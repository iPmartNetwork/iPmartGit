#!/bin/bash
# ============================================
#  iPmartGit - Professional Installer
#  https://github.com/iPmartNetwork/iPmartGit
#  Compatible: Ubuntu 20/22/24, Debian 11/12
# ============================================

set -e

# ============ CONFIGURATION ============
APP_NAME="iPmartGit"
APP_DIR="/opt/ipmartgit"
APP_USER="ipmartgit"
APP_REPO="https://github.com/iPmartNetwork/iPmartGit.git"
APP_SERVICE="ipmartgit"
DEFAULT_PORT=3000

# ============ COLORS ============
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# ============ HELPERS ============
print_banner() {
  clear
  echo -e "${CYAN}"
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║                                              ║"
  echo "  ║          iPmartGit Installer v1.0            ║"
  echo "  ║       Self-hosted Git Platform               ║"
  echo "  ║                                              ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo ""
}

log_info() { echo -e "  ${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "  ${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "  ${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n  ${PURPLE}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"; }

check_root() {
  if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root: sudo bash deploy-iran.sh"
    exit 1
  fi
}

get_ip() {
  hostname -I | awk '{print $1}'
}

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

  local status="${RED}Not Installed${NC}"
  local version="—"
  local service_status="${RED}Stopped${NC}"

  if is_installed; then
    status="${GREEN}Installed${NC}"
    version=$(get_version)
  fi

  if service_running; then
    service_status="${GREEN}Running${NC}"
  fi

  echo -e "  ${BOLD}System Status:${NC}"
  echo -e "  ─────────────────────────────────"
  echo -e "  Status    : $status"
  echo -e "  Version   : ${CYAN}$version${NC}"
  echo -e "  Service   : $service_status"
  echo -e "  Directory : ${CYAN}$APP_DIR${NC}"
  echo -e "  URL       : ${CYAN}http://$(get_ip)${NC}"
  echo ""
  echo -e "  ${BOLD}Select an option:${NC}"
  echo -e "  ─────────────────────────────────"
  echo -e "  ${GREEN}1)${NC} Install iPmartGit"
  echo -e "  ${BLUE}2)${NC} Update iPmartGit"
  echo -e "  ${CYAN}3)${NC} Check Status"
  echo -e "  ${YELLOW}4)${NC} Restart Service"
  echo -e "  ${PURPLE}5)${NC} View Logs"
  echo -e "  ${NC}6)${NC} SSL Certificate (Let's Encrypt)"
  echo -e "  ${NC}7)${NC} Change Domain / Port"
  echo -e "  ${NC}8)${NC} Firewall Settings"
  echo -e "  ${NC}9)${NC} Backup Database"
  echo -e "  ${RED}10)${NC} Uninstall iPmartGit"
  echo -e "  ${NC}0)${NC} Exit"
  echo ""
  echo -ne "  ${BOLD}Enter option [0-10]: ${NC}"
  read -r choice

  case $choice in
    1) do_install ;;
    2) do_update ;;
    3) do_status ;;
    4) do_restart ;;
    5) do_logs ;;
    6) do_ssl ;;
    7) do_change_domain_port ;;
    8) do_firewall ;;
    9) do_backup ;;
    10) do_uninstall ;;
    0) echo ""; log_info "Goodbye!"; exit 0 ;;
    *) log_error "Invalid option"; sleep 1; show_menu ;;
  esac
}

