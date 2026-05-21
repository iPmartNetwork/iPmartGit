<div align="center" dir="rtl">

<img src="img/iPmartGit2.png" alt="iPmartGit" width="150">

# iPmartGit

### کد شما. سرور شما. قوانین شما.

پلتفرم مدیریت کد سلف‌هاست برای تیم‌هایی که کنترل کامل روی سورس‌کد خود می‌خواهند — بدون وابستگی به فضای ابری، بدون نیاز به اینترنت بین‌المللی.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/iPmartNetwork/iPmartGit?style=flat-square&color=yellow)](https://github.com/iPmartNetwork/iPmartGit/stargazers)

[نصب سریع](#-نصب-سریع) · [قابلیت‌ها](#-قابلیتها) · [استقرار روی سرور](#-استقرار-روی-سرور) · [داکر](#-داکر) · [API](#-api) · [مشارکت](#-مشارکت)

---

<img src="img/iPmartGit.png" width="500" alt="iPmartGit Logo">

</div>

---

<div dir="rtl">

## 🤔 چرا iPmartGit؟

| مشکل | راه‌حل iPmartGit |
|------|-----------------|
| GitHub/GitLab مسدود یا کند است | ۱۰۰٪ روی سرور محلی شما اجرا می‌شود |
| نیاز به سرور Git خصوصی | بدون پیکربندی — SQLite داخلی |
| نصب پیچیده (Gitea, GitLab) | فقط `npm install && npm start` |
| تیم نیاز به ابزار همکاری دارد | PR، Code Review، Issues، سازمان‌ها |
| منابع سرور محدود | با ۵۱۲ مگابایت RAM اجرا می‌شود |

---

## ⚡ نصب سریع

### نصب یک‌خطی (سرور لینوکس)

</div>

```bash
bash <(curl -s https://raw.githubusercontent.com/iPmartNetwork/iPmartGit/master/deploy-iran.sh)
```

<div dir="rtl">

### نصب دستی

</div>

```bash
git clone https://github.com/iPmartNetwork/iPmartGit.git
cd iPmartGit
npm install
npm run setup
npm start
```

<div dir="rtl">

مرورگر را باز کنید: **http://localhost:3000** → ورود: `admin` / `admin123`

> ⚠️ بلافاصله بعد از اولین ورود، نام کاربری و رمز عبور ادمین را از صفحه تنظیمات تغییر دهید.

---

## 🎯 قابلیت‌ها

### 📦 مدیریت ریپازیتوری
- ایجاد ریپازیتوری عمومی و خصوصی
- Fork کردن ریپازیتوری‌ها
- آپلود فایل (کشیدن و رها کردن)
- ویرایش آنلاین فایل‌ها با Syntax Highlighting
- دانلود به صورت ZIP
- میرور از GitHub با قابلیت سینک

### 🔀 Pull Request و Code Review
- ایجاد PR بین fork ها
- کامنت خط به خط روی کد
- تأیید / درخواست تغییرات / کامنت
- Merge با یک کلیک
- نمایش فایل‌های تغییر یافته

### 🏢 تیم‌ها و سازمان‌ها
- ایجاد سازمان
- نقش‌های عضو: مالک / ادمین / عضو
- ریپازیتوری‌های مشترک تیمی
- سطوح دسترسی همکاران (خواندن / نوشتن / ادمین)

### 🐛 Issues و مدیریت پروژه
- سیستم کامل Issue Tracker
- کامنت و بحث
- برچسب‌ها با رنگ دلخواه
- Milestone با تاریخ سررسید
- گردش کار باز/بسته

### 🔐 امنیت و احراز هویت
- احراز هویت مبتنی بر Session
- توکن‌های API برای دسترسی برنامه‌ای
- هش رمز عبور با bcrypt
- محدودیت نرخ درخواست (Rate Limiting)
- کنترل دسترسی ریپازیتوری خصوصی
- تغییر نام کاربری و رمز عبور ادمین از تنظیمات

### 🚀 آماده DevOps
- پروتکل Git HTTP (واقعی `git clone` / `git push`)
- Releases با فایل‌های پیوست
- Import/Export (پشتیبان‌گیری کامل به JSON)
- Docker و Docker Compose
- اسکریپت استقرار خودکار
- سرویس Systemd

### ✨ تجربه کاربری
- 🎨 **Syntax Highlighting** — بیش از ۳۰ زبان
- 🌗 **تم تاریک / روشن** — تغییر با `Ctrl+Shift+T`
- ⌨️ **میانبرهای کیبورد** — `?` را بزنید
- 📜 **تاریخچه فایل** — ردیابی نسخه‌ها با Diff بصری
- 🔍 **جستجوی کد** — جستجو در محتوای فایل‌ها
- 📰 **فید فعالیت** — ببینید چه اتفاقی می‌افتد
- 🔔 **اعلان‌ها** — ستاره، Issue، PR، کامنت
- 📱 **ریسپانسیو** — سازگار با موبایل
- 🇮🇷 **رابط فارسی RTL** — پشتیبانی کامل راست‌به‌چپ

---

## 🖥️ استقرار روی سرور

### استقرار یک‌دستوری (Ubuntu/Debian)

</div>

```bash
# پروژه را به سرور منتقل کنید، سپس:
chmod +x deploy-iran.sh
sudo bash deploy-iran.sh

# با دامنه اختصاصی:
sudo bash deploy-iran.sh git.yourdomain.com
```

<div dir="rtl">

این اسکریپت همه کارها را انجام می‌دهد:
- ✅ نصب Node.js 20، Git، Nginx
- ✅ ایجاد کاربر سیستم و دایرکتوری‌ها
- ✅ نصب وابستگی‌ها
- ✅ راه‌اندازی سرویس systemd (ریستارت خودکار)
- ✅ پیکربندی Nginx reverse proxy
- ✅ تولید کلید امن Session

### حداقل سیستم مورد نیاز

| | حداقل | توصیه شده |
|---|-------|-----------|
| **CPU** | ۱ هسته | ۲+ هسته |
| **RAM** | ۵۱۲ مگابایت | ۱ گیگابایت+ |
| **دیسک** | ۱ گیگابایت | ۱۰ گیگابایت+ |
| **سیستم‌عامل** | Ubuntu 20.04+ | Ubuntu 22.04/24.04 |
| **Node.js** | ۱۸ | ۲۰ LTS |

---

## 🐳 داکر

</div>

```bash
# اجرای iPmartGit
docker-compose up -d

# با Nginx reverse proxy
docker-compose --profile with-nginx up -d

# مشاهده لاگ
docker logs -f ipmartgit

# توقف
docker-compose down
```

<div dir="rtl">

### متغیرهای محیطی

</div>

```env
PORT=3000
SESSION_SECRET=your-secret-key-here
NODE_ENV=production
```

<div dir="rtl">

---

## 🔗 پروتکل Git

iPmartGit از پروتکل استاندارد Git HTTP پشتیبانی می‌کند:

</div>

```bash
# Clone
git clone http://your-server/git/username/repo.git

# Push (با نام کاربری + رمز عبور یا توکن API)
git push origin main
```

<div dir="rtl">

### توکن‌های API

از مسیر **تنظیمات → توکن‌های API** توکن بسازید و به جای رمز عبور در Git و CI/CD استفاده کنید.

---

## 📡 API

| مسیر | متد | توضیح |
|------|------|-------|
| `/api/repos` | GET | لیست ریپازیتوری‌های عمومی |
| `/api/repos/:owner/:repo` | GET | جزئیات ریپازیتوری + فایل‌ها |
| `/api/repos/:owner/:repo/file/*` | GET | محتوای فایل |
| `/api/repos/:owner/:repo/search?q=` | GET | جستجو در کد |
| `/api/repos/:owner/:repo/download` | GET | دانلود ZIP |
| `/api/repos/:owner/:repo/issues` | GET | لیست Issues |
| `/api/users/:username` | GET | پروفایل کاربر |
| `/api/stats` | GET | آمار پلتفرم |
| `/api/explore` | GET | ریپازیتوری‌های محبوب |

---

## 🏗️ معماری پروژه

</div>

```
iPmartGit/
├── server.js              # نقطه ورود Express
├── db/database.js         # اسکیمای SQLite (۲۰+ جدول)
├── lib/cache.js           # لایه کش حافظه‌ای
├── routes/
│   ├── api.js             # API عمومی
│   ├── auth.js            # احراز هویت
│   ├── repos.js           # CRUD ریپازیتوری
│   ├── git-http.js        # پروتکل Git
│   ├── pull-requests.js   # Pull Requests
│   ├── code-review.js     # بررسی کد خط به خط
│   ├── releases.js        # Releases و تگ‌ها
│   ├── organizations.js   # سازمان‌ها
│   ├── mirror.js          # میرور GitHub
│   ├── activity.js        # فید فعالیت
│   ├── notifications.js   # اعلان‌ها
│   ├── admin.js           # پنل ادمین
│   └── ...
├── public/                # فرانت‌اند (HTML/CSS/JS خالص)
├── Dockerfile
├── docker-compose.yml
└── deploy-iran.sh         # اسکریپت استقرار خودکار
```

<div dir="rtl">

### پشته فناوری
- **Runtime:** Node.js + Express
- **دیتابیس:** SQLite با better-sqlite3 (بدون پیکربندی)
- **فرانت‌اند:** Vanilla JS — بدون React، بدون مرحله Build
- **احراز هویت:** bcrypt + express-session
- **Syntax:** highlight.js

---

## 🤝 مشارکت

از مشارکت شما استقبال می‌کنیم! فایل [CONTRIBUTING.md](CONTRIBUTING.md) را ببینید.

</div>

```bash
# حالت توسعه (بارگذاری مجدد خودکار)
npm run dev
```

<div dir="rtl">

---

## 📋 نقشه راه

- [ ] پشتیبانی Webhook
- [ ] احراز هویت دو مرحله‌ای (2FA)
- [ ] احراز هویت با کلید SSH
- [ ] رابط مدیریت Branch
- [ ] صفحات Wiki
- [ ] اجراکننده CI/CD
- [ ] سیستم پلاگین

تاریخچه نسخه‌ها را در [CHANGELOG.md](CHANGELOG.md) ببینید.

---

## 📄 لایسنس

MIT License — فایل [LICENSE](LICENSE) را ببینید.

---

</div>

<div align="center">

**ساخته شده با ❤️ توسط [iPmart Network](https://github.com/iPmartNetwork)**

اگر این پروژه برایتان مفید بود، یک ⭐ بدهید

[گزارش باگ](https://github.com/iPmartNetwork/iPmartGit/issues) · [درخواست قابلیت](https://github.com/iPmartNetwork/iPmartGit/issues) · [بحث و گفتگو](https://github.com/iPmartNetwork/iPmartGit/discussions)

</div>
