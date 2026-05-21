const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/database');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Get user's tokens
router.get('/', requireAuth, (req, res) => {
  const tokens = db.prepare(`
    SELECT id, name, token_prefix, scopes, is_active, created_at, last_used_at
    FROM api_tokens
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.session.user.id);

  res.json(tokens);
});

// Create new token
router.post('/', requireAuth, (req, res) => {
  const { name, scopes } = req.body;

  if (!name) return res.status(400).json({ error: 'نام توکن الزامی است' });

  // Generate secure token
  const token = 'ipg_' + crypto.randomBytes(32).toString('hex');
  const tokenPrefix = token.substring(0, 12) + '...';

  const validScopes = scopes || 'repo,read';

  try {
    db.prepare(`
      INSERT INTO api_tokens (user_id, name, token, token_prefix, scopes)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.session.user.id, name, token, tokenPrefix, validScopes);

    // Return the full token only once
    res.json({
      success: true,
      token,
      message: 'توکن ایجاد شد. این توکن فقط یک‌بار نمایش داده می‌شود!'
    });
  } catch (err) {
    res.status(500).json({ error: 'خطا در ایجاد توکن' });
  }
});

// Delete token
router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  db.prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?')
    .run(id, req.session.user.id);

  res.json({ success: true, message: 'توکن حذف شد' });
});

// Toggle token active state
router.put('/:id/toggle', requireAuth, (req, res) => {
  const { id } = req.params;

  const token = db.prepare('SELECT is_active FROM api_tokens WHERE id = ? AND user_id = ?')
    .get(id, req.session.user.id);

  if (!token) return res.status(404).json({ error: 'توکن یافت نشد' });

  const newState = token.is_active ? 0 : 1;
  db.prepare('UPDATE api_tokens SET is_active = ? WHERE id = ?').run(newState, id);

  res.json({ success: true, is_active: newState });
});

module.exports = router;
