<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if ($user->status === 'suspended') {
            return response()->json(['message' => 'Account is suspended'], 403);
        }

        // Revoke all existing tokens for this user
        $user->tokens()->delete();

        // Close any open attendance shift (e.g. previous session that never logged out)
        AttendanceLog::where('user_id', $user->id)
            ->whereNull('clock_out_at')
            ->get()
            ->each(function (AttendanceLog $log) {
                $log->clock_out_at = now();
                $log->minutes_worked = max(0, (int) $log->clock_in_at->diffInMinutes(now()));
                $log->save();
            });

        // Record login time
        $user->last_login_at = now();
        $user->save();

        // Open a new attendance shift
        AttendanceLog::create([
            'user_id' => $user->id,
            'clock_in_at' => now(),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $user->toApiArray(),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        // Close the open attendance shift (if any)
        $open = AttendanceLog::where('user_id', $user->id)
            ->whereNull('clock_out_at')
            ->orderByDesc('clock_in_at')
            ->first();
        if ($open) {
            $open->clock_out_at = now();
            $open->minutes_worked = max(0, (int) $open->clock_in_at->diffInMinutes(now()));
            $open->save();
        }

        $user->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()->toApiArray());
    }
}
