const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Get user notifications
router.get('/', requireAuth, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.session.user.id);

  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.session.user.id);

  res.json({ notifications, unreadCount: unreadCount.count });
});

// Mark as read
router.put('/read/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.session.user.id);
  res.json({ success: true });
});

// Mark all as read
router.put('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.session.user.id);
  res.json({ success: true });
});

// Delete notification
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.session.user.id);
  res.json({ success: true });
});

// Helper: Create notification (used by other routes)
function createNotification(userId, type, title, message, link) {
  db.prepare('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, message || '', link || '');
}

module.exports = router;
module.exports.createNotification = function(userId, type, title, message, link) {
  db.prepare('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, message || '', link || '');
};
