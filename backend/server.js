import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCodeLib from "qrcode";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(__dirname, "uploads");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(path.join(dataDir, "menu.db"));
db.pragma("encoding = 'UTF-8'");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const closeDatabase = () => {
  try {
    db.close();
  } catch {
    // Ignore shutdown cleanup errors; process exit is already in progress.
  }
};

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "stageadmin").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Stage@Coffee2026!";
const ADMIN_SESSION_TTL_MS = Number(
  process.env.ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000,
);
const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || "stage_admin_session";
const SESSION_COOKIE_SECURE =
  String(process.env.SESSION_COOKIE_SECURE || "false").toLowerCase() ===
  "true";
const PORT = Number(process.env.PORT || 4000);
const UPLOAD_MAX_SIZE_BYTES = Number(
  process.env.UPLOAD_MAX_SIZE_BYTES || 8 * 1024 * 1024,
);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDir),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeBase = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      callback(null, `${safeBase}${ext}`);
    },
  }),
  limits: { fileSize: UPLOAD_MAX_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG and WebP images are allowed."),
      );
    }
    callback(null, true);
  },
});

db.exec(`
  CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`);

const ensureAdminUser = () => {
  const existing = db
    .prepare("SELECT id, password_hash FROM admin_users WHERE username = ?")
    .get(ADMIN_USERNAME);
  if (!existing) {
    db.prepare(
      "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
    ).run(ADMIN_USERNAME, bcrypt.hashSync(ADMIN_PASSWORD, 12));
    return;
  }

  if (
    existing.password_hash !== bcrypt.hashSync(ADMIN_PASSWORD, 12) &&
    !bcrypt.compareSync(ADMIN_PASSWORD, existing.password_hash)
  ) {
    db.prepare(
      "UPDATE admin_users SET password_hash = ? WHERE username = ?",
    ).run(bcrypt.hashSync(ADMIN_PASSWORD, 12), ADMIN_USERNAME);
  }
};

ensureAdminUser();

