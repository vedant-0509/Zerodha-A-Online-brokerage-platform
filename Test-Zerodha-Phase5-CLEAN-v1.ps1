param(
    [switch]$RunBackendTests,
    [switch]$RunFrontendBuild
)

$ErrorActionPreference = "Continue"
$ProjectRoot = (Get-Location).Path
$BackendRoot = Join-Path $ProjectRoot "backend"
$FrontendRoot = Join-Path $ProjectRoot "frontend"
$MFRoot = Join-Path $BackendRoot "mutualfunds"
$Migration = Join-Path $MFRoot "sql\008_phase5_mf_sync_monitoring.sql"
$TestFile = Join-Path $BackendRoot "tests\phase5-mutual-fund-sync.test.js"
$pass = 0; $fail = 0; $skip = 0

function Pass($name, $detail = "") { $script:pass++; Write-Host "[PASS] $name" -ForegroundColor Green; if ($detail) { Write-Host "       $detail" } }
function Fail($name, $detail = "") { $script:fail++; Write-Host "[FAIL] $name" -ForegroundColor Red; if ($detail) { Write-Host "       $detail" } }
function HasText($path, $pattern) { if (-not (Test-Path $path)) { return $false }; return $null -ne (Select-String -Path $path -Pattern $pattern -SimpleMatch -Quiet) }

Write-Host ""
Write-Host "ZERODHA PROJECT - PHASE 5 MUTUAL FUND TEST SUITE" -ForegroundColor Cyan
Write-Host "Project : $ProjectRoot"
Write-Host "Backend : http://localhost:3000"
Write-Host ""

if (Get-Command node -ErrorAction SilentlyContinue) { Pass "Node.js available" (& node --version) } else { Fail "Node.js available" }
if (Get-Command npm -ErrorAction SilentlyContinue) { Pass "npm available" (& npm --version) } else { Fail "npm available" }
if (Test-Path $BackendRoot) { Pass "backend folder exists" } else { Fail "backend folder exists" }
if (Test-Path $FrontendRoot) { Pass "frontend folder exists" } else { Fail "frontend folder exists" }

Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "PHASE 5 - Mutual Fund Synchronization Safety"
Write-Host "========================================================================" -ForegroundColor DarkGray

$files = @(
    (Join-Path $MFRoot "mfSyncScheduler.js"),
    (Join-Path $MFRoot "mfSyncService.js"),
    (Join-Path $MFRoot "mfSyncStatusService.js"),
    (Join-Path $MFRoot "mutualFundController.js"),
    (Join-Path $MFRoot "mutualFundRoutes.js"),
    $Migration,
    $TestFile
)
foreach ($file in $files) { if (Test-Path $file) { Pass "Required file exists" $file } else { Fail "Required file exists" $file } }

$scheduler = Join-Path $MFRoot "mfSyncScheduler.js"
$syncService = Join-Path $MFRoot "mfSyncService.js"
$routes = Join-Path $MFRoot "mutualFundRoutes.js"
$status = Join-Path $MFRoot "mfSyncStatusService.js"
$controller = Join-Path $MFRoot "mutualFundController.js"

if (HasText $scheduler "15 23 * * 1-5") { Pass "Daily NAV sync scheduled for 23:15" } else { Fail "Daily NAV sync scheduled for 23:15" }
if (HasText $scheduler "Asia/Kolkata") { Pass "Scheduler timezone is Asia/Kolkata" } else { Fail "Scheduler timezone is Asia/Kolkata" }
if (HasText $scheduler "MF_SYNC_STARTUP_RECOVERY") { Pass "Startup recovery is configurable" } else { Fail "Startup recovery is configurable" }
if (HasText $scheduler "hasTodaysSyncSucceeded(DAILY_SYNC_NAME") { Pass "Successful daily sync suppresses duplicate provider call" } else { Fail "Successful daily sync suppresses duplicate provider call" }
if (HasText $scheduler "mf_returns_sync") { Pass "Returns stage is monitored" } else { Fail "Returns stage is monitored" }
if (HasText $scheduler "mf_rating_sync") { Pass "Rating stage is monitored" } else { Fail "Rating stage is monitored" }

