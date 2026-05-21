const express = require('express');
const router = express.Router();
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const REPOS_BASE = path.join(__dirname, '..', 'git-repos');

// Ensure git-repos directory exists
if (!fs.existsSync(REPOS_BASE)) fs.mkdirSync(REPOS_BASE, { recursive: true });

// Basic auth middleware for git operations
function gitAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="iPmartGit"');
    return res.status(401).send('Authentication required');
  }

  const base64 = authHeader.split(' ')[1];
  const [username, password] = Buffer.from(base64, 'base64').toString().split(':');

  // Check if it's a token
  const token = db.prepare('SELECT * FROM api_tokens WHERE token = ? AND is_active = 1').get(password);
  if (token) {
    req.gitUser = db.prepare('SELECT * FROM users WHERE id = ?').get(token.user_id);
    return next();
  }

  // Check username/password
  const bcrypt = require('bcryptjs');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="iPmartGit"');
    return res.status(401).send('Invalid credentials');
  }

  req.gitUser = user;
  next();
}

// Initialize bare git repo if not exists
function ensureBareRepo(owner, repoName) {
  const repoPath = path.join(REPOS_BASE, owner, `${repoName}.git`);
  if (!fs.existsSync(repoPath)) {
    fs.mkdirSync(repoPath, { recursive: true });
    try {
      execSync('git init --bare', { cwd: repoPath, stdio: 'pipe' });
    } catch (err) {
      console.error('Failed to init bare repo:', err.message);
    }
  }
  return repoPath;
}

// Check access
function checkAccess(req, owner, repoName, needWrite) {
  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repoName, owner);

  if (!repoData) return { allowed: false, error: 'Repository not found' };

  if (!needWrite) {
    // Read access
    if (!repoData.is_private) return { allowed: true, repo: repoData };
    if (!req.gitUser) return { allowed: false, error: 'Authentication required' };
    if (repoData.owner_id === req.gitUser.id) return { allowed: true, repo: repoData };
    const collab = db.prepare('SELECT id FROM collaborators WHERE repo_id = ? AND user_id = ?')
      .get(repoData.id, req.gitUser.id);
    if (collab) return { allowed: true, repo: repoData };
    return { allowed: false, error: 'Access denied' };
  }

  // Write access
  if (!req.gitUser) return { allowed: false, error: 'Authentication required' };
  if (repoData.owner_id === req.gitUser.id) return { allowed: true, repo: repoData };
  const collab = db.prepare('SELECT permission FROM collaborators WHERE repo_id = ? AND user_id = ?')
    .get(repoData.id, req.gitUser.id);
  if (collab && (collab.permission === 'write' || collab.permission === 'admin')) {
    return { allowed: true, repo: repoData };
  }
  return { allowed: false, error: 'Write access denied' };
}

// GET /:owner/:repo.git/info/refs
router.get('/:owner/:repoName.git/info/refs', gitAuth, (req, res) => {
  const { owner, repoName } = req.params;
  const service = req.query.service;

  if (!service) {
    return res.status(400).send('Service parameter required');
  }

  const needWrite = service === 'git-receive-pack';
  const access = checkAccess(req, owner, repoName, needWrite);
  if (!access.allowed) {
    return res.status(403).send(access.error);
  }

  const repoPath = ensureBareRepo(owner, repoName);

  res.setHeader('Content-Type', `application/x-${service}-advertisement`);
  res.setHeader('Cache-Control', 'no-cache');

  // Packet line header
  const header = `# service=${service}\n`;
  const headerPkt = String(header.length + 4).padStart(4, '0') + header;
  res.write(headerPkt);
  res.write('0000');

  try {
    const result = execSync(`git ${service.replace('git-', '')} --stateless-rpc --advertise-refs .`, {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    res.end(result);
  } catch (err) {
    res.end();
  }
});

// POST /:owner/:repo.git/git-upload-pack (clone/fetch)
router.post('/:owner/:repoName.git/git-upload-pack', gitAuth, (req, res) => {
  const { owner, repoName } = req.params;

  const access = checkAccess(req, owner, repoName, false);
  if (!access.allowed) {
    return res.status(403).send(access.error);
  }

  const repoPath = ensureBareRepo(owner, repoName);

  res.setHeader('Content-Type', 'application/x-git-upload-pack-result');
  res.setHeader('Cache-Control', 'no-cache');

  const proc = spawn('git', ['upload-pack', '--stateless-rpc', '.'], { cwd: repoPath });
  req.pipe(proc.stdin);
  proc.stdout.pipe(res);
  proc.stderr.on('data', (data) => console.error('upload-pack error:', data.toString()));
});

// POST /:owner/:repo.git/git-receive-pack (push)
router.post('/:owner/:repoName.git/git-receive-pack', gitAuth, (req, res) => {
  const { owner, repoName } = req.params;

  const access = checkAccess(req, owner, repoName, true);
  if (!access.allowed) {
    return res.status(403).send(access.error);
  }

  const repoPath = ensureBareRepo(owner, repoName);

  res.setHeader('Content-Type', 'application/x-git-receive-pack-result');
  res.setHeader('Cache-Control', 'no-cache');

  const proc = spawn('git', ['receive-pack', '--stateless-rpc', '.'], { cwd: repoPath });
  req.pipe(proc.stdin);
  proc.stdout.pipe(res);
  proc.stderr.on('data', (data) => console.error('receive-pack error:', data.toString()));

  proc.on('close', () => {
    // Update repo timestamp
    db.prepare(`
      UPDATE repositories SET updated_at = CURRENT_TIMESTAMP 
      WHERE name = ? AND owner_id = (SELECT id FROM users WHERE username = ?)
    `).run(repoName, owner);
  });
});

module.exports = router;
module.exports.ensureBareRepo = ensureBareRepo;
