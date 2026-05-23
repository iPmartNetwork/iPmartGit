const express = require('express');
const router = express.Router();
const db = require('../db/database');
const path = require('path');

/**
 * Raw file access - serve files directly (like raw.githubusercontent.com)
 * 
 * Usage:
 *   http://your-server/raw/USERNAME/REPO/path/to/file.sh
 *   http://your-server/raw/USERNAME/REPO/install.sh
 *   http://your-server/raw/USERNAME/REPO/docker-compose.yml
 * 
 * Example:
 *   curl -s http://git.ipmart.online/raw/admin/myproject/install.sh | bash
 *   curl -O http://git.ipmart.online/raw/admin/myproject/node_modules.tar.gz
 */

// GET /raw/:owner/:repo/*
router.get('/:owner/:repo/*', (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.params[0];

  if (!filePath) {
    return res.status(400).send('File path required');
  }

  // Find repository
  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) {
    return res.status(404).send('Repository not found');
  }

  // Check access for private repos
  if (repoData.is_private) {
    // Check basic auth or token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic realm="iPmartGit"');
      return res.status(401).send('Authentication required for private repositories');
    }

    const base64 = authHeader.split(' ')[1];
    const [username, password] = Buffer.from(base64, 'base64').toString().split(':');

    // Check token
    const token = db.prepare('SELECT * FROM api_tokens WHERE token = ? AND is_active = 1').get(password);
    if (!token) {
      // Check username/password
      const bcrypt = require('bcryptjs');
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(403).send('Access denied');
      }
    }
  }

  // Find file
  const file = db.prepare('SELECT * FROM repo_files WHERE repo_id = ? AND file_path = ?')
    .get(repoData.id, filePath);

  if (!file) {
    return res.status(404).send('File not found: ' + filePath);
  }

  // Binary file
  if (file.is_binary || !file.content) {
    return res.status(404).send('Binary files not supported via raw. Use releases for binary downloads.');
  }

  // Detect content type
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.sh': 'text/x-shellscript',
    '.bash': 'text/x-shellscript',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.json': 'application/json',
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
    '.toml': 'text/toml',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.py': 'text/x-python',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.env': 'text/plain',
    '.conf': 'text/plain',
    '.cfg': 'text/plain',
    '.ini': 'text/plain',
    '.dockerfile': 'text/plain',
    '.service': 'text/plain',
  };

  const contentType = mimeTypes[ext] || 'text/plain';

  res.setHeader('Content-Type', contentType + '; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(file.content);
});

// List files in a repo (for browsing)
router.get('/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) {
    return res.status(404).send('Repository not found');
  }

  if (repoData.is_private) {
    return res.status(403).send('Private repository');
  }

  const files = db.prepare('SELECT file_path, file_name, size FROM repo_files WHERE repo_id = ? ORDER BY file_path')
    .all(repoData.id);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const list = files.map(f => `${f.file_path} (${f.size} bytes)`).join('\n');
  res.send(`Repository: ${owner}/${repo}\nFiles:\n${list}\n`);
});

module.exports = router;
