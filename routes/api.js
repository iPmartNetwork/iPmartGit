const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { marked } = require('marked');
const archiver = require('archiver');
const { createNotification } = require('./notifications');
const cache = require('../lib/cache');
const { logActivity } = require('./activity');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'ابتدا وارد شوید' });
  }
  next();
}

// Check if user has write access to repo (owner or collaborator with write/admin)
function hasWriteAccess(repoData, userId) {
  if (repoData.owner_id === userId) return true;
  const collab = db.prepare('SELECT permission FROM collaborators WHERE repo_id = ? AND user_id = ?')
    .get(repoData.id, userId);
  return collab && (collab.permission === 'write' || collab.permission === 'admin');
}

// Check if user has read access to repo
function hasReadAccess(repoData, userId) {
  if (!repoData.is_private) return true;
  if (repoData.owner_id === userId) return true;
  const collab = db.prepare('SELECT id FROM collaborators WHERE repo_id = ? AND user_id = ?')
    .get(repoData.id, userId);
  return !!collab;
}

// Get all public repositories
router.get('/repos', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  let query = `
    SELECT r.*, u.username as owner_name, u.display_name as owner_display_name
    FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.is_private = 0
  `;
  const params = [];

  if (search) {
    query += ' AND (r.name LIKE ? OR r.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY r.updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const repos = db.prepare(query).all(...params);

  const countQuery = search
    ? db.prepare('SELECT COUNT(*) as total FROM repositories WHERE is_private = 0 AND (name LIKE ? OR description LIKE ?)').get(`%${search}%`, `%${search}%`)
    : db.prepare('SELECT COUNT(*) as total FROM repositories WHERE is_private = 0').get();

  res.json({
    repos,
    total: countQuery.total,
    page,
    totalPages: Math.ceil(countQuery.total / limit),
    hasNext: page < Math.ceil(countQuery.total / limit),
    hasPrev: page > 1
  });
});

// Get user's repositories
router.get('/user/:username/repos', (req, res) => {
  const { username } = req.params;
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

  if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

  let repos;
  if (req.session.user && req.session.user.id === user.id) {
    // Show all repos for owner
    repos = db.prepare(`
      SELECT r.*, u.username as owner_name 
      FROM repositories r JOIN users u ON r.owner_id = u.id 
      WHERE r.owner_id = ? ORDER BY r.updated_at DESC
    `).all(user.id);
  } else {
    // Show only public repos
    repos = db.prepare(`
      SELECT r.*, u.username as owner_name 
      FROM repositories r JOIN users u ON r.owner_id = u.id 
      WHERE r.owner_id = ? AND r.is_private = 0 ORDER BY r.updated_at DESC
    `).all(user.id);
  }

  res.json(repos);
});

// Get single repository
router.get('/repos/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.*, u.username as owner_name, u.display_name as owner_display_name
    FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  if (repoData.is_private && (!req.session.user || !hasReadAccess(repoData, req.session.user.id))) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  // Get files
  const files = db.prepare('SELECT id, file_path, file_name, is_binary, size, mime_type, updated_at FROM repo_files WHERE repo_id = ? ORDER BY file_path').all(repoData.id);

  // Check if starred
  let isStarred = false;
  if (req.session.user) {
    const star = db.prepare('SELECT id FROM stars WHERE user_id = ? AND repo_id = ?').get(req.session.user.id, repoData.id);
    isStarred = !!star;
  }

  res.json({ ...repoData, files, isStarred });
});

// Get file content
router.get('/repos/:owner/:repo/file/*', (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.params[0];

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  if (repoData.is_private && (!req.session.user || req.session.user.id !== repoData.owner_id)) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  const file = db.prepare('SELECT * FROM repo_files WHERE repo_id = ? AND file_path = ?').get(repoData.id, filePath);

  if (!file) return res.status(404).json({ error: 'فایل یافت نشد' });

  // Render markdown
  let renderedContent = null;
  if (file.file_name.endsWith('.md') && file.content) {
    renderedContent = marked(file.content);
  }

  res.json({ ...file, renderedContent });
});

