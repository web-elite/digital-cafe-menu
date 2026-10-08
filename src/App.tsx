import { useEffect, useMemo, useState, type CSSProperties } from "react";
import AdminLogin from "./components/AdminLogin";
import CategoryRibbon from "./components/CategoryRibbon";
import Icon from "./components/Icon";
import MenuAdmin from "./components/MenuAdmin";
import type { AdminSession } from "./lib/adminAuth";
import { authenticateAdmin, clearAdminSession, hydrateAdminSession, isAdminSessionValid, readAdminSession } from "./lib/adminAuth";
import type { MenuData, SeedCategory } from "./lib/menuData";
import { DEFAULT_THEME, faNumber, loadMenuData, MENU_STORAGE_KEY, priceLabel, validateMenuData } from "./lib/menuData";
import { getAbsoluteUrl, isAdminQrRoute, parseCurrentRoute, routeLinks } from "./lib/router";

const resolveApiBaseUrl = () => {
  const configured = (import.meta.env.VITE_API_URL ?? "").trim();
  if (configured) return configured.replace(/\/$/, "");
  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname)
  ) {
    return "http://localhost:4000";
  }
  return "";
};

const API_BASE_URL = resolveApiBaseUrl();
const apiUrl = (path: string) => `${API_BASE_URL || ""}${path}`;

const photo = {
  hero: "https://images.pexels.com/photos/32416005/pexels-photo-32416005.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1800&w=1200",
  espresso: "https://images.pexels.com/photos/36671892/pexels-photo-36671892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  latte: "https://images.pexels.com/photos/32228894/pexels-photo-32228894.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  coffeeBeans: "https://images.pexels.com/photos/8937356/pexels-photo-8937356.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  coffeeTable: "https://images.pexels.com/photos/34579317/pexels-photo-34579317.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  matcha: "https://images.pexels.com/photos/32268846/pexels-photo-32268846.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  icedMatcha: "https://images.pexels.com/photos/32268861/pexels-photo-32268861.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  matchaGlasses: "https://images.pexels.com/photos/33371820/pexels-photo-33371820.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  herbalTea: "https://images.pexels.com/photos/34704515/pexels-photo-34704515.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  teapot: "https://images.pexels.com/photos/38279571/pexels-photo-38279571.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  hotDrink: "https://images.pexels.com/photos/35279763/pexels-photo-35279763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  smoothie: "https://images.pexels.com/photos/14930480/pexels-photo-14930480.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  smoothieSet: "https://images.pexels.com/photos/14930534/pexels-photo-14930534.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  shake: "https://images.pexels.com/photos/16096610/pexels-photo-16096610.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  mojito: "https://images.pexels.com/photos/11009211/pexels-photo-11009211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  limeDrink: "https://images.pexels.com/photos/37109031/pexels-photo-37109031.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
  citrus: "https://images.pexels.com/photos/14930489/pexels-photo-14930489.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200",
};

