export type MenuItem = {
  id: string;
  name: string;
  price: number;
  detail?: string;
  image: string;
  available: boolean;
};

export type Category = {
  id: string;
  title: string;
  englishTitle: string;
  cover: string;
  visible: boolean;
  items: MenuItem[];
};

export type SeedCategory = Omit<Category, "visible" | "items"> & {
  itemPhotos: string[];
  items: { name: string; price: number; detail?: string }[];
};

export type BusinessInfo = {
  name: string;
  englishName: string;
  description: string;
  address: string;
  heroImage: string;
  logo: string;
  instagramUrl: string;
  tagline: string;
};

export type ThemeSettings = {
  primary: string;
  primaryStrong: string;
  accent: string;
  accentSoft: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSoft: string;
};

export type MenuData = {
  version: 1;
  categories: Category[];
  business: BusinessInfo;
  theme: ThemeSettings;
};

export const DEFAULT_THEME: ThemeSettings = {
  primary: "#d7a36a",
  primaryStrong: "#b97742",
  accent: "#d7a36a",
  accentSoft: "#f2e4d6",
  background: "#111311",
  surface: "#f7f4ee",
  surfaceAlt: "#ede4d6",
  text: "#1b150f",
  textSoft: "#5f5142",
};

export const MENU_STORAGE_KEY = "stage.menu.v1";

export function newId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export function faNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export function priceLabel(value: number) {
  return `${faNumber(value)} تومان`;
}

export function parsePrice(value: string) {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[,٬\s]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isSafeInteger(price) && price >= 0 ? price : null;
}

export function isImageUrl(value: string) {
  return value === "" || /^https?:\/\/\S+$/i.test(value) || /^\/(?!\/)\S+/.test(value) || /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value);
}

export function cloneMenuData(data: MenuData): MenuData {
  return JSON.parse(JSON.stringify(data));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

export function validateMenuData(value: unknown): MenuData {
  const invalid = () => { throw new Error("فایل منو معتبر نیست؛ لطفاً از فایل خروجی همین پنل استفاده کنید."); };
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.business) || !Array.isArray(value.categories) || value.categories.length === 0) return invalid();
  const business = value.business;
  const businessKeys = ["name", "englishName", "description", "address", "heroImage", "instagramUrl", "tagline"];
  if (!businessKeys.every((key) => isText(business[key])) || !(business.name as string).trim() || !isImageUrl(business.heroImage as string)) return invalid();
  if (business.instagramUrl && !/^https?:\/\/\S+$/i.test(business.instagramUrl as string)) return invalid();
  if (business.logo !== undefined && (!isText(business.logo) || !isImageUrl(business.logo))) return invalid();

  const theme = isRecord(value.theme) ? value.theme : {};
  const themeKeys = ["primary", "primaryStrong", "accent", "accentSoft", "background", "surface", "surfaceAlt", "text", "textSoft"] as const;
  if (!themeKeys.every((key) => isText(theme[key]) && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(theme[key] as string))) {
    (value as Record<string, unknown>).theme = { ...DEFAULT_THEME };
  }

  const categoryIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const category of value.categories) {
    if (!isRecord(category) || !isText(category.id) || !category.id || categoryIds.has(category.id) || !isText(category.title) || !category.title.trim() || !isText(category.englishTitle) || !isText(category.cover) || !isImageUrl(category.cover) || typeof category.visible !== "boolean" || !Array.isArray(category.items)) return invalid();
    categoryIds.add(category.id);
    for (const item of category.items) {
      if (!isRecord(item) || !isText(item.id) || !item.id || itemIds.has(item.id) || !isText(item.name) || !item.name.trim() || typeof item.price !== "number" || !Number.isSafeInteger(item.price) || item.price < 0 || !isText(item.image) || !isImageUrl(item.image) || typeof item.available !== "boolean" || (item.detail !== undefined && !isText(item.detail))) return invalid();
      itemIds.add(item.id);
    }
  }
  const normalized = cloneMenuData(value as unknown as MenuData);
  if (normalized.business.logo === undefined) normalized.business.logo = "";
  normalized.theme = { ...DEFAULT_THEME, ...(isRecord(normalized.theme) ? normalized.theme : {}) } as ThemeSettings;
  return normalized;
}

export function loadMenuData(defaultData: MenuData) {
  try {
    const stored = localStorage.getItem(MENU_STORAGE_KEY);
    return stored ? validateMenuData(JSON.parse(stored)) : cloneMenuData(defaultData);
  } catch {
    return cloneMenuData(defaultData);
  }
}