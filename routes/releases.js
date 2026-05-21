const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { createNotification } = require('./notifications');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Upload config for release assets
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'releases');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${Date.now()}-${originalName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Get releases for a repo
router.get('/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.id FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const releases = db.prepare(`
    SELECT rel.*, u.username as author_name, u.display_name as author_display_name
    FROM releases rel
    JOIN users u ON rel.author_id = u.id
    WHERE rel.repo_id = ?
    ORDER BY rel.created_at DESC
  `).all(repoData.id);

  // Get assets for each release
  const releasesWithAssets = releases.map(rel => {
    const assets = db.prepare('SELECT * FROM release_assets WHERE release_id = ?').all(rel.id);
    return { ...rel, assets };
  });

  res.json(releasesWithAssets);
});

// Get single release
router.get('/:owner/:repo/:releaseId', (req, res) => {
  const { releaseId } = req.params;

  const release = db.prepare(`
    SELECT rel.*, u.username as author_name, u.display_name as author_display_name
    FROM releases rel
    JOIN users u ON rel.author_id = u.id
    WHERE rel.id = ?
  `).get(releaseId);

  if (!release) return res.status(404).json({ error: 'Release یافت نشد' });

  const assets = db.prepare('SELECT * FROM release_assets WHERE release_id = ?').all(releaseId);
  res.json({ ...release, assets });
});

// Create release
router.post('/:owner/:repo', requireAuth, upload.array('assets', 10), (req, res) => {
  const { owner, repo } = req.params;
  const { tag_name, title, body, is_prerelease } = req.body;

  if (!tag_name || !title) {
    return res.status(400).json({ error: 'نام تگ و عنوان الزامی هستند' });
  }

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  // Check duplicate tag
  const existing = db.prepare('SELECT id FROM releases WHERE repo_id = ? AND tag_name = ?').get(repoData.id, tag_name);
  if (existing) {
    return res.status(409).json({ error: 'تگی با این نام قبلاً وجود دارد' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO releases (repo_id, author_id, tag_name, title, body, is_prerelease)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(repoData.id, req.session.user.id, tag_name, title, body || '', is_prerelease ? 1 : 0);

    const releaseId = result.lastInsertRowid;

    // Save uploaded assets
    if (req.files && req.files.length > 0) {
      const insertAsset = db.prepare(`
        INSERT INTO release_assets (release_id, file_name, file_path, size, mime_type)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const file of req.files) {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        insertAsset.run(releaseId, originalName, file.filename, file.size, file.mimetype);
      }
    }

    res.json({ success: true, id: releaseId, message: 'Release ایجاد شد' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در ایجاد Release' });
  }
});

// Download release asset
router.get('/:owner/:repo/assets/:assetId/download', (req, res) => {
  const { assetId } = req.params;

  const asset = db.prepare('SELECT * FROM release_assets WHERE id = ?').get(assetId);
  if (!asset) return res.status(404).json({ error: 'فایل یافت نشد' });

  const filePath = path.join(__dirname, '..', 'uploads', 'releases', asset.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'فایل روی سرور یافت نشد' });

  // Update download count
  db.prepare('UPDATE release_assets SET download_count = download_count + 1 WHERE id = ?').run(assetId);

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.file_name)}"`);
  res.sendFile(filePath);
});

// Delete release
router.delete('/:owner/:repo/:releaseId', requireAuth, (req, res) => {
  const { owner, repo, releaseId } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  // Delete asset files
  const assets = db.prepare('SELECT file_path FROM release_assets WHERE release_id = ?').all(releaseId);
  for (const asset of assets) {
    const filePath = path.join(__dirname, '..', 'uploads', 'releases', asset.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM release_assets WHERE release_id = ?').run(releaseId);
  db.prepare('DELETE FROM releases WHERE id = ? AND repo_id = ?').run(releaseId, repoData.id);

  res.json({ success: true, message: 'Release حذف شد' });
});

module.exports = router;