const categorySeeds: SeedCategory[] = [
  {
    id: "hot-coffee",
    title: "نوشیدنی‌های گرم بر پایه قهوه",
    englishTitle: "HOT COFFEE",
    cover: photo.espresso,
    itemPhotos: [photo.espresso, photo.latte, photo.coffeeBeans, photo.coffeeTable],
    items: [
      { name: "اسپرسو ۵۰٪ عربیکا", price: 150 },
      { name: "اسپرسو ۱۰۰٪ عربیکا", price: 170 },
      { name: "آمریکانو ۵۰٪ عربیکا", price: 160 },
      { name: "آمریکانو ۱۰۰٪ عربیکا", price: 180 },
      { name: "کورتادو ۵۰٪ عربیکا", price: 170 },
      { name: "کورتادو ۱۰۰٪ عربیکا", price: 190 },
      { name: "کاپوچینو ۵۰٪ عربیکا", price: 175 },
      { name: "کاپوچینو ۱۰۰٪ عربیکا", price: 195 },
      { name: "موکا اورجینال ۵۰٪ عربیکا", price: 195 },
      { name: "موکا اورجینال ۱۰۰٪ عربیکا", price: 225 },
      { name: "کارامل ماکیاتو ۵۰٪ عربیکا", price: 190 },
      { name: "کارامل ماکیاتو ۱۰۰٪ عربیکا", price: 215 },
      { name: "لاته ۵۰٪ عربیکا", price: 185 },
      { name: "لاته ۱۰۰٪ عربیکا", price: 210 },
      { name: "موکا کرم ۵۰٪ عربیکا", price: 270 },
      { name: "موکا کرم ۱۰۰٪ عربیکا", price: 300 },
    ],
  },
  {
    id: "iced-coffee",
    title: "نوشیدنی‌های سرد بر پایه قهوه",
    englishTitle: "ICED COFFEE",
    cover: photo.icedMatcha,
    itemPhotos: [photo.icedMatcha, photo.matcha, photo.citrus, photo.limeDrink],
    items: [
      { name: "آیس اسپرسو ۵۰٪ عربیکا", price: 150 },
      { name: "آیس اسپرسو ۱۰۰٪ عربیکا", price: 170 },
      { name: "آیس آمریکانو ۵۰٪ عربیکا", price: 160 },
      { name: "آیس آمریکانو ۱۰۰٪ عربیکا", price: 180 },
      { name: "آیس موکا ۵۰٪ عربیکا", price: 190 },
      { name: "آیس موکا ۱۰۰٪ عربیکا", price: 225 },
      { name: "آیس کارامل ماکیاتو ۵۰٪ عربیکا", price: 195 },
      { name: "آیس کارامل ماکیاتو ۱۰۰٪ عربیکا", price: 230 },
      { name: "آیس لاته ۵۰٪ عربیکا", price: 185 },
      { name: "آیس لاته ۱۰۰٪ عربیکا", price: 215 },
      { name: "آفوگاتو ۵۰٪ عربیکا", price: 175 },
      { name: "آفوگاتو ۱۰۰٪ عربیکا", price: 190 },
      { name: "لایم تونیک اسپرسو ۵۰٪ عربیکا", price: 165 },
      { name: "لایم تونیک اسپرسو ۱۰۰٪ عربیکا", price: 190 },
      { name: "اورنج کافی ۵۰٪ عربیکا", price: 220 },
      { name: "اورنج کافی ۱۰۰٪ عربیکا", price: 260 },
      { name: "فراپه کارامل ۵۰٪ عربیکا", price: 170 },
      { name: "فراپه کارامل ۱۰۰٪ عربیکا", price: 200 },
      { name: "فراپه شکلات ۵۰٪ عربیکا", price: 180 },
      { name: "فراپه شکلات ۱۰۰٪ عربیکا", price: 210 },
    ],
  },
  {
    id: "warm-no-coffee",
    title: "نوشیدنی گرم بدون قهوه",
    englishTitle: "WARM & COMFORTING",
    cover: photo.hotDrink,
    itemPhotos: [photo.hotDrink, photo.herbalTea, photo.teapot],
    items: [
      { name: "ماسالا", price: 160 },
      { name: "چای کرک زعفران", price: 190 },
      { name: "هات چاکلت فندق", price: 195 },
      { name: "هات چاکلت", price: 175 },
      { name: "شیر عسلی دارچین", price: 150 },
    ],
  },
  {
    id: "shakes",
    title: "شیک‌ها",
    englishTitle: "SHAKES",
    cover: photo.shake,
    itemPhotos: [photo.shake, photo.smoothie, photo.smoothieSet],
    items: [
      { name: "شیک چاکلت بری", price: 260 },
      { name: "شیک نوتلا", price: 295 },
      { name: "شیک قهوه", price: 215 },
      { name: "شیک بری", price: 230 },
      { name: "شیک بیسکویت بادام", price: 270 },
      { name: "شیک دبل چاکلت", price: 300 },
      { name: "شیک پروتئین", price: 350 },
    ],
  },
  {
    id: "matcha",
    title: "ماچا بار",
    englishTitle: "MATCHA BAR",
    cover: photo.matcha,
    itemPhotos: [photo.matcha, photo.icedMatcha, photo.matchaGlasses],
    items: [
      { name: "آیس لاته ماچا", price: 185 },
      { name: "آیس لاته ماچا بری", price: 210 },
      { name: "آیس لاته ماچا منگو", price: 225 },
      { name: "آیس لاته اسپرولینا بری", price: 180 },
    ],
  },
  {
    id: "tea",
    title: "چای و دمنوش",
    englishTitle: "TEA & INFUSIONS",
    cover: photo.herbalTea,
    itemPhotos: [photo.herbalTea, photo.teapot, photo.hotDrink],
    items: [
      { name: "چای سیاه", price: 120 },
      { name: "چای سیاه و زعفران", price: 190 },
      { name: "چای سبز یاسمن", price: 160 },
      { name: "ملو", detail: "جنسینگ، هل، زعفران، گل محمدی، نبات", price: 190 },
      { name: "وزدا", detail: "سیب، لیمو، نعنا", price: 160 },
      { name: "آسود", detail: "سنبل‌الطیب، هل، زیرفون، گل گاوزبان", price: 160 },
      { name: "سیترا", detail: "لیمو، زنجبیل، لمون‌گرس", price: 160 },
    ],
  },
  {
    id: "brew-coffee",
    title: "قهوه دمی",
    englishTitle: "SLOW BREW",
    cover: photo.coffeeBeans,
    itemPhotos: [photo.coffeeBeans, photo.coffeeTable, photo.espresso],
    items: [
      { name: "کلد برو گازدار نور", detail: "انار، انگور، نمک", price: 360 },
      { name: "کلد برو گازدار بلوط", detail: "کاکائو، دارچین، بلوط", price: 360 },
      { name: "رگولار ۵۰٪ عربیکا", price: 160 },
    ],
  },
  {
    id: "smoothies",
    title: "اسموتی‌ها",
    englishTitle: "SMOOTHIES",
    cover: photo.smoothieSet,
    itemPhotos: [photo.smoothie, photo.smoothieSet, photo.citrus],
    items: [
      { name: "رد منگو", detail: "توت‌فرنگی، شاه‌توت، انبه", price: 290 },
      { name: "بلو اپل", detail: "سیب، بستنی وانیل، اسپرولینا، شیر", price: 290 },
      { name: "استرابری مینت", detail: "توت‌فرنگی، پرتقال، آناناس، نعنا", price: 290 },
      { name: "پیچ بری", detail: "توت‌فرنگی، هلو، پشن‌فروت، پرتقال", price: 290 },
      { name: "اسموتی پروتئین", detail: "موز، کره بادام‌زمینی، ماسالا، شیر نارگیل", price: 350 },
    ],
  },
  {
    id: "mocktails",
    title: "ماکتیل‌ها",
    englishTitle: "MOCKTAILS",
    cover: photo.mojito,
    itemPhotos: [photo.mojito, photo.limeDrink, photo.citrus],
    items: [
      { name: "لیموناد", price: 230 },
      { name: "موهیتو", price: 230 },
      { name: "موهیتو توت‌فرنگی", price: 320 },
      { name: "کاتالان", detail: "بلو کوراسائو، آلوورا، سوپرلیمو، سودا", price: 180 },
      { name: "تامارین", detail: "شاه‌توت، پرتقال، نمک، تمبر هندی، سودا", price: 180 },
      { name: "اسموک چری", detail: "شاه‌توت، آب انار، آب آلبالو، رزماری، سودا", price: 220 },
      { name: "بلک سالت", detail: "آب پرتقال، ریحان، نمک، پشن‌فروت، سودا", price: 190 },
    ],
  },
];