const defaultMenuDocument = {
  version: 1,
  business: {
    name: "صحنه",
    englishName: "STAGE",
    description:
      "صحنه (Stage) بازتابی از سبک زندگی مدرن و پرشتاب شهری است؛ یک کافه بیرون‌بر با هویتی مینیمال و بی‌تکلف که پیچیدگی‌های اضافه را حذف کرده تا بر ارائه بی‌نقص‌ترین فنجان قهوه تمرکز کند. سرعت و چابکی در کنار استانداردهای قهوه تخصصی تا تجربه‌ای گرم و مشتری‌محور بسازد.",
    address: "بلوار الهیه، بین الهیه ۹ و ۱۱",
    heroImage:
      "https://images.pexels.com/photos/32416005/pexels-photo-32416005.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1800&w=1200",
    logo: "",
    instagramUrl: "https://instagram.com",
    tagline: "یک فنجان، بی‌هیاهو.",
  },
  theme: {
    primary: "#d7a36a",
    primaryStrong: "#b97742",
    accent: "#d7a36a",
    accentSoft: "#f2e4d6",
    background: "#111311",
    surface: "#f7f4ee",
    surfaceAlt: "#ede4d6",
    text: "#1b150f",
    textSoft: "#5f5142",
  },
  categories: [
    {
      id: "hot-coffee",
      title: "نوشیدنی‌های گرم بر پایه قهوه",
      englishTitle: "HOT COFFEE",
      cover: "https://images.pexels.com/photos/36671892/pexels-photo-36671892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "hot-coffee-0",
          name: "اسپرسو ۵۰٪ عربیکا",
          price: 150000,
          detail: "",
          image: "https://images.pexels.com/photos/36671892/pexels-photo-36671892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-1",
          name: "اسپرسو ۱۰۰٪ عربیکا",
          price: 170000,
          detail: "",
          image: "https://images.pexels.com/photos/36671892/pexels-photo-36671892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-2",
          name: "آمریکانو ۵۰٪ عربیکا",
          price: 160000,
          detail: "",
          image: "https://images.pexels.com/photos/36671892/pexels-photo-36671892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-3",
          name: "آمریکانو ۱۰۰٪ عربیکا",
          price: 180000,
          detail: "",
          image: "https://images.pexels.com/photos/36671892/pexels-photo-36671892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-4",
          name: "کورتادو ۵۰٪ عربیکا",
          price: 170000,
          detail: "",
          image: "https://images.pexels.com/photos/36671892/pexels-photo-36671892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-5",
          name: "کورتادو ۱۰۰٪ عربیکا",
          price: 190000,
          detail: "",
          image: "https://images.pexels.com/photos/36671892/pexels-photo-36671892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-6",
          name: "کاپوچینو ۵۰٪ عربیکا",
          price: 175000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-7",
          name: "کاپوچینو ۱۰۰٪ عربیکا",
          price: 195000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-8",
          name: "موکا اورجینال ۵۰٪ عربیکا",
          price: 195000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-9",
          name: "موکا اورجینال ۱۰۰٪ عربیکا",
          price: 225000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-10",
          name: "کارامل ماکیاتو ۵۰٪ عربیکا",
          price: 190000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-11",
          name: "کارامل ماکیاتو ۱۰۰٪ عربیکا",
          price: 215000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-12",
          name: "لاته ۵۰٪ عربیکا",
          price: 185000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-13",
          name: "لاته ۱۰۰٪ عربیکا",
          price: 210000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-14",
          name: "موکا کرم ۵۰٪ عربیکا",
          price: 270000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "hot-coffee-15",
          name: "موکا کرم ۱۰۰٪ عربیکا",
          price: 300000,
          detail: "",
          image: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
    {
      id: "iced-coffee",
      title: "نوشیدنی‌های سرد بر پایه قهوه",
      englishTitle: "ICED COFFEE",
      cover: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "iced-coffee-0",
          name: "آیس اسپرسو ۵۰٪ عربیکا",
          price: 150000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-1",
          name: "آیس اسپرسو ۱۰۰٪ عربیکا",
          price: 170000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-2",
          name: "آیس آمریکانو ۵۰٪ عربیکا",
          price: 160000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-3",
          name: "آیس آمریکانو ۱۰۰٪ عربیکا",
          price: 180000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-4",
          name: "آیس موکا ۵۰٪ عربیکا",
          price: 190000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-5",
          name: "آیس موکا ۱۰۰٪ عربیکا",
          price: 225000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-6",
          name: "آیس کارامل ماکیاتو ۵۰٪ عربیکا",
          price: 195000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-7",
          name: "آیس کارامل ماکیاتو ۱۰۰٪ عربیکا",
          price: 230000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-8",
          name: "آیس لاته ۵۰٪ عربیکا",
          price: 185000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-9",
          name: "آیس لاته ۱۰۰٪ عربیکا",
          price: 215000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-10",
          name: "آفوگاتو ۵۰٪ عربیکا",
          price: 175000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-11",
          name: "آفوگاتو ۱۰۰٪ عربیکا",
          price: 190000,
          detail: "",
          image: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-12",
          name: "لایم تونیک اسپرسو ۵۰٪ عربیکا",
          price: 165000,
          detail: "",
          image: "https://images.pexels.com/photos/37109031/pexels-photo-37109031.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-13",
          name: "لایم تونیک اسپرسو ۱۰۰٪ عربیکا",
          price: 190000,
          detail: "",
          image: "https://images.pexels.com/photos/37109031/pexels-photo-37109031.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-14",
          name: "اورنج کافی ۵۰٪ عربیکا",
          price: 220000,
          detail: "",
          image: "https://images.pexels.com/photos/14930489/pexels-photo-14930489.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-15",
          name: "اورنج کافی ۱۰۰٪ عربیکا",
          price: 260000,
          detail: "",
          image: "https://images.pexels.com/photos/14930489/pexels-photo-14930489.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-16",
          name: "فراپه کارامل ۵۰٪ عربیکا",
          price: 170000,
          detail: "",
          image: "https://images.pexels.com/photos/14930489/pexels-photo-14930489.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-17",
          name: "فراپه کارامل ۱۰۰٪ عربیکا",
          price: 200000,
          detail: "",
          image: "https://images.pexels.com/photos/14930489/pexels-photo-14930489.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-18",
          name: "فراپه شکلات ۵۰٪ عربیکا",
          price: 180000,
          detail: "",
          image: "https://images.pexels.com/photos/14930489/pexels-photo-14930489.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "iced-coffee-19",
          name: "فراپه شکلات ۱۰۰٪ عربیکا",
          price: 210000,
          detail: "",
          image: "https://images.pexels.com/photos/14930489/pexels-photo-14930489.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
    {
      id: "warm-no-coffee",
      title: "نوشیدنی گرم بدون قهوه",
      englishTitle: "WARM & COMFORTING",
      cover: "https://images.pexels.com/photos/35279763/pexels-photo-35279763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "warm-no-coffee-0",
          name: "ماسالا",
          price: 160000,
          detail: "",
          image: "https://images.pexels.com/photos/35279763/pexels-photo-35279763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "warm-no-coffee-1",
          name: "چای کرک زعفران",
          price: 190000,
          detail: "",
          image: "https://images.pexels.com/photos/38279571/pexels-photo-38279571.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "warm-no-coffee-2",
          name: "هات چاکلت فندق",
          price: 195000,
          detail: "",
          image: "https://images.pexels.com/photos/35279763/pexels-photo-35279763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "warm-no-coffee-3",
          name: "هات چاکلت",
          price: 175000,
          detail: "",
          image: "https://images.pexels.com/photos/35279763/pexels-photo-35279763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "warm-no-coffee-4",
          name: "شیر عسلی دارچین",
          price: 150000,
          detail: "",
          image: "https://images.pexels.com/photos/35279763/pexels-photo-35279763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
    {
      id: "shakes",
      title: "شیک‌ها",
      englishTitle: "SHAKES",
      cover: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "shakes-0",
          name: "شیک چاکلت بری",
          price: 260000,
          detail: "",
          image: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "shakes-1",
          name: "شیک نوتلا",
          price: 295000,
          detail: "",
          image: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "shakes-2",
          name: "شیک قهوه",
          price: 215000,
          detail: "",
          image: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "shakes-3",
          name: "شیک بری",
          price: 230000,
          detail: "",
          image: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "shakes-4",
          name: "شیک بیسکویت بادام",
          price: 270000,
          detail: "",
          image: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "shakes-5",
          name: "شیک دبل چاکلت",
          price: 300000,
          detail: "",
          image: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "shakes-6",
          name: "شیک پروتئین",
          price: 350000,
          detail: "",
          image: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
    {
      id: "matcha",
      title: "ماچا بار",
      englishTitle: "MATCHA BAR",
      cover: "https://images.pexels.com/photos/32268846/pexels-photo-32268846.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "matcha-0",
          name: "آیس لاته ماچا",
          price: 185000,
          detail: "",
          image: "https://images.pexels.com/photos/32268846/pexels-photo-32268846.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "matcha-1",
          name: "آیس لاته ماچا بری",
          price: 210000,
          detail: "",
          image: "https://images.pexels.com/photos/32268846/pexels-photo-32268846.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "matcha-2",
          name: "آیس لاته ماچا منگو",
          price: 225000,
          detail: "",
          image: "https://images.pexels.com/photos/32268846/pexels-photo-32268846.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "matcha-3",
          name: "آیس لاته اسپرولینا بری",
          price: 180000,
          detail: "",
          image: "https://images.pexels.com/photos/32268846/pexels-photo-32268846.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
    {
      id: "tea",
      title: "چای و دمنوش",
      englishTitle: "TEA & INFUSIONS",
      cover: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "tea-0",
          name: "چای سیاه",
          price: 120000,
          detail: "",
          image: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "tea-1",
          name: "چای سیاه و زعفران",
          price: 190000,
          detail: "",
          image: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "tea-2",
          name: "چای سبز یاسمن",
          price: 160000,
          detail: "",
          image: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "tea-3",
          name: "ملو",
          price: 190000,
          detail: "جنسینگ، هل، زعفران، گل محمدی، نبات",
          image: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "tea-4",
          name: "وزدا",
          price: 160000,
          detail: "سیب، لیمو، نعنا",
          image: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "tea-5",
          name: "آسود",
          price: 160000,
          detail: "سنبل‌الطیب، هل، زیرفون، گل گاوزبان",
          image: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "tea-6",
          name: "سیترا",
          price: 160000,
          detail: "لیمو، زنجبیل، لمون‌گرس",
          image: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
    {
      id: "brew-coffee",
      title: "قهوه دمی",
      englishTitle: "SLOW BREW",
      cover: "https://images.pexels.com/photos/8937356/pexels-photo-8937356.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "brew-coffee-0",
          name: "کلد برو گازدار نور",
          price: 360000,
          detail: "انار، انگور، نمک",
          image: "https://images.pexels.com/photos/8937356/pexels-photo-8937356.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "brew-coffee-1",
          name: "کلد برو گازدار بلوط",
          price: 360000,
          detail: "کاکائو، دارچین، بلوط",
          image: "https://images.pexels.com/photos/8937356/pexels-photo-8937356.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "brew-coffee-2",
          name: "رگولار ۵۰٪ عربیکا",
          price: 160000,
          detail: "",
          image: "https://images.pexels.com/photos/8937356/pexels-photo-8937356.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
    {
      id: "smoothies",
      title: "اسموتی‌ها",
      englishTitle: "SMOOTHIES",
      cover: "https://images.pexels.com/photos/14930534/pexels-photo-14930534.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "smoothies-0",
          name: "رد منگو",
          price: 290000,
          detail: "توت‌فرنگی، شاه‌توت، انبه",
          image: "https://images.pexels.com/photos/14930534/pexels-photo-14930534.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "smoothies-1",
          name: "بلو اپل",
          price: 290000,
          detail: "سیب، بستنی وانیل، اسپرولینا، شیر",
          image: "https://images.pexels.com/photos/14930534/pexels-photo-14930534.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "smoothies-2",
          name: "استرابری مینت",
          price: 290000,
          detail: "توت‌فرنگی، پرتقال، آناناس، نعنا",
          image: "https://images.pexels.com/photos/14930534/pexels-photo-14930534.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "smoothies-3",
          name: "پیچ بری",
          price: 290000,
          detail: "توت‌فرنگی، هلو، پشن‌فروت، پرتقال",
          image: "https://images.pexels.com/photos/14930534/pexels-photo-14930534.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "smoothies-4",
          name: "اسموتی پروتئین",
          price: 350000,
          detail: "موز، کره بادام‌زمینی، ماسالا، شیر نارگیل",
          image: "https://images.pexels.com/photos/14930534/pexels-photo-14930534.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
    {
      id: "mocktails",
      title: "ماکتیل‌ها",
      englishTitle: "MOCKTAILS",
      cover: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
      visible: true,
      items: [
        {
          id: "mocktails-0",
          name: "لیموناد",
          price: 230000,
          detail: "",
          image: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "mocktails-1",
          name: "موهیتو",
          price: 230000,
          detail: "",
          image: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "mocktails-2",
          name: "موهیتو توت‌فرنگی",
          price: 320000,
          detail: "",
          image: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "mocktails-3",
          name: "کاتالان",
          price: 180000,
          detail: "بلو کوراسائو، آلوورا، سوپرلیمو، سودا",
          image: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "mocktails-4",
          name: "تامارین",
          price: 180000,
          detail: "شاه‌توت، پرتقال، نمک، تمبر هندی، سودا",
          image: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "mocktails-5",
          name: "اسموک چری",
          price: 220000,
          detail: "شاه‌توت، آب انار، آب آلبالو، رزماری، سودا",
          image: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
        {
          id: "mocktails-6",
          name: "بلک سالت",
          price: 190000,
          detail: "آب پرتقال، ریحان، نمک، پشن‌فروت، سودا",
          image: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
          available: true,
        },
      ],
    },
  ],
};

const app = express();
app.set("trust proxy", 1);

process.on("SIGINT", () => {
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDatabase();
  process.exit(0);
});

const parseCookies = (header = "") => {
  const entries = {};
  for (const chunk of header.split(";")) {
    const [rawKey, ...rawValue] = chunk.split("=");
    if (!rawKey) continue;
    const key = decodeURIComponent(rawKey.trim());
    const value = decodeURIComponent(rawValue.join("=").trim());
    if (key) entries[key] = value;
  }
  return entries;
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getAdminTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || null;
};

const getAdminSessionFromToken = (token) => {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      "SELECT username, expires_at FROM admin_sessions WHERE token_hash = ?",
    )
    .get(tokenHash);
  if (!row) return null;
  if (Number(row.expires_at) <= Date.now()) {
    db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(
      tokenHash,
    );
    return null;
  }
  return { username: row.username, expiresAt: Number(row.expires_at) };
};

const getRequestAdminSession = (req) =>
  getAdminSessionFromToken(getAdminTokenFromRequest(req));

const requireAdmin = (req, res, next) => {
  const session = getRequestAdminSession(req);
  if (!session) {
    return res
      .status(401)
      .json({ ok: false, message: "Authentication required." });
  }
  req.admin = session;
  return next();
};

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "12mb" }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));
app.use("/uploads", express.static(uploadsDir));

const hasCorruptedUtf8Text = (value) => {
  if (typeof value !== "string") return false;
  return /(?:\?{3,})|(?:�)/.test(value);
};

const containsCorruptedUtf8 = (value) => {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") {
    return hasCorruptedUtf8Text(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsCorruptedUtf8(item));
  }

  if (typeof value === "object") {
    return Object.values(value).some((item) => containsCorruptedUtf8(item));
  }

  return false;
};

const ensureDefaultMenu = () => {
  const row = db.prepare("SELECT data FROM menu WHERE key = ?").get("menu");
  if (!row) {
    writeJson("menu", defaultMenuDocument);
    return defaultMenuDocument;
  }

  try {
    const parsed = JSON.parse(row.data);
    if (containsCorruptedUtf8(parsed)) {
      writeJson("menu", defaultMenuDocument);
      return defaultMenuDocument;
    }
    return parsed;
  } catch {
    writeJson("menu", defaultMenuDocument);
    return defaultMenuDocument;
  }
};

const readJson = (key, fallbackValue = null) => {
  const row = db.prepare("SELECT data FROM menu WHERE key = ?").get(key);
  if (!row) return fallbackValue;
  try {
    const parsed = JSON.parse(row.data);
    if (containsCorruptedUtf8(parsed)) {
      return fallbackValue;
    }
    return parsed;
  } catch {
    return fallbackValue;
  }
};

const writeJson = (key, value) => {
  const json = JSON.stringify(value);
  const existing = db.prepare("SELECT 1 FROM menu WHERE key = ?").get(key);
  if (existing) {
    db.prepare(
      "UPDATE menu SET data = ?, updated_at = strftime('%s', 'now') WHERE key = ?",
    ).run(json, key);
  } else {
    db.prepare("INSERT INTO menu (key, data) VALUES (?, ?)").run(key, json);
  }
};

const readSetting = (key, fallbackValue = null) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (!row) return fallbackValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallbackValue;
  }
};

const writeSetting = (key, value) => {
  const serialized = JSON.stringify(value);
  const existing = db
    .prepare("SELECT 1 FROM settings WHERE key = ?")
    .get(key);
  if (existing) {
    db.prepare(
      "UPDATE settings SET value = ?, updated_at = strftime('%s', 'now') WHERE key = ?",
    ).run(serialized, key);
  } else {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
      key,
      serialized,
    );
  }
};

app.get("/api/health", (_, res) => {
  res.json({ ok: true, status: "healthy", timestamp: Date.now() });
});

app.post("/api/admin/login", (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!username || !password) {
    return res
      .status(400)
      .json({ ok: false, message: "Username and password required." });
  }

  const row = db
    .prepare("SELECT password_hash FROM admin_users WHERE username = ?")
    .get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res
      .status(401)
      .json({ ok: false, message: "Invalid credentials." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  db.prepare(
    "INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES (?, ?, ?)",
  ).run(hashToken(token), username, expiresAt);

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SESSION_COOKIE_SECURE,
    maxAge: ADMIN_SESSION_TTL_MS,
    path: "/",
  });

  return res.json({ ok: true, user: { username }, expiresAt });
});

