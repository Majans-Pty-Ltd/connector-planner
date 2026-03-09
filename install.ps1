# ============================================
# Planner MCP Connector — One-Click Installer
# ============================================
# Run this in PowerShell:
#   irm https://raw.githubusercontent.com/Majans-Pty-Ltd/connector-planner/master/install.ps1 | iex
#
# Or locally:
#   .\install.ps1
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Planner MCP Connector Installer ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "Install it from https://nodejs.org/ and try again."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Node.js found: $(node --version)" -ForegroundColor Green

# 2. Set install directory
$installDir = "$env:LOCALAPPDATA\connector-planner"

if (Test-Path $installDir) {
    Write-Host "Existing installation found. Updating..." -ForegroundColor Yellow
    Set-Location $installDir
    git pull --quiet 2>$null
} else {
    Write-Host "Cloning connector-planner..." -ForegroundColor Cyan
    git clone --quiet https://github.com/Majans-Pty-Ltd/connector-planner.git $installDir 2>$null
    if (-not $?) {
        # Try HTTPS if SSH fails
        git clone --quiet https://github.com/Majans-Pty-Ltd/connector-planner.git $installDir
    }
    Set-Location $installDir
}

# 3. Install & build
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install --silent 2>$null
Write-Host "Building..." -ForegroundColor Cyan
npm run build --silent 2>$null
Write-Host "[OK] Built successfully" -ForegroundColor Green

# 4. Create .env
$envFile = Join-Path $installDir ".env"
Write-Host ""
Write-Host "Enter the Client Secret (ask Amit if you don't have it):" -ForegroundColor Yellow
$clientSecret = Read-Host
if (-not $clientSecret) {
    Write-Host "ERROR: Client secret is required." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
@"
PLANNER_TENANT_ID=d54794b1-f598-4c0f-a276-6039a39774ac
PLANNER_CLIENT_ID=a8d46b4d-b1d0-48aa-b4c4-2122a97d6dc8
PLANNER_CLIENT_SECRET=$clientSecret
"@ | Set-Content $envFile
Write-Host "[OK] Credentials configured" -ForegroundColor Green

# 5. Configure Claude Desktop
$claudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$distPath = (Join-Path $installDir "dist\index.js") -replace '\\', '/'

if (Test-Path $claudeConfigPath) {
    $config = Get-Content $claudeConfigPath -Raw | ConvertFrom-Json
} else {
    # Create directory if needed
    $claudeDir = Split-Path $claudeConfigPath
    if (-not (Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null }
    $config = @{} | ConvertTo-Json | ConvertFrom-Json
}

# Add mcpServers if missing
if (-not $config.mcpServers) {
    $config | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([PSCustomObject]@{})
}

# Add planner server
$plannerConfig = [PSCustomObject]@{
    command = "node"
    args = @($distPath)
    env = [PSCustomObject]@{
        PLANNER_TENANT_ID = "d54794b1-f598-4c0f-a276-6039a39774ac"
        PLANNER_CLIENT_ID = "a8d46b4d-b1d0-48aa-b4c4-2122a97d6dc8"
        PLANNER_CLIENT_SECRET = $clientSecret
    }
}

$config.mcpServers | Add-Member -NotePropertyName "planner" -NotePropertyValue $plannerConfig -Force
$config | ConvertTo-Json -Depth 10 | Set-Content $claudeConfigPath
Write-Host "[OK] Claude Desktop configured" -ForegroundColor Green

# 6. Run auth setup (opens browser)
Write-Host ""
Write-Host "=== SIGN IN ===" -ForegroundColor Yellow
Write-Host "A browser window will open. Sign in with your Majans account." -ForegroundColor Yellow
Write-Host ""

npm run setup

# 7. Done
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  INSTALLATION COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Restart Claude Desktop (quit and reopen)" -ForegroundColor White
Write-Host "  2. Ask Claude: 'show me my Planner tasks'" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to close"
