#!/bin/bash
# ============================================
#  iPmartGit - Professional Installer
#  https://github.com/iPmartNetwork/iPmartGit
#  For servers WITH free internet access
# ============================================

# ============ CONFIGURATION ============
APP_NAME="iPmartGit"
APP_DIR="/opt/ipmartgit"
APP_USER="ipmartgit"
APP_REPO="https://github.com/iPmartNetwork/iPmartGit.git"
APP_SERVICE="ipmartgit"
DEFAULT_PORT=3000

# ============ COLORS ============
RED='\033[0;31m'
GREEN='\033[1;32m'
BLUE='\033[1;34m'
CYAN='\033[1;36m'
YELLOW='\033[1;33m'
PURPLE='\033[1;35m'
GRAY='\033[0;37m'
WHITE='\033[1;37m'
NC='\033[0m'

# ============ HELPERS ============
print_banner() {
  clear
  echo ""
  echo -e "${BLUE}  +----------------------------------------------------------+${NC}"
  echo -e "${BLUE}  |${NC}                                                          ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}   ${PURPLE} _ ____  __  __    _    ____ _____${NC}                    ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}   ${PURPLE}(_)  _ \\|  \\/  |  / \\  |  _ \\_   _|${NC}                   ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}   ${PURPLE}| | |_) | |\\/| | / _ \\ | |_) || |${NC}                     ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}   ${PURPLE}| |  __/| |  | |/ ___ \\|  _ < | |${NC}                     ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}   ${PURPLE}|_|_|   |_|  |_/_/   \\_\\_| \\_\\|_|${NC}                     ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}                       ${CYAN}____ ___ _____${NC}                   ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}                      ${CYAN}/ ___|_ _|_   _|${NC}                  ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}                     ${CYAN}| |  _ | |  | |${NC}                    ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}                     ${CYAN}| |_| || |  | |${NC}                    ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}                      ${CYAN}\\____|___| |_|${NC}                    ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}                                                          ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}   ${WHITE}Self-hosted Git Platform${NC}              ${GRAY}v1.0.0${NC}           ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}   ${PURPLE}github.com/iPmartNetwork/iPmartGit${NC}                   ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}   ${GRAY}(International Server Edition)${NC}                        ${BLUE}|${NC}"
  echo -e "${BLUE}  |${NC}                                                          ${BLUE}|${NC}"
  echo -e "${BLUE}  +----------------------------------------------------------+${NC}"
  echo ""
}

