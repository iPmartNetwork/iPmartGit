const express = require('express');
const router = express.Router();
const db = require('../db/database');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Get activity feed for current user (repos they own/star/collaborate on)
router.get('/feed', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 30;
  const offset = (page - 1) * limit;

  const activities = db.prepare(`
    SELECT a.*, u.username as actor_name, u.display_name as actor_display_name
    FROM activities a
    JOIN users u ON a.actor_id = u.id
    WHERE a.repo_id IN (
      SELECT id FROM repositories WHERE owner_id = ?
      UNION
      SELECT repo_id FROM stars WHERE user_id = ?
      UNION
      SELECT repo_id FROM collaborators WHERE user_id = ?
    )
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.session.user.id, req.session.user.id, req.session.user.id, limit, offset);

  res.json(activities);
});

// Get activity for a specific repo
router.get('/repo/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.id FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const activities = db.prepare(`
    SELECT a.*, u.username as actor_name, u.display_name as actor_display_name
    FROM activities a
    JOIN users u ON a.actor_id = u.id
    WHERE a.repo_id = ?
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all(repoData.id);

  res.json(activities);
});

// Get activity for a user
router.get('/user/:username', (req, res) => {
  const { username } = req.params;
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

  const activities = db.prepare(`
    SELECT a.*, u.username as actor_name, u.display_name as actor_display_name
    FROM activities a
    JOIN users u ON a.actor_id = u.id
    WHERE a.actor_id = ?
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all(user.id);

  res.json(activities);
});

module.exports = router;

// Helper: Log activity (used by other routes)
module.exports.logActivity = function(actorId, repoId, type, message, meta) {
  try {
    db.prepare('INSERT INTO activities (actor_id, repo_id, type, message, meta) VALUES (?, ?, ?, ?, ?)')
      .run(actorId, repoId, type, message, meta ? JSON.stringify(meta) : null);
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};