app.post("/api/admin/logout", (req, res) => {
  const token = getAdminTokenFromRequest(req);
  if (token) {
    db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(
      hashToken(token),
    );
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  return res.json({ ok: true });
});

app.get("/api/admin/session", (req, res) => {
  const session = getRequestAdminSession(req);
  if (!session) {
    return res.json({ ok: true, authenticated: false });
  }
  return res.json({
    ok: true,
    authenticated: true,
    user: { username: session.username },
    expiresAt: session.expiresAt,
  });
});

app.post("/api/upload", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ ok: false, message: "Image file is required." });
  }

  const url = `/uploads/${encodeURIComponent(req.file.filename)}`;
  return res.json({ ok: true, url });
});

app.get("/api/menu", (_, res) => {
  res.json({ ok: true, data: ensureDefaultMenu() });
});

app.put("/api/menu", requireAdmin, (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res
      .status(400)
      .json({
        ok: false,
        message: "Menu payload must be a JSON object.",
      });
  }

  writeJson("menu", req.body);
  return res.json({ ok: true, data: req.body });
});

app.get("/api/settings", requireAdmin, (_, res) => {
  res.json({
    ok: true,
    data: readSetting("site-settings", { theme: {}, locale: "fa-IR" }),
  });
});

app.put("/api/settings", requireAdmin, (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res
      .status(400)
      .json({
        ok: false,
        message: "Settings payload must be a JSON object.",
      });
  }

  writeSetting("site-settings", req.body);
  return res.json({ ok: true, data: req.body });
});