log_info() { echo -e "  ${CYAN}[i]${NC} $1"; }
log_ok() { echo -e "  ${GREEN}[ok]${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "  ${RED}[x]${NC} $1"; }
log_step() { echo -e "\n  ${BLUE}[$1/$TOTAL_STEPS]${NC} ${PURPLE}$2${NC}"; }

check_root() {
  if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root: sudo bash deploy.sh"
    exit 1
  fi
}

get_ip() { hostname -I | awk '{print $1}'; }

is_installed() {
  [ -f "$APP_DIR/package.json" ] && [ -d "$APP_DIR/node_modules" ]
}

service_running() {
  systemctl is-active --quiet "$APP_SERVICE" 2>/dev/null
}

get_version() {
  if [ -f "$APP_DIR/package.json" ]; then
    grep '"version"' "$APP_DIR/package.json" | head -1 | awk -F'"' '{print $4}'
  else
    echo "not installed"
  fi
}

# ============ MENU ============
show_menu() {
  print_banner

  local status="${RED}* Not Installed${NC}"
  local version="-"
  local service_status="${RED}* Stopped${NC}"

  if is_installed; then
    status="${GREEN}* Installed${NC}"
    version=$(get_version)
  fi
  if service_running; then
    service_status="${GREEN}* Running${NC}"
  fi

  echo -e "  ${GRAY}-----------------------------------------${NC}"
  echo -e "  ${PURPLE}System Status${NC}"
  echo -e "  ${GRAY}-----------------------------------------${NC}"
  echo -e "    Status    : $status"
  echo -e "    Version   : ${CYAN}$version${NC}"
  echo -e "    Service   : $service_status"
  echo -e "    Directory : ${GRAY}$APP_DIR${NC}"
  echo -e "    URL       : ${CYAN}http://$(get_ip)${NC}"
  echo ""
  echo -e "  ${GRAY}-----------------------------------------${NC}"
  echo -e "  ${PURPLE}Select an option${NC}"
  echo -e "  ${GRAY}-----------------------------------------${NC}"
  echo ""
  echo -e "    ${GREEN}1)${NC}  Install iPmartGit"
  echo -e "    ${BLUE}2)${NC}  Update iPmartGit"
  echo -e "    ${CYAN}3)${NC}  Check Status"
  echo -e "    ${PURPLE}4)${NC}  Restart Service"
  echo -e "    ${GRAY}5)${NC}  View Logs"
  echo -e "    ${YELLOW}6)${NC}  SSL Certificate (Let's Encrypt)"
  echo -e "    ${CYAN}7)${NC}  Change Domain / Port"
  echo -e "    ${GREEN}8)${NC}  Backup Database"
  echo -e "    ${YELLOW}9)${NC}  Sync to Iran Server"
  echo -e "    ${PURPLE}10)${NC} Update Script"
  echo -e "    ${RED}11)${NC} Uninstall"
  echo -e "    ${GRAY}0)${NC}  Exit"
  echo ""
  echo -e "  ${GRAY}-----------------------------------------${NC}"
  echo -ne "  ${PURPLE}>${NC} Enter option [0-11]: "
  read -r choice

  case $choice in
    1) do_install ;;
    2) do_update ;;
    3) do_status ;;
    4) do_restart ;;
    5) do_logs ;;
    6) do_ssl ;;
    7) do_change_domain_port ;;
    8) do_backup ;;
    9) do_sync_iran ;;
    10) do_update_script ;;
    11) do_uninstall ;;
    0) echo ""; log_info "Goodbye!"; exit 0 ;;
    *) log_error "Invalid option"; sleep 1; show_menu ;;
  esac
}

# ============ INSTALL ============
do_install() {
  TOTAL_STEPS=6
  print_banner

  if is_installed; then
    log_warn "iPmartGit is already installed at $APP_DIR"
    echo -ne "  Reinstall? (y/N): "
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      show_menu
      return
    fi
  fi

  echo ""
  echo -ne "  ${WHITE}Enter domain (or press Enter for IP): ${NC}"
  read -r DOMAIN
  echo -ne "  ${WHITE}Enter port [${DEFAULT_PORT}]: ${NC}"
  read -r PORT
  PORT=${PORT:-$DEFAULT_PORT}

  echo ""
  log_info "Starting installation..."

  log_step 1 "Installing system dependencies..."
  apt-get update -qq > /dev/null 2>&1
  apt-get install -y -qq curl git build-essential nginx openssl python3 make g++ > /dev/null 2>&1
  log_ok "Dependencies installed"

  log_step 2 "Installing Node.js 20..."
  if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 18 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
  fi
  log_ok "Node.js $(node -v) ready"

  log_step 3 "Downloading iPmartGit..."
  if ! id "$APP_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$APP_USER"
  fi
  if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR" && git pull origin master 2>/dev/null
  else
    rm -rf "$APP_DIR"
    git clone "$APP_REPO" "$APP_DIR"
  fi
  mkdir -p "$APP_DIR/db" "$APP_DIR/repositories" "$APP_DIR/git-repos" "$APP_DIR/uploads" "$APP_DIR/uploads/temp" "$APP_DIR/uploads/releases"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  log_ok "Project ready"

  log_step 4 "Installing npm dependencies..."
  cd "$APP_DIR"
  su - "$APP_USER" -c "cd $APP_DIR && npm install --production" 2>&1 | tail -3
  su - "$APP_USER" -c "cd $APP_DIR && node scripts/setup.js" 2>&1 | tail -5
  log_ok "Dependencies installed"

  log_step 5 "Creating systemd service..."
  create_service "$PORT"
  log_ok "Service started"

  log_step 6 "Configuring Nginx..."
  configure_nginx "$DOMAIN" "$PORT"
  log_ok "Nginx configured"

  show_install_complete "$DOMAIN" "$PORT"
}

