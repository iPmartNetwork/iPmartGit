<p align="center">
  <img src="public/assets/logo.svg" alt="iPmartGit" width="120" height="120">
</p>

<h1 align="center">iPmartGit</h1>

<p align="center">
  <strong>Self-hosted Git platform for teams</strong><br>
  A lightweight GitHub alternative designed for servers without international internet access
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#installation">Installation</a> •
  <a href="#docker">Docker</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#api">API</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/database-SQLite-orange" alt="SQLite">
  <img src="https://img.shields.io/badge/docker-ready-blue" alt="Docker">
  <img src="https://img.shields.io/github/stars/iPmartNetwork/iPmartGit?style=social" alt="Stars">
</p>

---

## Why iPmartGit?

- **No external dependencies** — Uses SQLite, no MySQL/PostgreSQL/Redis needed
- **Works offline** — Once deployed, no internet connection required
- **Lightweight** — Runs on 512MB RAM, single binary-like deployment
- **Persian RTL UI** — Full right-to-left interface with Vazirmatn font
- **GitHub-compatible** — Familiar interface and workflows
- **Git HTTP protocol** — Real `git clone` and `git push` support

---

## Features

### Core
- 📦 **Repositories** — Public/private, create, delete, fork
- 📁 **File Management** — Upload, edit online, delete, create new files
- 🔄 **GitHub Mirror** — Mirror repositories from GitHub with sync
- 📥 **Download ZIP** — Download any repository as ZIP archive

### Collaboration
- 🔀 **Pull Requests** — Create, review, merge PRs between forks
- 💬 **Code Review** — Inline comments on specific lines in PRs
- 🐛 **Issues** — Create issues with comments, labels, milestones
- 👥 **Collaborators** — Add team members with read/write/admin access
- 🏢 **Organizations** — Group users into teams with shared repositories

### Platform
- 🔐 **Authentication** — Register, login, profile management, password change
- 🔑 **API Tokens** — Personal access tokens for Git HTTP and API access
- 🏷️ **Releases** — Publish versions with file attachments and changelogs
- 🔔 **Notifications** — Real-time notifications for stars, issues, PRs, comments
- 📰 **Activity Feed** — Track what's happening across your repositories
- 🔍 **Search** — Search repositories and search within file contents
- 📜 **File History** — Version history with diff viewer
- 📤 **Import/Export** — Full repository backup and restore as JSON

### User Experience
- 🎨 **Syntax Highlighting** — 30+ languages with highlight.js
- 🌗 **Dark/Light Theme** — Toggle with keyboard shortcut
- ⌨️ **Keyboard Shortcuts** — Navigate quickly (press `?` to see all)
- 📱 **Responsive** — Works on mobile and desktop
- 🇮🇷 **Persian RTL** — Full right-to-left support

### Administration
- 🛡️ **Admin Panel** — Manage users, repositories, system stats
- 🐳 **Docker Ready** — One-command deployment with Docker Compose
- 🚀 **Auto Deploy** — Bash script for automated server setup

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/iPmartNetwork/iPmartGit.git
cd iPmartGit

# Install dependencies
npm install

# Initialize database and create admin user
npm run setup

# Start the server
npm start
```

Open `http://localhost:3000` — Login with `admin` / `admin123`

---

## Installation

### Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 18+ | 20+ |
| RAM | 512MB | 1GB+ |
| Disk | 100MB + data | 10GB+ |
| OS | Ubuntu 20+, Debian 11+ | Ubuntu 22/24 |

### Deploy on Server (Automated)

```bash
# Upload project to server
scp -r iPmartGit/ root@YOUR_SERVER:/opt/

# SSH into server and run installer
ssh root@YOUR_SERVER
cd /opt/iPmartGit
chmod +x deploy-iran.sh
sudo bash deploy-iran.sh

# Or with a domain:
sudo bash deploy-iran.sh git.yourdomain.com
```

The script automatically:
1. Installs Node.js 20, Git, Nginx
2. Creates a system user
3. Installs npm dependencies
4. Initializes the database
5. Creates a systemd service (auto-start on reboot)
6. Configures Nginx reverse proxy

### Manual Installation

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Setup application
cd /opt/iPmartGit
npm install --production
npm run setup

# Start
PORT=3000 node server.js
```

---

## Docker

```bash
# Simple start
docker-compose up -d

# With Nginx reverse proxy
docker-compose --profile with-nginx up -d

# View logs
docker logs -f ipmartgit
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `SESSION_SECRET` | Session encryption key | Random |
| `NODE_ENV` | Environment | `development` |

---

## Git Clone & Push

iPmartGit supports the Git HTTP protocol for real `git clone` and `git push`:

```bash
# Clone a repository
git clone http://YOUR_SERVER/git/username/repo.git

# Push changes (uses your iPmartGit credentials or API token)
git push origin main
```

### Authentication for Git

Use your iPmartGit username and password, or create an API token in Settings and use it as the password.

---

## API

All API endpoints are available under `/api/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/repos` | GET | List public repositories |
| `/api/repos/:owner/:repo` | GET | Get repository details |
| `/api/repos/:owner/:repo/file/*` | GET | Get file content |
| `/api/repos/:owner/:repo/search?q=` | GET | Search in files |
| `/api/repos/:owner/:repo/download` | GET | Download as ZIP |
| `/api/users/:username` | GET | Public user profile |
| `/api/stats` | GET | Platform statistics |

---

## Project Structure

```
iPmartGit/
├── server.js                # Express server entry point
├── db/database.js           # SQLite database schema & connection
├── lib/cache.js             # In-memory caching layer
├── routes/
│   ├── auth.js              # Authentication & profile
│   ├── repos.js             # Repository management
│   ├── api.js               # Public API (files, issues, search, labels)
│   ├── mirror.js            # GitHub mirroring
│   ├── git-http.js          # Git HTTP protocol (clone/push)
│   ├── pull-requests.js     # Pull requests
│   ├── code-review.js       # Inline code review
│   ├── releases.js          # Releases & tags
│   ├── organizations.js     # Organizations & teams
│   ├── collaborators.js     # Repository collaborators
│   ├── notifications.js     # Notification system
│   ├── activity.js          # Activity feed
│   ├── tokens.js            # API tokens
│   ├── admin.js             # Admin panel
│   ├── fork.js              # Repository forking
│   └── import-export.js     # Import/Export
├── public/                  # Frontend (HTML/CSS/JS)
├── Dockerfile               # Docker image
├── docker-compose.yml       # Docker Compose config
├── deploy-iran.sh           # Automated deployment script
└── nginx.conf               # Nginx configuration
```

---

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3) — zero configuration
- **Frontend:** Vanilla HTML/CSS/JavaScript — no build step
- **Font:** Vazirmatn (Persian)
- **Syntax Highlighting:** highlight.js
- **Containerization:** Docker + Docker Compose

---

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Administrator |

⚠️ **Change the admin password immediately after first login!**

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

- 🐛 [Report a Bug](https://github.com/iPmartNetwork/iPmartGit/issues)
- 💡 [Request a Feature](https://github.com/iPmartNetwork/iPmartGit/issues)
- ⭐ Star this repo if you find it useful!

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/iPmartNetwork">iPmart Network</a>
</p>
