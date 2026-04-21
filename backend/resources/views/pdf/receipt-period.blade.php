<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Receipt & payment report</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        .meta { font-size: 10px; color: #444; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; }
        .nums { text-align: right; }
        .section { margin-top: 18px; }
    </style>
</head>
<body>
    <h1>Receipt &amp; payment report</h1>
    <div class="meta">
        Period: {{ $period }}<br>
        Range: {{ $from->format('Y-m-d H:i') }} — {{ $to->format('Y-m-d H:i') }}<br>
        Generated: {{ now()->format('Y-m-d H:i') }}
    </div>

    <table>
        <tr>
            <th>Metric</th>
            <th class="nums">Value</th>
        </tr>
        <tr><td>Receipts (count)</td><td class="nums">{{ $totals['count'] ?? 0 }}</td></tr>
        <tr><td>Total billed</td><td class="nums">{{ number_format($totals['totalBilled'] ?? 0, 2) }}</td></tr>
        <tr><td>Total paid</td><td class="nums">{{ number_format($totals['totalPaid'] ?? 0, 2) }}</td></tr>
        <tr><td>Outstanding</td><td class="nums">{{ number_format($totals['totalOutstanding'] ?? 0, 2) }}</td></tr>
    </table>

    <div class="section">
        <strong>Payment status (receipt count)</strong>
        <table>
            <tr><th>Status</th><th class="nums">Count</th></tr>
            @foreach($byPaymentStatus as $k => $v)
                <tr><td>{{ $k }}</td><td class="nums">{{ $v }}</td></tr>
            @endforeach
        </table>
    </div>

    <div class="section">
        <strong>Overdue</strong>
        <p>Open balance past due date: {{ $overdueCount }} receipts, {{ number_format($overdueOutstanding, 2) }} outstanding.</p>
    </div>

    <div class="section">
        <strong>Top customers by outstanding</strong>
        <table>
            <tr>
                <th>Customer</th>
                <th class="nums">Receipts</th>
                <th class="nums">Outstanding</th>
            </tr>
            @foreach($topOutstandingCustomers as $row)
                <tr>
                    <td>{{ $row['customerLabel'] }}</td>
                    <td class="nums">{{ $row['receiptCount'] }}</td>
                    <td class="nums">{{ number_format($row['outstanding'], 2) }}</td>
                </tr>
            @endforeach
        </table>
    </div>
</body>
</html>
