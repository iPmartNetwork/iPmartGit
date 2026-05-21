const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { createNotification } = require('./notifications');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Get inline comments for a PR
router.get('/pr/:prId/comments', (req, res) => {
  const { prId } = req.params;

  const comments = db.prepare(`
    SELECT rc.*, u.username as author_name, u.display_name as author_display_name
    FROM review_comments rc
    JOIN users u ON rc.author_id = u.id
    WHERE rc.pr_id = ?
    ORDER BY rc.file_path, rc.line_number, rc.created_at
  `).all(prId);

  res.json(comments);
});

// Add inline comment on a specific line
router.post('/pr/:prId/comments', requireAuth, (req, res) => {
  const { prId } = req.params;
  const { file_path, line_number, body, side } = req.body;

  if (!file_path || !line_number || !body) {
    return res.status(400).json({ error: 'مسیر فایل، شماره خط و متن الزامی هستند' });
  }

  const pr = db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(prId);
  if (!pr) return res.status(404).json({ error: 'PR یافت نشد' });

  try {
    db.prepare(`
      INSERT INTO review_comments (pr_id, author_id, file_path, line_number, body, side)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(prId, req.session.user.id, file_path, line_number, body.trim(), side || 'right');

    // Notify PR author
    if (pr.author_id !== req.session.user.id) {
      createNotification(
        pr.author_id,
        'review_comment',
        `💬 کامنت کد روی "${pr.title}"`,
        `${req.session.user.username} روی ${file_path}:${line_number} کامنت گذاشت`,
        null
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطا در ثبت کامنت' });
  }
});

// Submit review (approve/request changes/comment)
router.post('/pr/:prId/review', requireAuth, (req, res) => {
  const { prId } = req.params;
  const { status, body } = req.body;

  if (!['approved', 'changes_requested', 'commented'].includes(status)) {
    return res.status(400).json({ error: 'وضعیت نامعتبر' });
  }

  const pr = db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(prId);
  if (!pr) return res.status(404).json({ error: 'PR یافت نشد' });

  try {
    db.prepare(`
      INSERT INTO reviews (pr_id, reviewer_id, status, body)
      VALUES (?, ?, ?, ?)
    `).run(prId, req.session.user.id, status, body || '');

    const statusText = status === 'approved' ? 'تأیید کرد' : status === 'changes_requested' ? 'تغییرات خواست' : 'کامنت گذاشت';

    // Notify PR author
    if (pr.author_id !== req.session.user.id) {
      createNotification(
        pr.author_id,
        'review',
        `بررسی PR "${pr.title}"`,
        `${req.session.user.username} ${statusText}`,
        null
      );
    }

    res.json({ success: true, message: `بررسی ثبت شد: ${statusText}` });
  } catch (err) {
    res.status(500).json({ error: 'خطا در ثبت بررسی' });
  }
});

// Get reviews for a PR
router.get('/pr/:prId/reviews', (req, res) => {
  const { prId } = req.params;

  const reviews = db.prepare(`
    SELECT r.*, u.username as reviewer_name, u.display_name as reviewer_display_name
    FROM reviews r
    JOIN users u ON r.reviewer_id = u.id
    WHERE r.pr_id = ?
    ORDER BY r.created_at DESC
  `).all(prId);

  res.json(reviews);
});

module.exports = router;
