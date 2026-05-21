const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { createNotification } = require('./notifications');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Get pull requests for a repo
router.get('/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;
  const state = req.query.state || 'open';

  const repoData = db.prepare(`
    SELECT r.id FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const prs = db.prepare(`
    SELECT pr.*, 
      u.username as author_name, u.display_name as author_display_name,
      sr.name as source_repo_name, su.username as source_owner_name
    FROM pull_requests pr
    JOIN users u ON pr.author_id = u.id
    LEFT JOIN repositories sr ON pr.source_repo_id = sr.id
    LEFT JOIN users su ON sr.owner_id = su.id
    WHERE pr.target_repo_id = ? AND pr.state = ?
    ORDER BY pr.created_at DESC
  `).all(repoData.id, state);

  res.json(prs);
});

// Get single PR
router.get('/:owner/:repo/:prId', (req, res) => {
  const { owner, repo, prId } = req.params;

  const pr = db.prepare(`
    SELECT pr.*, 
      u.username as author_name, u.display_name as author_display_name,
      sr.name as source_repo_name, su.username as source_owner_name,
      tr.name as target_repo_name, tu.username as target_owner_name
    FROM pull_requests pr
    JOIN users u ON pr.author_id = u.id
    LEFT JOIN repositories sr ON pr.source_repo_id = sr.id
    LEFT JOIN users su ON sr.owner_id = su.id
    JOIN repositories tr ON pr.target_repo_id = tr.id
    JOIN users tu ON tr.owner_id = tu.id
    WHERE pr.id = ?
  `).get(prId);

  if (!pr) return res.status(404).json({ error: 'Pull Request یافت نشد' });

  // Get PR comments
  const comments = db.prepare(`
    SELECT prc.*, u.username as author_name, u.display_name as author_display_name
    FROM pr_comments prc
    JOIN users u ON prc.author_id = u.id
    WHERE prc.pr_id = ?
    ORDER BY prc.created_at ASC
  `).all(prId);

  // Get changed files (compare source and target repo files)
  let changedFiles = [];
  if (pr.source_repo_id) {
    const sourceFiles = db.prepare('SELECT file_path, content, size FROM repo_files WHERE repo_id = ?').all(pr.source_repo_id);
    const targetFiles = db.prepare('SELECT file_path, content, size FROM repo_files WHERE repo_id = ?').all(pr.target_repo_id);

    const targetMap = {};
    targetFiles.forEach(f => { targetMap[f.file_path] = f; });

    sourceFiles.forEach(sf => {
      const tf = targetMap[sf.file_path];
      if (!tf) {
        changedFiles.push({ path: sf.file_path, status: 'added', size: sf.size });
      } else if (tf.content !== sf.content) {
        changedFiles.push({ path: sf.file_path, status: 'modified', size: sf.size });
      }
    });

    // Check for deleted files
    targetFiles.forEach(tf => {
      const sf = sourceFiles.find(s => s.file_path === tf.file_path);
      if (!sf) {
        changedFiles.push({ path: tf.file_path, status: 'deleted', size: tf.size });
      }
    });
  }

  res.json({ ...pr, comments, changedFiles });
});

// Create pull request
router.post('/:owner/:repo', requireAuth, (req, res) => {
  const { owner, repo } = req.params;
  const { title, body, source_repo_id, source_branch, target_branch } = req.body;

  if (!title) return res.status(400).json({ error: 'عنوان الزامی است' });
  if (!source_repo_id) return res.status(400).json({ error: 'ریپازیتوری مبدأ الزامی است' });

  const targetRepo = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!targetRepo) return res.status(404).json({ error: 'ریپازیتوری مقصد یافت نشد' });

  // Verify source repo exists and user has access
  const sourceRepo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(source_repo_id);
  if (!sourceRepo) return res.status(404).json({ error: 'ریپازیتوری مبدأ یافت نشد' });

  try {
    const result = db.prepare(`
      INSERT INTO pull_requests (target_repo_id, source_repo_id, author_id, title, body, source_branch, target_branch)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      targetRepo.id,
      source_repo_id,
      req.session.user.id,
      title,
      body || '',
      source_branch || 'main',
      target_branch || 'main'
    );

    // Notify repo owner
    if (targetRepo.owner_id !== req.session.user.id) {
      createNotification(
        targetRepo.owner_id,
        'pull_request',
        `🔀 Pull Request جدید: ${title}`,
        `${req.session.user.username} یک PR ایجاد کرد`,
        `/${owner}/${repo}`
      );
    }

    res.json({ success: true, id: result.lastInsertRowid, message: 'Pull Request ایجاد شد' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در ایجاد Pull Request' });
  }
});

