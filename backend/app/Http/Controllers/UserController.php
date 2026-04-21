<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\InAppNotifier;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(
            User::orderBy('created_at')->get()->map(fn($u) => $u->toApiArray())
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'                  => 'required|string|max:255',
            'email'                 => 'required|email|unique:users,email',
            'password'              => 'required|string|min:8',
            'role'                  => 'required|in:supervisor,employee',
            'employee_type'       => 'nullable|in:accountant,sales,hr',
            'main_job'            => 'nullable|string|max:255',
            'supervisor_id'       => 'nullable|exists:users,id',
            'base_salary'         => 'nullable|numeric|min:0',
            'annual_leave_balance'=> 'nullable|numeric|min:0',
        ]);

        $user = User::create([
            'name'                  => $data['name'],
            'email'                 => $data['email'],
            'password'              => $data['password'],
            'role'                  => $data['role'],
            'employee_type'         => $data['employee_type'] ?? null,
            'main_job'              => $data['main_job'] ?? null,
            'supervisor_id'         => $data['supervisor_id'] ?? null,
            'base_salary'           => $data['base_salary']         ?? null,
            'annual_leave_balance'  => $data['annual_leave_balance'] ?? 0,
            'status'                => 'active',
        ]);

        InAppNotifier::welcomeNewUser($user->fresh());

        return response()->json($user->toApiArray(), 201);
    }

    public function update(Request $request, User $user)
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Cannot modify admin'], 403);
        }

        $me = $request->user();

        // HR staff: compensation only, any non-admin account
        if ($me->isHrStaff()) {
            $data = $request->validate([
                'base_salary'           => 'sometimes|nullable|numeric|min:0',
                'annual_leave_balance'  => 'sometimes|nullable|numeric|min:0',
            ]);
            if ($data === []) {
                return response()->json(['message' => 'Provide base_salary and/or annual_leave_balance'], 422);
            }
            $user->update($data);

            return response()->json($user->fresh()->toApiArray());
        }

        if ($me->role !== 'admin') {
            if ($me->role === 'supervisor' && $user->id != $me->id && $user->supervisor_id != $me->id) {
                return response()->json(['message' => 'You can only update your own employees or your own profile'], 403);
            }
            if ($me->role === 'employee' && $user->id != $me->id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $data = $request->validate([
            'name'                  => 'sometimes|string|max:255',
            'email'                 => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'role'                  => 'sometimes|in:supervisor,employee',
            'employee_type'         => 'nullable|in:accountant,sales,hr',
            'main_job'              => 'nullable|string|max:255',
            'supervisor_id'         => 'nullable|exists:users,id',
            'status'                => 'sometimes|in:active,suspended',
            'base_salary'           => 'nullable|numeric|min:0',
            'annual_leave_balance'  => 'nullable|numeric|min:0',
        ]);

        if (isset($data['base_salary']) || isset($data['annual_leave_balance'])) {
            if ($me->role !== 'admin') {
                return response()->json(['message' => 'You cannot update compensation fields'], 403);
            }
        }

        $user->update($data);

        return response()->json($user->fresh()->toApiArray());
    }

    public function destroy(User $user)
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Cannot delete admin'], 403);
        }

        // Unassign any employees reporting to this supervisor
        if ($user->role === 'supervisor') {
            User::where('supervisor_id', $user->id)->update(['supervisor_id' => null]);
        }

        $user->delete();

        return response()->json(null, 204);
    }

    public function toggleStatus(Request $request, User $user)
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Cannot modify admin'], 403);
        }

        $me = $request->user();
        if ($me->role === 'supervisor' && $user->supervisor_id != $me->id) {
            return response()->json(['message' => 'You can only change status of your own employees'], 403);
        }

        $user->status = $user->status === 'active' ? 'suspended' : 'active';
        $user->save();

        return response()->json($user->toApiArray());
    }

    public function assignSupervisor(Request $request, User $user)
    {
        $data = $request->validate([
            'supervisor_id' => 'nullable|exists:users,id',
        ]);

        $user->supervisor_id = $data['supervisor_id'] ?? null;
        $user->save();

        return response()->json($user->toApiArray());
    }
}
