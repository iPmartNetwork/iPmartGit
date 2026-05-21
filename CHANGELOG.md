# Changelog

All notable changes to iPmartGit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-01

### 🎉 Initial Release

#### Core Features
- **Repository Management** — Create, delete, fork public/private repositories
- **File Management** — Upload (drag & drop), edit online, delete, create new files
- **GitHub Mirroring** — Mirror repositories from GitHub with re-sync capability
- **Download ZIP** — Download any repository as a ZIP archive
- **Git HTTP Protocol** — Support for `git clone` and `git push` via HTTP

#### Collaboration
- **Pull Requests** — Create PRs between forks, review, merge, close
- **Code Review** — Inline comments on specific lines in pull requests
- **Issues** — Full issue tracker with comments, open/close state
- **Labels & Milestones** — Organize issues with labels and milestones
- **Collaborators** — Add team members with read/write/admin permissions
- **Organizations** — Create teams with shared repositories and member roles

#### Platform
- **User Authentication** — Register, login, logout, session management
- **Profile Management** — Edit display name, email, bio, change password
- **API Tokens** — Personal access tokens for programmatic access
- **Releases** — Publish versions with tag names, changelogs, and file attachments
- **Notifications** — Real-time notifications for stars, issues, PRs, comments
- **Activity Feed** — Track activities across repositories
- **Search** — Search repositories globally and search within file contents
- **File History** — Track file changes with version history and diff viewer
- **Import/Export** — Full repository backup and restore as JSON

#### User Experience
- **Syntax Highlighting** — 30+ programming languages via highlight.js
- **Dark/Light Theme** — Toggle between themes, saved in localStorage
- **Keyboard Shortcuts** — Quick navigation (press `?` to view all)
- **Responsive Design** — Mobile and desktop compatible
- **Persian RTL Interface** — Full right-to-left support with Vazirmatn font
- **Breadcrumb Navigation** — Easy file path navigation
- **Collapsible Directories** — Click to expand/collapse folders

#### Administration
- **Admin Panel** — Manage all users and repositories, view system stats
- **User Management** — Promote/demote admins, delete users
- **System Statistics** — Total users, repos, files, storage usage

#### Deployment
- **Docker Support** — Dockerfile and docker-compose.yml included
- **Nginx Configuration** — Ready-to-use reverse proxy config
- **Automated Deployment** — Bash script for one-command server setup
- **Systemd Service** — Auto-start on server reboot
- **SQLite Database** — Zero-configuration, no external database needed

#### Security
- **Password Hashing** — bcrypt with salt rounds
- **Session Management** — Secure HTTP-only cookies, 7-day expiry
- **Rate Limiting** — API rate limiting to prevent abuse
- **Access Control** — Private repos, collaborator permissions, admin roles
- **Input Validation** — Server-side validation on all inputs
- **Admin Credentials** — Both username and password are changeable from Settings page

---

## Roadmap

### Planned for v1.1.0
- [ ] Webhook support (POST events to external URLs)
- [ ] Two-Factor Authentication (2FA)
- [ ] Email notifications
- [ ] Repository topics/tags
- [ ] Pinned repositories on profile

### Planned for v1.2.0
- [ ] Wiki pages for repositories
- [ ] Project boards (Kanban)
- [ ] Repository templates
- [ ] Commit signing verification
- [ ] SSH key authentication for Git

### Planned for v2.0.0
- [ ] Real Git backend (replace file-based storage)
- [ ] Branch management
- [ ] Merge conflict resolution
- [ ] CI/CD pipeline runner
- [ ] Plugin system