$latestCount = (Select-String -Path $syncService -Pattern "await getLatestFunds\(\)" -AllMatches | Measure-Object).Count
if ($latestCount -eq 1) { Pass "Latest NAV uses one bulk provider call" } else { Fail "Latest NAV uses one bulk provider call" "Found $latestCount getLatestFunds() calls" }
if (HasText $syncService "WHERE is_active = 1") { Pass "NAV sync reads only active schemes" } else { Fail "NAV sync reads only active schemes" }
if (HasText $syncService "returns_for_nav_date IS NULL OR returns_for_nav_date <> nav_date") { Pass "Returns calculation is incremental" } else { Fail "Returns calculation is incremental" }
if (HasText $syncService "navChangedSameDate") { Pass "Same-day NAV correction is detected" } else { Fail "Same-day NAV correction is detected" }
if (HasText $syncService "risk_updated_at = CASE") { Pass "Risk is invalidated when NAV changes" } else { Fail "Risk is invalidated when NAV changes" }

if (HasText $routes "router.post('/sync-now', authenticateToken, requireRole('ADMIN')") { Pass "Manual full sync is ADMIN-only" } else { Fail "Manual full sync is ADMIN-only" }
if (HasText $routes "router.get('/sync-status', authenticateToken, requireRole('ADMIN')") { Pass "Sync monitoring is ADMIN-only" } else { Fail "Sync monitoring is ADMIN-only" }
if (HasText $routes "router.post('/sync', authenticateToken, requireRole('ADMIN')") { Pass "NAV sync route is ADMIN-only" } else { Fail "NAV sync route is ADMIN-only" }
if (HasText $routes "router.post('/sync-returns', authenticateToken, requireRole('ADMIN')") { Pass "Returns sync route is ADMIN-only" } else { Fail "Returns sync route is ADMIN-only" }
if (HasText $status "getAllSyncStatuses") { Pass "Sync status service supports stage monitoring" } else { Fail "Sync status service supports stage monitoring" }
if (HasText $controller "getAllSyncStatuses") { Pass "Controller exposes all sync stages" } else { Fail "Controller exposes all sync stages" }

Write-Host ""
Write-Host "Phase 5 migration command (run once before DB tests):" -ForegroundColor Cyan
Write-Host '$env:MYSQL_PWD="root"; Get-Content ".\backend\mutualfunds\sql\008_phase5_mf_sync_monitoring.sql" | mysql -u root zerodha; Remove-Item Env:MYSQL_PWD'

if ($RunBackendTests) {
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor DarkGray
    Write-Host "Automated Phase 5 Test Suite"
    Write-Host "========================================================================" -ForegroundColor DarkGray
    Push-Location $BackendRoot
    try {
        $output = & node --test ".\tests\phase5-mutual-fund-sync.test.js" 2>&1
        $code = $LASTEXITCODE
        $output | ForEach-Object { Write-Host $_ }
        if ($code -eq 0) { Pass "Phase 5 backend test suite" } else { Fail "Phase 5 backend test suite" "node --test exited with code $code" }
    } finally { Pop-Location }
}

if ($RunFrontendBuild) {
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor DarkGray
    Write-Host "Frontend Validation"
    Write-Host "========================================================================" -ForegroundColor DarkGray
    Push-Location $FrontendRoot
    try {
        $output = & npm run build 2>&1
        $code = $LASTEXITCODE
        $output | ForEach-Object { Write-Host $_ }
        if ($code -eq 0) { Pass "Frontend production build" } else { Fail "Frontend production build" "npm run build exited with code $code" }
    } finally { Pop-Location }
}

Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "FINAL RESULT"
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "PASS : $pass" -ForegroundColor Green
Write-Host "FAIL : $fail" -ForegroundColor Red
Write-Host "SKIP : $skip" -ForegroundColor Yellow
Write-Host ""
if ($fail -eq 0) { Write-Host "PHASE 5 SOURCE / TEST CHECKS PASSED" -ForegroundColor Green } else { Write-Host "PHASE 5 HAS FAILURES - FIX THE FAIL ITEMS BEFORE MARKING IT COMPLETE" -ForegroundColor Red; exit 1 }