# ============ UPDATE ============
do_update() {
  print_banner
  if ! is_installed; then
    log_error "Not installed. Install first."
    sleep 2; show_menu; return
  fi

  log_info "Updating iPmartGit..."
  echo ""

  # Backup DB
  if [ -f "$APP_DIR/db/ipmartgit.db" ]; then
    cp "$APP_DIR/db/ipmartgit.db" "$APP_DIR/db/ipmartgit.db.bak-$(date +%Y%m%d%H%M%S)"
    log_ok "Database backed up"
  fi

  systemctl stop "$APP_SERVICE" 2>/dev/null || true

  # Fix git safe directory
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null

  # Force update from GitHub (fresh clone to temp, then sync)
  log_info "Downloading latest version from GitHub..."
  rm -rf /tmp/iPmartGit-update
  if git clone "$APP_REPO" /tmp/iPmartGit-update 2>/dev/null; then
    # Sync all files EXCEPT data directories
    rsync -a --delete \
      --exclude='db/' \
      --exclude='repositories/' \
      --exclude='git-repos/' \
      --exclude='uploads/' \
      --exclude='node_modules/' \
      --exclude='.git/' \
      /tmp/iPmartGit-update/ "$APP_DIR/"
    rm -rf /tmp/iPmartGit-update
    log_ok "Files updated from GitHub"
  else
    log_error "Failed to download from GitHub"
    systemctl start "$APP_SERVICE" 2>/dev/null
    echo ""; echo -ne "  Press Enter..."; read -r; show_menu; return
  fi

  # Reinstall dependencies
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  log_info "Installing dependencies..."
  su - "$APP_USER" -c "cd $APP_DIR && npm install --production" 2>&1 | tail -3
  log_ok "Dependencies updated"

  # Restart
  systemctl start "$APP_SERVICE"
  sleep 3

  if service_running; then
    log_ok "iPmartGit updated and running! (v$(get_version))"
  else
    log_error "Service failed to start"
    journalctl -u "$APP_SERVICE" --no-pager -n 10
  fi

  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ UPDATE SCRIPT ============
do_update_script() {
  print_banner
  log_info "Updating installer script..."

  local SCRIPT_URL="https://raw.githubusercontent.com/iPmartNetwork/iPmartGit/master/deploy.sh"
  local SCRIPT_PATH="$APP_DIR/deploy.sh"

  if curl -fsSL --connect-timeout 15 -o /tmp/deploy-new.sh "$SCRIPT_URL" 2>/dev/null; then
    # Verify it's a valid script
    if head -1 /tmp/deploy-new.sh | grep -q "bash"; then
      cp /tmp/deploy-new.sh "$SCRIPT_PATH"
      chmod +x "$SCRIPT_PATH"
      rm -f /tmp/deploy-new.sh
      log_ok "Script updated to latest version!"
      echo ""
      echo -e "  ${YELLOW}Restarting script...${NC}"
      sleep 1
      exec bash "$SCRIPT_PATH"
    else
      log_error "Downloaded file is not a valid script"
      rm -f /tmp/deploy-new.sh
    fi
  else
    log_error "Failed to download. Check internet connection."
  fi

  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ STATUS ============
do_status() {
  print_banner
  echo -e "  ${WHITE}System Check:${NC}"
  echo -e "  ========================================="
  echo ""
  command -v node &>/dev/null && echo -e "  Node.js   : ${GREEN}$(node -v)${NC}" || echo -e "  Node.js   : ${RED}Not installed${NC}"
  command -v npm &>/dev/null && echo -e "  npm       : ${GREEN}$(npm -v)${NC}" || echo -e "  npm       : ${RED}Not installed${NC}"
  command -v git &>/dev/null && echo -e "  Git       : ${GREEN}$(git --version | awk '{print $3}')${NC}" || echo -e "  Git       : ${RED}Not installed${NC}"
  command -v nginx &>/dev/null && echo -e "  Nginx     : ${GREEN}$(nginx -v 2>&1 | awk -F/ '{print $2}')${NC}" || echo -e "  Nginx     : ${RED}Not installed${NC}"
  echo ""
  is_installed && echo -e "  iPmartGit : ${GREEN}Installed (v$(get_version))${NC}" || echo -e "  iPmartGit : ${RED}Not installed${NC}"
  service_running && echo -e "  Service   : ${GREEN}Running${NC}" || echo -e "  Service   : ${RED}Stopped${NC}"

  if [ -f "/etc/systemd/system/$APP_SERVICE.service" ]; then
    local port=$(grep "PORT=" "/etc/systemd/system/$APP_SERVICE.service" | grep -oP '\d+' | head -1)
    echo -e "  Port      : ${CYAN}${port:-$DEFAULT_PORT}${NC}"
  fi
  if [ -f "/etc/nginx/sites-available/ipmartgit" ]; then
    local domain=$(grep "server_name" /etc/nginx/sites-available/ipmartgit | head -1 | awk '{print $2}' | tr -d ';')
    echo -e "  Domain    : ${CYAN}$domain${NC}"
    grep -q "ssl_certificate" /etc/nginx/sites-available/ipmartgit 2>/dev/null && echo -e "  SSL       : ${GREEN}Active${NC}" || echo -e "  SSL       : ${YELLOW}Not configured${NC}"
  fi
  if [ -f "$APP_DIR/db/ipmartgit.db" ]; then
    echo -e "  Database  : ${CYAN}$(du -h "$APP_DIR/db/ipmartgit.db" | awk '{print $1}')${NC}"
  fi
  [ -d "$APP_DIR" ] && echo -e "  Disk      : ${CYAN}$(du -sh "$APP_DIR" 2>/dev/null | awk '{print $1}')${NC}"
  echo -e "  URL       : ${CYAN}http://$(get_ip)${NC}"
  echo ""

  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ RESTART ============
do_restart() {
  print_banner
  log_info "Restarting..."
  systemctl restart "$APP_SERVICE" 2>/dev/null
  sleep 2
  service_running && log_ok "Service restarted" || log_error "Failed to start"
  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ LOGS ============
do_logs() {
  print_banner
  log_info "Last 30 lines:"
  echo ""
  journalctl -u "$APP_SERVICE" --no-pager -n 30
  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ SSL ============
do_ssl() {
  print_banner
  local domain=$(grep "server_name" /etc/nginx/sites-available/ipmartgit 2>/dev/null | awk '{print $2}' | tr -d ';')

  if [ "$domain" == "_" ] || [ -z "$domain" ]; then
    log_error "No domain set. Use option 7 first."
    echo ""; echo -ne "  Press Enter..."; read -r; show_menu; return
  fi

  echo -e "  Domain: ${CYAN}$domain${NC}"
  echo -ne "  Email (or Enter to skip): "
  read -r email

  log_info "Installing certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1

  local email_flag="--register-unsafely-without-email"
  [ -n "$email" ] && email_flag="--email $email"

  if certbot --nginx -d "$domain" $email_flag --agree-tos --non-interactive --redirect; then
    log_ok "SSL installed! https://$domain"
  else
    log_error "SSL failed. Check DNS and port 80."
  fi

  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ CHANGE DOMAIN/PORT ============
do_change_domain_port() {
  print_banner
  echo -e "  1) Change port"
  echo -e "  2) Set domain"
  echo -e "  0) Back"
  echo -ne "  Option: "
  read -r sub

  case $sub in
    1)
      echo -ne "  New port: "
      read -r new_port
      sed -i "s/Environment=PORT=.*/Environment=PORT=$new_port/" "/etc/systemd/system/$APP_SERVICE.service"
      systemctl daemon-reload
      sed -i "s/proxy_pass http:\/\/127.0.0.1:[0-9]*/proxy_pass http:\/\/127.0.0.1:$new_port/" /etc/nginx/sites-available/ipmartgit
      nginx -t 2>/dev/null && systemctl reload nginx
      systemctl restart "$APP_SERVICE"
      log_ok "Port changed to $new_port"
      ;;
    2)
      echo -ne "  Domain: "
      read -r new_domain
      sed -i "s/server_name .*/server_name $new_domain;/" /etc/nginx/sites-available/ipmartgit
      nginx -t 2>/dev/null && systemctl reload nginx
      log_ok "Domain set to $new_domain"
      echo -e "  ${YELLOW}Point DNS A record to $(get_ip), then use option 6 for SSL${NC}"
      ;;
    0) show_menu; return ;;
  esac

  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ BACKUP ============
do_backup() {
  print_banner
  local backup_dir="/root/ipmartgit-backups"
  local file="$backup_dir/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
  mkdir -p "$backup_dir"

  log_info "Creating backup..."
  tar -czf "$file" -C "$APP_DIR" db/ repositories/ git-repos/ uploads/ 2>/dev/null

  [ -f "$file" ] && log_ok "Backup: $file ($(du -h "$file" | awk '{print $1}'))" || log_error "Backup failed"

  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ SYNC TO IRAN ============
do_sync_iran() {
  print_banner
  echo -e "  ${WHITE}Sync to Iran Server (Database + Code)${NC}"
  echo -e "  ${GRAY}-----------------------------------------${NC}"
  echo ""
  echo -ne "  Iran server IP: "
  read -r iran_ip
  echo -ne "  SSH port [22]: "
  read -r iran_port
  iran_port=${iran_port:-22}

  if [ -z "$iran_ip" ]; then
    log_error "IP required"
    echo ""; echo -ne "  Press Enter..."; read -r; show_menu; return
  fi

  echo ""
  echo -e "  ${WHITE}What to sync?${NC}"
  echo -e "    1) Database only (repositories, users, files)"
  echo -e "    2) Code only (HTML, CSS, JS, routes)"
  echo -e "    3) Both (database + code) [recommended]"
  echo -e "    0) Back"
  echo ""
  echo -ne "  Option: "
  read -r sync_choice

  case $sync_choice in
    1) sync_database "$iran_ip" "$iran_port" ;;
    2) sync_code "$iran_ip" "$iran_port" ;;
    3) sync_database "$iran_ip" "$iran_port"; sync_code "$iran_ip" "$iran_port" ;;
    0) show_menu; return ;;
    *) log_error "Invalid"; show_menu; return ;;
  esac

  echo ""; echo -ne "  Press Enter..."; read -r; show_menu
}

