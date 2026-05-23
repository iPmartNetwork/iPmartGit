const express = require('express');
const router = express.Router();
const db = require('../db/database');
const https = require('https');
const http = require('http');
const path = require('path');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'ابتدا وارد شوید' });
  }
  next();
}

// Mirror page
router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'mirror.html'));
});

// Create mirror from GitHub
router.post('/github', requireAuth, (req, res) => {
  const { github_url, name, description, is_private } = req.body;

  if (!github_url) {
    return res.status(400).json({ error: 'آدرس GitHub الزامی است' });
  }

  // Parse GitHub URL
  const match = github_url.match(/github\.com\/([^\/]+)\/([^\/\s.]+)/);
  if (!match) {
    return res.status(400).json({ error: 'آدرس GitHub معتبر نیست' });
  }

  const ghOwner = match[1];
  const ghRepo = match[2].replace('.git', '');
  const repoName = name || ghRepo;

  // Check if repo already exists
  const existing = db.prepare('SELECT id FROM repositories WHERE name = ? AND owner_id = ?')
    .get(repoName, req.session.user.id);
  if (existing) {
    return res.status(409).json({ error: 'ریپازیتوری با این نام قبلاً وجود دارد' });
  }

  // Fetch repo info from GitHub API
  const apiUrl = `https://api.github.com/repos/${ghOwner}/${ghRepo}`;

  fetchJSON(apiUrl).then(ghData => {
    // Create repository
    const result = db.prepare(`
      INSERT INTO repositories (name, owner_id, description, is_private, is_mirror, mirror_url, language)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(
      repoName,
      req.session.user.id,
      description || ghData.description || '',
      is_private ? 1 : 0,
      github_url,
      ghData.language || null
    );

    const repoId = result.lastInsertRowid;

    // Fetch file tree from GitHub
    fetchGitHubTree(ghOwner, ghRepo, ghData.default_branch || 'main', repoId)
      .then(() => {
        // Also fetch latest release
        return fetchLatestRelease(ghOwner, ghRepo, repoId, req.session.user.id);
      })
      .then(() => {
        res.json({
          success: true,
          message: 'میرور با موفقیت ایجاد شد (شامل آخرین Release)',
          redirect: `/${req.session.user.username}/${repoName}`
        });
      })
      .catch(err => {
        console.error('Error fetching tree:', err);
        res.json({
          success: true,
          message: 'ریپازیتوری ایجاد شد اما دریافت فایل‌ها با خطا مواجه شد. می‌توانید بعداً سینک کنید.',
          redirect: `/${req.session.user.username}/${repoName}`
        });
      });
  }).catch(err => {
    console.error('GitHub API error:', err);
    // Create repo without GitHub data
    try {
      const result = db.prepare(`
        INSERT INTO repositories (name, owner_id, description, is_private, is_mirror, mirror_url)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(repoName, req.session.user.id, description || '', is_private ? 1 : 0, github_url);

      res.json({
        success: true,
        message: 'ریپازیتوری میرور ایجاد شد (بدون دسترسی به GitHub API). فایل‌ها را می‌توانید دستی آپلود کنید.',
        redirect: `/${req.session.user.username}/${repoName}`
      });
    } catch (dbErr) {
      res.status(500).json({ error: 'خطا در ایجاد ریپازیتوری' });
    }
  });
});

// Sync mirror
router.post('/:owner/:repo/sync', requireAuth, (req, res) => {
  const { owner, repo } = req.params;

  const repoData = db.prepare(`
    SELECT r.* FROM repositories r
    JOIN users u ON r.owner_id = u.id
    WHERE r.name = ? AND u.username = ? AND r.is_mirror = 1
  `).get(repo, owner);

  if (!repoData) return res.status(404).json({ error: 'ریپازیتوری میرور یافت نشد' });
  if (repoData.owner_id !== req.session.user.id) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }

  const match = repoData.mirror_url.match(/github\.com\/([^\/]+)\/([^\/\s.]+)/);
  if (!match) {
    return res.status(400).json({ error: 'آدرس میرور معتبر نیست' });
  }

  const ghOwner = match[1];
  const ghRepo = match[2].replace('.git', '');

  // Delete existing files and re-fetch
  db.prepare('DELETE FROM repo_files WHERE repo_id = ?').run(repoData.id);

  fetchGitHubTree(ghOwner, ghRepo, repoData.default_branch || 'main', repoData.id)
    .then(() => {
      db.prepare('UPDATE repositories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(repoData.id);
      res.json({ success: true, message: 'سینک با موفقیت انجام شد' });
    })
    .catch(err => {
      console.error('Sync error:', err);
      res.status(500).json({ error: 'خطا در سینک. ممکن است دسترسی به GitHub محدود باشد.' });
    });
});

// Helper: Fetch JSON from URL
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const ghToken = process.env.GITHUB_TOKEN || '';
    const headers = { 'User-Agent': 'iPmartGit/1.0' };
    if (ghToken) headers['Authorization'] = 'token ' + ghToken;

    const options = { headers };

    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', reject);
  });
}

