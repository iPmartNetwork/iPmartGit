const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { createNotification } = require('./notifications');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Get user's organizations
router.get('/', requireAuth, (req, res) => {
  const orgs = db.prepare(`
    SELECT o.*, om.role,
    (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) as member_count,
    (SELECT COUNT(*) FROM repositories WHERE org_id = o.id) as repo_count
    FROM organizations o
    JOIN org_members om ON o.id = om.org_id
    WHERE om.user_id = ?
    ORDER BY o.name
  `).all(req.session.user.id);

  res.json(orgs);
});

// Get single organization
router.get('/:orgName', (req, res) => {
  const { orgName } = req.params;

  const org = db.prepare('SELECT * FROM organizations WHERE name = ?').get(orgName);
  if (!org) return res.status(404).json({ error: 'سازمان یافت نشد' });

  const members = db.prepare(`
    SELECT om.role, om.joined_at, u.id as user_id, u.username, u.display_name, u.avatar
    FROM org_members om
    JOIN users u ON om.user_id = u.id
    WHERE om.org_id = ?
    ORDER BY om.role DESC, om.joined_at ASC
  `).all(org.id);

  const repos = db.prepare(`
    SELECT r.*, u.username as owner_name
    FROM repositories r
    LEFT JOIN users u ON r.owner_id = u.id
    WHERE r.org_id = ? AND r.is_private = 0
    ORDER BY r.updated_at DESC
  `).all(org.id);

  // Check if current user is member
  let userRole = null;
  if (req.session.user) {
    const membership = db.prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
      .get(org.id, req.session.user.id);
    userRole = membership ? membership.role : null;
  }

  res.json({ ...org, members, repos, userRole });
});

// Create organization
router.post('/', requireAuth, (req, res) => {
  const { name, display_name, description } = req.body;

  if (!name) return res.status(400).json({ error: 'نام سازمان الزامی است' });
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({ error: 'نام سازمان فقط حروف انگلیسی، اعداد، خط تیره و زیرخط' });
  }
  if (name.length < 2 || name.length > 30) {
    return res.status(400).json({ error: 'نام سازمان باید بین ۲ تا ۳۰ کاراکتر باشد' });
  }

  // Check if name is taken (by user or org)
  const userExists = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  const orgExists = db.prepare('SELECT id FROM organizations WHERE name = ?').get(name);
  if (userExists || orgExists) {
    return res.status(409).json({ error: 'این نام قبلاً استفاده شده' });
  }

  try {
    const result = db.prepare('INSERT INTO organizations (name, display_name, description, owner_id) VALUES (?, ?, ?, ?)')
      .run(name, display_name || name, description || '', req.session.user.id);

    // Add creator as owner
    db.prepare('INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)')
      .run(result.lastInsertRowid, req.session.user.id, 'owner');

    res.json({ success: true, message: 'سازمان ایجاد شد', name });
  } catch (err) {
    res.status(500).json({ error: 'خطا در ایجاد سازمان' });
  }
});

// Add member to organization
router.post('/:orgName/members', requireAuth, (req, res) => {
  const { orgName } = req.params;
  const { username, role } = req.body;

  if (!username) return res.status(400).json({ error: 'نام کاربری الزامی است' });

  const org = db.prepare('SELECT * FROM organizations WHERE name = ?').get(orgName);
  if (!org) return res.status(404).json({ error: 'سازمان یافت نشد' });

  // Check permission (only owner/admin can add)
  const membership = db.prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
    .get(org.id, req.session.user.id);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  const targetUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!targetUser) return res.status(404).json({ error: 'کاربر یافت نشد' });

  const existing = db.prepare('SELECT id FROM org_members WHERE org_id = ? AND user_id = ?')
    .get(org.id, targetUser.id);
  if (existing) return res.status(409).json({ error: 'کاربر قبلاً عضو است' });

  const validRole = ['member', 'admin'].includes(role) ? role : 'member';

  db.prepare('INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)')
    .run(org.id, targetUser.id, validRole);

  createNotification(targetUser.id, 'org_invite', `دعوت به سازمان ${orgName}`, `شما به سازمان ${orgName} اضافه شدید`, `/org/${orgName}`);

  res.json({ success: true, message: `${username} به سازمان اضافه شد` });
});

// Remove member
router.delete('/:orgName/members/:userId', requireAuth, (req, res) => {
  const { orgName, userId } = req.params;

  const org = db.prepare('SELECT * FROM organizations WHERE name = ?').get(orgName);
  if (!org) return res.status(404).json({ error: 'سازمان یافت نشد' });

  const membership = db.prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
    .get(org.id, req.session.user.id);
  if (!membership || membership.role !== 'owner') {
    return res.status(403).json({ error: 'فقط مالک می‌تواند عضو حذف کند' });
  }

  if (parseInt(userId) === req.session.user.id) {
    return res.status(400).json({ error: 'نمی‌توانید خودتان را حذف کنید' });
  }

  db.prepare('DELETE FROM org_members WHERE org_id = ? AND user_id = ?').run(org.id, userId);
  res.json({ success: true });
});

// Create repo under organization
router.post('/:orgName/repos', requireAuth, (req, res) => {
  const { orgName } = req.params;
  const { name, description, is_private } = req.body;

  if (!name) return res.status(400).json({ error: 'نام ریپازیتوری الزامی است' });

  const org = db.prepare('SELECT * FROM organizations WHERE name = ?').get(orgName);
  if (!org) return res.status(404).json({ error: 'سازمان یافت نشد' });

  // Check membership
  const membership = db.prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
    .get(org.id, req.session.user.id);
  if (!membership) return res.status(403).json({ error: 'عضو سازمان نیستید' });
  if (membership.role === 'member') return res.status(403).json({ error: 'فقط ادمین و مالک می‌توانند ریپازیتوری ایجاد کنند' });

  try {
    const result = db.prepare(
      'INSERT INTO repositories (name, owner_id, org_id, description, is_private) VALUES (?, ?, ?, ?, ?)'
    ).run(name, req.session.user.id, org.id, description || '', is_private ? 1 : 0);

    // Create default README
    const readmeContent = `# ${name}\n\n${description || `ریپازیتوری سازمان ${orgName}`}\n`;
    db.prepare('INSERT INTO repo_files (repo_id, file_path, file_name, content, size) VALUES (?, ?, ?, ?, ?)')
      .run(result.lastInsertRowid, 'README.md', 'README.md', readmeContent, readmeContent.length);

    res.json({ success: true, redirect: `/${orgName}/${name}` });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'ریپازیتوری با این نام وجود دارد' });
    res.status(500).json({ error: 'خطا در ایجاد ریپازیتوری' });
  }
});

module.exports = router;