sync_database() {
  local ip=$1 port=$2
  log_info "Syncing database to $ip..."

  # Create sync package with database
  tar -czf /tmp/ipmartgit-db.tar.gz -C "$APP_DIR" db/ipmartgit.db 2>/dev/null

  if scp -P "$port" /tmp/ipmartgit-db.tar.gz "root@$ip:/opt/ipmartgit/"; then
    ssh -p "$port" "root@$ip" "cd /opt/ipmartgit && systemctl stop ipmartgit && tar -xzf ipmartgit-db.tar.gz && rm ipmartgit-db.tar.gz && chown -R ipmartgit:ipmartgit db/ && systemctl start ipmartgit" 2>&1
    log_ok "Database synced!"
  else
    log_error "Failed. Try from Iran server instead:"
    echo -e "  ${CYAN}scp root@$(get_ip):/opt/ipmartgit/db/ipmartgit.db /opt/ipmartgit/db/${NC}"
  fi
  rm -f /tmp/ipmartgit-db.tar.gz
}

sync_code() {
  local ip=$1 port=$2
  log_info "Syncing code to $ip..."

  # Create package with all code files (exclude data)
  tar -czf /tmp/ipmartgit-code.tar.gz -C "$APP_DIR" \
    --exclude='db' \
    --exclude='repositories' \
    --exclude='git-repos' \
    --exclude='uploads' \
    --exclude='node_modules' \
    --exclude='.git' \
    . 2>/dev/null

  if scp -P "$port" /tmp/ipmartgit-code.tar.gz "root@$ip:/opt/ipmartgit/"; then
    ssh -p "$port" "root@$ip" "cd /opt/ipmartgit && tar -xzf ipmartgit-code.tar.gz && rm ipmartgit-code.tar.gz && chown -R ipmartgit:ipmartgit . && systemctl restart ipmartgit" 2>&1
    log_ok "Code synced!"
  else
    log_error "Failed. Try from Iran server instead:"
    echo -e "  ${CYAN}scp -r root@$(get_ip):/opt/ipmartgit/public /opt/ipmartgit/${NC}"
    echo -e "  ${CYAN}scp -r root@$(get_ip):/opt/ipmartgit/routes /opt/ipmartgit/${NC}"
    echo -e "  ${CYAN}scp root@$(get_ip):/opt/ipmartgit/server.js /opt/ipmartgit/${NC}"
  fi
  rm -f /tmp/ipmartgit-code.tar.gz
}

