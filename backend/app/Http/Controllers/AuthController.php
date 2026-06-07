<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    private const WORKDAY_LIMIT_MINUTES = 8 * 60;

    private function closeOpenAttendanceSession($user): void
    {
        $open = AttendanceLog::where('user_id', $user->id)
            ->whereNull('clock_out_at')
            ->orderByDesc('clock_in_at')
            ->first();

        if (!$open) {
            return;
        }

        $closeAt = $open->last_heartbeat_at ?? $open->clock_in_at;
        $limitAt = $open->clock_in_at->copy()->addMinutes(self::WORKDAY_LIMIT_MINUTES);
        $effectiveClose = $closeAt->copy()->min($limitAt);

        if ($effectiveClose->lt($open->clock_in_at)) {
            $effectiveClose = $open->clock_in_at->copy();
        }

        $open->clock_out_at = $effectiveClose;
        $open->minutes_worked = min(
            self::WORKDAY_LIMIT_MINUTES,
            max(0, (int) $open->clock_in_at->diffInMinutes($effectiveClose))
        );
        $open->save();
    }

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
        $this->closeOpenAttendanceSession($user);

        // Record login time. Attendance sessions start only after the user
        // explicitly confirms "start work" from the dashboard.
        $user->last_login_at = now();
        $user->save();

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $user->toApiArray(),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        // Close any open attendance session at its last heartbeat (not "now") so
        // we don't count idle/post-activity time. The heartbeat stitcher would
        // eventually close this anyway, but doing it here keeps reports clean
        // when the user explicitly signs out.
        $this->closeOpenAttendanceSession($user);

        $user->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()->toApiArray());
    }
}
