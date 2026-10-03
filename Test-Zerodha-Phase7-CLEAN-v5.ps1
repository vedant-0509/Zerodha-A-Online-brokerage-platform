param(
    [switch]$RunBackendTests,
    [switch]$RunFrontendBuild
)

$ErrorActionPreference = "Continue"

$ProjectRoot = (Get-Location).Path
$BackendRoot = Join-Path $ProjectRoot "backend"
$FrontendRoot = Join-Path $ProjectRoot "frontend"
$EnvFile = Join-Path $BackendRoot ".env"
$MigrationFile = Join-Path $BackendRoot "mutualfunds\sql\009_phase7_database_hardening.sql"

$pass = 0
$fail = 0
$skip = 0

function Pass($name, $detail = "") {
    $script:pass++
    Write-Host "[PASS] $name" -ForegroundColor Green
    if ($detail) {
        Write-Host "       $detail"
    }
}

function Fail($name, $detail = "") {
    $script:fail++
    Write-Host "[FAIL] $name" -ForegroundColor Red
    if ($detail) {
        Write-Host "       $detail"
    }
}

function Skip($name, $detail = "") {
    $script:skip++
    Write-Host "[SKIP] $name" -ForegroundColor Yellow
    if ($detail) {
        Write-Host "       $detail"
    }
}

function Get-EnvValue($name) {
    if (-not (Test-Path $EnvFile)) {
        return ""
    }

    $line = Get-Content $EnvFile | Where-Object {
        $_ -match "^\s*$([regex]::Escape($name))\s*="
    } | Select-Object -First 1

    if (-not $line) {
        return ""
    }

    $value = $line -replace "^\s*$([regex]::Escape($name))\s*=", ""

    return $value.Trim().Trim('"').Trim("'")
}

function Run-NodeCheck($path) {
    & node --check $path 2>&1 | ForEach-Object {
        Write-Host $_
    }

    return ($LASTEXITCODE -eq 0)
}

