const express = require('express');
const router = express.Router();
const db = require('../db/database');
const archiver = require('archiver');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads', 'temp'), limits: { fileSize: 500 * 1024 * 1024 } });

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Export a repository (full backup as JSON + files in ZIP)
router.get('/export/:owner/:repo', requireAuth, (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id && !req.session.user.is_admin) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  // Gather all data
  const files = db.prepare('SELECT * FROM repo_files WHERE repo_id = ?').all(repoData.id);
  const issues = db.prepare('SELECT * FROM issues WHERE repo_id = ?').all(repoData.id);
  const comments = db.prepare(`
    SELECT c.* FROM comments c
    JOIN issues i ON c.issue_id = i.id
    WHERE i.repo_id = ?
  `).all(repoData.id);
  const labels = db.prepare('SELECT * FROM labels WHERE repo_id = ?').all(repoData.id);
  const releases = db.prepare('SELECT * FROM releases WHERE repo_id = ?').all(repoData.id);

  const exportData = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    platform: 'iPmartGit',
    repository: {
      name: repoData.name,
      description: repoData.description,
      is_private: repoData.is_private,
      default_branch: repoData.default_branch,
      language: repoData.language,
      created_at: repoData.created_at
    },
    files: files.map(f => ({
      path: f.file_path,
      name: f.file_name,
      content: f.content,
      is_binary: f.is_binary,
      size: f.size
    })),
    issues: issues.map(i => ({
      title: i.title,
      body: i.body,
      state: i.state,
      created_at: i.created_at
    })),
    comments,
    labels: labels.map(l => ({ name: l.name, color: l.color, description: l.description })),
    releases: releases.map(r => ({ tag_name: r.tag_name, title: r.title, body: r.body, created_at: r.created_at }))
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${repo}-export.json"`);
  res.json(exportData);
});

// Import a repository from exported JSON
router.post('/import', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایل الزامی است' });

  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    const data = JSON.parse(content);

    if (!data.repository || !data.repository.name) {
      return res.status(400).json({ error: 'فرمت فایل نامعتبر است' });
    }

    // Check if repo name exists
    const existing = db.prepare('SELECT id FROM repositories WHERE name = ? AND owner_id = ?')
      .get(data.repository.name, req.session.user.id);
    if (existing) {
      return res.status(409).json({ error: 'ریپازیتوری با این نام قبلاً وجود دارد' });
    }

    // Create repository
    const result = db.prepare(`
      INSERT INTO repositories (name, owner_id, description, is_private, default_branch, language)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.repository.name,
      req.session.user.id,
      data.repository.description || '',
      data.repository.is_private ? 1 : 0,
      data.repository.default_branch || 'main',
      data.repository.language || null
    );

    const repoId = result.lastInsertRowid;

    // Import files
    if (data.files && data.files.length > 0) {
      const insertFile = db.prepare(`
        INSERT INTO repo_files (repo_id, file_path, file_name, content, is_binary, size)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const importFiles = db.transaction(() => {
        for (const file of data.files) {
          insertFile.run(repoId, file.path, file.name, file.content, file.is_binary ? 1 : 0, file.size || 0);
        }
      });
      importFiles();
    }

    // Import issues
    if (data.issues && data.issues.length > 0) {
      const insertIssue = db.prepare('INSERT INTO issues (repo_id, author_id, title, body, state) VALUES (?, ?, ?, ?, ?)');
      for (const issue of data.issues) {
        insertIssue.run(repoId, req.session.user.id, issue.title, issue.body || '', issue.state || 'open');
      }
    }

    // Import labels
    if (data.labels && data.labels.length > 0) {
      const insertLabel = db.prepare('INSERT OR IGNORE INTO labels (repo_id, name, color, description) VALUES (?, ?, ?, ?)');
      for (const label of data.labels) {
        insertLabel.run(repoId, label.name, label.color || '#8b949e', label.description || '');
      }
    }

    // Cleanup temp file
    fs.unlinkSync(req.file.path);

    // Update repo size
    const totalSize = db.prepare('SELECT SUM(size) as total FROM repo_files WHERE repo_id = ?').get(repoId);
    db.prepare('UPDATE repositories SET size = ? WHERE id = ?').run(totalSize.total || 0, repoId);

    res.json({
      success: true,
      message: `ریپازیتوری "${data.repository.name}" با موفقیت وارد شد`,
      redirect: `/${req.session.user.username}/${data.repository.name}`
    });
  } catch (err) {
    console.error('Import error:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'خطا در وارد کردن ریپازیتوری: ' + err.message });
  }
});

module.exports = router;