// Star/Unstar repository
router.post('/repos/:owner/:repo/star', requireAuth, (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const existing = db.prepare('SELECT id FROM stars WHERE user_id = ? AND repo_id = ?').get(req.session.user.id, repoData.id);

  if (existing) {
    db.prepare('DELETE FROM stars WHERE id = ?').run(existing.id);
    db.prepare('UPDATE repositories SET stars = stars - 1 WHERE id = ?').run(repoData.id);
    res.json({ starred: false });
  } else {
    db.prepare('INSERT INTO stars (user_id, repo_id) VALUES (?, ?)').run(req.session.user.id, repoData.id);
    db.prepare('UPDATE repositories SET stars = stars + 1 WHERE id = ?').run(repoData.id);

    // Notify repo owner
    if (repoData.owner_id !== req.session.user.id) {
      createNotification(
        repoData.owner_id,
        'star',
        `⭐ ستاره جدید`,
        `${req.session.user.username} به ${repo} ستاره داد`,
        `/${owner}/${repo}`
      );
    }

    logActivity(req.session.user.id, repoData.id, 'star', `${req.session.user.username} به ${repo} ستاره داد`);

    res.json({ starred: true });
  }
});

// Issues
router.get('/repos/:owner/:repo/issues', (req, res) => {
  const { owner, repo } = req.params;
  const state = req.query.state || 'open';

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const issues = db.prepare(`
    SELECT i.*, u.username as author_name, u.display_name as author_display_name
    FROM issues i
    JOIN users u ON i.author_id = u.id
    WHERE i.repo_id = ? AND i.state = ?
    ORDER BY i.created_at DESC
  `).all(repoData.id, state);

  res.json(issues);
});

// Create issue
router.post('/repos/:owner/:repo/issues', requireAuth, (req, res) => {
  const { owner, repo } = req.params;
  const { title, body } = req.body;

  if (!title) return res.status(400).json({ error: 'عنوان الزامی است' });

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const result = db.prepare('INSERT INTO issues (repo_id, author_id, title, body) VALUES (?, ?, ?, ?)')
    .run(repoData.id, req.session.user.id, title, body || '');

  // Notify repo owner
  if (repoData.owner_id !== req.session.user.id) {
    createNotification(
      repoData.owner_id,
      'issue',
      `🐛 Issue جدید: ${title}`,
      `${req.session.user.username} یک Issue ایجاد کرد`,
      `/${owner}/${repo}`
    );
  }

  res.json({ success: true, id: result.lastInsertRowid });
});

// Get stats (cached)
router.get('/stats', (req, res) => {
  const cached = cache.get('global_stats');
  if (cached) return res.json(cached);

  const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const repos = db.prepare('SELECT COUNT(*) as count FROM repositories').get();
  const publicRepos = db.prepare('SELECT COUNT(*) as count FROM repositories WHERE is_private = 0').get();

  const stats = { users: users.count, repos: repos.count, publicRepos: publicRepos.count };
  cache.set('global_stats', stats, 60); // Cache for 60 seconds
  res.json(stats);
});

// Explore - trending repos (cached)
router.get('/explore', (req, res) => {
  const cached = cache.get('explore_repos');
  if (cached) return res.json(cached);

  const repos = db.prepare(`
    SELECT r.*, u.username as owner_name, u.display_name as owner_display_name
    FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.is_private = 0
    ORDER BY r.stars DESC, r.updated_at DESC
    LIMIT 20
  `).all();

  cache.set('explore_repos', repos, 30); // Cache for 30 seconds
  res.json(repos);
});

// ============ FILE EDIT ============

