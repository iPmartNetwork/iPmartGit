// iPmartGit - Main JavaScript

// API Helper
async function api(url, options = {}) {
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };
  const config = { ...defaults, ...options };
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  const response = await fetch(url, config);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'خطایی رخ داد');
  }
  return data;
}

// Show alert
function showAlert(message, type = 'error', container = null) {
  const alertEl = document.createElement('div');
  alertEl.className = `alert alert-${type}`;
  alertEl.textContent = message;

  const target = container || document.querySelector('.form-card') || document.querySelector('main');
  if (target) {
    target.insertBefore(alertEl, target.firstChild);
    setTimeout(() => alertEl.remove(), 5000);
  }
}

// Format file size
function formatSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'همین الان';
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  if (hours < 24) return `${hours} ساعت پیش`;
  if (days < 30) return `${days} روز پیش`;
  return date.toLocaleDateString('fa-IR');
}

// Get file icon
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    js: '📜', ts: '📘', py: '🐍', java: '☕', go: '🔵',
    html: '🌐', css: '🎨', json: '📋', md: '📝', txt: '📄',
    png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️',
    zip: '📦', tar: '📦', gz: '📦',
    sh: '⚙️', yml: '⚙️', yaml: '⚙️', toml: '⚙️',
    sql: '🗃️', db: '🗃️',
    lock: '🔒', env: '🔒',
  };
  return icons[ext] || '📄';
}

// Get language color
function getLanguageColor(lang) {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Rust: '#dea584',
    PHP: '#4F5D95',
    Ruby: '#701516',
    C: '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    HTML: '#e34c26',
    CSS: '#563d7c',
  };
  return colors[lang] || '#8b949e';
}

// Search functionality
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        window.location.href = `/explore?search=${encodeURIComponent(query)}`;
      }
    }, 500);
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = e.target.value.trim();
      if (query) {
        window.location.href = `/explore?search=${encodeURIComponent(query)}`;
      }
    }
  });
}

// ===== THEME TOGGLE =====
function initTheme() {
  const saved = localStorage.getItem('ipmartgit-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'light' ? 'dark' : 'light';
  if (newTheme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', newTheme);
  }
  localStorage.setItem('ipmartgit-theme', newTheme);
  
  // Update toggle icon
  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) toggleBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
}

// Initialize theme on load
initTheme();

// Add theme toggle to navbar (if nav exists)
document.addEventListener('DOMContentLoaded', () => {
  const navContainer = document.querySelector('.nav-container');
  if (navContainer) {
    const toggle = document.createElement('span');
    toggle.id = 'themeToggle';
    toggle.className = 'theme-toggle';
    toggle.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️';
    toggle.onclick = toggleTheme;
    toggle.title = 'تغییر تم (Ctrl+Shift+T)';
    // Insert before nav-links
    const navLinks = navContainer.querySelector('.nav-links');
    if (navLinks) navContainer.insertBefore(toggle, navLinks);
  }
});

// ===== KEYBOARD SHORTCUTS =====
const shortcuts = [
  { key: '/', desc: 'فوکوس روی جستجو' },
  { key: 'g d', desc: 'رفتن به داشبورد' },
  { key: 'g e', desc: 'رفتن به کاوش' },
  { key: 'g n', desc: 'ریپازیتوری جدید' },
  { key: 'g s', desc: 'تنظیمات' },
  { key: 'Ctrl+Shift+T', desc: 'تغییر تم' },
  { key: '?', desc: 'نمایش میانبرها' },
  { key: 'Esc', desc: 'بستن پنجره‌ها' },
];

let shortcutBuffer = '';
let shortcutTimeout;

document.addEventListener('keydown', (e) => {
  // Don't trigger in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }

  // Ctrl+Shift+T - Toggle theme
  if (e.ctrlKey && e.shiftKey && e.key === 'T') {
    e.preventDefault();
    toggleTheme();
    return;
  }

  // Escape - close modals
  if (e.key === 'Escape') {
    const modal = document.querySelector('.shortcuts-modal');
    if (modal) modal.remove();
    const fileViewer = document.getElementById('fileViewer');
    if (fileViewer) fileViewer.style.display = 'none';
    const notifPopup = document.getElementById('notifPopup');
    if (notifPopup) notifPopup.remove();
    return;
  }

  // ? - Show shortcuts
  if (e.key === '?' && !e.ctrlKey) {
    showShortcutsModal();
    return;
  }

  // / - Focus search
  if (e.key === '/' && !e.ctrlKey) {
    e.preventDefault();
    const search = document.getElementById('searchInput') || document.getElementById('repoSearchInput');
    if (search) search.focus();
    return;
  }

  // Two-key shortcuts (g + letter)
  clearTimeout(shortcutTimeout);
  shortcutBuffer += e.key;
  shortcutTimeout = setTimeout(() => { shortcutBuffer = ''; }, 800);

  if (shortcutBuffer === 'gd') { window.location.href = '/dashboard'; shortcutBuffer = ''; }
  else if (shortcutBuffer === 'ge') { window.location.href = '/explore'; shortcutBuffer = ''; }
  else if (shortcutBuffer === 'gn') { window.location.href = '/repos/new'; shortcutBuffer = ''; }
  else if (shortcutBuffer === 'gs') { window.location.href = '/settings'; shortcutBuffer = ''; }
});

function showShortcutsModal() {
  // Remove existing
  const existing = document.querySelector('.shortcuts-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.className = 'shortcuts-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div class="shortcuts-content">
      <h3>⌨️ میانبرهای کیبورد</h3>
      ${shortcuts.map(s => `
        <div class="shortcut-item">
          <span>${s.desc}</span>
          <span class="shortcut-key">${s.key}</span>
        </div>
      `).join('')}
      <p style="text-align:center; margin-top:16px; color:var(--text-muted); font-size:0.85rem;">
        برای بستن Esc یا کلیک بیرون
      </p>
    </div>
  `;

  document.body.appendChild(modal);
}