// Return admin list of categories with optional stored QR logo override
app.get("/api/admin/categories", requireAdmin, (req, res) => {
  const menu = ensureDefaultMenu();
  const categories = (menu.categories || []).map((c) => {
    const qrLogo = readSetting(`qr-logo:${c.id}`, null) || null;
    return {
      id: c.id,
      title: c.title,
      visible: !!c.visible,
      cover: c.cover,
      qrLogo,
    };
  });
  return res.json({ ok: true, data: categories });
});

// Set or clear a QR logo override for a category
app.put("/api/admin/category/:categoryId/qr-logo", requireAdmin, (req, res) => {
  const categoryId = String(req.params.categoryId || "").trim();
  if (!categoryId)
    return res
      .status(400)
      .json({ ok: false, message: "categoryId required" });
  const logoUrl = req.body?.logoUrl ?? null;
  if (logoUrl && typeof logoUrl !== "string")
    return res
      .status(400)
      .json({ ok: false, message: "logoUrl must be a string or null" });
  if (logoUrl) writeSetting(`qr-logo:${categoryId}`, logoUrl);
  else writeSetting(`qr-logo:${categoryId}`, null);
  return res.json({ ok: true, categoryId, logoUrl });
});

const getFirstQueryValue = (value) => {
  if (Array.isArray(value)) return value[0] ?? "";
  return String(value ?? "");
};

