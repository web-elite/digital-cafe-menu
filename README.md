# ☕ Stage Coffee — Digital Cafe Menu

A fast, mobile-first **digital menu for cafes** with full admin panel. Built for **Stage Coffee (کافه صحنه)** — Persian RTL UI, category browsing, cart selection, QR codes per category for tables.

Flow: scan QR → open category → pick drinks → staff sees selection.

## ✨ Features

**Customer (`#/`, `#/category/:id`):**
- RTL Persian UI, Vazirmatn font
- Hero profile, address, Instagram
- Category ribbon + hash routing
- Items with photo, price (تومان), availability
- Cart bottom-sheet with quantity + total
- Single-file build, `localStorage` fallback (`stage.menu.v1`)

**Admin (`#/admin`):**
- Secure login (cookie, bcrypt, 8h TTL)
- Tabs: items / categories / business / QR
- CRUD categories + items, visibility, FA-digit price parse
- Business + theme editor
- Image upload (JPG/PNG/WebP, 8MB) → `/uploads/...`
- JSON export/import with validation
- QR generator: PNG/SVG, logo overlay, print (A4/Letter)

**Backend:**
- Express + better-sqlite3 (`menu.db`, WAL)
- Tables: `menu`, `settings`, `admin_users`, `admin_sessions`
- Helmet, CORS credentials, rate-limit 300/min
- Auto-seed default Persian menu

## 🧱 Tech Stack

Frontend: React 19 + TS + Vite 7 + Tailwind 4, `clsx`, custom hash router.
Backend: Node ESM, Express 4, better-sqlite3, bcryptjs, multer, sharp + qrcode, helmet, cors, rate-limit, dotenv.

## 📁 Structure

```
src/App.tsx                 # routing, menu fetch, cart
src/components/MenuAdmin.tsx      # admin CRUD
src/components/AdminQrGenerator.tsx # QR UI + print
src/components/AdminLogin.tsx / CategoryRibbon.tsx / Icon.tsx
src/lib/menuData.ts         # types, validation, faNumber
src/lib/router.ts / adminAuth.ts
backend/server.js           # API + SQLite + QR + uploads
index.html                  # fa/RTL
vite.config.ts              # singlefile build
```

## 🚀 Quick Start

Needs Node 20+.

```bash
npm install
npm run dev          # frontend → http://localhost:5173
```

```bash
cd backend
npm install
cp .env.example .env
npm run dev          # backend → http://localhost:4000
```

Root shortcuts:
```bash
npm run backend:dev  # backend watch
npm run build        # single-file dist
npm run preview
```

Frontend uses `http://localhost:4000` on localhost unless `VITE_API_URL` set.

## ⚙️ Env

Frontend `.env` (see `.env.example`):
```bash
VITE_API_URL=http://localhost:4000
# blank in prod for same-origin
```

Backend `backend/.env` (see `backend/.env.example`):
```bash
PORT=4000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin@password
ADMIN_SESSION_TTL_MS=28800000
SESSION_COOKIE_NAME=prfx_admin_session
SESSION_COOKIE_SECURE=false
UPLOAD_MAX_SIZE_BYTES=8388608
# FRONTEND_URL=https://your-domain.com
```

Change defaults in prod. `.env`, `data/`, `uploads/` gitignored.

## 🔌 API

Base `http://localhost:4000`. Admin = httpOnly cookie, `credentials: include`.

| Method | Endpoint | Auth | Use |
|---|---|---|---|
| GET | `/api/health` | no | check |
| POST | `/api/admin/login` | no | `{username,password}` |
| POST | `/api/admin/logout` | cookie | clear |
| GET | `/api/admin/session` | cookie | session state |
| GET | `/api/menu` | no | full MenuData |
| PUT | `/api/menu` | admin | replace menu |
| GET/PUT | `/api/settings` | admin | site settings |
| POST | `/api/upload` | admin | `image` → `{url}` |
| GET | `/api/admin/categories` | admin | list |
| PUT | `/api/admin/category/:id/qr-logo` | admin | `{logoUrl}` |
| GET/POST | `/api/admin/qrcode/category/:id` | admin | QR for `#/category/:id` |
| GET/POST | `/api/admin/qrcode` | admin | QR for any `data` |

## 🖥️ Routes

```
#/                  → landing
#/categories        → sheet
#/category/:id      → menu (+ #/menu aliases)
#/admin             → panel
#/admin/qrcode      → QR
```

QR encodes full deploy URL via `getAbsoluteUrl()`.

## 🖨️ Table QR

Open `#/admin/qrcode` → pick category → size 500 → PNG → download/print → stick on table.

## 📦 Deploy

`npm run build` → serve `dist/`. Run `node backend/server.js`, persist `backend/data/` + `uploads/`. Same-origin: leave `VITE_API_URL` empty. Set `SESSION_COOKIE_SECURE=true` + `FRONTEND_URL` in prod.

## 🇮🇷 Stage Coffee

> کافه صحنه؛ قهوه تخصصی، ساده و بی‌تکلف.

```
