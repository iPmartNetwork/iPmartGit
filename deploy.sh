#!/bin/bash
# ============================================
#  iPmartGit - Quick Installer (International Server)
#  https://github.com/iPmartNetwork/iPmartGit
#  For servers WITH free internet access
# ============================================

APP_DIR="/opt/ipmartgit"
APP_USER="ipmartgit"
APP_SERVICE="ipmartgit"
PORT=${1:-3000}
DOMAIN=${2:-""}

# Colors
G='\033[1;32m'
B='\033[1;34m'
C='\033[1;36m'
Y='\033[1;33m'
R='\033[1;31m'
W='\033[1;37m'
N='\033[0m'

echo ""
echo -e "${B}+----------------------------------------------------------+${N}"
echo -e "${B}|${N}                                                          ${B}|${N}"
echo -e "${B}|${N}   ${C}iPmartGit Installer${N} (International Server)             ${B}|${N}"
echo -e "${B}|${N}   ${W}Self-hosted Git Platform${N}                                ${B}|${N}"
echo -e "${B}|${N}                                                          ${B}|${N}"
echo -e "${B}+----------------------------------------------------------+${N}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${R}[x] Run as root: sudo bash deploy.sh${N}"
  exit 1
fi

echo -e "${B}[1/6]${N} Installing system dependencies..."
apt-get update -qq > /dev/null 2>&1
apt-get install -y -qq curl git build-essential nginx openssl python3 make g++ > /dev/null 2>&1
echo -e "${G}[ok]${N} Dependencies installed"

echo -e "${B}[2/6]${N} Installing Node.js 20..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
fi
echo -e "${G}[ok]${N} Node.js $(node -v)"

echo -e "${B}[3/6]${N} Setting up project..."
if ! id "$APP_USER" &>/dev/null; then
  useradd -r -m -s /bin/bash "$APP_USER"
fi

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull origin master 2>/dev/null
else
  rm -rf "$APP_DIR"
  git clone https://github.com/iPmartNetwork/iPmartGit.git "$APP_DIR"
fi

mkdir -p "$APP_DIR/db" "$APP_DIR/repositories" "$APP_DIR/git-repos" "$APP_DIR/uploads" "$APP_DIR/uploads/temp" "$APP_DIR/uploads/releases"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
echo -e "${G}[ok]${N} Project ready at $APP_DIR"

echo -e "${B}[4/6]${N} Installing npm dependencies..."
cd "$APP_DIR"
su - "$APP_USER" -c "cd $APP_DIR && npm install --production" 2>&1 | tail -3
su - "$APP_USER" -c "cd $APP_DIR && node scripts/setup.js" 2>&1 | tail -3
echo -e "${G}[ok]${N} Dependencies installed"

echo -e "${B}[5/6]${N} Creating systemd service..."
SECRET=$(openssl rand -hex 32)
cat > /etc/systemd/system/$APP_SERVICE.service << EOF
[Unit]
Description=iPmartGit - Self-hosted Git Platform
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=SESSION_SECRET=$SECRET

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$APP_SERVICE" > /dev/null 2>&1
systemctl restart "$APP_SERVICE"
sleep 3
echo -e "${G}[ok]${N} Service started"

echo -e "${B}[6/6]${N} Configuring Nginx..."
SERVER_NAME="${DOMAIN:-_}"
cat > /etc/nginx/sites-available/ipmartgit << EOF
server {
    listen 80;
    server_name $SERVER_NAME;
    client_max_body_size 200M;

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
    }
}
EOF

ln -sf /etc/nginx/sites-available/ipmartgit /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t > /dev/null 2>&1 && systemctl reload nginx
echo -e "${G}[ok]${N} Nginx configured"

# Done
IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${G}+----------------------------------------------------------+${N}"
echo -e "${G}|${N}  ${W}iPmartGit installed successfully!${N}                        ${G}|${N}"
echo -e "${G}+----------------------------------------------------------+${N}"
echo ""
echo -e "  URL      : ${C}http://${DOMAIN:-$IP}${N}"
echo -e "  Login    : ${C}admin${N} / ${C}admin123${N}"
echo ""
echo -e "  ${Y}Change password after first login!${N}"
echo ""
echo -e "  Commands:"
echo -e "    Status  : systemctl status $APP_SERVICE"
echo -e "    Logs    : journalctl -u $APP_SERVICE -f"
echo -e "    Restart : systemctl restart $APP_SERVICE"
echo ""
