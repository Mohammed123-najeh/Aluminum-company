<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{ $title }}</title>
  <style>
    body { font-family: DejaVu Sans, sans-serif; color: #1e293b; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; color: #4f46e5; }
    .period { font-size: 11px; color: #64748b; margin-bottom: 16px; }
    .section { margin-top: 18px; }
    h2 { font-size: 13px; margin: 0 0 8px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; background: #f1f5f9; padding: 6px 8px; font-weight: 600; color: #475569; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
    .footer { margin-top: 8px; text-align: right; font-weight: 700; color: #4f46e5; }
    .summary { display: table; width: 100%; }
    .summary div { display: table-row; }
    .summary span { display: table-cell; padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
    .summary span:last-child { text-align: right; font-weight: 700; }
    .meta { font-size: 10px; color: #94a3b8; margin-top: 24px; }
  </style>
</head>
<body>
  <h1>{{ $title }}</h1>
  <p class="period">{{ $period }}</p>

  @foreach ($sections as $sec)
    <div class="section">
      <h2>{{ $sec['heading'] }}</h2>
      @if (! empty($sec['tableHeaders']))
        <table>
          <thead>
            <tr>
              @foreach ($sec['tableHeaders'] as $h)
                <th>{{ $h }}</th>
              @endforeach
            </tr>
          </thead>
          <tbody>
            @foreach ($sec['tableRows'] ?? [] as $row)
              <tr>
                @foreach ($row as $cell)
                  <td>{{ $cell }}</td>
                @endforeach
              </tr>
            @endforeach
          </tbody>
        </table>
      @elseif (! empty($sec['rows']))
        <div class="summary">
          @foreach ($sec['rows'] as $row)
            <div>
              <span>{{ $row[0] }}</span>
              <span>{{ $row[1] }}</span>
            </div>
          @endforeach
        </div>
      @endif
      @if (! empty($sec['footer']))
        <p class="footer">{{ $sec['footer'] }}</p>
      @endif
    </div>
  @endforeach

  <p class="meta">Generated {{ now()->toDateTimeString() }}</p>
</body>
</html>
