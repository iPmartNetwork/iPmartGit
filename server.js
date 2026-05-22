const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Wait for database to be ready before starting
const db = require('./db/database');

async function startServer() {
  await db.initPromise;

// Ensure directories exist
const REPOS_DIR = path.join(__dirname, 'repositories');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'ipmartgit-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Make user available in all requests
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const repoRoutes = require('./routes/repos');
const apiRoutes = require('./routes/api');
const mirrorRoutes = require('./routes/mirror');
const adminRoutes = require('./routes/admin');
const forkRoutes = require('./routes/fork');
const collaboratorRoutes = require('./routes/collaborators');
const notificationRoutes = require('./routes/notifications');
const gitHttpRoutes = require('./routes/git-http');
const pullRequestRoutes = require('./routes/pull-requests');
const releaseRoutes = require('./routes/releases');
const tokenRoutes = require('./routes/tokens');
const orgRoutes = require('./routes/organizations');
const activityRoutes = require('./routes/activity');
const codeReviewRoutes = require('./routes/code-review');
const importExportRoutes = require('./routes/import-export');

app.use('/auth', authRoutes);
app.use('/repos', repoRoutes);
app.use('/api', apiRoutes);
app.use('/mirror', mirrorRoutes);
app.use('/admin', adminRoutes);
app.use('/fork', forkRoutes);
app.use('/collaborators', collaboratorRoutes);
app.use('/notifications', notificationRoutes);
app.use('/git', gitHttpRoutes);
app.use('/pr', pullRequestRoutes);
app.use('/releases', releaseRoutes);
app.use('/tokens', tokenRoutes);
app.use('/org', orgRoutes);
app.use('/activity', activityRoutes);
app.use('/review', codeReviewRoutes);
app.use('/transfer', importExportRoutes);

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Explore
app.get('/explore', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'explore.html'));
});

// Edit file page
app.get('/edit', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, 'public', 'edit-file.html'));
});

// New file page
app.get('/new-file', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, 'public', 'new-file.html'));
});

// Profile/Settings page
app.get('/settings', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Repository view (must be last - catches /:owner/:repo pattern)
app.get('/:owner/:repo', (req, res) => {
  // Avoid matching static files and known routes
  const reserved = ['auth', 'repos', 'api', 'mirror', 'dashboard', 'explore', 'css', 'js', 'assets', 'uploads', 'edit', 'new-file', 'settings', 'admin', 'fork', 'collaborators', 'notifications', 'git', 'pr', 'releases', 'tokens', 'org', 'activity', 'review', 'transfer'];
  if (reserved.includes(req.params.owner)) return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname, 'public', 'repo.html'));
});

// User profile (catches /:username pattern - must check if it's a user)
app.get('/:username', (req, res) => {
  const reserved = ['auth', 'repos', 'api', 'mirror', 'dashboard', 'explore', 'css', 'js', 'assets', 'uploads', 'edit', 'new-file', 'settings', 'admin', 'fork', 'collaborators', 'notifications', 'git', 'pr', 'releases', 'tokens', 'org', 'activity', 'review', 'transfer'];
  if (reserved.includes(req.params.username)) return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname, 'public', 'user-profile.html'));
});

// Error handling
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 iPmartGit running on http://localhost:${PORT}`);
});

} // end startServer

startServer().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