// Update file content
router.put('/repos/:owner/:repo/file/*', requireAuth, (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.params[0];
  const { content } = req.body;

  if (content === undefined) {
    return res.status(400).json({ error: 'محتوای فایل الزامی است' });
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

  const file = db.prepare('SELECT id FROM repo_files WHERE repo_id = ? AND file_path = ?').get(repoData.id, filePath);

  if (!file) return res.status(404).json({ error: 'فایل یافت نشد' });

  try {
    // Save current version to history before updating
    const currentFile = db.prepare('SELECT content FROM repo_files WHERE id = ?').get(file.id);
    if (currentFile && currentFile.content) {
      db.prepare('INSERT INTO file_history (repo_id, file_path, content, author_id, message) VALUES (?, ?, ?, ?, ?)')
        .run(repoData.id, filePath, currentFile.content, req.session.user.id, 'ویرایش فایل');
    }

    db.prepare('UPDATE repo_files SET content = ?, size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(content, Buffer.byteLength(content, 'utf8'), file.id);

    // Update repo timestamp
    db.prepare('UPDATE repositories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(repoData.id);

    res.json({ success: true, message: 'فایل بروزرسانی شد' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در بروزرسانی فایل' });
  }
});

// Create new file
router.post('/repos/:owner/:repo/newfile', requireAuth, (req, res) => {
  const { owner, repo } = req.params;
  const { file_path, content } = req.body;

  if (!file_path) {
    return res.status(400).json({ error: 'مسیر فایل الزامی است' });
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

  // Check if file already exists
  const existing = db.prepare('SELECT id FROM repo_files WHERE repo_id = ? AND file_path = ?').get(repoData.id, file_path);
  if (existing) {
    return res.status(409).json({ error: 'فایلی با این نام قبلاً وجود دارد' });
  }

  const fileName = file_path.split('/').pop();
  const fileContent = content || '';

  try {
    db.prepare('INSERT INTO repo_files (repo_id, file_path, file_name, content, size) VALUES (?, ?, ?, ?, ?)')
      .run(repoData.id, file_path, fileName, fileContent, Buffer.byteLength(fileContent, 'utf8'));

    db.prepare('UPDATE repositories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(repoData.id);

    res.json({ success: true, message: 'فایل ایجاد شد' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در ایجاد فایل' });
  }
});

// ============ FILE DELETE ============

// Delete file
router.delete('/repos/:owner/:repo/file/*', requireAuth, (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.params[0];

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  const file = db.prepare('SELECT id FROM repo_files WHERE repo_id = ? AND file_path = ?').get(repoData.id, filePath);
  if (!file) return res.status(404).json({ error: 'فایل یافت نشد' });

  try {
    db.prepare('DELETE FROM repo_files WHERE id = ?').run(file.id);

    // Update repo size
    const totalSize = db.prepare('SELECT SUM(size) as total FROM repo_files WHERE repo_id = ?').get(repoData.id);
    db.prepare('UPDATE repositories SET size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(totalSize.total || 0, repoData.id);

    res.json({ success: true, message: 'فایل حذف شد' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در حذف فایل' });
  }
});

// ============ DOWNLOAD ZIP ============

// Download repository as ZIP
router.get('/repos/:owner/:repo/download', (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  if (repoData.is_private && (!req.session.user || req.session.user.id !== repoData.owner_id)) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  const files = db.prepare('SELECT file_path, content, is_binary FROM repo_files WHERE repo_id = ?').all(repoData.id);

  if (files.length === 0) {
    return res.status(404).json({ error: 'ریپازیتوری خالی است' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${repo}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error(err);
    res.status(500).end();
  });

  archive.pipe(res);

  for (const file of files) {
    if (file.content) {
      archive.append(file.content, { name: `${repo}/${file.file_path}` });
    }
  }

  archive.finalize();
});

// ============ COMMENTS ON ISSUES ============

// Get comments for an issue
router.get('/repos/:owner/:repo/issues/:issueId/comments', (req, res) => {
  const { owner, repo, issueId } = req.params;

  const comments = db.prepare(`
    SELECT c.*, u.username as author_name, u.display_name as author_display_name
    FROM comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.issue_id = ?
    ORDER BY c.created_at ASC
  `).all(issueId);

  res.json(comments);
});

// Add comment to issue
router.post('/repos/:owner/:repo/issues/:issueId/comments', requireAuth, (req, res) => {
  const { owner, repo, issueId } = req.params;
  const { body } = req.body;

  if (!body || !body.trim()) return res.status(400).json({ error: 'متن کامنت الزامی است' });

  const issue = db.prepare(`
    SELECT i.*, r.owner_id, r.name as repo_name FROM issues i
    JOIN repositories r ON i.repo_id = r.id
    WHERE i.id = ?
  `).get(issueId);

  if (!issue) return res.status(404).json({ error: 'Issue یافت نشد' });

  try {
    const result = db.prepare('INSERT INTO comments (issue_id, author_id, body) VALUES (?, ?, ?)')
      .run(issueId, req.session.user.id, body.trim());

    db.prepare('UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(issueId);

    // Notify issue author
    if (issue.author_id !== req.session.user.id) {
      createNotification(
        issue.author_id,
        'comment',
        `کامنت جدید روی "${issue.title}"`,
        `${req.session.user.username} کامنت گذاشت`,
        `/${owner}/${repo}`
      );
    }

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'خطا در ثبت کامنت' });
  }
});

// Close/Reopen issue
router.put('/repos/:owner/:repo/issues/:issueId/state', requireAuth, (req, res) => {
  const { owner, repo, issueId } = req.params;
  const { state } = req.body;

  if (!['open', 'closed'].includes(state)) {
    return res.status(400).json({ error: 'وضعیت نامعتبر' });
  }

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const issue = db.prepare('SELECT * FROM issues WHERE id = ? AND repo_id = ?').get(issueId, repoData.id);
  if (!issue) return res.status(404).json({ error: 'Issue یافت نشد' });

  // Only owner or issue author can change state
  if (repoData.owner_id !== req.session.user.id && issue.author_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  db.prepare('UPDATE issues SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(state, issueId);
  res.json({ success: true, state });
});

// ============ LABELS ============

// Get labels for a repo
router.get('/repos/:owner/:repo/labels', (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.id FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const labels = db.prepare('SELECT * FROM labels WHERE repo_id = ? ORDER BY name').all(repoData.id);
  res.json(labels);
});

// Create label
router.post('/repos/:owner/:repo/labels', requireAuth, (req, res) => {
  const { owner, repo } = req.params;
  const { name, color, description } = req.body;

  if (!name) return res.status(400).json({ error: 'نام برچسب الزامی است' });

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  try {
    db.prepare('INSERT INTO labels (repo_id, name, color, description) VALUES (?, ?, ?, ?)')
      .run(repoData.id, name, color || '#8b949e', description || '');
    res.json({ success: true, message: 'برچسب ایجاد شد' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'برچسبی با این نام وجود دارد' });
    }
    res.status(500).json({ error: 'خطا در ایجاد برچسب' });
  }
});

// Delete label
router.delete('/repos/:owner/:repo/labels/:labelId', requireAuth, (req, res) => {
  const { owner, repo, labelId } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  db.prepare('DELETE FROM labels WHERE id = ? AND repo_id = ?').run(labelId, repoData.id);
  res.json({ success: true });
});

// Add label to issue
router.post('/repos/:owner/:repo/issues/:issueId/labels', requireAuth, (req, res) => {
  const { owner, repo, issueId } = req.params;
  const { label_id } = req.body;

  try {
    db.prepare('INSERT OR IGNORE INTO issue_labels (issue_id, label_id) VALUES (?, ?)').run(issueId, label_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطا' });
  }
});

// Remove label from issue
router.delete('/repos/:owner/:repo/issues/:issueId/labels/:labelId', requireAuth, (req, res) => {
  const { issueId, labelId } = req.params;
  db.prepare('DELETE FROM issue_labels WHERE issue_id = ? AND label_id = ?').run(issueId, labelId);
  res.json({ success: true });
});

// ============ MILESTONES ============

// Get milestones
router.get('/repos/:owner/:repo/milestones', (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.id FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const milestones = db.prepare('SELECT * FROM milestones WHERE repo_id = ? ORDER BY created_at DESC').all(repoData.id);
  res.json(milestones);
});

// Create milestone
router.post('/repos/:owner/:repo/milestones', requireAuth, (req, res) => {
  const { owner, repo } = req.params;
  const { title, description, due_date } = req.body;

  if (!title) return res.status(400).json({ error: 'عنوان الزامی است' });

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  db.prepare('INSERT INTO milestones (repo_id, title, description, due_date) VALUES (?, ?, ?, ?)')
    .run(repoData.id, title, description || '', due_date || null);
  res.json({ success: true, message: 'Milestone ایجاد شد' });
});

// ============ FILE HISTORY ============

// Get file history
router.get('/repos/:owner/:repo/history/*', (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.params[0];

  const repoData = db.prepare(`
    SELECT r.id FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const history = db.prepare(`
    SELECT fh.*, u.username as author_name, u.display_name as author_display_name
    FROM file_history fh
    JOIN users u ON fh.author_id = u.id
    WHERE fh.repo_id = ? AND fh.file_path = ?
    ORDER BY fh.created_at DESC
    LIMIT 50
  `).all(repoData.id, filePath);

  res.json(history);
});

// Get specific history version
router.get('/repos/:owner/:repo/history-version/:id', (req, res) => {
  const { id } = req.params;
  const version = db.prepare('SELECT * FROM file_history WHERE id = ?').get(id);
  if (!version) return res.status(404).json({ error: 'نسخه یافت نشد' });
  res.json(version);
});

// ============ SEARCH IN FILES ============

// Search within repository files
router.get('/repos/:owner/:repo/search', (req, res) => {
  const { owner, repo } = req.params;
  const query = req.query.q;

  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'عبارت جستجو باید حداقل ۲ کاراکتر باشد' });
  }

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  if (repoData.is_private && (!req.session.user || req.session.user.id !== repoData.owner_id)) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  const results = db.prepare(`
    SELECT file_path, file_name, size
    FROM repo_files
    WHERE repo_id = ? AND is_binary = 0 AND content LIKE ?
    LIMIT 50
  `).all(repoData.id, `%${query}%`);

  // Get matching lines for each file
  const detailedResults = results.map(file => {
    const fullFile = db.prepare('SELECT content FROM repo_files WHERE repo_id = ? AND file_path = ?')
      .get(repoData.id, file.file_path);

    const lines = (fullFile.content || '').split('\n');
    const matches = [];
    const lowerQuery = query.toLowerCase();

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(lowerQuery)) {
        matches.push({ line: index + 1, content: line.trim().substring(0, 200) });
      }
    });

    return { ...file, matches: matches.slice(0, 5) };
  });

  res.json(detailedResults);
});

// ============ USER PROFILE (PUBLIC) ============

// Get public user profile
router.get('/users/:username', (req, res) => {
  const { username } = req.params;

  const user = db.prepare('SELECT id, username, display_name, bio, avatar, created_at FROM users WHERE username = ?')
    .get(username);

  if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

  const repos = db.prepare(`
    SELECT r.*, u.username as owner_name
    FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.owner_id = ? AND r.is_private = 0
    ORDER BY r.updated_at DESC
  `).all(user.id);

  const starCount = db.prepare('SELECT COUNT(*) as count FROM stars WHERE user_id = ?').get(user.id);

  res.json({ ...user, repos, starCount: starCount.count });
});

module.exports = router;