// Add comment to PR
router.post('/:owner/:repo/:prId/comments', requireAuth, (req, res) => {
  const { prId } = req.params;
  const { body } = req.body;

  if (!body || !body.trim()) return res.status(400).json({ error: 'متن کامنت الزامی است' });

  const pr = db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(prId);
  if (!pr) return res.status(404).json({ error: 'PR یافت نشد' });

  db.prepare('INSERT INTO pr_comments (pr_id, author_id, body) VALUES (?, ?, ?)')
    .run(prId, req.session.user.id, body.trim());

  // Notify PR author
  if (pr.author_id !== req.session.user.id) {
    createNotification(
      pr.author_id,
      'pr_comment',
      `کامنت جدید روی PR "${pr.title}"`,
      `${req.session.user.username} کامنت گذاشت`,
      null
    );
  }

  res.json({ success: true });
});

// Merge pull request
router.post('/:owner/:repo/:prId/merge', requireAuth, (req, res) => {
  const { owner, repo, prId } = req.params;

  const targetRepo = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!targetRepo) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  // Only owner can merge
  if (targetRepo.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'فقط مالک ریپازیتوری می‌تواند merge کند' });
  }

  const pr = db.prepare('SELECT * FROM pull_requests WHERE id = ? AND target_repo_id = ?').get(prId, targetRepo.id);
  if (!pr) return res.status(404).json({ error: 'PR یافت نشد' });
  if (pr.state !== 'open') return res.status(400).json({ error: 'این PR قبلاً بسته شده' });

  try {
    // Copy files from source to target
    const sourceFiles = db.prepare('SELECT * FROM repo_files WHERE repo_id = ?').all(pr.source_repo_id);

    const upsertFile = db.prepare(`
      INSERT OR REPLACE INTO repo_files (repo_id, file_path, file_name, content, is_binary, size, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const mergeTransaction = db.transaction(() => {
      for (const file of sourceFiles) {
        upsertFile.run(targetRepo.id, file.file_path, file.file_name, file.content, file.is_binary, file.size, file.mime_type);
      }
    });
    mergeTransaction();

    // Update PR state
    db.prepare('UPDATE pull_requests SET state = ?, merged_at = CURRENT_TIMESTAMP, merged_by = ? WHERE id = ?')
      .run('merged', req.session.user.id, prId);

    // Update repo timestamp
    db.prepare('UPDATE repositories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetRepo.id);

    // Notify PR author
    if (pr.author_id !== req.session.user.id) {
      createNotification(
        pr.author_id,
        'pr_merged',
        `✅ PR "${pr.title}" merge شد`,
        `${req.session.user.username} PR شما را merge کرد`,
        `/${owner}/${repo}`
      );
    }

    res.json({ success: true, message: 'Pull Request با موفقیت merge شد' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در merge' });
  }
});

// Close PR (without merge)
router.post('/:owner/:repo/:prId/close', requireAuth, (req, res) => {
  const { owner, repo, prId } = req.params;

  const targetRepo = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!targetRepo) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  const pr = db.prepare('SELECT * FROM pull_requests WHERE id = ? AND target_repo_id = ?').get(prId, targetRepo.id);
  if (!pr) return res.status(404).json({ error: 'PR یافت نشد' });

  // Owner or PR author can close
  if (targetRepo.owner_id !== req.session.user.id && pr.author_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  db.prepare('UPDATE pull_requests SET state = ? WHERE id = ?').run('closed', prId);
  res.json({ success: true, message: 'PR بسته شد' });
});

module.exports = router;