const defaultMenuData: MenuData = {
  version: 1,
  business: {
    name: "صحنه",
    englishName: "STAGE",
    description: "صحنه (Stage) بازتابی از سبک زندگی مدرن و پرشتاب شهری است؛ یک کافه بیرون‌بر با هویتی مینیمال و بی‌تکلف که پیچیدگی‌های اضافه را حذف کرده تا بر ارائه بی‌نقص‌ترین فنجان قهوه تمرکز کند. سرعت و چابکی در کنار استانداردهای قهوه تخصصی تا تجربه‌ای گرم و مشتری‌محور بسازد.",
    address: "بلوار الهیه، بین الهیه ۹ و ۱۱",
    heroImage: photo.hero,
    logo: "",
    instagramUrl: "https://instagram.com",
    tagline: "یک فنجان، بی‌هیاهو.",
  },
  theme: DEFAULT_THEME,
  categories: categorySeeds.map(({ itemPhotos, items, ...category }) => ({
    ...category,
    visible: true,
    items: items.map((item, index) => ({ ...item, id: `${category.id}-${index}`, price: item.price * 1000, image: itemPhotos[index % itemPhotos.length] || category.cover, available: true })),
  })),
};

type Screen = "profile" | "menu" | "admin";

function StageLogo({ small = false, src = "" }: { small?: boolean; src?: string }) {
  return (
    <span className={`stage-logo${small ? " stage-logo-small" : ""}`} aria-hidden="true">
      {src ? (
        <img className="stage-logo-image" src={src} alt="" />
      ) : (
        <svg viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="30.5" />
          <path d="M43 19H27a8 8 0 0 0 0 16h10a8 8 0 0 1 0 16H20" />
          <path d="M30 7c-3 3-3 5 0 8m8-8c-3 3-3 5 0 8" />
          <path d="M16 57h32" />
        </svg>
      )}
    </span>
  );
}

