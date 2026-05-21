#!/bin/bash
# ============================================
# iPmartGit - Automated Deployment Script
# Compatible with Ubuntu 20/22/24, Debian 11/12
# Designed for Iran-based servers
# ============================================

set -e

echo "=========================================="
echo "  iPmartGit - Automated Installer"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run as root: sudo bash deploy-iran.sh${NC}"
  exit 1
fi

# Variables
APP_DIR="/opt/ipmartgit"
APP_USER="ipmartgit"
DOMAIN=${1:-""}
PORT=${2:-3000}

echo -e "${BLUE}[INFO] Configuration:${NC}"
echo "   Install path : $APP_DIR"
echo "   Port         : $PORT"
echo "   Domain       : ${DOMAIN:-'None (direct IP access)'}"
echo ""

# ============================================
# Step 1: Install system dependencies
# ============================================
echo -e "${BLUE}[1/7] Installing system dependencies...${NC}"

apt-get update -qq
apt-get install -y -qq curl git build-essential nginx openssl > /dev/null 2>&1

echo -e "${GREEN}[OK] System dependencies installed${NC}"

# ============================================
# Step 2: Install Node.js 20
# ============================================
echo -e "${BLUE}[2/7] Installing Node.js 20...${NC}"

if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  if curl -fsSL --connect-timeout 15 https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null; then
    apt-get install -y -qq nodejs > /dev/null 2>&1
  else
    echo -e "${YELLOW}[WARN] NodeSource not reachable. Trying binary install...${NC}"
    NODE_VERSION="20.11.0"
    ARCH=$(dpkg --print-architecture)
    if [ "$ARCH" = "amd64" ]; then
      NODE_ARCH="x64"
    else
      NODE_ARCH="$ARCH"
    fi
    TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
    if [ -f "/tmp/$TARBALL" ]; then
      tar -xf "/tmp/$TARBALL" -C /usr/local --strip-components=1
    else
      echo -e "${RED}[ERROR] Cannot download Node.js and binary not found at /tmp/$TARBALL${NC}"
      echo "   Please download Node.js manually and place it in /tmp/"
      echo "   URL: https://nodejs.org/dist/v${NODE_VERSION}/$TARBALL"
      exit 1
    fi
  fi
fi

echo -e "${GREEN}[OK] Node.js $(node -v) installed${NC}"

# ============================================
# Step 3: Create system user
# ============================================
echo -e "${BLUE}[3/7] Creating system user...${NC}"

if ! id "$APP_USER" &>/dev/null; then
  useradd -r -m -s /bin/bash "$APP_USER"
fi

echo -e "${GREEN}[OK] User '$APP_USER' ready${NC}"

# ============================================
# Step 4: Copy project files
# ============================================
echo -e "${BLUE}[4/7] Copying project files...${NC}"

mkdir -p "$APP_DIR"

# Copy files from current directory if package.json exists
if [ -f "./package.json" ]; then
  cp -r ./* "$APP_DIR/"
  cp ./.gitignore "$APP_DIR/" 2>/dev/null || true
  cp ./.dockerignore "$APP_DIR/" 2>/dev/null || true
fi

# Create data directories
mkdir -p "$APP_DIR/db"
mkdir -p "$APP_DIR/repositories"
mkdir -p "$APP_DIR/git-repos"
mkdir -p "$APP_DIR/uploads"
mkdir -p "$APP_DIR/uploads/temp"
mkdir -p "$APP_DIR/uploads/releases"

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo -e "${GREEN}[OK] Project files copied to $APP_DIR${NC}"

# ============================================
# Step 5: Install npm dependencies & setup
# ============================================
echo -e "${BLUE}[5/7] Installing npm dependencies...${NC}"

cd "$APP_DIR"

# Optional: Use npm mirror for faster downloads in Iran
# Uncomment the next line if npm is slow:
# su - "$APP_USER" -c "npm config set registry https://registry.npmmirror.com/"

su - "$APP_USER" -c "cd $APP_DIR && npm install --production" 2>&1 | tail -5
su - "$APP_USER" -c "cd $APP_DIR && node scripts/setup.js"

echo -e "${GREEN}[OK] Dependencies installed and database initialized${NC}"

# ============================================
# Step 6: Create systemd service
# ============================================
echo -e "${BLUE}[6/7] Creating systemd service...${NC}"

# Generate random session secret
SESSION_SECRET=$(openssl rand -hex 32)

cat > /etc/systemd/system/ipmartgit.service << EOF
[Unit]
Description=iPmartGit - Self-hosted Git Platform
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=SESSION_SECRET=$SESSION_SECRET

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ipmartgit
systemctl start ipmartgit

# Wait for startup
sleep 3

if systemctl is-active --quiet ipmartgit; then
  echo -e "${GREEN}[OK] iPmartGit service is running${NC}"
else
  echo -e "${RED}[ERROR] Service failed to start. Logs:${NC}"
  journalctl -u ipmartgit --no-pager -n 20
  exit 1
fi

# ============================================
# Step 7: Configure Nginx reverse proxy
# ============================================
echo -e "${BLUE}[7/7] Configuring Nginx...${NC}"

SERVER_NAME="${DOMAIN:-_}"

cat > /etc/nginx/sites-available/ipmartgit << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    client_max_body_size 200M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ipmartgit /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t && systemctl reload nginx

echo -e "${GREEN}[OK] Nginx configured${NC}"

# ============================================
# Installation Complete
# ============================================
IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo -e "${GREEN}  iPmartGit installed successfully!${NC}"
echo "=========================================="
echo ""
echo "  Access URL:"
if [ -n "$DOMAIN" ]; then
  echo "    http://$DOMAIN"
else
  echo "    http://$IP"
fi
echo ""
echo "  Default login credentials:"
echo "    Username: admin"
echo "    Password: admin123"
echo ""
echo -e "  ${YELLOW}WARNING: Change the admin password after first login!${NC}"
echo ""
echo "  Git clone URL:"
if [ -n "$DOMAIN" ]; then
  echo "    git clone http://$DOMAIN/git/USERNAME/REPO.git"
else
  echo "    git clone http://$IP/git/USERNAME/REPO.git"
fi
echo ""
echo "  Useful commands:"
echo "    Status  : systemctl status ipmartgit"
echo "    Logs    : journalctl -u ipmartgit -f"
echo "    Restart : systemctl restart ipmartgit"
echo "    Stop    : systemctl stop ipmartgit"
echo ""
echo "=========================================="
