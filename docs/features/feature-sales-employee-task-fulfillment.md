# Sales employee: task fulfillment from inventory & receipts

## Summary

Employees with **`employeeType === 'sales'`** can open a task, launch a **sales desk** modal to search live inventory, add quantities with **quick +1 m … +4 m** actions, and **issue a receipt**. The server **deducts stock**, creates or finalizes an **order** with **line pricing**, sets the order to **completed**, marks the **task completed**, and assigns a **receipt number**. A **recent receipts** list on the tasks page shows completed sales.

## Purpose

Supports a simple in-house sales workflow: quote from actual stock, reserve length in meters, print a receipt, and close the related task without manual stock adjustments elsewhere.

## User flows

1. Sales employee: **My tasks** → open task → **Fulfill from inventory & receipt** (replaces “Create order from task” for non-sales).
2. **Sales desk**: search catalog → add lines (+1 m…+4 m or manual qty) → optional customer reference → **Issue receipt & complete task**.
3. Success: **receipt** screen with print → inventory and task state updated on the server.
4. **Recent receipts**: expandable list of **completed** orders that have a **receipt number** (newest first).

## APIs (backend)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/sales/inventory-offers` | Employee, `employee_type = sales` |
| POST | `/api/sales/fulfill-task` | Employee, `employee_type = sales` |

**Fulfill body:** `task_id`, optional `customer_reference`, `items[]` with `inventory_id`, `quantity_m`.

**Pricing:** `unitPricePerM` is **deterministic** per inventory row (`crc32`-based) so list prices are stable for quoting and match server deduction.

**Data model:** `orders.total_amount`, `currency`, `receipt_number`; `order_items.unit_price_per_m`, `line_total`.

## Frontend

- `SalesTaskFulfillmentModal`, `EmployeeSalesReceipts`
- `EmployeeTaskDetailPanel` + `EmployeeTasks` + `EmployeePage` (`currentUser` for sales detection)

## Design decisions

- **Sales-only APIs** — avoids exposing fulfillment to other employee types.
- **One transaction** — stock, order lines, order completion, and task completion stay consistent; validation errors use `HttpResponseException` so the transaction rolls back.
- **Draft orders** — If the task already has a **draft** linked order, fulfillment **replaces** line items and then completes (same endpoint).

## Limitations

- List price is algorithmic, not from a separate price list table.
- Print uses the browser **Print** dialog; dedicated PDF export can be added later.