export default function App() {
  const [menuData, setMenuData] = useState(() => loadMenuData(defaultMenuData));
  const [adminSession, setAdminSession] = useState<AdminSession | null>(readAdminSession);
  const initialRoute = useMemo(() => parseCurrentRoute(window.location.hash, window.location.pathname), []);
  const [screen, setScreen] = useState<Screen>(initialRoute.screen);
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    if (initialRoute.screen === "menu" && initialRoute.categoryId) {
      return initialRoute.categoryId;
    }
    return menuData.categories[0]?.id || "hot-coffee";
  });
  const [menuSheetOpen, setMenuSheetOpen] = useState(() => initialRoute.screen === "profile" && initialRoute.openSheet);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [toast, setToast] = useState("");

  const business = menuData.business;
  const themeStyle = useMemo(() => ({
    "--brand-primary": menuData.theme.primary,
    "--brand-primary-strong": menuData.theme.primaryStrong,
    "--brand-accent": menuData.theme.accent,
    "--brand-accent-soft": menuData.theme.accentSoft,
    "--brand-background": menuData.theme.background,
    "--brand-surface": menuData.theme.surface,
    "--brand-surface-alt": menuData.theme.surfaceAlt,
    "--brand-text": menuData.theme.text,
    "--brand-text-soft": menuData.theme.textSoft,
  }) as CSSProperties, [menuData.theme]);
  const mapUrl = "https://neshan.org/maps/search/" + encodeURIComponent(business.address);
  const visibleCategories = useMemo(() => menuData.categories.filter((category) => category.visible), [menuData]);
  const selectedCategory = visibleCategories.find((category) => category.id === selectedCategoryId) ?? visibleCategories[0];
  const catalog = useMemo(() => menuData.categories.flatMap((category) => category.items.map((item) => ({ ...item, categoryId: category.id, categoryTitle: category.title, categoryVisible: category.visible }))), [menuData]);
  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return [];
    const term = query.trim().toLocaleLowerCase();
    return selectedCategory.items
      .map((item) => ({ ...item, photo: item.image || selectedCategory.cover || photo.latte }))
      .filter((item) => !term || `${item.name} ${item.detail ?? ""}`.toLocaleLowerCase().includes(term));
  }, [query, selectedCategory]);

  const cartItems = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ item: catalogById.get(id)!, quantity }))
    .filter(({ item }) => Boolean(item?.available && item?.categoryVisible));
  const cartCount = cartItems.reduce((sum, entry) => sum + entry.quantity, 0);
  const cartTotal = cartItems.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);
  const overlayOpen = menuSheetOpen || drawerOpen || cartOpen;
  const hasAdminAccess = isAdminSessionValid(adminSession);

  const syncRoute = () => {
    const route = parseCurrentRoute(window.location.hash, window.location.pathname);
    if (route.screen === "admin") {
      setScreen("admin");
      setMenuSheetOpen(false);
      setDrawerOpen(false);
      setCartOpen(false);
    } else if (route.screen === "menu") {
      setScreen("menu");
      if (route.categoryId) {
        setSelectedCategoryId(route.categoryId);
      }
      setMenuSheetOpen(false);
      setDrawerOpen(false);
      setCartOpen(false);
    } else {
      setScreen("profile");
      setMenuSheetOpen(route.openSheet);
      setDrawerOpen(false);
      setCartOpen(false);
    }
  };

  const navigateTo = (hashUrl: string) => {
    if (window.location.hash !== hashUrl) {
      window.location.hash = hashUrl;
    } else {
      syncRoute();
    }
  };

  useEffect(() => {
    const onHashOrPop = () => syncRoute();
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== MENU_STORAGE_KEY || !event.newValue) return;
      try { setMenuData(validateMenuData(JSON.parse(event.newValue))); } catch { /* Keep the current menu if another tab stores invalid data. */ }
    };
    window.addEventListener("hashchange", onHashOrPop);
    window.addEventListener("popstate", onHashOrPop);
    window.addEventListener("storage", syncStorage);
    fetch(apiUrl("/api/menu"), { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload || !payload.data) return;
        try { setMenuData(validateMenuData(payload.data)); } catch { /* Ignore invalid backend data, keep the current local menu. */ }
      })
      .catch(() => undefined);

    hydrateAdminSession().then((session) => {
      if (session) {
        setAdminSession(session);
        return;
      }
      const storedSession = readAdminSession();
      if (storedSession && isAdminSessionValid(storedSession)) {
        setAdminSession(storedSession);
        return;
      }
      setAdminSession(null);
    }).catch(() => {
      const storedSession = readAdminSession();
      if (storedSession && isAdminSessionValid(storedSession)) {
        setAdminSession(storedSession);
      } else {
        setAdminSession(null);
      }
    });
    return () => {
      window.removeEventListener("hashchange", onHashOrPop);
      window.removeEventListener("popstate", onHashOrPop);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  useEffect(() => {
    if (!adminSession) return;
    const checkSession = () => {
      if (isAdminSessionValid(adminSession)) return;
      clearAdminSession();
      setAdminSession(null);
      if (screen === "admin") setToast("نشست مدیریت پایان یافت؛ دوباره وارد شوید.");
    };
    const timer = window.setTimeout(checkSession, Math.max(0, adminSession.expiresAt - Date.now()));
    window.addEventListener("focus", checkSession);
    window.addEventListener("pageshow", checkSession);
    document.addEventListener("visibilitychange", checkSession);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", checkSession);
      window.removeEventListener("pageshow", checkSession);
      document.removeEventListener("visibilitychange", checkSession);
    };
  }, [adminSession, screen]);

  useEffect(() => {
    document.title = `کافه ${business.name} | ${business.englishName}`;
    setCart((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => {
        const item = catalogById.get(id);
        return item?.available && item.categoryVisible;
      }));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [business.name, business.englishName, catalogById]);

  useEffect(() => {
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (cartOpen) setCartOpen(false);
      else if (drawerOpen) setDrawerOpen(false);
      else if (menuSheetOpen) closeMenuSheet();
      else if (searchOpen) setSearchOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cartOpen, drawerOpen, menuSheetOpen, searchOpen]);

  const chooseCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setQuery("");
    setSearchOpen(false);
    setMenuSheetOpen(false);
    navigateTo(routeLinks.category(categoryId));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const returnToCategories = () => {
    setQuery("");
    setSearchOpen(false);
    navigateTo(routeLinks.categories());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeMenuSheet = () => {
    setMenuSheetOpen(false);
    if (/^#\/?(?:categories|menu\/categories)\/?$/i.test(window.location.hash)) {
      window.history.replaceState(null, "", routeLinks.home());
    }
  };

  const copyCategoryLink = async (categoryId: string, categoryTitle: string) => {
    const url = getAbsoluteUrl(routeLinks.category(categoryId));
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setToast(`لینک دسته «${categoryTitle}» کپی شد`);
      } else if (navigator.share) {
        await navigator.share({ title: categoryTitle, url });
      } else {
        setToast("لینک دسته: " + url);
      }
    } catch {
      setToast("لینک دسته: " + url);
    }
  };

  const changeQuantity = (id: string, delta: number) => {
    const item = catalogById.get(id);
    if (delta > 0 && (!item?.available || !item.categoryVisible)) return;
    setCart((current) => {
      const next = { ...current };
      const quantity = (next[id] ?? 0) + delta;
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  };

  const sharePage = async () => {
    const currentUrl = screen === "menu" && selectedCategory
      ? getAbsoluteUrl(routeLinks.category(selectedCategory.id))
      : getAbsoluteUrl(routeLinks.home());
    const shareData = {
      title: screen === "menu" && selectedCategory
        ? `منوی ${selectedCategory.title} | کافه ${business.name}`
        : `کافه ${business.name} | ${business.englishName}`,
      text: business.tagline,
      url: currentUrl,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(currentUrl);
        setToast("لینک صفحه کپی شد");
      } else setToast("کافه صحنه را با دوستانتان به اشتراک بگذارید");
    } catch {
      setToast("اشتراک‌گذاری انجام نشد");
    }
  };

  const exitAdmin = () => {
    navigateTo(routeLinks.home());
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const loginAdmin = async (username: string, password: string) => {
    const session = await authenticateAdmin(username, password);
    if (!session) return false;
    setAdminSession(session);
    setScreen("admin");
    navigateTo(routeLinks.admin());
    window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  };

  const logoutAdmin = () => {
    clearAdminSession();
    setAdminSession(null);
    navigateTo(routeLinks.admin());
    setToast("از حساب مدیریت خارج شدید.");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const saveMenu = (next: MenuData) => {
    if (!isAdminSessionValid(adminSession)) {
      clearAdminSession();
      setAdminSession(null);
      setToast("برای ذخیره تغییرات، دوباره وارد حساب مدیریت شوید.");
      return false;
    }
    try {
      localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(next));
      setMenuData(next);
      fetch(apiUrl("/api/menu"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || "Unauthorized");
        }
      }).catch(() => {
        clearAdminSession();
        setAdminSession(null);
        setToast("نشست مدیریت نامعتبر است؛ دوباره وارد شوید.");
      });
      setToast("تغییرات منو ذخیره شد");
      return true;
    } catch {
      setToast("ذخیره انجام نشد؛ فضای مرورگر یا دسترسی ذخیره‌سازی را بررسی کنید.");
      return false;
    }
  };

  return (
    <div className="app-shell" dir="rtl" style={themeStyle}>
      {screen === "admin" ? (
        hasAdminAccess ? (
          <MenuAdmin
            data={menuData}
            defaultData={defaultMenuData}
            onSave={saveMenu}
            onExit={exitAdmin}
            onLogout={logoutAdmin}
            initialTab={isAdminQrRoute(window.location.hash, window.location.pathname) ? "qr" : "items"}
          />
        ) : (
          <AdminLogin businessName={business.name} logo={business.logo} onLogin={loginAdmin} onBack={exitAdmin} />
        )
      ) : screen === "profile" ? (
        <main className="profile-screen">
          <div className="profile-background" style={{ backgroundImage: `url("${business.heroImage || photo.hero}")` }} />
          <header className="profile-topbar">
            <button className="glass-icon-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="باز کردن اطلاعات کافه">
              <Icon name="menu" />
            </button>
            <div className="topbar-wordmark"><span>{business.englishName}</span><i /> <span>COFFEE TO GO</span></div>
            <a className="glass-icon-button" href={mapUrl} target="_blank" rel="noreferrer" aria-label="نمایش موقعیت کافه">
              <Icon name="location" />
            </a>
          </header>

          <div className="profile-content">
            <section className="profile-copy" aria-labelledby="brand-title">
              <div className="brand-intro">
                <StageLogo src={business.logo} />
                <p className="profile-kicker">SPECIALTY COFFEE <span /> TO GO</p>
                <h1 id="brand-title">{business.name}</h1>
                <p className="english-name">{business.englishName}</p>
                <span className="accent-rule" />
                <p className="profile-description">{business.description}</p>
              </div>
            </section>

            <section className="profile-footer" aria-label="اطلاعات و منوی کافه">
              <div className="social-actions">
                <button className="round-action" type="button" onClick={sharePage} aria-label="اشتراک‌گذاری صفحه"><Icon name="share" /></button>
                {business.instagramUrl && <a className="round-action" href={business.instagramUrl} target="_blank" rel="noreferrer" aria-label="اینستاگرام"><Icon name="instagram" /></a>}
                <a className="round-action" href={mapUrl} target="_blank" rel="noreferrer" aria-label="مسیریابی"><Icon name="location" /></a>
              </div>
              <a className="address-link" href={mapUrl} target="_blank" rel="noreferrer">
                <span className="address-icon"><Icon name="location" /></span>
                <span><small>ما را پیدا کنید</small><strong>{business.address}</strong></span>
                <Icon name="arrow-up-right" />
              </a>
              <a
                className="primary-button"
                href={routeLinks.categories()}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                  event.preventDefault();
                  navigateTo(routeLinks.categories());
                }}
              >
                <span>مشاهده منو</span>
                <span className="button-arrow"><Icon name="arrow-down" /></span>
              </a>
            </section>
          </div>
        </main>
      ) : (
        <main className="menu-screen">
          <header className="menu-topbar">
            <a
              className="plain-icon-button"
              href={routeLinks.categories()}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                event.preventDefault();
                returnToCategories();
              }}
              aria-label="بازگشت به دسته‌بندی‌ها"
              title="بازگشت به دسته‌بندی‌ها"
            >
              <Icon name="arrow-left" />
            </a>
            <a
              className="menu-brand"
              href={routeLinks.home()}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                event.preventDefault();
                navigateTo(routeLinks.home());
              }}
              aria-label="بازگشت به صفحه کافه"
            >
              <StageLogo small src={business.logo} />
              <span>{business.name}</span>
            </a>
            <div className="menu-top-actions">
              <button className={`plain-icon-button${searchOpen ? " is-active" : ""}`} type="button" onClick={() => { setSearchOpen((open) => !open); setQuery(""); }} aria-label="جست‌وجو در منو"><Icon name="search" /></button>
              <button className="plain-icon-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="اطلاعات کافه"><Icon name="menu" /></button>
            </div>
          </header>

          {searchOpen && (
            <div className="search-row">
              <Icon name="search" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام نوشیدنی را جست‌وجو کنید..." aria-label="جست‌وجوی نوشیدنی" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جست‌وجو"><Icon name="close" /></button>}
            </div>
          )}

          <CategoryRibbon
            categories={visibleCategories}
            selectedId={selectedCategory?.id ?? ""}
            onSelect={chooseCategory}
            getHref={(id) => routeLinks.category(id)}
          />

          <section className="products-section" id="products">
            <div className="section-title-row">
              <span />
              <div>
                <p>{selectedCategory?.englishTitle}</p>
                <h1>{selectedCategory?.title ?? "منو در حال آماده‌سازی است"}</h1>
              </div>
              <span />
            </div>
            {/* <div className="category-meta-bar">
              <span className="items-count-badge">{faNumber(filteredItems.length)} نوشیدنی</span>
              {selectedCategory && (
                <button
                  type="button"
                  className="category-share-link"
                  onClick={() => copyCategoryLink(selectedCategory.id, selectedCategory.title)}
                  title={`کپی لینک مستقیم دسته ${selectedCategory.title}`}
                >
                  <Icon name="link" />
                  <span>کپی لینک این دسته</span>
                </button>
              )}
            </div> */}

            {filteredItems.length ? (
              <div className="product-list">
                {filteredItems.map((item, index) => {
                  const quantity = cart[item.id] ?? 0;
                  return (
                    <article className={`product-row${item.available ? "" : " is-unavailable"}`} key={item.id} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                      <div className="product-photo-wrap">
                        <img src={item.photo} alt={item.name} loading={index > 3 ? "lazy" : "eager"} />
                        {!item.available ? <span className="unavailable-label">ناموجود</span> : quantity > 0 ? (
                          <div className="quantity-control" aria-label={`تعداد ${item.name}`}>
                            <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`کم کردن ${item.name}`}><Icon name="minus" /></button>
                            <span>{faNumber(quantity)}</span>
                            <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`افزودن ${item.name}`}><Icon name="plus" /></button>
                          </div>
                        ) : (
                          <button className="add-button" type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`افزودن ${item.name} به سبد`}><Icon name="plus" /></button>
                        )}
                      </div>
                      <div className="product-info">
                        <h2>{item.name}</h2>
                        {item.detail && <p>{item.detail}</p>}
                        <div className="product-price">{priceLabel(item.price)}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-search"><Icon name="search" /><strong>{selectedCategory ? "چیزی پیدا نشد" : "به‌زودی با یک منوی تازه"}</strong><span>{selectedCategory ? "نام نوشیدنی دیگری را امتحان کنید." : "برای دیدن نوشیدنی‌ها دوباره سر بزنید."}</span></div>
            )}
          </section>
        </main>
      )}

      {screen === "menu" && cartCount > 0 && (
        <button className="cart-dock" type="button" onClick={() => setCartOpen(true)}>
          <span className="cart-count">{faNumber(cartCount)}</span>
          <span className="cart-label">در سبد شما</span>
          <span className="cart-total">{priceLabel(cartTotal)}</span>
          <span className="cart-arrow"><Icon name="arrow-left" /></span>
        </button>
      )}

      {menuSheetOpen && (
        <div className="overlay-layer">
          <button className="overlay-scrim" type="button" onClick={closeMenuSheet} aria-label="بستن منو" />
          <section className="bottom-sheet category-sheet" role="dialog" aria-modal="true" aria-labelledby="category-sheet-title">
            <div className="sheet-handle" />
            <header className="sheet-heading">
              <div>
                <p>STAGE MENU</p>
                <h2 id="category-sheet-title">چی میل دارید؟</h2>
                <span>یک دسته را انتخاب کنید و منو را ببینید.</span>
              </div>
              <button className="sheet-close" type="button" onClick={closeMenuSheet} aria-label="بستن"><Icon name="close" /></button>
            </header>
            <div className="sheet-category-list">
              {visibleCategories.map((category, index) => (
                <a
                  className="sheet-category"
                  key={category.id}
                  href={routeLinks.category(category.id)}
                  style={{ backgroundImage: `linear-gradient(90deg, rgba(12,14,13,.12), rgba(10,12,11,.78)), url("${category.cover}")` }}
                  onClick={(event) => {
                    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                    event.preventDefault();
                    chooseCategory(category.id);
                  }}
                >
                  <span className="sheet-category-number">{faNumber(index + 1).padStart(2, "۰")}</span>
                  <span className="sheet-category-copy"><strong>{category.title}</strong><small>{faNumber(category.items.length)} انتخاب</small></span>
                  <span className="sheet-category-arrow"><Icon name="arrow-left" /></span>
                </a>
              ))}
              {!visibleCategories.length && <p className="empty-menu-message">منوی تازه به‌زودی آماده می‌شود.</p>}
            </div>
          </section>
        </div>
      )}

      {drawerOpen && (
        <div className="overlay-layer drawer-layer">
          <button className="overlay-scrim" type="button" onClick={() => setDrawerOpen(false)} aria-label="بستن اطلاعات کافه" />
          <aside className="side-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
            <header className="drawer-header">
              <button className="drawer-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="بستن"><Icon name="close" /></button>
              <StageLogo src={business.logo} />
              <h2 id="drawer-title">کافه {business.name}</h2>
              <p>{business.englishName} · COFFEE TO GO</p>
            </header>
            <div className="drawer-rule" />
            <a className="drawer-primary" href={mapUrl} target="_blank" rel="noreferrer"><Icon name="location" /><span>مسیریابی تا کافه</span><Icon name="arrow-up-right" /></a>
            <div className="drawer-links">
              <a
                href={routeLinks.home()}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                  event.preventDefault();
                  setDrawerOpen(false);
                  navigateTo(routeLinks.home());
                }}
              >
                <Icon name="arrow-left" />
                <span>صفحه اصلی کافه</span>
                <Icon name="arrow-up-right" />
              </a>
              <a
                href={routeLinks.categories()}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                  event.preventDefault();
                  setDrawerOpen(false);
                  navigateTo(routeLinks.categories());
                }}
              >
                <Icon name="menu" />
                <span>دسته‌بندی‌های منو</span>
                <Icon name="arrow-up-right" />
              </a>
              <a href={mapUrl} target="_blank" rel="noreferrer"><Icon name="location" /><span>{business.address}</span><Icon name="arrow-up-right" /></a>
              {business.instagramUrl && <a href={business.instagramUrl} target="_blank" rel="noreferrer"><Icon name="instagram" /><span>اینستاگرام {business.name}</span><Icon name="arrow-up-right" /></a>}
              <button type="button" onClick={() => { setDrawerOpen(false); setToast("هر روز، آماده‌ی یک فنجان تازه"); }}><Icon name="clock" /><span>کافه بیرون‌بر و قهوه تخصصی</span><Icon name="arrow-up-right" /></button>
            </div>
            <div className="drawer-about">
              <span>درباره {business.name}</span>
              <p>ساده، سریع و دقیق؛ برای لحظه‌ای کوتاه و یک فنجان قهوه‌ی درست.</p>
            </div>
            <div className="drawer-footer">
              <StageLogo small src={business.logo} />
              <p>{business.tagline}</p>
              <a
                href={routeLinks.categories()}
                className="drawer-menu-button"
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                  event.preventDefault();
                  setDrawerOpen(false);
                  navigateTo(routeLinks.categories());
                }}
              >
                دیدن دسته‌بندی‌های منو
              </a>
            </div>
          </aside>
        </div>
      )}

      {cartOpen && (
        <div className="overlay-layer cart-overlay">
          <button className="overlay-scrim" type="button" onClick={() => setCartOpen(false)} aria-label="بستن سبد" />
          <section className="bottom-sheet cart-sheet" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="sheet-handle" />
            <header className="sheet-heading cart-heading">
              <div><p>YOUR SELECTION</p><h2 id="cart-title">انتخاب‌های شما</h2><span>{faNumber(cartCount)} نوشیدنی در سبد</span></div>
              <button className="sheet-close" type="button" onClick={() => setCartOpen(false)} aria-label="بستن"><Icon name="close" /></button>
            </header>
            <div className="cart-items-list">
              {!cartItems.length && <p className="empty-menu-message">سبد شما خالی است؛ یک نوشیدنی تازه انتخاب کنید.</p>}
              {cartItems.map(({ item, quantity }) => (
                <div className="cart-item" key={item.id}>
                  <div><strong>{item.name}</strong><small>{item.categoryTitle}</small></div>
                  <div className="cart-item-actions">
                    <span>{priceLabel(item.price * quantity)}</span>
                    <div className="mini-quantity"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="کم کردن"><Icon name="minus" /></button><b>{faNumber(quantity)}</b><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="افزودن"><Icon name="plus" /></button></div>
                  </div>
                </div>
              ))}
            </div>
            <footer className="cart-sheet-footer"><span>جمع سفارش</span><strong>{priceLabel(cartTotal)}</strong><button type="button" onClick={() => setCartOpen(false)}>ادامه انتخاب</button></footer>
          </section>
        </div>
      )}

      {toast && <div className="toast-layer"><div className="toast-message" role="status">{toast}</div></div>}
    </div>
  );
}