# ============ INSTALL ============
do_install() {
  TOTAL_STEPS=7
  print_banner

  if is_installed; then
    log_warn "iPmartGit is already installed at $APP_DIR"
    echo -ne "  Do you want to reinstall? (y/N): "
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      show_menu
      return
    fi
  fi

  # Ask for domain
  echo ""
  echo -ne "  ${BOLD}Enter domain (or press Enter for IP access): ${NC}"
  read -r DOMAIN

  echo -ne "  ${BOLD}Enter port [${DEFAULT_PORT}]: ${NC}"
  read -r PORT
  PORT=${PORT:-$DEFAULT_PORT}

  echo ""
  log_info "Starting installation..."
  echo ""

  # Step 1: System dependencies
  log_step 1 "Installing system dependencies..."
  apt-get update -qq > /dev/null 2>&1
  apt-get install -y -qq curl git build-essential nginx openssl > /dev/null 2>&1
  log_ok "System dependencies installed"

  # Step 2: Node.js
  log_step 2 "Installing Node.js..."
  install_nodejs
  log_ok "Node.js $(node -v) ready"

  # Step 3: System user
  log_step 3 "Creating system user..."
  if ! id "$APP_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$APP_USER"
  fi
  log_ok "User '$APP_USER' ready"

  # Step 4: Download project
  log_step 4 "Downloading iPmartGit..."
  download_project
  log_ok "Project files ready at $APP_DIR"

  # Step 5: Install dependencies
  log_step 5 "Installing npm dependencies (this may take a few minutes)..."
  cd "$APP_DIR"
  install_npm_deps
  su - "$APP_USER" -c "cd $APP_DIR && node scripts/setup.js"
  log_ok "Dependencies installed and database initialized"

  # Step 6: Create systemd service
  log_step 6 "Creating systemd service..."
  create_service "$PORT"
  log_ok "Service created and started"

  # Step 7: Configure Nginx
  log_step 7 "Configuring Nginx..."
  configure_nginx "$DOMAIN" "$PORT"
  log_ok "Nginx configured"

  # Done
  show_install_complete "$DOMAIN" "$PORT"
}

# ============ UPDATE ============
do_update() {
  print_banner

  if ! is_installed; then
    log_error "iPmartGit is not installed. Please install first."
    sleep 2
    show_menu
    return
  fi

  log_info "Updating iPmartGit..."
  echo ""

  # Backup database
  if [ -f "$APP_DIR/db/ipmartgit.db" ]; then
    cp "$APP_DIR/db/ipmartgit.db" "$APP_DIR/db/ipmartgit.db.backup-$(date +%Y%m%d%H%M%S)"
    log_ok "Database backed up"
  fi

  # Stop service
  systemctl stop "$APP_SERVICE" 2>/dev/null || true
  log_ok "Service stopped"

  # Pull latest code
  cd "$APP_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    su - "$APP_USER" -c "cd $APP_DIR && git pull origin master" 2>&1 | tail -5
  else
    # Re-download
    rm -rf /tmp/iPmartGit
    git clone "$APP_REPO" /tmp/iPmartGit 2>/dev/null
    # Keep data directories
    rsync -a --exclude='db' --exclude='repositories' --exclude='git-repos' --exclude='uploads' --exclude='node_modules' /tmp/iPmartGit/ "$APP_DIR/"
    rm -rf /tmp/iPmartGit
  fi
  log_ok "Code updated"

  # Reinstall dependencies
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  install_npm_deps
  log_ok "Dependencies updated"

  # Restart
  systemctl start "$APP_SERVICE"
  sleep 2

  if service_running; then
    log_ok "iPmartGit updated and running!"
    echo ""
    echo -e "  Version: ${CYAN}$(get_version)${NC}"
  else
    log_error "Service failed to start after update"
    journalctl -u "$APP_SERVICE" --no-pager -n 10
  fi

  echo ""
  echo -ne "  Press Enter to return to menu..."
  read -r
  show_menu
}