# ============ UNINSTALL ============
do_uninstall() {
  print_banner
  echo -e "  ${RED}WARNING: This will remove iPmartGit!${NC}"
  echo -ne "  Type 'yes' to confirm: "
  read -r confirm
  [ "$confirm" != "yes" ] && { show_menu; return; }

  echo -ne "  Keep data? (Y/n): "
  read -r keep

  systemctl stop "$APP_SERVICE" 2>/dev/null || true
  systemctl disable "$APP_SERVICE" 2>/dev/null || true
  rm -f "/etc/systemd/system/$APP_SERVICE.service"
  systemctl daemon-reload
  rm -f /etc/nginx/sites-enabled/ipmartgit /etc/nginx/sites-available/ipmartgit
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null

  if [[ "$keep" == "n" || "$keep" == "N" ]]; then
    rm -rf "$APP_DIR"
    log_ok "All removed"
  else
    rm -rf "$APP_DIR/node_modules"
    log_ok "Code removed, data kept"
  fi

  userdel "$APP_USER" 2>/dev/null || true
  log_ok "Uninstalled"
  exit 0
}

# ============ HELPER FUNCTIONS ============
create_service() {
  local port=$1
  local secret=$(openssl rand -hex 32)
  cat > "/etc/systemd/system/$APP_SERVICE.service" << EOF
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
Environment=PORT=$port
Environment=SESSION_SECRET=$secret

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "$APP_SERVICE" > /dev/null 2>&1
  systemctl start "$APP_SERVICE"
  sleep 3
  if ! service_running; then
    log_error "Service failed:"
    journalctl -u "$APP_SERVICE" --no-pager -n 10
    exit 1
  fi
}

