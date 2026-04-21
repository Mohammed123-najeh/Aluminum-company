<?php

namespace App\Services;

use App\Models\AdminSubmission;
use App\Models\LeaveRequest;
use App\Models\Message;
use App\Models\SalaryIncreaseRequest;
use App\Models\Task;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Str;

class InAppNotifier
{
    public static function messageReceived(User $receiver, Message $message): void
    {
        $message->loadMissing('sender:id,name');
        $sender = $message->sender;
        $name = $sender?->name ?? 'Someone';
        $preview = Str::limit(strip_tags($message->body), 120);

        UserNotification::create([
            'user_id' => $receiver->id,
            'type' => UserNotification::TYPE_MESSAGE,
            'title' => 'New message from '.$name,
            'body' => $preview,
            'data' => [
                'messageId' => (string) $message->id,
                'peerId' => (string) $message->sender_id,
            ],
        ]);
    }

    public static function taskAssigned(User $assignee, Task $task, string $supervisorName): void
    {
        UserNotification::create([
            'user_id' => $assignee->id,
            'type' => UserNotification::TYPE_TASK_ASSIGNED,
            'title' => 'New task assigned to you',
            'body' => $task->title,
            'data' => [
                'taskId' => (string) $task->id,
                'supervisorName' => $supervisorName,
            ],
        ]);
    }

    /** Employee changed task status — notify owning supervisor. */
    public static function taskStatusForSupervisor(User $supervisor, Task $task, User $employee, string $newStatus): void
    {
        UserNotification::create([
            'user_id' => $supervisor->id,
            'type' => UserNotification::TYPE_TASK_STATUS,
            'title' => 'Task status updated',
            'body' => $employee->name.' marked “'.$task->title.'” as '.$newStatus,
            'data' => [
                'taskId' => (string) $task->id,
                'employeeId' => (string) $employee->id,
                'status' => $newStatus,
            ],
        ]);
    }

    public static function welcomeNewUser(User $user): void
    {
        UserNotification::create([
            'user_id' => $user->id,
            'type' => UserNotification::TYPE_WELCOME,
            'title' => 'Welcome',
            'body' => 'Your account is ready. Sign in anytime with your email and password.',
            'data' => [],
        ]);
    }

    public static function leaveRequestSubmitted(LeaveRequest $leave): void
    {
        $leave->loadMissing('user:id,name');
        $name = $leave->user?->name ?? 'Employee';
        $typeLabel = $leave->type === 'holiday' ? 'Annual leave' : 'Sick leave';
        foreach (User::hrRecipients()->get() as $hr) {
            UserNotification::create([
                'user_id' => $hr->id,
                'type' => UserNotification::TYPE_HR_LEAVE_PENDING,
                'title' => 'New '.$typeLabel.' request',
                'body' => $name.' requested '.$leave->days_count.' day(s).',
                'data' => [
                    'leaveRequestId' => (string) $leave->id,
                    'employeeId' => (string) $leave->user_id,
                ],
            ]);
        }
    }

    public static function leaveRequestDecided(User $employee, LeaveRequest $leave): void
    {
        UserNotification::create([
            'user_id' => $employee->id,
            'type' => UserNotification::TYPE_HR_LEAVE_DECIDED,
            'title' => 'Leave request '.$leave->status,
            'body' => 'Your '.$leave->type.' leave ('.$leave->days_count.' day(s)) was '.$leave->status.'.',
            'data' => [
                'leaveRequestId' => (string) $leave->id,
            ],
        ]);
    }

    public static function salaryRequestSubmitted(SalaryIncreaseRequest $row): void
    {
        $row->loadMissing('user:id,name');
        $name = $row->user?->name ?? 'Employee';
        foreach (User::adminRecipients()->get() as $admin) {
            UserNotification::create([
                'user_id' => $admin->id,
                'type' => UserNotification::TYPE_ADMIN_SALARY_PENDING,
                'title' => 'Salary approval needed',
                'body' => $name.' submitted a salary review request.',
                'data' => [
                    'salaryRequestId' => (string) $row->id,
                    'employeeId' => (string) $row->user_id,
                ],
            ]);
        }
        foreach (User::hrRecipients()->get() as $hr) {
            UserNotification::create([
                'user_id' => $hr->id,
                'type' => UserNotification::TYPE_HR_SALARY_PENDING,
                'title' => 'Salary request (admin approval)',
                'body' => $name.' submitted a salary request — awaiting administrator.',
                'data' => [
                    'salaryRequestId' => (string) $row->id,
                    'employeeId' => (string) $row->user_id,
                ],
            ]);
        }
    }

    public static function adminSubmissionPending(AdminSubmission $row): void
    {
        $row->loadMissing('submitter:id,name');
        $name = $row->submitter?->name ?? 'Staff';
        foreach (User::adminRecipients()->get() as $admin) {
            UserNotification::create([
                'user_id' => $admin->id,
                'type' => UserNotification::TYPE_ADMIN_SUBMISSION_PENDING,
                'title' => 'New submission: '.$row->title,
                'body' => $name.' submitted an item for review.',
                'data' => [
                    'submissionId' => (string) $row->id,
                    'submissionType' => $row->type,
                ],
            ]);
        }
    }

    public static function adminSubmissionDecided(User $submitter, AdminSubmission $row): void
    {
        UserNotification::create([
            'user_id' => $submitter->id,
            'type' => UserNotification::TYPE_ADMIN_SUBMISSION_DECIDED,
            'title' => 'Submission '.$row->status,
            'body' => 'Your submission “'.$row->title.'” was '.$row->status.'.',
            'data' => [
                'submissionId' => (string) $row->id,
            ],
        ]);
    }

    public static function salaryRequestDecided(User $employee, SalaryIncreaseRequest $row): void
    {
        UserNotification::create([
            'user_id' => $employee->id,
            'type' => UserNotification::TYPE_HR_SALARY_DECIDED,
            'title' => 'Salary request '.$row->status,
            'body' => 'Your salary review was '.$row->status.'.',
            'data' => [
                'salaryRequestId' => (string) $row->id,
            ],
        ]);
    }
}