# ============ STATUS ============
do_status() {
  print_banner
  echo -e "  ${BOLD}System Check:${NC}"
  echo -e "  ═══════════════════════════════════════"
  echo ""

  # Node.js
  if command -v node &>/dev/null; then
    echo -e "  Node.js     : ${GREEN}$(node -v)${NC}"
  else
    echo -e "  Node.js     : ${RED}Not installed${NC}"
  fi

  # npm
  if command -v npm &>/dev/null; then
    echo -e "  npm         : ${GREEN}$(npm -v)${NC}"
  else
    echo -e "  npm         : ${RED}Not installed${NC}"
  fi

  # Git
  if command -v git &>/dev/null; then
    echo -e "  Git         : ${GREEN}$(git --version | awk '{print $3}')${NC}"
  else
    echo -e "  Git         : ${RED}Not installed${NC}"
  fi

  # Nginx
  if command -v nginx &>/dev/null; then
    echo -e "  Nginx       : ${GREEN}$(nginx -v 2>&1 | awk -F/ '{print $2}')${NC}"
  else
    echo -e "  Nginx       : ${RED}Not installed${NC}"
  fi

  echo ""

  # App status
  if is_installed; then
    echo -e "  iPmartGit   : ${GREEN}Installed (v$(get_version))${NC}"
  else
    echo -e "  iPmartGit   : ${RED}Not installed${NC}"
  fi

  # Service
  if service_running; then
    echo -e "  Service     : ${GREEN}Running${NC}"
    local pid=$(systemctl show -p MainPID "$APP_SERVICE" | cut -d= -f2)
    echo -e "  PID         : ${CYAN}$pid${NC}"
    local mem=$(ps -p "$pid" -o rss= 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
    echo -e "  Memory      : ${CYAN}$mem${NC}"
  else
    echo -e "  Service     : ${RED}Stopped${NC}"
  fi

  # Port
  if [ -f "/etc/systemd/system/$APP_SERVICE.service" ]; then
    local port=$(grep "PORT=" "/etc/systemd/system/$APP_SERVICE.service" | grep -oP '\d+' | head -1)
    echo -e "  Port        : ${CYAN}${port:-$DEFAULT_PORT}${NC}"
  fi

  # Domain & SSL
  if [ -f "/etc/nginx/sites-available/ipmartgit" ]; then
    local domain=$(grep "server_name" /etc/nginx/sites-available/ipmartgit | head -1 | awk '{print $2}' | tr -d ';')
    echo -e "  Domain      : ${CYAN}${domain}${NC}"
    if grep -q "ssl_certificate" /etc/nginx/sites-available/ipmartgit 2>/dev/null; then
      echo -e "  SSL         : ${GREEN}Active (HTTPS)${NC}"
    else
      echo -e "  SSL         : ${YELLOW}Not configured${NC}"
    fi
  fi

  # Firewall
  if command -v ufw &>/dev/null; then
    local fw=$(ufw status 2>/dev/null | head -1 | awk '{print $2}')
    echo -e "  Firewall    : ${CYAN}${fw:-unknown}${NC}"
  fi

  # Database
  if [ -f "$APP_DIR/db/ipmartgit.db" ]; then
    local db_size=$(du -h "$APP_DIR/db/ipmartgit.db" | awk '{print $1}')
    echo -e "  Database    : ${CYAN}$db_size${NC}"
  fi

  # Disk usage
  if [ -d "$APP_DIR" ]; then
    local disk=$(du -sh "$APP_DIR" 2>/dev/null | awk '{print $1}')
    echo -e "  Disk Usage  : ${CYAN}$disk${NC}"
  fi

  echo ""
  echo -e "  URL         : ${CYAN}http://$(get_ip)${NC}"
  echo ""
  echo -e "  ═══════════════════════════════════════"

  echo ""
  echo -ne "  Press Enter to return to menu..."
  read -r
  show_menu
}

# ============ RESTART ============
do_restart() {
  print_banner
  log_info "Restarting iPmartGit..."
  systemctl restart "$APP_SERVICE" 2>/dev/null
  sleep 2
  if service_running; then
    log_ok "Service restarted successfully"
  else
    log_error "Service failed to start"
    journalctl -u "$APP_SERVICE" --no-pager -n 10
  fi
  echo ""
  echo -ne "  Press Enter to return to menu..."
  read -r
  show_menu
}

# ============ LOGS ============
do_logs() {
  print_banner
  log_info "Showing last 30 lines of logs (Ctrl+C to exit)..."
  echo ""
  journalctl -u "$APP_SERVICE" --no-pager -n 30
  echo ""
  echo -ne "  Press Enter to return to menu..."
  read -r
  show_menu
}

# ============ UNINSTALL ============
do_uninstall() {
  print_banner
  echo -e "  ${RED}${BOLD}WARNING: This will remove iPmartGit completely!${NC}"
  echo ""
  echo -ne "  Are you sure? Type '${RED}yes${NC}' to confirm: "
  read -r confirm

  if [ "$confirm" != "yes" ]; then
    log_info "Cancelled."
    sleep 1
    show_menu
    return
  fi

  echo -ne "  Keep database and uploads? (Y/n): "
  read -r keep_data

  log_info "Uninstalling..."

  # Stop and disable service
  systemctl stop "$APP_SERVICE" 2>/dev/null || true
  systemctl disable "$APP_SERVICE" 2>/dev/null || true
  rm -f "/etc/systemd/system/$APP_SERVICE.service"
  systemctl daemon-reload

  # Remove Nginx config
  rm -f /etc/nginx/sites-enabled/ipmartgit
  rm -f /etc/nginx/sites-available/ipmartgit
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null

  if [[ "$keep_data" == "n" || "$keep_data" == "N" ]]; then
    rm -rf "$APP_DIR"
    log_ok "All files removed"
  else
    # Keep data, remove code
    find "$APP_DIR" -maxdepth 1 ! -name 'db' ! -name 'repositories' ! -name 'git-repos' ! -name 'uploads' ! -path "$APP_DIR" -exec rm -rf {} +
    rm -rf "$APP_DIR/node_modules"
    log_ok "Code removed, data preserved at $APP_DIR"
  fi

  # Remove user
  userdel "$APP_USER" 2>/dev/null || true

  log_ok "iPmartGit uninstalled"
  echo ""
  echo -ne "  Press Enter to exit..."
  read -r
  exit 0
}

# ============ CHANGE DOMAIN / PORT ============
do_change_domain_port() {
  print_banner
  echo -e "  ${BOLD}Current Configuration:${NC}"

  local current_port=$(grep "PORT=" "/etc/systemd/system/$APP_SERVICE.service" 2>/dev/null | grep -oP '\d+' | head -1)
  local current_domain=$(grep "server_name" /etc/nginx/sites-available/ipmartgit 2>/dev/null | awk '{print $2}' | tr -d ';')

  echo -e "  Port   : ${CYAN}${current_port:-$DEFAULT_PORT}${NC}"
  echo -e "  Domain : ${CYAN}${current_domain:-'_ (any)'}${NC}"
  echo ""
  echo -e "  ${BOLD}What do you want to change?${NC}"
  echo -e "  1) Change port"
  echo -e "  2) Set/Change domain"
  echo -e "  3) Remove domain (use IP only)"
  echo -e "  0) Back"
  echo ""
  echo -ne "  Enter option: "
  read -r sub_choice

  case $sub_choice in
    1)
      echo -ne "  Enter new port: "
      read -r new_port
      if ! [[ "$new_port" =~ ^[0-9]+$ ]] || [ "$new_port" -lt 1 ] || [ "$new_port" -gt 65535 ]; then
        log_error "Invalid port number"
        sleep 1
        show_menu
        return
      fi
      sed -i "s/Environment=PORT=.*/Environment=PORT=$new_port/" "/etc/systemd/system/$APP_SERVICE.service"
      systemctl daemon-reload
      sed -i "s/proxy_pass http:\/\/127.0.0.1:[0-9]*/proxy_pass http:\/\/127.0.0.1:$new_port/" /etc/nginx/sites-available/ipmartgit
      nginx -t 2>/dev/null && systemctl reload nginx
      systemctl restart "$APP_SERVICE"
      sleep 2
      log_ok "Port changed to $new_port"
      ;;
    2)
      echo -ne "  Enter domain (e.g. git.example.com): "
      read -r new_domain
      if [ -z "$new_domain" ]; then
        log_error "Domain cannot be empty"
        sleep 1
        show_menu
        return
      fi
      sed -i "s/server_name .*/server_name $new_domain;/" /etc/nginx/sites-available/ipmartgit
      nginx -t 2>/dev/null && systemctl reload nginx
      log_ok "Domain set to $new_domain"
      echo ""
      echo -e "  ${YELLOW}Don't forget to point your DNS A record to $(get_ip)${NC}"
      echo -e "  ${YELLOW}Then run option 6 to get SSL certificate${NC}"
      ;;
    3)
      sed -i "s/server_name .*/server_name _;/" /etc/nginx/sites-available/ipmartgit
      # Remove SSL if exists
      sed -i '/listen 443/d' /etc/nginx/sites-available/ipmartgit 2>/dev/null
      sed -i '/ssl_certificate/d' /etc/nginx/sites-available/ipmartgit 2>/dev/null
      nginx -t 2>/dev/null && systemctl reload nginx
      log_ok "Domain removed, using IP access"
      ;;
    0) show_menu; return ;;
    *) log_error "Invalid option" ;;
  esac

  echo ""
  echo -ne "  Press Enter to return to menu..."
  read -r
  show_menu
}

