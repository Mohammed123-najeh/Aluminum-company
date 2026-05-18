<?php

namespace App\Http\Controllers;

use App\Mail\PasswordResetCodeMail;
use App\Models\PasswordResetCode;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class PasswordResetController extends Controller
{
    /** How long a code is valid for. */
    private const CODE_TTL_MINUTES = 15;

    /** Cap on verification attempts before the code is invalidated. */
    private const MAX_ATTEMPTS = 5;

    /**
     * POST /password/forgot
     * Body: { email }
     * Always responds with the same success payload to avoid leaking which emails exist.
     */
    public function forgot(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:255',
        ]);

        $email = strtolower(trim($data['email']));
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user && $user->status !== 'suspended') {
            // Invalidate any prior unconsumed codes for this address.
            PasswordResetCode::where('email', $email)
                ->whereNull('consumed_at')
                ->update(['consumed_at' => now()]);

            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            PasswordResetCode::create([
                'email' => $email,
                'code_hash' => Hash::make($code),
                'expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
                'ip_address' => $request->ip(),
            ]);

            try {
                Mail::to($user->email)->send(
                    new PasswordResetCodeMail($user->name, $code, self::CODE_TTL_MINUTES),
                );
            } catch (\Throwable $e) {
                // Log full error server-side; surface a generic message to the caller.
                Log::error('Failed to dispatch password reset email', [
                    'email' => $email,
                    'error' => $e->getMessage(),
                ]);

                return response()->json([
                    'message' => 'We could not send the reset email right now. Please try again shortly.',
                ], 502);
            }
        }

        return response()->json([
            'message' => 'If an account with that email exists, a 6-digit reset code is on its way.',
            'expiresInMinutes' => self::CODE_TTL_MINUTES,
        ]);
    }

    /**
     * POST /password/verify
     * Body: { email, code }
     * Just confirms whether the code is currently valid (does not consume it).
     * Useful to advance the UI from "enter code" to "set new password" without two-step UX confusion.
     */
    public function verify(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:255',
            'code' => 'required|string|size:6',
        ]);

        $record = $this->findActiveRecord($data['email']);
        if (! $record) {
            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        if (! Hash::check($data['code'], $record->code_hash)) {
            $this->bumpAttempts($record);

            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * POST /password/reset
     * Body: { email, code, password, password_confirmation }
     * Consumes the code and rotates the user's password.
     */
    public function reset(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:255',
            'code' => 'required|string|size:6',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $record = $this->findActiveRecord($data['email']);
        if (! $record) {
            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        if (! Hash::check($data['code'], $record->code_hash)) {
            $this->bumpAttempts($record);

            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        $email = strtolower(trim($data['email']));
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
        if (! $user || $user->status === 'suspended') {
            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        $user->password = $data['password']; // hashed cast on User model
        $user->save();

        $record->consumed_at = now();
        $record->save();

        // Revoke any active API tokens — force fresh login everywhere.
        $user->tokens()->delete();

        return response()->json(['message' => 'Password updated. You can now sign in with your new password.']);
    }

    private function findActiveRecord(string $email): ?PasswordResetCode
    {
        $normalized = strtolower(trim($email));

        $record = PasswordResetCode::where('email', $normalized)
            ->whereNull('consumed_at')
            ->orderByDesc('id')
            ->first();

        if (! $record) {
            return null;
        }

        if ($record->expires_at instanceof Carbon && $record->expires_at->isPast()) {
            return null;
        }

        if ($record->attempts >= self::MAX_ATTEMPTS) {
            return null;
        }

        return $record;
    }

    private function bumpAttempts(PasswordResetCode $record): void
    {
        $record->attempts = ($record->attempts ?? 0) + 1;
        if ($record->attempts >= self::MAX_ATTEMPTS) {
            $record->consumed_at = now();
        }
        $record->save();
    }
}
