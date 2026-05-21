const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Get collaborators for a repo
router.get('/:owner/:repo', requireAuth, (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'فقط مالک می‌تواند همکاران را مدیریت کند' });
  }

  const collaborators = db.prepare(`
    SELECT c.id, c.permission, c.created_at, u.id as user_id, u.username, u.display_name, u.email
    FROM collaborators c
    JOIN users u ON c.user_id = u.id
    WHERE c.repo_id = ?
    ORDER BY c.created_at DESC
  `).all(repoData.id);

  res.json(collaborators);
});

// Add collaborator
router.post('/:owner/:repo', requireAuth, (req, res) => {
  const { owner, repo } = req.params;
  const { username, permission } = req.body;

  if (!username) return res.status(400).json({ error: 'نام کاربری الزامی است' });

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'فقط مالک می‌تواند همکار اضافه کند' });
  }

  const targetUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!targetUser) return res.status(404).json({ error: 'کاربر یافت نشد' });

  if (targetUser.id === req.session.user.id) {
    return res.status(400).json({ error: 'نمی‌توانید خودتان را اضافه کنید' });
  }

  const existing = db.prepare('SELECT id FROM collaborators WHERE repo_id = ? AND user_id = ?')
    .get(repoData.id, targetUser.id);
  if (existing) {
    return res.status(409).json({ error: 'این کاربر قبلاً همکار است' });
  }

  const perm = ['read', 'write', 'admin'].includes(permission) ? permission : 'read';

  try {
    db.prepare('INSERT INTO collaborators (repo_id, user_id, permission) VALUES (?, ?, ?)')
      .run(repoData.id, targetUser.id, perm);
    res.json({ success: true, message: `${username} به عنوان همکار اضافه شد` });
  } catch (err) {
    res.status(500).json({ error: 'خطا در اضافه کردن همکار' });
  }
});

// Remove collaborator
router.delete('/:owner/:repo/:userId', requireAuth, (req, res) => {
  const { owner, repo, userId } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'فقط مالک می‌تواند همکار حذف کند' });
  }

  db.prepare('DELETE FROM collaborators WHERE repo_id = ? AND user_id = ?').run(repoData.id, userId);
  res.json({ success: true, message: 'همکار حذف شد' });
});

// Update collaborator permission
router.put('/:owner/:repo/:userId', requireAuth, (req, res) => {
  const { owner, repo, userId } = req.params;
  const { permission } = req.body;

  if (!['read', 'write', 'admin'].includes(permission)) {
    return res.status(400).json({ error: 'سطح دسترسی نامعتبر' });
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

  db.prepare('UPDATE collaborators SET permission = ? WHERE repo_id = ? AND user_id = ?')
    .run(permission, repoData.id, userId);
  res.json({ success: true, message: 'سطح دسترسی بروزرسانی شد' });
});

module.exports = router;