# ============ SSL CERTIFICATE ============
do_ssl() {
  print_banner
  echo -e "  ${BOLD}SSL Certificate (Let's Encrypt)${NC}"
  echo ""

  # Check if domain is set
  local current_domain=$(grep "server_name" /etc/nginx/sites-available/ipmartgit 2>/dev/null | awk '{print $2}' | tr -d ';')

  if [ "$current_domain" == "_" ] || [ -z "$current_domain" ]; then
    log_error "No domain configured. Set a domain first (option 7)."
    echo ""
    echo -ne "  Press Enter to return to menu..."
    read -r
    show_menu
    return
  fi

  echo -e "  Domain: ${CYAN}$current_domain${NC}"
  echo ""
  echo -e "  ${YELLOW}Make sure:${NC}"
  echo -e "  • DNS A record points to ${CYAN}$(get_ip)${NC}"
  echo -e "  • Port 80 is open (for verification)"
  echo ""
  echo -ne "  Enter email for SSL notifications (or press Enter to skip): "
  read -r ssl_email

  echo ""
  log_info "Installing Certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1

  log_info "Requesting SSL certificate..."
  echo ""

  local email_flag=""
  if [ -n "$ssl_email" ]; then
    email_flag="--email $ssl_email"
  else
    email_flag="--register-unsafely-without-email"
  fi

  if certbot --nginx -d "$current_domain" $email_flag --agree-tos --non-interactive --redirect; then
    echo ""
    log_ok "SSL certificate installed successfully!"
    echo -e "  Your site is now available at: ${CYAN}https://$current_domain${NC}"
    echo ""
    echo -e "  Certificate auto-renews via systemd timer."
    echo -e "  Manual renewal: ${CYAN}certbot renew${NC}"
  else
    echo ""
    log_error "SSL certificate installation failed."
    echo -e "  Common issues:"
    echo -e "  • DNS not pointing to this server"
    echo -e "  • Port 80 blocked by firewall"
    echo -e "  • Domain not reachable from internet"
  fi

  echo ""
  echo -ne "  Press Enter to return to menu..."
  read -r
  show_menu
}

