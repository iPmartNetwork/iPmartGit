const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'ipmartgit.db');

// sql.js wrapper to match better-sqlite3 API
class Database {
  constructor() {
    this.db = null;
    this.ready = false;
  }

  async init() {
    const SQL = await initSqlJs();

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.ready = true;
    this._createTables();
    this._createAdmin();
    this._autoSave();
    return this;
  }

  _autoSave() {
    // Save to disk every 5 seconds if changes were made
    this._changed = false;
    setInterval(() => {
      if (this._changed) {
        this.save();
        this._changed = false;
      }
    }, 5000);
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self.db.run(sql, params);
        self._changed = true;
        const lastId = self.db.exec("SELECT last_insert_rowid() as id")[0];
        return { lastInsertRowid: lastId ? lastId.values[0][0] : 0, changes: self.db.getRowsModified() };
      },
      get(...params) {
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  exec(sql) {
    this.db.exec(sql);
    this._changed = true;
  }

  pragma(str) {
    try { this.db.exec(`PRAGMA ${str}`); } catch(e) {}
  }

  transaction(fn) {
    return (...args) => {
      this.db.exec('BEGIN');
      try {
        fn(...args);
        this.db.exec('COMMIT');
        this._changed = true;
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
    };
  }

  _createTables() {
    this.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT,
        avatar TEXT,
        bio TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        description TEXT,
        is_private INTEGER DEFAULT 0,
        is_mirror INTEGER DEFAULT 0,
        mirror_url TEXT,
        default_branch TEXT DEFAULT 'main',
        stars INTEGER DEFAULT 0,
        forks INTEGER DEFAULT 0,
        language TEXT,
        size INTEGER DEFAULT 0,
        org_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id),
        UNIQUE(name, owner_id)
      );

      CREATE TABLE IF NOT EXISTS repo_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content TEXT,
        is_binary INTEGER DEFAULT 0,
        size INTEGER DEFAULT 0,
        mime_type TEXT,
        branch TEXT DEFAULT 'main',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS stars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        repo_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, repo_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        state TEXT DEFAULT 'open',
        labels TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS collaborators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        permission TEXT DEFAULT 'read',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(repo_id, user_id),
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS file_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT,
        author_id INTEGER NOT NULL,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#8b949e',
        description TEXT,
        UNIQUE(repo_id, name),
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS issue_labels (
        issue_id INTEGER NOT NULL,
        label_id INTEGER NOT NULL,
        PRIMARY KEY(issue_id, label_id),
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        state TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pull_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_repo_id INTEGER NOT NULL,
        source_repo_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        state TEXT DEFAULT 'open',
        source_branch TEXT DEFAULT 'main',
        target_branch TEXT DEFAULT 'main',
        merged_at DATETIME,
        merged_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
        FOREIGN KEY (source_repo_id) REFERENCES repositories(id),
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS pr_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pr_id) REFERENCES pull_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS releases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        tag_name TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        is_prerelease INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS release_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        release_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        mime_type TEXT,
        download_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS api_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        token_prefix TEXT,
        scopes TEXT DEFAULT 'repo,read',
        is_active INTEGER DEFAULT 1,
        last_used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT,
        description TEXT,
        avatar TEXT,
        owner_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS org_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(org_id, user_id),
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER NOT NULL,
        repo_id INTEGER,
        type TEXT NOT NULL,
        message TEXT,
        meta TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actor_id) REFERENCES users(id),
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS review_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        body TEXT NOT NULL,
        side TEXT DEFAULT 'right',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pr_id) REFERENCES pull_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id INTEGER NOT NULL,
        reviewer_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        body TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pr_id) REFERENCES pull_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewer_id) REFERENCES users(id)
      );
    `);

    // Create indexes
    this.exec(`
      CREATE INDEX IF NOT EXISTS idx_repo_files_repo_id ON repo_files(repo_id);
      CREATE INDEX IF NOT EXISTS idx_repo_files_path ON repo_files(repo_id, file_path);
      CREATE INDEX IF NOT EXISTS idx_stars_user ON stars(user_id);
      CREATE INDEX IF NOT EXISTS idx_stars_repo ON stars(repo_id);
      CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues(repo_id, state);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_activities_repo ON activities(repo_id);
      CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(actor_id);
      CREATE INDEX IF NOT EXISTS idx_collaborators_repo ON collaborators(repo_id);
      CREATE INDEX IF NOT EXISTS idx_repositories_owner ON repositories(owner_id);
      CREATE INDEX IF NOT EXISTS idx_repositories_org ON repositories(org_id);
    `);
  }

  _createAdmin() {
    const admin = this.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!admin) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      this.prepare('INSERT INTO users (username, email, password, display_name, is_admin) VALUES (?, ?, ?, ?, ?)')
        .run('admin', 'admin@ipmartgit.local', hashedPassword, 'مدیر سیستم', 1);
      this.save();
      console.log('✅ Default admin user created (admin / admin123)');
    }
  }
}

// Singleton
const db = new Database();

// Export a promise-based init, but also support sync-like usage after init
let dbReady = db.init();

// For backward compatibility - make prepare/exec available synchronously after init
module.exports = new Proxy(db, {
  get(target, prop) {
    if (prop === 'initPromise') return dbReady;
    return target[prop] ? (typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop]) : undefined;
  }
});
