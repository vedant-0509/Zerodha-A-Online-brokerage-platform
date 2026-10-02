param(
    [string]$BASE_URL = "http://localhost:3000",
    [string]$FRONTEND_URL = "http://localhost:3002",
    [string]$AUTH_EMAIL = "",
    [string]$AUTH_PASSWORD = ""
)

$ErrorActionPreference = "Continue"

$passed = 0
$failed = 0
$skipped = 0

function Pass($message) {
    Write-Host "[PASS] $message" -ForegroundColor Green
    $script:passed++
}

function Fail($message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    $script:failed++
}

function Skip($message) {
    Write-Host "[SKIP] $message" -ForegroundColor Yellow
    $script:skipped++
}

function Section($title) {
    Write-Host ""
    Write-Host ("=" * 60)
    Write-Host $title
    Write-Host ("=" * 60)
}

function Get-StatusCode($uri, $method = "GET", $headers = $null) {
    try {
        if ($headers) {
            $response = Invoke-WebRequest -Uri $uri -Method $method -Headers $headers -UseBasicParsing -TimeoutSec 10
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method $method -UseBasicParsing -TimeoutSec 10
        }
        return [int]$response.StatusCode
    }
    catch {
        if ($_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode.value__
        }
        return 0
    }
}

function Get-Json($uri) {
    try {
        return Invoke-RestMethod -Uri $uri -Method GET -TimeoutSec 10
    }
    catch {
        return $null
    }
}

Section "PHASE 3 - CENTRAL BACKEND CONFIGURATION"

Write-Host "Public API : $BASE_URL"
Write-Host "Frontend   : $FRONTEND_URL"

Section "TEST 1 - CENTRAL API HEALTH"

$health = Get-Json "$BASE_URL/health"

if ($health -and $health.success -eq $true -and $health.service -eq "central-api" -and $health.status -eq "ok") {
    Pass "Central API /health -> OK"
} else {
    Fail "Central API /health is not responding correctly"
}

Section "TEST 2 - CENTRAL API READINESS"

$ready = Get-Json "$BASE_URL/ready"

if ($ready -and $ready.success -eq $true -and $ready.service -eq "central-api" -and $ready.status -eq "ready") {
    Pass "Central API /ready -> READY"
} else {
    Fail "Central API /ready is not responding correctly"
}

Section "TEST 3 - UNKNOWN PUBLIC ROUTE"

$status = Get-StatusCode "$BASE_URL/this-route-does-not-exist"

if ($status -eq 404) {
    Pass "Unknown public route -> 404"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Fail "Unknown public route returned HTTP $status instead of 404"
}

Section "TEST 4 - AUTH ROUTING"

$status = Get-StatusCode "$BASE_URL/api/auth/me"

if ($status -eq 401) {
    Pass "/api/auth/me reaches Auth service -> 401 without token"
} elseif ($status -eq 404) {
    Fail "/api/auth/me returned 404 - central Auth route is not mapped correctly"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "/api/auth/me reached Auth service -> HTTP $status"
}

Section "TEST 5 - HOLDINGS ROUTING"

$status = Get-StatusCode "$BASE_URL/api/holdings"

if ($status -eq 401) {
    Pass "/api/holdings reaches Holdings service -> 401 without token"
} elseif ($status -eq 404) {
    Fail "/api/holdings returned 404 - Holdings route is not mapped correctly"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "/api/holdings reached Holdings service -> HTTP $status"
}

Section "TEST 6 - WATCHLIST ROUTING"

$status = Get-StatusCode "$BASE_URL/api/watchlist"

if ($status -eq 401) {
    Pass "/api/watchlist reaches Watchlist service -> 401 without token"
} elseif ($status -eq 404) {
    Fail "/api/watchlist returned 404 - Watchlist route is not mapped correctly"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "/api/watchlist reached Watchlist service -> HTTP $status"
}

Section "TEST 7 - ORDERS ROUTING"

$status = Get-StatusCode "$BASE_URL/api/orders"

if ($status -eq 401) {
    Pass "/api/orders reaches Orders service -> 401 without token"
} elseif ($status -eq 404) {
    Fail "/api/orders returned 404 - Orders route is not mapped correctly"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "/api/orders reached Orders service -> HTTP $status"
}

Section "TEST 8 - STOCKS ROUTING"

$status = Get-StatusCode "$BASE_URL/api/stocks/search?q=reliance"

if ($status -eq 404) {
    Fail "/api/stocks/search returned 404 - Stocks route is not mapped correctly"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "/api/stocks/search reached Stocks service -> HTTP $status"
}

