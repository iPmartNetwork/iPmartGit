const express = require('express');
const router = express.Router();
const db = require('../db/database');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'temp');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Buffer.from(file.originalname, 'latin1').toString('utf8'));
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'ابتدا وارد شوید' });
  }
  next();
}

// New repo page
router.get('/new', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'new-repo.html'));
});

// Create repository
router.post('/create', requireAuth, (req, res) => {
  const { name, description, is_private } = req.body;
  const owner_id = req.session.user.id;

  if (!name) {
    return res.status(400).json({ error: 'نام ریپازیتوری الزامی است' });
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
    return res.status(400).json({ error: 'نام ریپازیتوری فقط می‌تواند شامل حروف، اعداد، نقطه، خط تیره و زیرخط باشد' });
  }

  const existing = db.prepare('SELECT id FROM repositories WHERE name = ? AND owner_id = ?').get(name, owner_id);
  if (existing) {
    return res.status(409).json({ error: 'ریپازیتوری با این نام قبلاً وجود دارد' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO repositories (name, owner_id, description, is_private) VALUES (?, ?, ?, ?)'
    ).run(name, owner_id, description || '', is_private ? 1 : 0);

    // Create repo directory
    const repoDir = path.join(__dirname, '..', 'repositories', req.session.user.username, name);
    if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });

    // Create default README
    const readmeContent = `# ${name}\n\n${description || 'یک ریپازیتوری جدید در iPmartGit'}\n`;
    db.prepare(
      'INSERT INTO repo_files (repo_id, file_path, file_name, content, size) VALUES (?, ?, ?, ?, ?)'
    ).run(result.lastInsertRowid, 'README.md', 'README.md', readmeContent, readmeContent.length);

    res.json({ success: true, redirect: `/${req.session.user.username}/${name}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در ایجاد ریپازیتوری' });
  }
});

// Upload files to repository
router.post('/:owner/:repo/upload', requireAuth, upload.array('files', 50), (req, res) => {
  const { owner, repo } = req.params;
  const uploadPath = req.body.path || '';

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r 
    JOIN users u ON r.owner_id = u.id 
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'فایلی انتخاب نشده' });
  }

  const insertFile = db.prepare(`
    INSERT OR REPLACE INTO repo_files (repo_id, file_path, file_name, content, is_binary, size, mime_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((files) => {
    for (const file of files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const filePath = uploadPath ? `${uploadPath}/${originalName}` : originalName;
      const content = fs.readFileSync(file.path);
      const isBinary = isBinaryContent(content);

      insertFile.run(
        repoData.id,
        filePath,
        originalName,
        isBinary ? null : content.toString('utf8'),
        isBinary ? 1 : 0,
        file.size,
        file.mimetype
      );

      // Clean up temp file
      fs.unlinkSync(file.path);
    }
  });

  try {
    insertMany(req.files);

    // Update repo size
    const totalSize = db.prepare('SELECT SUM(size) as total FROM repo_files WHERE repo_id = ?').get(repoData.id);
    db.prepare('UPDATE repositories SET size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(totalSize.total || 0, repoData.id);

    res.json({ success: true, message: `${req.files.length} فایل آپلود شد` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در آپلود فایل‌ها' });
  }
});

// Delete repository
router.delete('/:owner/:repo', requireAuth, (req, res) => {
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

  try {
    db.prepare('DELETE FROM repositories WHERE id = ?').run(repoData.id);

    // Remove repo directory
    const repoDir = path.join(__dirname, '..', 'repositories', owner, repo);
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطا در حذف ریپازیتوری' });
  }
});

// Helper function
function isBinaryContent(buffer) {
  for (let i = 0; i < Math.min(buffer.length, 8000); i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

module.exports = router;
