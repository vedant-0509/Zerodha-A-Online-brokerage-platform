param(
  [string]$BaseUrl = "http://127.0.0.1:3021",
  [int]$Limit = 100
)

Write-Host "Testing Detail Stock financial coverage..." -ForegroundColor Cyan

try {
  $stocks = Invoke-RestMethod "$BaseUrl/api/detail-stock/market-stocks"
} catch {
  Write-Host "Cannot load market stocks: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$items = @($stocks.data)
if ($Limit -gt 0) { $items = $items | Select-Object -First $Limit }

$ok = 0
$empty = 0
$failed = 0
$examples = @()

foreach ($stock in $items) {
  $symbol = [string]($stock.symbol)
  if ([string]::IsNullOrWhiteSpace($symbol)) { continue }

  try {
    $result = Invoke-RestMethod "$BaseUrl/api/detail-stock/financial-performance/$([uri]::EscapeDataString($symbol))" -TimeoutSec 20
    $rows = @()
    if ($result.data -is [array]) { $rows = @($result.data) }
    elseif ($result.financialRows) { $rows = @($result.financialRows) }
    elseif ($result.incomeStatement) { $rows = @($result.incomeStatement) }

    if ($rows.Count -gt 0) {
      $ok++
    } else {
      $empty++
      if ($examples.Count -lt 10) { $examples += $symbol }
    }
  } catch {
    $failed++
    if ($examples.Count -lt 10) { $examples += "$symbol (HTTP error)" }
  }
}

Write-Host ""
Write-Host "Checked: $($items.Count)" -ForegroundColor White
Write-Host "Financial data available: $ok" -ForegroundColor Green
Write-Host "Empty: $empty" -ForegroundColor Yellow
Write-Host "Failed: $failed" -ForegroundColor Red

if ($examples.Count) {
  Write-Host "Examples needing inspection:" -ForegroundColor Yellow
  $examples | ForEach-Object { Write-Host " - $_" }
}