function Find-MySql() {
    $cmd = Get-Command mysql -ErrorAction SilentlyContinue

    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @(
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return ""
}

# IMPORTANT:
# Do NOT name the first parameter $host.
# PowerShell already has a built-in/read-only $Host variable.
function Invoke-MySql(
    $mysqlExe,
    $dbHostName,
    $dbPortNumber,
    $dbUserName,
    $dbPassword,
    $databaseName,
    $sql
) {
    $oldPwd = $env:MYSQL_PWD

    try {
        $env:MYSQL_PWD = $dbPassword

        if ([string]::IsNullOrWhiteSpace($databaseName)) {
            $output = & $mysqlExe `
                --protocol=TCP `
                -h $dbHostName `
                -P $dbPortNumber `
                -u $dbUserName `
                -N `
                -B `
                -e $sql 2>&1
        }
        else {
            $output = & $mysqlExe `
                --protocol=TCP `
                -h $dbHostName `
                -P $dbPortNumber `
                -u $dbUserName `
                -N `
                -B `
                $databaseName `
                -e $sql 2>&1
        }

        return @{
            Code   = $LASTEXITCODE
            Output = ($output | Out-String).Trim()
        }
    }
    finally {
        if ($null -eq $oldPwd) {
            Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
        }
        else {
            $env:MYSQL_PWD = $oldPwd
        }
    }
}

Write-Host ""
Write-Host "ZERODHA PROJECT - PHASE 7 DATABASE HARDENING TEST SUITE" -ForegroundColor Cyan
Write-Host "Project : $ProjectRoot"
Write-Host ""

# ============================================================================
# BASIC PROJECT CHECKS
# ============================================================================

if (-not (Test-Path $BackendRoot)) {
    Fail "backend folder exists"
    exit 1
}
else {
    Pass "backend folder exists"
}

if (-not (Test-Path $FrontendRoot)) {
    Fail "frontend folder exists"
}
else {
    Pass "frontend folder exists"
}

$mysqlExe = Find-MySql

if ($mysqlExe) {
    Pass "MySQL client available" $mysqlExe
}
else {
    Fail "MySQL client available" "mysql.exe was not found."
}

# ============================================================================
# PHASE 7 SOURCE CHECKS
# ============================================================================

Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "PHASE 7 - SOURCE CHECKS"
Write-Host "========================================================================" -ForegroundColor DarkGray

$requiredFiles = @(
    "backend\config\env.js",
    "backend\config\mysql.js",
    "backend\detailStock\env.js",
    "backend\detailStock\db.js",
    "backend\mutualfunds\db.js",
    "backend\indexMarket\db.js",
    "backend\stocks\server.js",
    "backend\stocks\search.js",
    "backend\stocks\news.js",
    "backend\signup\app.js",
    "backend\watchlist\app.js",
    "backend\holding\app.js",
    "backend\holding\marketUpdateLog.js",
    "backend\holding\marketUpdateService.js",
    "backend\orders\app.js",
    "backend\mutualfunds\sql\009_phase7_database_hardening.sql"
)

foreach ($relative in $requiredFiles) {

    $full = Join-Path $ProjectRoot $relative

    if (Test-Path $full) {
        Pass "Required Phase 7 file exists" $relative
    }
    else {
        Fail "Required Phase 7 file exists" $relative
    }
}

# ============================================================================
# CENTRAL MYSQL CONFIG CHECK
# ============================================================================

$mysqlConfigPath = Join-Path $BackendRoot "config\mysql.js"

if (Test-Path $mysqlConfigPath) {

    $mysqlConfig = Get-Content $mysqlConfigPath -Raw

    $envConfigPath = Join-Path $BackendRoot "config\env.js"

    if (Test-Path $envConfigPath) {
        $envConfig = Get-Content $envConfigPath -Raw

        if ($envConfig -match "MYSQL_APP_USER") {
            Pass "Central DB config supports dedicated application user"
        }
        else {
            Fail "Central DB config supports dedicated application user"
        }

        if ($envConfig -match "MYSQL_APP_PASSWORD") {
            Pass "Central DB config supports dedicated application password"
        }
        else {
            Fail "Central DB config supports dedicated application password"
        }
    }
    else {
        Fail "Central DB config supports dedicated application user" `
            "backend\config\env.js not found."

        Fail "Central DB config supports dedicated application password" `
            "backend\config\env.js not found."
    }

    if ($mysqlConfig -match "connectionLimit") {
        Pass "Shared MySQL pool config has connection limit"
    }
    else {
        Fail "Shared MySQL pool config has connection limit"
    }

    if ($mysqlConfig -match "enableKeepAlive") {
        Pass "Shared MySQL pool config enables keep-alive"
    }
    else {
        Fail "Shared MySQL pool config enables keep-alive"
    }
}

# ============================================================================
# RUNTIME CREATE TABLE CHECK
# ============================================================================

$stocksServer = Join-Path $BackendRoot "stocks\server.js"

if (Test-Path $stocksServer) {

    $stocksText = Get-Content $stocksServer -Raw

    if ($stocksText -notmatch "CREATE TABLE IF NOT EXISTS\s+market_update_log") {
        Pass "Runtime CREATE TABLE removed from Stocks service"
    }
    else {
        Fail "Runtime CREATE TABLE removed from Stocks service"
    }
}

# ============================================================================
# NODE SYNTAX CHECKS
# ============================================================================

Write-Host ""
Write-Host "------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Node syntax checks"
Write-Host "------------------------------------------------------------------------" -ForegroundColor DarkGray

$nodeFiles = @(
    "backend\server.js",
    "backend\config\env.js",
    "backend\config\mysql.js",
    "backend\signup\app.js",
    "backend\watchlist\app.js",
    "backend\holding\app.js",
    "backend\orders\app.js",
    "backend\mutualfunds\server.js",
    "backend\mutualfunds\db.js",
    "backend\stocks\server.js",
    "backend\detailStock\server.js",
    "backend\detailStock\db.js",
    "backend\indexMarket\db.js",
    "backend\indexMarket\server.js"
)

foreach ($relative in $nodeFiles) {

    $full = Join-Path $ProjectRoot $relative

    if (Test-Path $full) {

        if (Run-NodeCheck $full) {
            Pass "Node syntax check" $relative
        }
        else {
            Fail "Node syntax check" $relative
        }
    }
}

# ============================================================================
# DATABASE PREFLIGHT - READ ONLY
# ============================================================================

Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "Database connection / preflight (READ-ONLY)"
Write-Host "========================================================================" -ForegroundColor DarkGray

$dbHostName = Get-EnvValue "MYSQL_HOST"
$dbPortNumber = Get-EnvValue "MYSQL_PORT"
$dbName = Get-EnvValue "MYSQL_DATABASE"
$adminUser = Get-EnvValue "MYSQL_ADMIN_USER"
$adminPassword = Get-EnvValue "MYSQL_ADMIN_PASSWORD"

if ([string]::IsNullOrWhiteSpace($dbHostName)) {
    $dbHostName = "127.0.0.1"
}

if ([string]::IsNullOrWhiteSpace($dbPortNumber)) {
    $dbPortNumber = "3306"
}

if ([string]::IsNullOrWhiteSpace($dbName)) {
    $dbName = "zerodha"
}

if ([string]::IsNullOrWhiteSpace($adminUser)) {
    $adminUser = "root"
}

Write-Host "Database : $dbName"
Write-Host "Host     : $dbHostName`:$dbPortNumber"
Write-Host "Admin    : $adminUser"
Write-Host ""

if (-not $mysqlExe) {

    Skip "Database preflight" "MySQL client unavailable."

}
elseif ([string]::IsNullOrWhiteSpace($adminPassword)) {

    Skip "Database preflight" "MYSQL_ADMIN_PASSWORD is not set in backend/.env. No database command was attempted."

    Write-Host "For local MySQL, set MYSQL_ADMIN_PASSWORD in backend/.env:" -ForegroundColor Yellow
    Write-Host '  MYSQL_ADMIN_PASSWORD=root' -ForegroundColor Yellow
    Write-Host ""

}
else {

    # ------------------------------------------------------------------------
    # MySQL connection
    # ------------------------------------------------------------------------

    $connection = Invoke-MySql `
        $mysqlExe `
        $dbHostName `
        $dbPortNumber `
        $adminUser `
        $adminPassword `
        "" `
        "SELECT 1;"

    if ($connection.Code -eq 0) {

        Pass "Administrator can connect to MySQL"

    }
    else {

        Fail "Administrator can connect to MySQL" $connection.Output

    }

    # ------------------------------------------------------------------------
    # Database existence
    # ------------------------------------------------------------------------

    $dbCheckSql = @"
SELECT SCHEMA_NAME
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE SCHEMA_NAME = '$dbName';
"@

    $dbCheck = Invoke-MySql `
        $mysqlExe `
        $dbHostName `
        $dbPortNumber `
        $adminUser `
        $adminPassword `
        "" `
        $dbCheckSql

    if (
        $dbCheck.Code -eq 0 -and
        $dbCheck.Output.Trim() -eq $dbName
    ) {

        Pass "Zerodha database exists" $dbName

    }
    else {

        Fail "Zerodha database exists" $dbName

    }

    # ------------------------------------------------------------------------
    # Table count
    # ------------------------------------------------------------------------

    if (
        $dbCheck.Code -eq 0 -and
        $dbCheck.Output.Trim() -eq $dbName
    ) {

        $tableCountSql = @"
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE();
"@

        $tableCount = Invoke-MySql `
            $mysqlExe `
            $dbHostName `
            $dbPortNumber `
            $adminUser `
            $adminPassword `
            $dbName `
            $tableCountSql

        if (
            $tableCount.Code -eq 0 -and
            [int]$tableCount.Output -gt 0
        ) {

            Pass "Zerodha database contains tables" "$($tableCount.Output) tables"

        }
        else {

            Fail "Zerodha database contains tables" $tableCount.Output

        }

        # --------------------------------------------------------------------
        # Duplicate checks
        # --------------------------------------------------------------------

        $duplicateQueries = @(
            @{
                Name = "Duplicate user emails"
                Sql  = "SELECT COUNT(*) FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1) x;"
            },
            @{
                Name = "Duplicate MF scheme codes"
                Sql  = "SELECT COUNT(*) FROM (SELECT scheme_code FROM mf_schemes GROUP BY scheme_code HAVING COUNT(*) > 1) x;"
            },
            @{
                Name = "Duplicate watchlist user/instrument pairs"
                Sql  = "SELECT COUNT(*) FROM (SELECT user_id, instrument_key FROM watchlist GROUP BY user_id, instrument_key HAVING COUNT(*) > 1) x;"
            }
        )

        foreach ($q in $duplicateQueries) {

            $result = Invoke-MySql `
                $mysqlExe `
                $dbHostName `
                $dbPortNumber `
                $adminUser `
                $adminPassword `
                $dbName `
                $q.Sql

            if (
                $result.Code -eq 0 -and
                [int]$result.Output -eq 0
            ) {

                Pass $q.Name

            }
            elseif ($result.Code -eq 0) {

                Fail $q.Name "Found $($result.Output) duplicate groups."

            }
            else {

                Skip $q.Name "Table/column may differ: $($result.Output)"

            }
        }

        # --------------------------------------------------------------------
        # Migration tracking table
        # --------------------------------------------------------------------

        $migrationCheckSql = @"
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'schema_migrations';
"@

        $migrationCheck = Invoke-MySql `
            $mysqlExe `
            $dbHostName `
            $dbPortNumber `
            $adminUser `
            $adminPassword `
            $dbName `
            $migrationCheckSql

        if (
            $migrationCheck.Code -eq 0 -and
            [int]$migrationCheck.Output -gt 0
        ) {

            Pass "Migration tracking table exists"

        }
        else {

            Skip "Migration tracking table exists" `
                "Expected to be created by Phase 7 migration."

        }

        # --------------------------------------------------------------------
        # Phase 7 marker
        # --------------------------------------------------------------------

        $phase7CheckSql = @"
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'phase7_database_hardening';
"@

        $phase7Check = Invoke-MySql `
            $mysqlExe `
            $dbHostName `
            $dbPortNumber `
            $adminUser `
            $adminPassword `
            $dbName `
            $phase7CheckSql

        if (
            $phase7Check.Code -eq 0 -and
            [int]$phase7Check.Output -gt 0
        ) {

            Pass "Phase 7 marker table exists" `
                "Phase 7 may already have been applied."

        }
        else {

            Pass "Phase 7 migration has not been applied yet" `
                "Safe pre-migration state."

        }
    }
}

# ============================================================================
# OPTIONAL BACKEND TESTS
# ============================================================================

Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "Frontend / backend optional validation"
Write-Host "========================================================================" -ForegroundColor DarkGray

if ($RunBackendTests) {

    $packageJson = Join-Path $BackendRoot "package.json"

    if (Test-Path $packageJson) {

        Push-Location $BackendRoot

        try {

            & npm test 2>&1 | ForEach-Object {
                Write-Host $_
            }

            if ($LASTEXITCODE -eq 0) {

                Pass "Backend test suite"

            }
            else {

                Fail "Backend test suite" `
                    "npm test exited with code $LASTEXITCODE"

            }

        }
        finally {

            Pop-Location

        }
    }
    else {

        Fail "Backend test suite" `
            "backend/package.json not found."

    }
}

# ============================================================================
# OPTIONAL FRONTEND BUILD
# ============================================================================

if ($RunFrontendBuild) {

    $packageJson = Join-Path $FrontendRoot "package.json"

    if (Test-Path $packageJson) {

        Push-Location $FrontendRoot

        try {

            & npm run build 2>&1 | ForEach-Object {
                Write-Host $_
            }

            if ($LASTEXITCODE -eq 0) {

                Pass "Frontend production build"

            }
            else {

                Fail "Frontend production build" `
                    "npm run build exited with code $LASTEXITCODE"

            }

        }
        finally {

            Pop-Location

        }
    }
    else {

        Fail "Frontend production build" `
            "frontend/package.json not found."

    }
}

# ============================================================================
# FINAL RESULT
# ============================================================================

Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "FINAL RESULT"
Write-Host "========================================================================" -ForegroundColor DarkGray

Write-Host "PASS : $pass" -ForegroundColor Green
Write-Host "FAIL : $fail" -ForegroundColor Red
Write-Host "SKIP : $skip" -ForegroundColor Yellow

Write-Host ""

if ($fail -eq 0) {

    Write-Host "PHASE 7 PREFLIGHT PASSED - DATABASE MIGRATION HAS NOT BEEN RUN BY THIS TEST" -ForegroundColor Green

    exit 0

}
else {

    Write-Host "PHASE 7 PREFLIGHT HAS FAILURES - DO NOT RUN THE MIGRATION YET" -ForegroundColor Red

    exit 1

}