Section "TEST 9 - MUTUAL FUNDS ROUTING"

$status = Get-StatusCode "$BASE_URL/api/mutual-funds/"

if ($status -eq 404) {
    Fail "/api/mutual-funds returned 404 - Mutual Funds route may not be mapped correctly"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "/api/mutual-funds reached Mutual Funds service -> HTTP $status"
}

Section "TEST 10 - DETAIL STOCK ROUTING"

$status = Get-StatusCode "$BASE_URL/api/detail-stock/"

if ($status -eq 404) {
    Fail "/api/detail-stock returned 404 - Detail Stock route is not mapped correctly"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "/api/detail-stock reached Detail Stock service -> HTTP $status"
}

Section "TEST 11 - COMPANY REVIEWS ROUTING"

$status = Get-StatusCode "$BASE_URL/api/company-reviews?company=Reliance"

if ($status -eq 404) {
    Fail "/api/company-reviews returned 404 - Company Reviews route is not mapped correctly"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "/api/company-reviews reached Auth service -> HTTP $status"
}

Section "TEST 12 - SOCKET.IO PUBLIC ENTRY POINT"

$status = Get-StatusCode "$BASE_URL/socket.io/?EIO=4&transport=polling"

if ($status -eq 200) {
    Pass "Public Socket.IO endpoint is available on :3000"
} elseif ($status -eq 404) {
    Fail "Socket.IO endpoint returned 404"
} elseif ($status -eq 0) {
    Fail "Central API is unreachable"
} else {
    Pass "Socket.IO endpoint responded -> HTTP $status"
}

Section "TEST 13 - FRONTEND ACCESS"

$status = Get-StatusCode $FRONTEND_URL

if ($status -ge 200 -and $status -lt 500) {
    Pass "Frontend is reachable at $FRONTEND_URL -> HTTP $status"
} elseif ($status -eq 0) {
    Skip "Frontend test skipped/unreachable. Start the React frontend if it is not running."
} else {
    Fail "Frontend returned HTTP $status"
}

Section "TEST 14 - AUTH THROUGH CENTRAL API"

if ([string]::IsNullOrWhiteSpace($AUTH_EMAIL) -or [string]::IsNullOrWhiteSpace($AUTH_PASSWORD)) {
    Skip "Set AUTH_EMAIL and AUTH_PASSWORD to test login through :3000"
} else {
    $body = @{
        email = $AUTH_EMAIL
        password = $AUTH_PASSWORD
    } | ConvertTo-Json

    try {
        $login = Invoke-RestMethod `
            -Method POST `
            -Uri "$BASE_URL/api/auth/login" `
            -ContentType "application/json" `
            -Body $body `
            -TimeoutSec 15

        if ($login.token) {
            Pass "Login works through central API :3000"
        } elseif ($login.accessToken) {
            Pass "Login works through central API :3000"
        } else {
            Fail "Login reached Auth service but no token was returned"
        }
    }
    catch {
        $status = 0
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode.value__
        }

        if ($status -eq 429) {
            Skip "Login reached central API but was rate-limited (429)"
        } elseif ($status -eq 401) {
            Fail "Central Auth routing works, but supplied credentials were rejected"
        } else {
            Fail "Central Auth login failed with HTTP $status"
        }
    }
}

Section "PHASE 3 - INTERNAL PORT CHECK"

Write-Host "These ports are intentionally still used internally:"
Write-Host "Auth=3010  Stocks=3001  Holdings=3006  Orders=3007"
Write-Host "Watchlist=3008  MF=5000  Index=3020  DetailStock=3021"

Write-Host ""
Write-Host "NOTE: Phase 3 does NOT require deleting the internal services."
Write-Host "They should be bound to loopback / not exposed publicly in deployment."

Section "PHASE 3 TEST SUMMARY"

Write-Host ""
Write-Host "PASSED : $passed" -ForegroundColor Green
Write-Host "FAILED : $failed" -ForegroundColor Red
Write-Host "SKIPPED: $skipped" -ForegroundColor Yellow
Write-Host ""

if ($failed -eq 0) {
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host " PHASE 3 BASIC TESTS PASSED" -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Green
} else {
    Write-Host "==============================================" -ForegroundColor Red
    Write-Host " PHASE 3 TESTS HAVE FAILURES" -ForegroundColor Red
    Write-Host "Fix the failed tests before moving to Phase 4." -ForegroundColor Red
    Write-Host "==============================================" -ForegroundColor Red
}
