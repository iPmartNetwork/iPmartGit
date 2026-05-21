const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const path = require('path');

// Login page
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Register page
router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'register.html'));
});

// Login API
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    is_admin: user.is_admin,
    avatar: user.avatar
  };

  res.json({ success: true, redirect: '/dashboard' });
});

// Register API
router.post('/register', (req, res) => {
  const { username, email, password, display_name } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'تمام فیلدها الزامی هستند' });
  }

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'نام کاربری باید بین ۳ تا ۳۰ کاراکتر باشد' });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'نام کاربری فقط می‌تواند شامل حروف، اعداد، خط تیره و زیرخط باشد' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'نام کاربری یا ایمیل قبلاً ثبت شده است' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const result = db.prepare('INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)')
      .run(username, email, hashedPassword, display_name || username);

    req.session.user = {
      id: result.lastInsertRowid,
      username,
      email,
      display_name: display_name || username,
      is_admin: 0,
      avatar: null
    };

    res.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    res.status(500).json({ error: 'خطا در ثبت‌نام' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Profile page
router.get('/settings', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, '..', 'public', 'profile.html'));
});

// Profile API - GET
router.get('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'وارد نشده‌اید' });
  const user = db.prepare('SELECT id, username, email, display_name, bio, avatar, is_admin, created_at FROM users WHERE id = ?')
    .get(req.session.user.id);
  res.json(user);
});

// Profile API - UPDATE
router.put('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'وارد نشده‌اید' });

  const { username, display_name, email, bio } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'ایمیل الزامی است' });
  }

  // Validate username if changed
  if (username && username !== req.session.user.username) {
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'نام کاربری باید بین ۳ تا ۳۰ کاراکتر باشد' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'نام کاربری فقط حروف انگلیسی، اعداد، خط تیره و زیرخط' });
    }
    const usernameExists = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.session.user.id);
    if (usernameExists) {
      return res.status(409).json({ error: 'این نام کاربری قبلاً استفاده شده' });
    }
  }

  // Check if email is taken by another user
  const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.session.user.id);
  if (emailExists) {
    return res.status(409).json({ error: 'این ایمیل قبلاً استفاده شده است' });
  }

  const newUsername = (username && username !== req.session.user.username) ? username : req.session.user.username;

  try {
    db.prepare('UPDATE users SET username = ?, display_name = ?, email = ?, bio = ? WHERE id = ?')
      .run(newUsername, display_name || '', email, bio || '', req.session.user.id);

    // Update session
    req.session.user.username = newUsername;
    req.session.user.display_name = display_name || '';
    req.session.user.email = email;
    req.session.user.bio = bio || '';

    res.json({ success: true, message: 'پروفایل بروزرسانی شد' });
  } catch (err) {
    res.status(500).json({ error: 'خطا در بروزرسانی پروفایل' });
  }
});

// Change password
router.put('/password', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'وارد نشده‌اید' });

  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'رمز عبور فعلی و جدید الزامی است' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد' });
  }

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.session.user.id);

  if (!bcrypt.compareSync(current_password, user.password)) {
    return res.status(401).json({ error: 'رمز عبور فعلی اشتباه است' });
  }

  const hashedPassword = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.session.user.id);

  res.json({ success: true, message: 'رمز عبور با موفقیت تغییر کرد' });
});

module.exports = router;