configure_nginx() {
  local domain=$1 port=$2
  local server_name="${domain:-_}"
  cat > /etc/nginx/sites-available/ipmartgit << EOF
server {
    listen 80;
    server_name $server_name;
    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:$port;
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
}

show_install_complete() {
  local domain=$1 port=$2
  local ip=$(get_ip)
  echo ""
  echo -e "  ${GREEN}+----------------------------------------------------------+${NC}"
  echo -e "  ${GREEN}|${NC}  ${WHITE}iPmartGit installed successfully!${NC}                        ${GREEN}|${NC}"
  echo -e "  ${GREEN}+----------------------------------------------------------+${NC}"
  echo ""
  echo -e "  URL      : ${CYAN}http://${domain:-$ip}${NC}"
  echo -e "  Login    : ${CYAN}admin${NC} / ${CYAN}admin123${NC}"
  echo ""
  echo -e "  ${YELLOW}Change password after first login!${NC}"
  echo ""
  echo -e "  Git Clone: ${CYAN}git clone http://${domain:-$ip}/git/USERNAME/REPO.git${NC}"
  echo ""
  echo -e "  Commands:"
  echo -e "    Status  : systemctl status $APP_SERVICE"
  echo -e "    Logs    : journalctl -u $APP_SERVICE -f"
  echo -e "    Restart : systemctl restart $APP_SERVICE"
  echo ""
  echo -e "  Re-run: ${CYAN}bash <(curl -s https://raw.githubusercontent.com/iPmartNetwork/iPmartGit/master/deploy.sh)${NC}"
  echo ""
  echo -ne "  Press Enter..."; read -r; show_menu
}

# ============ MAIN ============
check_root

if [ "$1" == "--install" ] || [ "$1" == "-i" ]; then
  DOMAIN="$2"; PORT="${3:-$DEFAULT_PORT}"; do_install; exit 0
fi

show_menu