# ============ FIREWALL ============
do_firewall() {
  print_banner
  echo -e "  ${BOLD}Firewall Settings (UFW)${NC}"
  echo ""

  # Install UFW if not present
  if ! command -v ufw &>/dev/null; then
    log_info "Installing UFW..."
    apt-get install -y -qq ufw > /dev/null 2>&1
  fi

  local ufw_status=$(ufw status 2>/dev/null | head -1)
  echo -e "  UFW Status: ${CYAN}$ufw_status${NC}"
  echo ""

  echo -e "  ${BOLD}Options:${NC}"
  echo -e "  1) Enable firewall & open required ports (22, 80, 443)"
  echo -e "  2) Open additional port"
  echo -e "  3) Show current rules"
  echo -e "  4) Disable firewall"
  echo -e "  0) Back"
  echo ""
  echo -ne "  Enter option: "
  read -r fw_choice

  case $fw_choice in
    1)
      log_info "Configuring firewall..."
      ufw default deny incoming > /dev/null 2>&1
      ufw default allow outgoing > /dev/null 2>&1
      ufw allow 22/tcp > /dev/null 2>&1    # SSH
      ufw allow 80/tcp > /dev/null 2>&1    # HTTP
      ufw allow 443/tcp > /dev/null 2>&1   # HTTPS
      echo "y" | ufw enable > /dev/null 2>&1
      log_ok "Firewall enabled. Ports 22, 80, 443 are open."
      ;;
    2)
      echo -ne "  Enter port to open: "
      read -r open_port
      if [[ "$open_port" =~ ^[0-9]+$ ]]; then
        ufw allow "$open_port/tcp" > /dev/null 2>&1
        log_ok "Port $open_port opened"
      else
        log_error "Invalid port"
      fi
      ;;
    3)
      echo ""
      ufw status numbered 2>/dev/null || echo "  UFW not active"
      ;;
    4)
      ufw disable > /dev/null 2>&1
      log_ok "Firewall disabled"
      ;;
    0) show_menu; return ;;
  esac

  echo ""
  echo -ne "  Press Enter to return to menu..."
  read -r
  show_menu
}

# ============ BACKUP ============
do_backup() {
  print_banner
  local backup_dir="/root/ipmartgit-backups"
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="$backup_dir/backup_$timestamp.tar.gz"

  mkdir -p "$backup_dir"

  log_info "Creating backup..."

  tar -czf "$backup_file" \
    -C "$APP_DIR" \
    db/ repositories/ git-repos/ uploads/ 2>/dev/null

  if [ -f "$backup_file" ]; then
    local size=$(du -h "$backup_file" | awk '{print $1}')
    log_ok "Backup created: $backup_file ($size)"
  else
    log_error "Backup failed"
  fi

  echo ""
  echo -ne "  Press Enter to return to menu..."
  read -r
  show_menu
}

