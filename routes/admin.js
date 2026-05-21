const express = require('express');
const router = express.Router();
const db = require('../db/database');
const path = require('path');

// Admin middleware
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'وارد نشده‌اید' });
  if (!req.session.user.is_admin) return res.status(403).json({ error: 'دسترسی ادمین ندارید' });
  next();
}

// Admin panel page
router.get('/', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Get all users
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, email, display_name, is_admin, created_at,
    (SELECT COUNT(*) FROM repositories WHERE owner_id = users.id) as repo_count
    FROM users ORDER BY created_at DESC
  `).all();
  res.json(users);
});

// Toggle user admin status
router.put('/users/:id/admin', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.session.user.id) {
    return res.status(400).json({ error: 'نمی‌توانید وضعیت ادمین خودتان را تغییر دهید' });
  }
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

  const newStatus = user.is_admin ? 0 : 1;
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(newStatus, id);
  res.json({ success: true, is_admin: newStatus });
});

// Delete user
router.delete('/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.session.user.id) {
    return res.status(400).json({ error: 'نمی‌توانید خودتان را حذف کنید' });
  }

  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

  try {
    // Delete user's repos
    db.prepare('DELETE FROM repositories WHERE owner_id = ?').run(id);
    db.prepare('DELETE FROM stars WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: `کاربر ${user.username} حذف شد` });
  } catch (err) {
    res.status(500).json({ error: 'خطا در حذف کاربر' });
  }
});

// Get all repositories (admin view)
router.get('/repos', requireAdmin, (req, res) => {
  const repos = db.prepare(`
    SELECT r.*, u.username as owner_name
    FROM repositories r
    JOIN users u ON r.owner_id = u.id
    ORDER BY r.updated_at DESC
  `).all();
  res.json(repos);
});

// Delete any repository
router.delete('/repos/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const repo = db.prepare('SELECT name FROM repositories WHERE id = ?').get(id);
  if (!repo) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  try {
    db.prepare('DELETE FROM repo_files WHERE repo_id = ?').run(id);
    db.prepare('DELETE FROM stars WHERE repo_id = ?').run(id);
    db.prepare('DELETE FROM issues WHERE repo_id = ?').run(id);
    db.prepare('DELETE FROM repositories WHERE id = ?').run(id);
    res.json({ success: true, message: `ریپازیتوری ${repo.name} حذف شد` });
  } catch (err) {
    res.status(500).json({ error: 'خطا در حذف ریپازیتوری' });
  }
});

// System stats
router.get('/stats', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const repos = db.prepare('SELECT COUNT(*) as count FROM repositories').get();
  const files = db.prepare('SELECT COUNT(*) as count FROM repo_files').get();
  const issues = db.prepare('SELECT COUNT(*) as count FROM issues').get();
  const totalSize = db.prepare('SELECT SUM(size) as total FROM repo_files').get();

  res.json({
    users: users.count,
    repos: repos.count,
    files: files.count,
    issues: issues.count,
    totalSize: totalSize.total || 0
  });
});

module.exports = router;
