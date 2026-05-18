<?php

use App\Http\Controllers\AiController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\MyEmployeesController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\StorehouseController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AdminAnalyticsController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\HrAnalyticsController;
use App\Http\Controllers\LeaveRequestController;
use App\Http\Controllers\ReceiptPaymentAnalyticsController;
use App\Http\Controllers\SalaryIncreaseRequestController;
use App\Http\Controllers\SalesTaskFulfillmentController;
use App\Http\Controllers\AccountantFinanceController;
use App\Http\Controllers\AdminSubmissionController;
use App\Http\Controllers\AdminApprovalsController;
use App\Http\Controllers\EmployeeDebitRequestController;
use Illuminate\Support\Facades\Route;

// Public login is registered in bootstrap/app.php (then) as POST /api/login.

// Protected (requires Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    Route::get('/my-employees', [MyEmployeesController::class, 'index']);

    Route::get('/messages', [MessageController::class, 'index']);
    Route::post('/messages', [MessageController::class, 'store']);

    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::post('/tasks/{task}/attachments', [TaskController::class, 'storeAttachment']);
    Route::delete('/tasks/{task}/attachments/{attachment}', [TaskController::class, 'destroyAttachment']);
    Route::patch('/tasks/{task}', [TaskController::class, 'update']);
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy']);

    Route::get('/storehouse/categories', [StorehouseController::class, 'categories']);
    Route::get('/storehouse/profiles', [StorehouseController::class, 'profiles']);
    Route::patch('/storehouse/profiles/{profile}', [StorehouseController::class, 'updateProfile']);
    Route::get('/storehouse/colors', [StorehouseController::class, 'colors']);
    Route::get('/storehouse/inventory', [StorehouseController::class, 'inventory']);
    Route::post('/storehouse/inventory', [StorehouseController::class, 'storeInventory']);
    Route::patch('/storehouse/inventory/{inventory}', [StorehouseController::class, 'updateInventory']);
    Route::delete('/storehouse/inventory/{inventory}', [StorehouseController::class, 'destroyInventory']);

    Route::get('/clients', [ClientController::class, 'index']);
    Route::post('/clients', [ClientController::class, 'store']);
    Route::get('/clients/{client}', [ClientController::class, 'show']);
    Route::patch('/clients/{client}', [ClientController::class, 'update']);
    Route::delete('/clients/{client}', [ClientController::class, 'destroy']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::put('/orders/{order}', [OrderController::class, 'update']);
    Route::patch('/orders/{order}/payment', [OrderController::class, 'updatePayment']);
    Route::get('/orders/{order}/payments', [OrderController::class, 'listPayments']);
    Route::post('/orders/{order}/payments', [OrderController::class, 'addPayment']);
    Route::patch('/orders/{order}/receipt-meta', [OrderController::class, 'updateReceiptMeta']);

    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);
    Route::patch('/users/{user}/toggle-status', [UserController::class, 'toggleStatus']);
    Route::patch('/users/{user}/assign-supervisor', [UserController::class, 'assignSupervisor']);

    Route::get('/attendance', [AttendanceController::class, 'index']);
    Route::get('/attendance/summary', [AttendanceController::class, 'summary']);

    Route::get('/admin/analytics', [AdminAnalyticsController::class, 'index']);
    Route::get('/receipt-payment-analytics', [ReceiptPaymentAnalyticsController::class, 'index']);

    Route::get('/accountant/cash-flow', [AccountantFinanceController::class, 'cashFlow']);
    Route::get('/accountant/overview', [AccountantFinanceController::class, 'overview']);
    Route::get('/accountant/aging', [AccountantFinanceController::class, 'aging']);
    Route::get('/accountant/trend', [AccountantFinanceController::class, 'trend']);
    Route::get('/accountant/debits', [AccountantFinanceController::class, 'debits']);
    Route::get('/accountant/clients', [AccountantFinanceController::class, 'clients']);
    Route::post('/accountant/clients', [AccountantFinanceController::class, 'storeClient']);
    Route::patch('/accountant/clients/{client}', [AccountantFinanceController::class, 'updateClient']);
    Route::post('/accountant/manual-receipts', [AccountantFinanceController::class, 'manualReceipt']);
    Route::get('/accountant/receipt-report.pdf', [AccountantFinanceController::class, 'receiptReportPdf']);
    Route::post('/accountant/publish-report', [AccountantFinanceController::class, 'publishReport']);

    Route::get('/admin/approvals/summary', [AdminApprovalsController::class, 'summary']);
    Route::get('/admin/submissions', [AdminSubmissionController::class, 'index']);
    Route::patch('/admin/submissions/{adminSubmission}/decide', [AdminSubmissionController::class, 'decide']);
    Route::get('/my-submissions', [AdminSubmissionController::class, 'mine']);
    Route::post('/submissions', [AdminSubmissionController::class, 'store']);
    Route::get('/submissions/{adminSubmission}/attachment', [AdminSubmissionController::class, 'download']);

    Route::get('/hr/analytics', [HrAnalyticsController::class, 'index']);
    Route::get('/hr/users/{user}/hr-detail', [HrAnalyticsController::class, 'employeeDetail']);

    Route::get('/leave-requests/mine', [LeaveRequestController::class, 'mine']);
    Route::get('/leave-requests', [LeaveRequestController::class, 'indexHr']);
    Route::get('/leave-requests/supervisor-queue', [LeaveRequestController::class, 'indexSupervisor']);
    Route::post('/leave-requests', [LeaveRequestController::class, 'store']);
    Route::patch('/leave-requests/{leaveRequest}/supervisor-decide', [LeaveRequestController::class, 'supervisorDecide']);
    Route::patch('/leave-requests/{leaveRequest}/decide', [LeaveRequestController::class, 'decide']);
    Route::patch('/leave-requests/{leaveRequest}/cancel', [LeaveRequestController::class, 'cancel']);

    Route::get('/salary-requests/mine', [SalaryIncreaseRequestController::class, 'mine']);
    Route::get('/salary-requests', [SalaryIncreaseRequestController::class, 'indexHr']);
    Route::post('/salary-requests', [SalaryIncreaseRequestController::class, 'store']);
    Route::patch('/salary-requests/{salaryIncreaseRequest}/decide', [SalaryIncreaseRequestController::class, 'decide']);
    Route::patch('/salary-requests/{salaryIncreaseRequest}/cancel', [SalaryIncreaseRequestController::class, 'cancel']);

    Route::get('/debit-requests/mine', [EmployeeDebitRequestController::class, 'mine']);
    Route::get('/debit-requests', [EmployeeDebitRequestController::class, 'index']);
    Route::post('/debit-requests', [EmployeeDebitRequestController::class, 'store']);
    Route::patch('/debit-requests/{debitRequest}/decide', [EmployeeDebitRequestController::class, 'decide']);
    Route::patch('/debit-requests/{debitRequest}/cancel', [EmployeeDebitRequestController::class, 'cancel']);

    Route::get('/sales/inventory-offers', [SalesTaskFulfillmentController::class, 'inventoryOffers']);
    Route::post('/sales/fulfill-task', [SalesTaskFulfillmentController::class, 'fulfill']);

    Route::post('/ai/task-text', [AiController::class, 'taskText'])->middleware('throttle:20,1');

    Route::get('/ai/conversations', [AiController::class, 'conversations']);
    Route::get('/ai/conversations/{conversation}/messages', [AiController::class, 'messages']);
    Route::post('/ai/conversations/{conversation}/share', [AiController::class, 'shareConversation'])->middleware('throttle:30,1');
    Route::post('/ai/conversations/import-shared', [AiController::class, 'importShared'])->middleware('throttle:20,1');
    Route::delete('/ai/conversations/{conversation}', [AiController::class, 'deleteConversation']);
    Route::get('/ai/shared/{token}', [AiController::class, 'sharedConversation'])->where('token', '[0-9a-fA-F\-]{36}');
    Route::post('/ai/chat', [AiController::class, 'chat'])->middleware('throttle:30,1');
    Route::post('/ai/summarize-today', [AiController::class, 'summarizeToday'])->middleware('throttle:15,1');
});