# ============ HELPER FUNCTIONS ============

install_nodejs() {
  if command -v node &>/dev/null; then
    local ver=$(node -v | cut -d. -f1 | tr -d 'v')
    if [ "$ver" -ge 18 ]; then
      return 0
    fi
  fi

  if curl -fsSL --connect-timeout 15 https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - > /dev/null 2>&1; then
    apt-get install -y -qq nodejs > /dev/null 2>&1
  else
    log_warn "NodeSource not reachable, trying alternative..."
    apt-get install -y -qq nodejs npm > /dev/null 2>&1
    if ! command -v node &>/dev/null; then
      log_error "Failed to install Node.js. Please install manually."
      exit 1
    fi
  fi
}

install_npm_deps() {
  cd "$APP_DIR"

  # NPM Mirror registries to try (in order)
  local registries=(
    "https://registry.npmjs.org"
    "https://registry.npmmirror.com"
    "https://registry.yarnpkg.com"
  )

  local success=false

  for registry in "${registries[@]}"; do
    log_info "Trying npm registry: $registry"
    su - "$APP_USER" -c "cd $APP_DIR && npm config set registry $registry" 2>/dev/null

    if su - "$APP_USER" -c "cd $APP_DIR && npm install --production --loglevel=error" 2>&1 | tail -5; then
      # Verify installation
      if [ -d "$APP_DIR/node_modules/express" ] && [ -d "$APP_DIR/node_modules/better-sqlite3" ]; then
        success=true
        log_ok "npm install successful using $registry"
        break
      fi
    fi

    log_warn "Failed with $registry, trying next..."
    # Clean failed install
    rm -rf "$APP_DIR/node_modules" 2>/dev/null
  done

  if [ "$success" = false ]; then
    echo ""
    log_error "All npm registries failed. Possible solutions:"
    echo ""
    echo -e "  ${YELLOW}Option 1: Set proxy on server${NC}"
    echo -e "    export http_proxy=http://your-proxy:port"
    echo -e "    export https_proxy=http://your-proxy:port"
    echo ""
    echo -e "  ${YELLOW}Option 2: Upload node_modules manually${NC}"
    echo -e "    On your local machine (with internet):"
    echo -e "      cd iPmartGit && npm install --production"
    echo -e "      tar -czf node_modules.tar.gz node_modules"
    echo -e "      scp node_modules.tar.gz root@SERVER:/opt/ipmartgit/"
    echo -e "    On server:"
    echo -e "      cd /opt/ipmartgit"
    echo -e "      tar -xzf node_modules.tar.gz"
    echo -e "      chown -R $APP_USER:$APP_USER node_modules"
    echo -e "      rm node_modules.tar.gz"
    echo ""
    echo -e "  ${YELLOW}Option 3: Try with different DNS${NC}"
    echo -e "    echo 'nameserver 8.8.8.8' > /etc/resolv.conf"
    echo -e "    Then re-run this script"
    echo ""
    echo -ne "  Press Enter to retry or Ctrl+C to exit: "
    read -r

    # One more try with DNS change
    log_info "Retrying with alternative DNS..."
    cp /etc/resolv.conf /etc/resolv.conf.backup 2>/dev/null
    echo -e "nameserver 8.8.8.8\nnameserver 1.1.1.1" > /etc/resolv.conf

    su - "$APP_USER" -c "cd $APP_DIR && npm config set registry https://registry.npmmirror.com"
    if su - "$APP_USER" -c "cd $APP_DIR && npm install --production --loglevel=error" 2>&1 | tail -5; then
      if [ -d "$APP_DIR/node_modules/express" ]; then
        log_ok "npm install successful after DNS change"
        # Restore DNS
        cp /etc/resolv.conf.backup /etc/resolv.conf 2>/dev/null
        return 0
      fi
    fi

    # Restore DNS
    cp /etc/resolv.conf.backup /etc/resolv.conf 2>/dev/null
    log_error "Installation failed. Please use Option 2 (manual upload) above."
    exit 1
  fi

  # Reset registry to default
  su - "$APP_USER" -c "cd $APP_DIR && npm config set registry https://registry.npmjs.org" 2>/dev/null
}

