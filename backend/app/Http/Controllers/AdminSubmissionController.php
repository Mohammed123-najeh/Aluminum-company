<?php

namespace App\Http\Controllers;

use App\Models\AdminSubmission;
use App\Models\User;
use App\Services\InAppNotifier;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AdminSubmissionController extends Controller
{
    public function index(Request $request)
    {
        $me = $request->user();
        if ($me->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $q = AdminSubmission::query()->with(['submitter:id,name,email', 'decidedBy:id,name']);
        if ($request->query('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($request->query('type')) {
            $q->where('type', $request->query('type'));
        }

        $rows = $q->orderByDesc('created_at')->limit(500)->get();

        return response()->json($rows->map(fn ($r) => $r->toApiArray())->values()->all());
    }

    public function mine(Request $request)
    {
        $me = $request->user();
        $rows = AdminSubmission::query()
            ->where('submitted_by_id', $me->id)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        return response()->json($rows->map(fn ($r) => $r->toApiArray())->values()->all());
    }

    public function store(Request $request)
    {
        $me = $request->user();

        $data = $request->validate([
            'type' => 'required|in:'.implode(',', [
                AdminSubmission::TYPE_FINANCE_REPORT,
                AdminSubmission::TYPE_SUPERVISOR_NOTE,
                AdminSubmission::TYPE_HR_NOTE,
                AdminSubmission::TYPE_GENERAL,
            ]),
            'title' => 'required|string|max:255',
            'body' => 'nullable|string|max:8000',
            'attachment' => 'nullable|file|max:12288',
        ]);

        $this->assertCanCreateType($me, $data['type']);

        $disk = 'local';
        $path = null;
        if ($request->hasFile('attachment')) {
            $path = $request->file('attachment')->store('admin-submissions/'.date('Y/m'), $disk);
        }

        $submission = AdminSubmission::create([
            'submitted_by_id' => $me->id,
            'type' => $data['type'],
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'attachment_disk' => $path ? $disk : null,
            'attachment_path' => $path,
            'metadata' => null,
            'status' => 'pending',
        ]);

        InAppNotifier::adminSubmissionPending($submission->fresh(['submitter:id,name']));

        return response()->json($submission->fresh(['submitter:id,name,email'])->toApiArray(), 201);
    }

    public function decide(Request $request, AdminSubmission $adminSubmission)
    {
        $me = $request->user();
        if ($me->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'status' => 'required|in:approved,rejected',
            'decision_note' => 'nullable|string|max:4000',
        ]);

        if ($adminSubmission->status !== 'pending') {
            return response()->json(['message' => 'Submission is no longer pending'], 422);
        }

        return DB::transaction(function () use ($adminSubmission, $data, $me) {
            $adminSubmission->status = $data['status'];
            $adminSubmission->decided_by_id = $me->id;
            $adminSubmission->decided_at = now();
            $adminSubmission->decision_note = $data['decision_note'] ?? null;
            $adminSubmission->save();

            $submitter = $adminSubmission->submitter ?? User::find($adminSubmission->submitted_by_id);
            if ($submitter) {
                InAppNotifier::adminSubmissionDecided($submitter, $adminSubmission->fresh());
            }

            return response()->json($adminSubmission->fresh(['submitter:id,name,email', 'decidedBy:id,name'])->toApiArray());
        });
    }

    public function download(Request $request, AdminSubmission $adminSubmission)
    {
        $me = $request->user();
        if ($me->role !== 'admin' && (int) $adminSubmission->submitted_by_id !== (int) $me->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $adminSubmission->attachment_path || ! $adminSubmission->attachment_disk) {
            return response()->json(['message' => 'No attachment'], 404);
        }

        $disk = Storage::disk($adminSubmission->attachment_disk);
        if (! $disk->exists($adminSubmission->attachment_path)) {
            return response()->json(['message' => 'File missing'], 404);
        }

        return $disk->download($adminSubmission->attachment_path, 'submission-'.$adminSubmission->id.'-'.basename($adminSubmission->attachment_path));
    }

    private function assertCanCreateType(User $user, string $type): void
    {
        $ok = match ($type) {
            AdminSubmission::TYPE_FINANCE_REPORT => $user->role === 'admin' || $user->isAccountant(),
            AdminSubmission::TYPE_SUPERVISOR_NOTE => $user->role === 'supervisor' || $user->role === 'admin',
            AdminSubmission::TYPE_HR_NOTE => $user->isHrStaff() || $user->role === 'admin',
            AdminSubmission::TYPE_GENERAL => in_array($user->role, ['employee', 'supervisor', 'admin'], true),
            default => false,
        };

        if (! $ok) {
            throw new HttpResponseException(response()->json(['message' => 'Forbidden'], 403));
        }
    }
}
