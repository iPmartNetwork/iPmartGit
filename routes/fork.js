const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ابتدا وارد شوید' });
  next();
}

// Fork a repository
router.post('/:owner/:repo', requireAuth, (req, res) => {
  const { owner, repo } = req.params;

  // Get source repo
  const sourceRepo = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ?
  `).get(repo, owner);

  if (!sourceRepo) return res.status(404).json({ error: 'ریپازیتوری یافت نشد' });

  if (sourceRepo.is_private && sourceRepo.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'نمی‌توانید ریپازیتوری خصوصی را fork کنید' });
  }

  // Check if already forked
  const existing = db.prepare('SELECT id FROM repositories WHERE name = ? AND owner_id = ?')
    .get(repo, req.session.user.id);
  if (existing) {
    return res.status(409).json({ error: 'شما قبلاً این ریپازیتوری را fork کرده‌اید' });
  }

  try {
    // Create forked repo
    const result = db.prepare(`
      INSERT INTO repositories (name, owner_id, description, is_private, default_branch, language, size)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `).run(
      sourceRepo.name,
      req.session.user.id,
      `Fork از ${owner}/${repo} - ${sourceRepo.description || ''}`,
      sourceRepo.default_branch,
      sourceRepo.language,
      sourceRepo.size
    );

    const newRepoId = result.lastInsertRowid;

    // Copy all files
    const files = db.prepare('SELECT * FROM repo_files WHERE repo_id = ?').all(sourceRepo.id);
    const insertFile = db.prepare(`
      INSERT INTO repo_files (repo_id, file_path, file_name, content, is_binary, size, mime_type, branch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const copyFiles = db.transaction(() => {
      for (const file of files) {
        insertFile.run(newRepoId, file.file_path, file.file_name, file.content, file.is_binary, file.size, file.mime_type, file.branch);
      }
    });
    copyFiles();

    // Update fork count
    db.prepare('UPDATE repositories SET forks = forks + 1 WHERE id = ?').run(sourceRepo.id);

    res.json({
      success: true,
      message: 'ریپازیتوری با موفقیت fork شد',
      redirect: `/${req.session.user.username}/${repo}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطا در fork ریپازیتوری' });
  }
});

module.exports = router;