// Helper: Fetch GitHub tree and save files
async function fetchGitHubTree(owner, repo, branch, repoId) {
  // Method: Download ZIP archive (much faster than file-by-file)
  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;

  try {
    const zipBuffer = await downloadFile(zipUrl);
    if (!zipBuffer || zipBuffer.length < 100) {
      console.error('Failed to download ZIP, falling back to tree API');
      return await fetchGitHubTreeFallback(owner, repo, branch, repoId);
    }

    // Extract ZIP
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const insertFile = db.prepare(`
      INSERT INTO repo_files (repo_id, file_path, file_name, content, is_binary, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (count >= 500) break; // Limit to 500 files

      // Remove the top-level directory from path (GitHub adds owner-repo-hash/)
      const fullPath = entry.entryName;
      const parts = fullPath.split('/');
      parts.shift(); // Remove first directory
      const filePath = parts.join('/');
      if (!filePath) continue;

      const fileName = parts[parts.length - 1];
      const content = entry.getData();
      const isBinary = isBinaryBuffer(content);

      try {
        insertFile.run(
          repoId,
          filePath,
          fileName,
          isBinary ? null : content.toString('utf8'),
          isBinary ? 1 : 0,
          entry.header.size || content.length
        );
        count++;
      } catch (e) { /* skip duplicates */ }
    }

    // Update repo size
    const totalSize = db.prepare('SELECT SUM(size) as total FROM repo_files WHERE repo_id = ?').get(repoId);
    db.prepare('UPDATE repositories SET size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(totalSize.total || 0, repoId);

    console.log(`Mirrored ${count} files for ${owner}/${repo} via ZIP`);
  } catch (err) {
    console.error('ZIP download failed:', err.message);
    return await fetchGitHubTreeFallback(owner, repo, branch, repoId);
  }
}

// Fallback: file-by-file (slow, used if ZIP fails)
async function fetchGitHubTreeFallback(owner, repo, branch, repoId) {
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const tree = await fetchJSON(treeUrl);

  if (!tree.tree) return;

  const insertFile = db.prepare(`
    INSERT INTO repo_files (repo_id, file_path, file_name, content, is_binary, size)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const item of tree.tree.slice(0, 100)) {
    if (item.type !== 'blob') continue;
    if (item.size > 1024 * 1024) continue;

    try {
      const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`;
      const fileData = await fetchJSON(contentUrl);

      let content = null;
      let isBinary = 0;

      if (fileData.encoding === 'base64' && fileData.content) {
        const decoded = Buffer.from(fileData.content, 'base64');
        if (isBinaryBuffer(decoded)) {
          isBinary = 1;
        } else {
          content = decoded.toString('utf8');
        }
      }

      const fileName = item.path.split('/').pop();
      insertFile.run(repoId, item.path, fileName, content, isBinary, item.size || 0);
    } catch (err) {
      const fileName = item.path.split('/').pop();
      insertFile.run(repoId, item.path, fileName, null, 0, item.size || 0);
    }
  }
}

function isBinaryBuffer(buffer) {
  for (let i = 0; i < Math.min(buffer.length, 8000); i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

// Fetch latest release from GitHub
async function fetchLatestRelease(owner, repo, repoId, userId) {
  try {
    const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const release = await fetchJSON(releaseUrl);

    if (!release || !release.tag_name) return;

    // Check if release already exists
    const existing = db.prepare('SELECT id FROM releases WHERE repo_id = ? AND tag_name = ?').get(repoId, release.tag_name);
    if (existing) return;

    // Create release record
    const result = db.prepare(`
      INSERT INTO releases (repo_id, author_id, tag_name, title, body, is_prerelease)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      repoId,
      userId,
      release.tag_name,
      release.name || release.tag_name,
      release.body || '',
      release.prerelease ? 1 : 0
    );

    const releaseId = result.lastInsertRowid;

    // Download release assets (max 5, max 100MB each)
    if (release.assets && release.assets.length > 0) {
      const fs = require('fs');
      const path = require('path');
      const releaseDir = path.join(__dirname, '..', 'uploads', 'releases');
      if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });

      for (const asset of release.assets.slice(0, 5)) {
        if (asset.size > 100 * 1024 * 1024) continue; // Skip > 100MB

        try {
          const assetData = await downloadFile(asset.browser_download_url);
          if (assetData) {
            const filename = `${Date.now()}-${asset.name}`;
            const filepath = path.join(releaseDir, filename);
            fs.writeFileSync(filepath, assetData);

            db.prepare(`
              INSERT INTO release_assets (release_id, file_name, file_path, size, mime_type)
              VALUES (?, ?, ?, ?, ?)
            `).run(releaseId, asset.name, filename, asset.size, asset.content_type || 'application/octet-stream');
          }
        } catch (e) {
          console.error(`Failed to download asset: ${asset.name}`, e.message);
        }
      }
    }

    console.log(`Release ${release.tag_name} mirrored for ${owner}/${repo}`);
  } catch (err) {
    console.error('Failed to fetch release:', err.message);
  }
}

// Download file as buffer
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: { 'User-Agent': 'iPmartGit/1.0' }
    };

    protocol.get(url, options, (response) => {
      // Follow redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location).then(resolve).catch(reject);
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

module.exports = router;
