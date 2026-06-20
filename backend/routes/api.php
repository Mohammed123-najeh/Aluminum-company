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
use App\Http\Controllers\AttendanceHeartbeatController;
use App\Http\Controllers\HrAnalyticsController;
use App\Http\Controllers\LeaveRequestController;
use App\Http\Controllers\ReceiptPaymentAnalyticsController;
use App\Http\Controllers\SalaryIncreaseRequestController;
use App\Http\Controllers\SalesTaskFulfillmentController;
use App\Http\Controllers\AccountantFinanceController;
use App\Http\Controllers\AdminSubmissionController;
use App\Http\Controllers\AdminApprovalsController;
use App\Http\Controllers\EmployeeDebitRequestController;
use App\Http\Controllers\FinanceCenterController;
use App\Http\Controllers\FinanceReportsController;
use App\Http\Controllers\HrCenterController;
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
    Route::get('/messages/contacts', [MessageController::class, 'contacts']);
    Route::post('/messages', [MessageController::class, 'store']);

    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::post('/tasks/{task}/attachments', [TaskController::class, 'storeAttachment']);
    Route::delete('/tasks/{task}/attachments/{attachment}', [TaskController::class, 'destroyAttachment']);
    Route::patch('/tasks/{task}', [TaskController::class, 'update']);
    Route::post('/tasks/{task}/cancel', [TaskController::class, 'cancel']);
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
    Route::post('/orders/{order}/cancel', [OrderController::class, 'cancel']);
    Route::post('/orders/{order}/uncancel', [OrderController::class, 'uncancel']);

    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);
    Route::patch('/users/{user}/toggle-status', [UserController::class, 'toggleStatus']);
    Route::patch('/users/{user}/assign-supervisor', [UserController::class, 'assignSupervisor']);

    Route::get('/attendance', [AttendanceController::class, 'index']);
    Route::get('/attendance/summary', [AttendanceController::class, 'summary']);
    Route::post('/attendance/heartbeat', [AttendanceHeartbeatController::class, 'ping']);
    Route::get('/attendance/today', [AttendanceHeartbeatController::class, 'today']);

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

    // ===== Finance Center (accountant + admin) =====
    Route::get('/finance/dashboard', [FinanceCenterController::class, 'dashboard']);

    Route::get('/finance/suppliers', [FinanceCenterController::class, 'listSuppliers']);
    Route::post('/finance/suppliers', [FinanceCenterController::class, 'storeSupplier']);
    Route::patch('/finance/suppliers/{id}', [FinanceCenterController::class, 'updateSupplier']);
    Route::delete('/finance/suppliers/{id}', [FinanceCenterController::class, 'deleteSupplier']);

    Route::get('/finance/transactions', [FinanceCenterController::class, 'listTransactions']);
    Route::post('/finance/transactions', [FinanceCenterController::class, 'storeTransaction']);
    Route::patch('/finance/transactions/{id}', [FinanceCenterController::class, 'updateTransaction']);
    Route::delete('/finance/transactions/{id}', [FinanceCenterController::class, 'deleteTransaction']);

    Route::get('/finance/expense-categories', [FinanceCenterController::class, 'listExpenseCategories']);
    Route::post('/finance/expense-categories', [FinanceCenterController::class, 'storeExpenseCategory']);
    Route::patch('/finance/expense-categories/{id}', [FinanceCenterController::class, 'updateExpenseCategory']);
    Route::delete('/finance/expense-categories/{id}', [FinanceCenterController::class, 'deleteExpenseCategory']);

    Route::get('/finance/expenses', [FinanceCenterController::class, 'listExpenses']);
    Route::post('/finance/expenses', [FinanceCenterController::class, 'storeExpense']);
    Route::patch('/finance/expenses/{id}/decide', [FinanceCenterController::class, 'decideExpense']);
    Route::patch('/finance/expenses/{id}', [FinanceCenterController::class, 'updateExpense']);
    Route::delete('/finance/expenses/{id}', [FinanceCenterController::class, 'deleteExpense']);

    Route::get('/finance/customer-invoices', [FinanceCenterController::class, 'listCustomerInvoices']);
    Route::get('/finance/customer-invoices/{id}', [FinanceCenterController::class, 'showCustomerInvoice']);
    Route::post('/finance/customer-invoices', [FinanceCenterController::class, 'storeCustomerInvoice']);
    Route::patch('/finance/customer-invoices/{id}', [FinanceCenterController::class, 'updateCustomerInvoice']);
    Route::delete('/finance/customer-invoices/{id}', [FinanceCenterController::class, 'deleteCustomerInvoice']);

    Route::get('/finance/supplier-invoices', [FinanceCenterController::class, 'listSupplierInvoices']);
    Route::post('/finance/supplier-invoices', [FinanceCenterController::class, 'storeSupplierInvoice']);
    Route::patch('/finance/supplier-invoices/{id}/decide', [FinanceCenterController::class, 'decideSupplierInvoice']);
    Route::delete('/finance/supplier-invoices/{id}', [FinanceCenterController::class, 'deleteSupplierInvoice']);

    Route::get('/finance/receipt-vouchers', [FinanceCenterController::class, 'listReceiptVouchers']);
    Route::post('/finance/receipt-vouchers', [FinanceCenterController::class, 'storeReceiptVoucher']);

    // Order-payment receipts — every OrderPayment surfaced as a printable
    // receipt voucher inside the Invoices panel.
    Route::get('/finance/order-payment-receipts', [FinanceCenterController::class, 'listOrderPaymentReceipts']);

    Route::get('/finance/payment-vouchers', [FinanceCenterController::class, 'listPaymentVouchers']);
    Route::post('/finance/payment-vouchers', [FinanceCenterController::class, 'storePaymentVoucher']);

    Route::get('/finance/aging', [FinanceCenterController::class, 'aging']);
    Route::get('/finance/advances', [FinanceCenterController::class, 'advances']);

    Route::get('/finance/reports/pnl', [FinanceCenterController::class, 'reportPnl']);
    Route::get('/finance/reports/expense-breakdown', [FinanceCenterController::class, 'reportExpenseBreakdown']);
    Route::get('/finance/reports/download/{kind}', [FinanceReportsController::class, 'download']);

    Route::get('/finance/settings/work-schedule', [FinanceCenterController::class, 'workScheduleSettings']);
    Route::patch('/finance/settings/work-schedule', [FinanceCenterController::class, 'updateWorkScheduleSettings']);

    // ===== HR Center (hr + admin) =====
    Route::get('/hr-center/dashboard', [HrCenterController::class, 'dashboard']);

    Route::get('/hr-center/employees', [HrCenterController::class, 'listEmployees']);
    Route::get('/hr-center/employees/{id}', [HrCenterController::class, 'showEmployee']);
    Route::post('/hr-center/employees', [HrCenterController::class, 'storeEmployee']);
    Route::patch('/hr-center/employees/{id}', [HrCenterController::class, 'updateEmployee']);

    Route::get('/hr-center/employees/{userId}/documents', [HrCenterController::class, 'listDocuments']);
    Route::post('/hr-center/employees/{userId}/documents', [HrCenterController::class, 'storeDocument']);
    Route::delete('/hr-center/documents/{id}', [HrCenterController::class, 'deleteDocument']);

    Route::get('/hr-center/attendance/daily', [HrCenterController::class, 'attendanceDaily']);
    Route::get('/hr-center/attendance/monthly', [HrCenterController::class, 'attendanceMonthly']);
    Route::post('/hr-center/attendance/manual', [HrCenterController::class, 'attendanceManual']);
    Route::patch('/hr-center/attendance/{id}', [HrCenterController::class, 'attendanceUpdate']);
    Route::patch('/hr-center/attendance/{id}/justify', [HrCenterController::class, 'justifyAttendance']);

    Route::get('/hr-center/holidays', [HrCenterController::class, 'listHolidays']);
    Route::post('/hr-center/holidays', [HrCenterController::class, 'storeHoliday']);
    Route::delete('/hr-center/holidays/{id}', [HrCenterController::class, 'deleteHoliday']);

    Route::get('/hr-center/payroll/runs', [HrCenterController::class, 'listPayrollRuns']);
    Route::get('/hr-center/payroll/runs/{id}', [HrCenterController::class, 'showPayrollRun']);
    Route::post('/hr-center/payroll/compute', [HrCenterController::class, 'computePayrollRun']);
    Route::patch('/hr-center/payroll/payslips/{id}', [HrCenterController::class, 'updatePayslip']);
    Route::post('/hr-center/payroll/runs/{id}/approve', [HrCenterController::class, 'approvePayrollRun']);
    Route::post('/hr-center/payroll/payslips/{id}/pay', [HrCenterController::class, 'payPayslip']);

    Route::get('/hr-center/increments', [HrCenterController::class, 'listIncrements']);
    Route::post('/hr-center/increments', [HrCenterController::class, 'storeIncrement']);

    Route::get('/hr-center/leave/balances', [HrCenterController::class, 'leaveBalances']);
    Route::patch('/hr-center/leave/balances/{userId}', [HrCenterController::class, 'adjustLeaveBalance']);

    Route::get('/hr-center/reports/absence-tardiness', [HrCenterController::class, 'reportAbsenceTardiness']);
    Route::get('/hr-center/reports/payroll', [HrCenterController::class, 'reportPayroll']);

    Route::get('/hr-center/settings/work-schedule', [HrCenterController::class, 'workScheduleSettings']);
    Route::patch('/hr-center/settings/work-schedule', [HrCenterController::class, 'updateWorkScheduleSettings']);
});