download_project() {
  mkdir -p "$APP_DIR"

  if [ -f "./package.json" ] && grep -q "ipmartgit" "./package.json" 2>/dev/null; then
    # Running from project directory
    cp -r ./* "$APP_DIR/"
    cp ./.gitignore "$APP_DIR/" 2>/dev/null || true
    cp ./.dockerignore "$APP_DIR/" 2>/dev/null || true
  elif [ -f "$APP_DIR/package.json" ]; then
    log_info "Project files already exist"
  else
    # Clone from GitHub
    log_info "Cloning from GitHub..."
    rm -rf /tmp/iPmartGit
    if git clone "$APP_REPO" /tmp/iPmartGit 2>/dev/null; then
      cp -r /tmp/iPmartGit/* "$APP_DIR/"
      cp /tmp/iPmartGit/.gitignore "$APP_DIR/" 2>/dev/null || true
      cp /tmp/iPmartGit/.dockerignore "$APP_DIR/" 2>/dev/null || true
      rm -rf /tmp/iPmartGit
    else
      log_error "Failed to clone repository. Check internet connection."
      exit 1
    fi
  fi

  # Create data directories
  mkdir -p "$APP_DIR/db"
  mkdir -p "$APP_DIR/repositories"
  mkdir -p "$APP_DIR/git-repos"
  mkdir -p "$APP_DIR/uploads"
  mkdir -p "$APP_DIR/uploads/temp"
  mkdir -p "$APP_DIR/uploads/releases"

  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
}

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
Group=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$port
Environment=SESSION_SECRET=$secret

NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$APP_SERVICE" > /dev/null 2>&1
  systemctl start "$APP_SERVICE"
  sleep 3

  if ! service_running; then
    log_error "Service failed to start. Logs:"
    journalctl -u "$APP_SERVICE" --no-pager -n 15
    exit 1
  fi
}

configure_nginx() {
  local domain=$1
  local port=$2
  local server_name="${domain:-_}"

  cat > /etc/nginx/sites-available/ipmartgit << EOF
server {
    listen 80;
    server_name $server_name;

    client_max_body_size 200M;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

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
        proxy_send_timeout 300s;
    }
}
EOF

  ln -sf /etc/nginx/sites-available/ipmartgit /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

  if nginx -t 2>/dev/null; then
    systemctl reload nginx
  else
    log_warn "Nginx config test failed, skipping reload"
  fi
}

show_install_complete() {
  local domain=$1
  local port=$2
  local ip=$(get_ip)

  echo ""
  echo -e "  ${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "  ${GREEN}║                                              ║${NC}"
  echo -e "  ${GREEN}║     iPmartGit installed successfully! 🎉     ║${NC}"
  echo -e "  ${GREEN}║                                              ║${NC}"
  echo -e "  ${GREEN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}Access:${NC}"
  if [ -n "$domain" ]; then
    echo -e "    Web UI  : ${CYAN}http://$domain${NC}"
  else
    echo -e "    Web UI  : ${CYAN}http://$ip${NC}"
  fi
  echo ""
  echo -e "  ${BOLD}Default Login:${NC}"
  echo -e "    Username: ${CYAN}admin${NC}"
  echo -e "    Password: ${CYAN}admin123${NC}"
  echo ""
  echo -e "  ${YELLOW}⚠  Change the admin password after first login!${NC}"
  echo ""
  echo -e "  ${BOLD}Git Clone:${NC}"
  if [ -n "$domain" ]; then
    echo -e "    ${CYAN}git clone http://$domain/git/USERNAME/REPO.git${NC}"
  else
    echo -e "    ${CYAN}git clone http://$ip/git/USERNAME/REPO.git${NC}"
  fi
  echo ""
  echo -e "  ${BOLD}Commands:${NC}"
  echo -e "    Status  : systemctl status $APP_SERVICE"
  echo -e "    Logs    : journalctl -u $APP_SERVICE -f"
  echo -e "    Restart : systemctl restart $APP_SERVICE"
  echo ""
  echo -e "  ${BOLD}Re-run this script anytime for management:${NC}"
  echo -e "    ${CYAN}bash <(curl -s https://raw.githubusercontent.com/iPmartNetwork/iPmartGit/master/deploy-iran.sh)${NC}"
  echo ""
}

# ============ MAIN ============
check_root

# If argument passed, skip menu
if [ "$1" == "--install" ] || [ "$1" == "-i" ]; then
  DOMAIN="$2"
  PORT="${3:-$DEFAULT_PORT}"
  do_install
  exit 0
fi

show_menu
