<div align="center">

<img src="img/iPmartGit2.png" alt="iPmartGit" width="150">

# iPmartGit

### Your Code. Your Server. Your Rules.

A self-hosted Git platform built for teams who need full control over their source code — no cloud dependency, no international internet required.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/iPmartNetwork/iPmartGit?style=flat-square&color=yellow)](https://github.com/iPmartNetwork/iPmartGit/stargazers)

[Quick Start](#-quick-start) · [Features](#-features) · [Deploy](#-deploy-on-server) · [Docker](#-docker) · [API](#-api) · [Contributing](#-contributing)

**[🇮🇷 مستندات فارسی](README-FA.md)**

---

<img src="img/iPmartGit.png" width="500" alt="iPmartGit Logo">

</div>

---

## 🤔 Why iPmartGit?

| Problem | iPmartGit Solution |
|---------|-------------------|
| GitHub/GitLab blocked or slow | Runs 100% on your local server |
| Need a private Git server | Zero-config SQLite, no external DB |
| Complex setup (Gitea, GitLab) | `npm install && npm start` — done |
| Team needs collaboration tools | PRs, Code Review, Issues, Orgs built-in |
| Limited server resources | Runs on 512MB RAM, single process |

---

## ⚡ Quick Start

### One-Line Install (Linux Server)

```bash
bash <(curl -s https://raw.githubusercontent.com/iPmartNetwork/iPmartGit/master/deploy-iran.sh)
```

### Manual Install

```bash
git clone https://github.com/iPmartNetwork/iPmartGit.git
cd iPmartGit
npm install
npm run setup
npm start
```

Open **http://localhost:3000** → Login: `admin` / `admin123`

> ⚠️ Change the default password immediately after first login.

---

## 🎯 Features

<table>
<tr>
<td width="50%">

### 📦 Repository Management
- Create public & private repos
- Fork repositories
- Upload files (drag & drop)
- Edit files online with syntax highlighting
- Download as ZIP
- GitHub mirroring with sync

</td>
<td width="50%">

### 🔀 Pull Requests & Code Review
- Create PRs between forks
- Inline code comments (line-by-line)
- Approve / Request Changes / Comment
- Merge with one click
- Changed files diff view

</td>
</tr>
<tr>
<td>

### 🏢 Teams & Organizations
- Create organizations
- Member roles: Owner / Admin / Member
- Shared team repositories
- Collaborator permissions (Read/Write/Admin)

</td>
<td>

### 🐛 Issues & Project Management
- Full issue tracker
- Comments & discussions
- Labels with custom colors
- Milestones with due dates
- Close/Reopen workflow

</td>
</tr>
<tr>
<td>

### 🔐 Security & Auth
- Session-based authentication
- API tokens for programmatic access
- bcrypt password hashing
- Rate limiting
- Private repository access control

</td>
<td>

### 🚀 DevOps Ready
- Git HTTP protocol (`git clone` / `git push`)
- Releases with file attachments
- Import/Export (full backup as JSON)
- Docker & Docker Compose
- Automated deployment script
- Systemd service

</td>
</tr>
</table>

### ✨ User Experience

- 🎨 **Syntax Highlighting** — 30+ languages
- 🌗 **Dark / Light Theme** — Toggle with `Ctrl+Shift+T`
- ⌨️ **Keyboard Shortcuts** — Press `?` to see all
- 📜 **File History** — Version tracking with visual diff
- 🔍 **Code Search** — Search within file contents
- 📰 **Activity Feed** — See what's happening
- 🔔 **Notifications** — Stars, issues, PRs, comments
- 📱 **Responsive** — Works on mobile
- 🇮🇷 **Persian RTL** — Full right-to-left interface

---

## 🖥️ Deploy on Server

### One-Command Deploy (Ubuntu/Debian)

```bash
# Upload project to your server, then:
chmod +x deploy-iran.sh
sudo bash deploy-iran.sh

# With custom domain:
sudo bash deploy-iran.sh git.yourdomain.com
```

This script handles everything:
- ✅ Installs Node.js 20, Git, Nginx
- ✅ Creates system user & directories
- ✅ Installs dependencies
- ✅ Sets up systemd service (auto-restart)
- ✅ Configures Nginx reverse proxy
- ✅ Generates secure session secret

### System Requirements

| | Minimum | Recommended |
|---|---------|-------------|
| **CPU** | 1 core | 2+ cores |
| **RAM** | 512 MB | 1 GB+ |
| **Disk** | 1 GB | 10 GB+ |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04/24.04 |
| **Node.js** | 18 | 20 LTS |

---

## 🐳 Docker

```bash
# Start iPmartGit
docker-compose up -d

# With Nginx reverse proxy
docker-compose --profile with-nginx up -d

# View logs
docker logs -f ipmartgit

# Stop
docker-compose down
```

### Environment Variables

```env
PORT=3000
SESSION_SECRET=your-secret-key-here
NODE_ENV=production
```

---

## 🔗 Git Protocol

iPmartGit supports standard Git HTTP protocol:

```bash
# Clone
git clone http://your-server/git/username/repo.git

# Push (authenticate with username + password or API token)
git push origin main
```

### API Tokens

Create tokens in **Settings → API Tokens** for passwordless Git access and CI/CD integration.

---

## 📡 API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/repos` | GET | List public repositories |
| `/api/repos/:owner/:repo` | GET | Repository details + files |
| `/api/repos/:owner/:repo/file/*` | GET | File content |
| `/api/repos/:owner/:repo/search?q=` | GET | Search in code |
| `/api/repos/:owner/:repo/download` | GET | Download ZIP |
| `/api/repos/:owner/:repo/issues` | GET | List issues |
| `/api/users/:username` | GET | User profile |
| `/api/stats` | GET | Platform statistics |
| `/api/explore` | GET | Trending repositories |

---

## 🏗️ Architecture

```
iPmartGit/
├── server.js              # Express entry point
├── db/database.js         # SQLite schema (20+ tables)
├── lib/cache.js           # In-memory caching
├── routes/
│   ├── api.js             # Public API
│   ├── auth.js            # Authentication
│   ├── repos.js           # Repository CRUD
│   ├── git-http.js        # Git protocol
│   ├── pull-requests.js   # PRs
│   ├── code-review.js     # Inline reviews
│   ├── releases.js        # Releases & tags
│   ├── organizations.js   # Teams
│   ├── mirror.js          # GitHub mirroring
│   ├── activity.js        # Activity feed
│   ├── notifications.js   # Notifications
│   ├── admin.js           # Admin panel
│   └── ...
├── public/                # Frontend (vanilla HTML/CSS/JS)
├── Dockerfile
├── docker-compose.yml
└── deploy-iran.sh         # Auto-deploy script
```

**Tech Stack:**
- **Runtime:** Node.js + Express
- **Database:** SQLite via better-sqlite3 (zero config)
- **Frontend:** Vanilla JS — no React, no build step, no complexity
- **Auth:** bcrypt + express-session
- **Syntax:** highlight.js

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Development mode (auto-reload)
npm run dev
```

---

## 📋 Roadmap

- [ ] Webhook support
- [ ] Two-Factor Authentication
- [ ] SSH key authentication
- [ ] Branch management UI
- [ ] Wiki pages
- [ ] CI/CD pipeline runner
- [ ] Plugin system

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

<div align="center">

**Built with ❤️ by [iPmart Network](https://github.com/iPmartNetwork)**

If this project helps you, consider giving it a ⭐

[Report Bug](https://github.com/iPmartNetwork/iPmartGit/issues) · [Request Feature](https://github.com/iPmartNetwork/iPmartGit/issues) · [Discussions](https://github.com/iPmartNetwork/iPmartGit/discussions)

</div>