function resolveBusinessQrLogo(menu) {
  const businessLogo = menu?.business?.logo;
  return typeof businessLogo === "string" && businessLogo.trim() ? businessLogo.trim() : null;
}

async function generateQrImageResponse({
  data,
  res,
  size = 300,
  file = "png",
  logoUrl = null,
}) {
  if (!data || typeof data !== "string") {
    return res.status(400).json({
      ok: false,
      message: "`data` (URL or text) is required and must be a string.",
    });
  }

  const width = Number(size) || 300;

  try {
    const svgString = await QRCodeLib.toString(String(data), {
      type: "svg",
      width,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    let finalSvg = svgString;

    if (logoUrl && typeof logoUrl === "string") {
      const resolveLocalUpload = (u) => {
        try {
          const parts = u.split("/").filter(Boolean);
          const filename = parts[parts.length - 1];
          const filePath = path.join(uploadsDir, filename);
          if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
        } catch (e) {
          // ignore
        }
        return null;
      };

      const mimeFromExt = (name) => {
        const ext = (path.extname(name || "") || "").toLowerCase();
        if (ext === ".png") return "image/png";
        if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
        if (ext === ".webp") return "image/webp";
        if (ext === ".svg") return "image/svg+xml";
        if (ext === ".ico") return "image/x-icon";
        return "application/octet-stream";
      };

      let logoBuffer = null;
      let logoMime = null;

      try {
        const lower = logoUrl.toLowerCase();
        if (lower.startsWith("/uploads/")) {
          const buf = resolveLocalUpload(logoUrl);
          if (buf) {
            logoBuffer = buf;
            logoMime = mimeFromExt(logoUrl);
          }
        } else if (lower === "/favicon.ico" || lower === "/favicon.png") {
          const uploadFav = path.join(uploadsDir, "favicon.ico");
          if (fs.existsSync(uploadFav)) {
            logoBuffer = fs.readFileSync(uploadFav);
            logoMime = "image/x-icon";
          } else {
            const candidates = [
              path.join(__dirname, "favicon.ico"),
              path.join(__dirname, "..", "dist", "favicon.ico"),
              path.join(__dirname, "..", "public", "favicon.ico"),
            ];
            for (const c of candidates) {
              if (fs.existsSync(c)) {
                logoBuffer = fs.readFileSync(c);
                logoMime = mimeFromExt(c);
                break;
              }
            }
          }
        } else if (/^https?:\/\//.test(logoUrl)) {
          const response = await fetch(logoUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            logoBuffer = Buffer.from(arrayBuffer);
            logoMime =
              response.headers.get("content-type") ||
              mimeFromExt(logoUrl);
          }
        } else if (logoUrl.startsWith("/")) {
          const candidate = path.join(__dirname, logoUrl.replace(/^\//, ""));
          if (fs.existsSync(candidate)) {
            logoBuffer = fs.readFileSync(candidate);
            logoMime = mimeFromExt(candidate);
          } else {
            const tryUpload = resolveLocalUpload(logoUrl);
            if (tryUpload) {
              logoBuffer = tryUpload;
              logoMime = mimeFromExt(logoUrl);
            }
          }
        }
      } catch (e) {
        console.error("Failed to resolve logoUrl:", e);
      }

      let imageHref = null;
      if (logoBuffer && logoMime) {
        imageHref = `data:${logoMime};base64,${logoBuffer.toString("base64")}`;
      } else if (/^https?:\/\//.test(logoUrl) || logoUrl.startsWith("data:")) {
        imageHref = logoUrl;
      }

      if (imageHref) {
        const logoSize = Math.floor(width * 0.2);
        const x = Math.floor((width - logoSize) / 2);
        const y = Math.floor((width - logoSize) / 2);
        const logoElements = `\n  <rect x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" fill="#ffffff" rx="${Math.floor(logoSize * 0.15)}" />\n  <image href="${imageHref}" x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid slice" />\n`;

        finalSvg = svgString.replace(
          /<\/svg>\s*$/i,
          `${logoElements}</svg>`,
        );
      }
    }

    if (String(file).toLowerCase() === "svg") {
      res.setHeader("Content-Type", "image/svg+xml");
      return res.send(finalSvg);
    }

    const pngBuffer = await sharp(Buffer.from(finalSvg)).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", pngBuffer.length);
    return res.send(pngBuffer);
  } catch (err) {
    console.error("Error generating QR code:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error while generating QR code.",
    });
  }
}

// Generate QR for a category automatically. Uses stored qr-logo:{id} if exists, otherwise business.logo, otherwise /favicon.ico
app.get(
  "/api/admin/qrcode/category/:categoryId",
  requireAdmin,
  async (req, res) => {
    const categoryId = String(req.params.categoryId || "").trim();
    if (!categoryId)
      return res
        .status(400)
        .json({ ok: false, message: "categoryId required" });

    const frontendEnv = String(process.env.FRONTEND_URL || "").trim();
    const originHeader = String(req.get("origin") || "").trim();
    const hostUrl = `${req.protocol}://${req.get("host")}`;
    const base = frontendEnv || originHeader || hostUrl;
    const hashPath = `#/category/${encodeURIComponent(categoryId)}`;
    const targetUrl = `${base.replace(/\/$/, "")}/${hashPath}`;

    const logoOverride = readSetting(`qr-logo:${categoryId}`, null);
    const menu = ensureDefaultMenu();
    const businessLogo = resolveBusinessQrLogo(menu);
    const logoUrl = logoOverride || businessLogo || null;

    return generateQrImageResponse({
      data: String(targetUrl),
      res,
      size: Number(req.query.size || 300),
      file: String(req.query.file || "png"),
      logoUrl,
    });
  },
);

app.post("/api/admin/qrcode/category/:categoryId", requireAdmin, async (req, res) => {
  const categoryId = String(req.params.categoryId || "").trim();
  if (!categoryId)
    return res.status(400).json({ ok: false, message: "categoryId required" });

  const frontendEnv = String(process.env.FRONTEND_URL || "").trim();
  const originHeader = String(req.get("origin") || "").trim();
  const hostUrl = `${req.protocol}://${req.get("host")}`;
  const base = frontendEnv || originHeader || hostUrl;
  const hashPath = `#/category/${encodeURIComponent(categoryId)}`;
  const targetUrl = `${base.replace(/\/$/, "")}/${hashPath}`;

  const logoOverride = readSetting(`qr-logo:${categoryId}`, null);
  const menu = ensureDefaultMenu();
  const businessLogo = resolveBusinessQrLogo(menu);
  const logoUrl = req.body?.logoUrl || logoOverride || businessLogo || null;

  return generateQrImageResponse({
    data: String(targetUrl),
    res,
    size: req.body?.size ?? 300,
    file: req.body?.file ?? "png",
    logoUrl,
  });
});

// Admin-only endpoint to generate a QR code image for arbitrary data (menu URL, text, etc.)
// GET is supported because browser/client code often opens QR endpoints directly without a JSON body.
app.get("/api/admin/qrcode", requireAdmin, async (req, res) => {
  const rawData = getFirstQueryValue(req.query.data ?? req.query.url ?? req.query.text);
  const value = rawData || "";
  const logoUrl = getFirstQueryValue(req.query.logoUrl ?? req.query.logo ?? "") || null;

  if (!logoUrl) {
    const menu = ensureDefaultMenu();
    const businessLogo = resolveBusinessQrLogo(menu);
    return generateQrImageResponse({
      data: value,
      res,
      size: Number(getFirstQueryValue(req.query.size || "300")) || 300,
      file: String(getFirstQueryValue(req.query.file || "png") || "png"),
      logoUrl: businessLogo,
    });
  }

  return generateQrImageResponse({
    data: value,
    res,
    size: Number(getFirstQueryValue(req.query.size || "300")) || 300,
    file: String(getFirstQueryValue(req.query.file || "png") || "png"),
    logoUrl,
  });
});

app.post("/api/admin/qrcode", requireAdmin, async (req, res) => {
  const { data, size = 300, file = "png", logoUrl } = req.body || {};
  const resolvedLogoUrl =
    typeof logoUrl === "string" && logoUrl.trim()
      ? logoUrl.trim()
      : (() => {
          const fallback = resolveBusinessQrLogo(ensureDefaultMenu());
          return fallback || null;
        })();

  return generateQrImageResponse({
    data,
    res,
    size,
    file,
    logoUrl: resolvedLogoUrl,
  });
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled API error:", error);
  res.status(500).json({ ok: false, message: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Stage cafe backend running on http://localhost:${PORT}`);
});
