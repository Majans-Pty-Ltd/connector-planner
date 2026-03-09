#!/bin/bash
# ============================================
# Planner MCP Connector — Mac Installer
# ============================================
# Run this in Terminal:
#   curl -fsSL https://raw.githubusercontent.com/Majans-Pty-Ltd/connector-planner/master/install.sh | bash
# ============================================

set -e

echo ""
echo "=== Planner MCP Connector Installer ==="
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Install it from https://nodejs.org/ and try again."
    exit 1
fi
echo "[OK] Node.js found: $(node --version)"

# 2. Set install directory
INSTALL_DIR="$HOME/.connector-planner"

if [ -d "$INSTALL_DIR" ]; then
    echo "Existing installation found. Updating..."
    cd "$INSTALL_DIR"
    git pull --quiet 2>/dev/null || true
else
    echo "Cloning connector-planner..."
    git clone --quiet https://github.com/Majans-Pty-Ltd/connector-planner.git "$INSTALL_DIR" 2>/dev/null || \
    git clone https://github.com/Majans-Pty-Ltd/connector-planner.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 3. Install & build
echo "Installing dependencies..."
npm install --silent 2>/dev/null
echo "Building..."
npm run build --silent 2>/dev/null
echo "[OK] Built successfully"

# 4. Create .env
cat > "$INSTALL_DIR/.env" << 'ENVEOF'
PLANNER_TENANT_ID=d54794b1-f598-4c0f-a276-6039a39774ac
PLANNER_CLIENT_ID=a8d46b4d-b1d0-48aa-b4c4-2122a97d6dc8
PLANNER_CLIENT_SECRET=y-r8Q~z_q7n8t59J8OBr~6lltuwtWhnKIySriayC
ENVEOF
echo "[OK] Credentials configured"

# 5. Configure Claude Desktop
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
CLAUDE_DIR="$(dirname "$CLAUDE_CONFIG")"
DIST_PATH="$INSTALL_DIR/dist/index.js"

mkdir -p "$CLAUDE_DIR"

if [ -f "$CLAUDE_CONFIG" ]; then
    # Merge planner into existing config using node
    node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));
if (!config.mcpServers) config.mcpServers = {};
config.mcpServers.planner = {
  command: 'node',
  args: ['$DIST_PATH'],
  env: {
    PLANNER_TENANT_ID: 'd54794b1-f598-4c0f-a276-6039a39774ac',
    PLANNER_CLIENT_ID: 'a8d46b4d-b1d0-48aa-b4c4-2122a97d6dc8',
    PLANNER_CLIENT_SECRET: 'y-r8Q~z_q7n8t59J8OBr~6lltuwtWhnKIySriayC'
  }
};
fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2));
"
else
    cat > "$CLAUDE_CONFIG" << CONFIGEOF
{
  "mcpServers": {
    "planner": {
      "command": "node",
      "args": ["$DIST_PATH"],
      "env": {
        "PLANNER_TENANT_ID": "d54794b1-f598-4c0f-a276-6039a39774ac",
        "PLANNER_CLIENT_ID": "a8d46b4d-b1d0-48aa-b4c4-2122a97d6dc8",
        "PLANNER_CLIENT_SECRET": "y-r8Q~z_q7n8t59J8OBr~6lltuwtWhnKIySriayC"
      }
    }
  }
}
CONFIGEOF
fi
echo "[OK] Claude Desktop configured"

# 6. Run auth setup (opens browser)
echo ""
echo "=== SIGN IN ==="
echo "A browser window will open. Sign in with your Majans account."
echo ""

npm run setup

# 7. Done
echo ""
echo "============================================"
echo "  INSTALLATION COMPLETE!"
echo "============================================"
echo ""
echo "  1. Restart Claude Desktop (Cmd+Q then reopen)"
echo "  2. Ask Claude: 'show me my Planner tasks'"
echo ""
