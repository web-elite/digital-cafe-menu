import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Icon from "./Icon";
import type { BusinessInfo, Category, MenuData, MenuItem } from "../lib/menuData";
import { cloneMenuData, faNumber, isImageUrl, newId, parsePrice, validateMenuData } from "../lib/menuData";
import { isAdminQrRoute, routeLinks } from "../lib/router";
import AdminQrGenerator from "./AdminQrGenerator";
import "../admin.css";

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

type AdminTab = "items" | "categories" | "business" | "qr";

type Props = {
  data: MenuData;
  defaultData: MenuData;
  onSave: (data: MenuData) => boolean;
  onExit: () => void;
  onLogout: () => void;
  initialTab?: AdminTab;
};

type Editor =
  | { kind: "category"; category: Category; isNew: boolean }
  | { kind: "item"; item: MenuItem; price: string; categoryId: string; isNew: boolean };

type Confirmation = {
  title: string;
  message: string;
  label: string;
  danger?: boolean;
  action: () => void;
  extra?: { label: string; action: () => void };
};

function AdminDialog({ title, children, onClose, compact = false }: { title: string; children: ReactNode; onClose: () => void; compact?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const headingId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const field = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? dialogRef.current?.querySelector<HTMLElement>("input:not([type='file']), button");
      field?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const fields = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]):not([type='hidden']), textarea:not([disabled]), select:not([disabled]), [tabindex='0']") ?? []).filter((element) => element.getClientRects().length > 0);
      const first = fields[0];
      const last = fields[fields.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="admin-modal-layer">
      <button className="overlay-scrim" type="button" onClick={onClose} aria-label="بستن پنجره" />
      <section className={`admin-modal${compact ? " is-compact" : ""}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <header className="admin-modal-header"><h2 id={headingId}>{title}</h2><button className="sheet-close" type="button" onClick={onClose} aria-label="بستن"><Icon name="close" /></button></header>
        {children}
      </section>
    </div>
  );
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(apiUrl("/api/upload"), {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const payload: { ok?: boolean; url?: string; message?: string } = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok || !payload.url) {
    throw new Error(payload.message || "بارگذاری تصویر انجام نشد.");
  }

  return payload.url;
}

function ImageField({ label, value, onChange, maxEdge = 900, preserveAlpha = false, hint }: { label: string; value: string; onChange: (value: string) => void; maxEdge?: number; preserveAlpha?: boolean; hint?: string }) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const uploaded = value.startsWith("data:image/");

  return (
    <div className="admin-image-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="admin-image-editor">
        <div className="admin-image-preview">{value && isImageUrl(value) ? <img src={value} alt="پیش‌نمایش تصویر" /> : <Icon name="eye" />}</div>
        <div className="admin-image-inputs">
          <input id={inputId} type="text" dir="ltr" value={uploaded ? "" : value} onChange={(event) => { setError(""); onChange(event.target.value); }} placeholder={uploaded ? "تصویر بارگذاری شده است" : "https://example.com/photo.jpg"} aria-label={`لینک ${label}`} />
          <div className="admin-image-buttons">
            <button className="admin-button is-small is-secondary" type="button" disabled={loading} onClick={() => fileRef.current?.click()}><Icon name="upload" />{loading ? "در حال پردازش..." : "انتخاب تصویر"}</button>
            {value && <button className="admin-text-button" type="button" onClick={() => onChange("")}>حذف تصویر</button>}
          </div>
          <small>{uploaded ? "تصویر همراه منو ذخیره می‌شود." : "لینک تصویر یا فایل JPG، PNG و WebP تا ۸ مگابایت"}{hint ? ` | ${hint}` : ""}</small>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
          setError("یک تصویر JPG، PNG یا WebP با حجم کمتر از ۸ مگابایت انتخاب کنید.");
          return;
        }
        setLoading(true);
        setError("");
        try { onChange(await uploadImage(file)); }
        catch (error) { setError(error instanceof Error ? error.message : "بارگذاری تصویر انجام نشد."); }
        finally { setLoading(false); }
      }} />
      {error && <p className="admin-field-error" role="alert">{error}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`admin-toggle${checked ? " is-checked" : ""}`} role="switch" aria-checked={checked} aria-label={label} type="button" onClick={onChange}><span className="admin-toggle-track"><i /></span><span>{checked ? "فعال" : "غیرفعال"}</span></button>;
}

function reorder<T>(list: T[], index: number, direction: number): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  const [entry] = next.splice(index, 1);
  next.splice(target, 0, entry);
  return next;
}

export default function MenuAdmin({ data, defaultData, onSave, onExit, onLogout, initialTab = "items" }: Props) {
  const [draft, setDraft] = useState(() => cloneMenuData(data));
  const [baseline, setBaseline] = useState(() => JSON.stringify(data));
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [activeCategoryId, setActiveCategoryId] = useState(data.categories[0].id);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorError, setEditorError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState("");
  const [qrLogoMap, setQrLogoMap] = useState<Record<string, string | null>>({});
  const importRef = useRef<HTMLInputElement>(null);
  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const activeCategory = draft.categories.find((category) => category.id === activeCategoryId) ?? draft.categories[0];
  const filteredItems = activeCategory.items.filter((item) => `${item.name} ${item.detail ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const itemCount = draft.categories.reduce((sum, category) => sum + category.items.length, 0);

  useEffect(() => {
    const incoming = JSON.stringify(data);
    if (incoming !== baseline && !dirty) {
      setDraft(cloneMenuData(data));
      setBaseline(incoming);
    }
  }, [data, baseline, dirty]);

  useEffect(() => {
    if (isAdminQrRoute(window.location.hash, window.location.pathname)) {
      setTab("qr");
      return;
    }
    if (!window.location.hash || window.location.hash === routeLinks.admin() || window.location.hash === "#/admin/") {
      setTab((current) => (current === "qr" ? "items" : current));
    }
  }, [window.location.hash, window.location.pathname]);

  // Load existing QR logo overrides for categories from backend (admin-only)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(apiUrl("/api/admin/categories"), { credentials: "include" });
        if (!resp.ok) return;
        const payload = await resp.json().catch(() => ({}));
        if (!payload || !payload.data) return;
        const map: Record<string, string | null> = {};
        for (const c of payload.data) map[c.id] = c.qrLogo ?? null;
        if (mounted) setQrLogoMap(map);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const handleTabSelect = (nextTab: AdminTab) => {
    setTab(nextTab);
    if (nextTab === "qr") {
      if (window.location.hash !== routeLinks.adminQr()) window.location.hash = routeLinks.adminQr();
      return;
    }
    if (window.location.hash === routeLinks.adminQr() || window.location.hash === "#/admin/") {
      window.location.hash = routeLinks.admin();
    }
  };

  const saveChanges = () => {
    try {
      const next = validateMenuData(draft);
      if (!onSave(next)) {
        setNotice("ذخیره انجام نشد؛ می‌توانید از منو خروجی بگیرید و دوباره تلاش کنید.");
        return false;
      }
      setBaseline(JSON.stringify(next));
      setDraft(next);
      setNotice("تغییرات ذخیره شد و در منوی کافه اعمال شد.");
      return true;
    } catch {
      setNotice("نام کافه و دسته‌ها نباید خالی باشند؛ قیمت‌ها و لینک تصاویر را هم بررسی کنید.");
      return false;
    }
  };

  const requestExit = () => {
    if (!dirty) { onExit(); return; }
    setConfirmation({
      title: "تغییرات ذخیره نشده‌اند",
      message: "برای نمایش نسخه جدید منو، ابتدا تغییرات را ذخیره کنید.",
      label: "ذخیره و نمایش",
      action: () => { if (saveChanges()) onExit(); },
      extra: { label: "خروج بدون ذخیره", action: onExit },
    });
  };

  const requestLogout = () => {
    if (!dirty) { onLogout(); return; }
    setConfirmation({
      title: "خروج از حساب مدیریت؟",
      message: "تغییرات ذخیره نشده‌اند. می‌توانید ابتدا آن‌ها را ذخیره کنید یا بدون ذخیره از حساب خارج شوید.",
      label: "ذخیره و خروج",
      action: () => { if (saveChanges()) onLogout(); },
      extra: { label: "خروج بدون ذخیره", action: onLogout },
    });
  };

  // Upload and set QR logo for a category
  const setCategoryQrLogo = async (categoryId: string, logoUrl: string | null) => {
    try {
      const resp = await fetch(apiUrl(`/api/admin/category/${encodeURIComponent(categoryId)}/qr-logo`), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload.ok) throw new Error(payload.message || "خطا در ذخیره لوگوی QR");
      setQrLogoMap((m) => ({ ...m, [categoryId]: logoUrl }));
      setNotice(logoUrl ? "لوگوی QR ذخیره شد." : "لوگوی QR حذف شد.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "ذخیره لوگوی QR انجام نشد.");
    }
  };

  const handleUploadQrLogo = (categoryId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        await setCategoryQrLogo(categoryId, url);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "بارگذاری انجام نشد.");
      }
    };
    input.click();
  };

  const handleClearQrLogo = async (categoryId: string) => {
    await setCategoryQrLogo(categoryId, null);
  };

  const handleViewCategoryQr = async (categoryId: string) => {
    try {
      const resp = await fetch(apiUrl(`/api/admin/qrcode/category/${encodeURIComponent(categoryId)}?file=png&size=500`), { credentials: "include" });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(txt || "خطا در تولید QR");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "تولید QR انجام نشد.");
    }
  };

  const openCategoryEditor = (category?: Category) => {
    setEditorError("");
    setEditor({ kind: "category", isNew: !category, category: category ? { ...category, items: [...category.items] } : { id: newId("category"), title: "", englishTitle: "", cover: defaultData.categories[0].cover, visible: true, items: [] } });
  };

  const openItemEditor = (item?: MenuItem) => {
    setEditorError("");
    setEditor({ kind: "item", isNew: !item, categoryId: activeCategory.id, price: item ? String(item.price) : "", item: item ? { ...item } : { id: newId("item"), name: "", price: 0, detail: "", image: activeCategory.cover, available: true } });
  };

  const applyEditor = (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    if (editor.kind === "category") {
      const category = { ...editor.category, title: editor.category.title.trim(), englishTitle: editor.category.englishTitle.trim(), cover: editor.category.cover.trim() || defaultData.categories[0].cover };
      if (!category.title || !isImageUrl(category.cover)) { setEditorError("نام دسته و یک تصویر معتبر را وارد کنید."); return; }
      setDraft((current) => ({ ...current, categories: editor.isNew ? [...current.categories, category] : current.categories.map((entry) => entry.id === category.id ? category : entry) }));
      setActiveCategoryId(category.id);
    } else {
      const price = parsePrice(editor.price);
      const item = { ...editor.item, name: editor.item.name.trim(), detail: editor.item.detail?.trim(), image: editor.item.image.trim() };
      if (!item.name || price === null || !isImageUrl(item.image)) { setEditorError("نام، قیمت کامل به تومان و یک لینک تصویر معتبر را وارد کنید."); return; }
      item.price = price;
      setDraft((current) => ({
        ...current,
        categories: current.categories.map((category) => {
          if (category.id !== editor.categoryId) return { ...category, items: category.items.filter((entry) => entry.id !== item.id) };
          const exists = category.items.some((entry) => entry.id === item.id);
          return { ...category, items: exists ? category.items.map((entry) => entry.id === item.id ? item : entry) : [...category.items, item] };
        }),
      }));
      setActiveCategoryId(editor.categoryId);
      setSearch("");
    }
    setEditor(null);
    setNotice("تغییر به پیش‌نویس اضافه شد؛ برای اعمال در سایت «ذخیره تغییرات» را بزنید.");
  };

  const removeCategory = (category: Category) => {
    if (draft.categories.length === 1) { setNotice("حداقل یک دسته باید در منو باقی بماند."); return; }
    setConfirmation({ title: `حذف «${category.title}»؟`, message: `${faNumber(category.items.length)} آیتم این دسته نیز حذف می‌شوند. تا پیش از ذخیره، می‌توانید پنل را بدون ذخیره ببندید.`, label: "حذف دسته و آیتم‌ها", danger: true, action: () => {
      setDraft((current) => ({ ...current, categories: current.categories.filter((entry) => entry.id !== category.id) }));
      setNotice("دسته از پیش‌نویس حذف شد.");
    } });
  };

  const removeItem = (item: MenuItem) => {
    setConfirmation({ title: `حذف «${item.name}»؟`, message: "این آیتم از منو حذف خواهد شد. تغییر بعد از ذخیره نهایی در سایت اعمال می‌شود.", label: "حذف آیتم", danger: true, action: () => {
      setDraft((current) => ({ ...current, categories: current.categories.map((category) => ({ ...category, items: category.items.filter((entry) => entry.id !== item.id) })) }));
      setNotice("آیتم از پیش‌نویس حذف شد.");
    } });
  };

  const moveCategory = (id: string, direction: number) => {
    setDraft((current) => ({ ...current, categories: reorder(current.categories, current.categories.findIndex((category) => category.id === id), direction) }));
  };

  const moveItem = (id: string, direction: number) => {
    setDraft((current) => ({ ...current, categories: current.categories.map((category) => category.id === activeCategory.id ? { ...category, items: reorder(category.items, category.items.findIndex((item) => item.id === id), direction) } : category) }));
  };

  const updateBusiness = <K extends keyof BusinessInfo>(key: K, value: BusinessInfo[K]) => {
    setDraft((current) => ({ ...current, business: { ...current.business, [key]: value } }));
  };

  const updateTheme = (key: keyof typeof draft.theme, value: string) => {
    setDraft((current) => ({ ...current, theme: { ...current.theme, [key]: value } }));
  };

  const exportMenu = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stage-menu-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(dirty ? "فایل خروجی پیش‌نویس دانلود شد؛ تغییرات هنوز در سایت ذخیره نشده‌اند." : "فایل پشتیبان منو دانلود شد.");
  };

  return (
    <main className="admin-screen">
      <header className="admin-topbar">
        {/* <a href="#/admin" className="admin-brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="admin-brand-mark">{draft.business.logo ? <img src={draft.business.logo} alt="" /> : "S"}</span>
          <div><strong>مدیریت {draft.business.name || "صحنه"}</strong><small>STAGE MENU EDITOR</small></div>
        </a> */}
        <div className="admin-header-actions">
          <a
            href="#/"
            className="admin-button is-secondary"
            onClick={(event) => {
              if (dirty) {
                event.preventDefault();
                requestExit();
              }
            }}
          >
            <Icon name="eye" />
            <span>نمایش سایت</span>
          </a>
          {/* <button
            type="button"
            className="admin-button is-secondary"
            title="تولید QR دسته‌ها"
            onClick={() => handleTabSelect("qr")}
          >
            <Icon name="share" />
            <span>QR ساز</span>
          </button> */}
          <button className="admin-button" type="button" disabled={!dirty} onClick={saveChanges}><Icon name="save" /><span>ذخیره تغییرات</span></button>
          <button className="admin-button is-secondary admin-logout" type="button" onClick={requestLogout} aria-label="خروج از حساب مدیریت" title="خروج از حساب مدیریت"><Icon name="logout" /><span>خروج</span></button>
        </div>
      </header>

      <div className="admin-workspace">
        <section className="admin-intro">
          <div><p>منو، به سلیقه شما</p><h1>ویرایش منوی کافه</h1><span>دسته‌ها، نوشیدنی‌ها و قیمت‌ها را تغییر دهید؛ سپس تغییرات را ذخیره کنید.</span></div>
          <div className={`admin-save-status${dirty ? " is-dirty" : ""}`} role="status"><i />{dirty ? "تغییرات ذخیره‌نشده" : "همه تغییرات ذخیره‌اند"}</div>
        </section>

        <div className="admin-local-note"><Icon name="save" /><p>تغییرات هم در مرورگر و هم در بک‌اند پایدار ذخیره می‌شوند تا هر زمان بتوانید نسخهٔ جدید را روی هر دستگاهی ببینید.</p></div>

        <nav className="admin-tabs" aria-label="بخش‌های مدیریت">
          <button type="button" className={tab === "items" ? "is-selected" : ""} onClick={() => handleTabSelect("items")}>آیتم‌های منو <span>{faNumber(itemCount)}</span></button>
          <button type="button" className={tab === "categories" ? "is-selected" : ""} onClick={() => handleTabSelect("categories")}>دسته‌بندی‌ها <span>{faNumber(draft.categories.length)}</span></button>
          <button type="button" className={tab === "business" ? "is-selected" : ""} onClick={() => handleTabSelect("business")}>اطلاعات کافه</button>
          <button type="button" className={tab === "qr" ? "is-selected" : ""} onClick={() => handleTabSelect("qr")}>QR ساز</button>
        </nav>

        {notice && <div className="admin-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="بستن پیام"><Icon name="close" /></button></div>}

        {tab === "qr" && <AdminQrGenerator defaultLogoUrl={draft.business.logo || null} />}

        {tab === "items" && (
          <div className="admin-menu-layout">
            <aside className="admin-category-sidebar" aria-label="انتخاب دسته برای ویرایش">
              <div className="admin-sidebar-heading"><span>دسته‌ها</span><button type="button" onClick={() => openCategoryEditor()} aria-label="افزودن دسته"><Icon name="plus" /></button></div>
              <div className="admin-sidebar-list">
                {draft.categories.map((category) => (
                  <button key={category.id} className={`admin-sidebar-category${activeCategory.id === category.id ? " is-selected" : ""}`} type="button" onClick={() => { setActiveCategoryId(category.id); setSearch(""); }} aria-pressed={activeCategory.id === category.id}>
                    <img src={category.cover || defaultData.categories[0].cover} alt="" /><span><strong>{category.title}</strong><small>{faNumber(category.items.length)} آیتم{!category.visible ? " · پنهان" : ""}</small></span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="admin-items-section">
              <header className="admin-section-heading">
                <div>
                  <h2>{activeCategory.title}</h2>
                  <p>{activeCategory.visible ? "قیمت‌ها به تومان هستند." : "این دسته در منوی عمومی پنهان است."}</p>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <a
                    href={`#/category/${encodeURIComponent(activeCategory.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-button is-small is-secondary"
                    title="مشاهده مستقیم این دسته در سایت با لینک اختصاصی"
                  >
                    <Icon name="link" />
                    <span>لینک دسته</span>
                  </a>
                  <button className="admin-button is-small" type="button" onClick={() => openItemEditor()}>
                    <Icon name="plus" />
                    <span>افزودن آیتم</span>
                  </button>
                </div>
              </header>
              <label className="admin-search"><Icon name="search" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی آیتم در این دسته..." aria-label="جست‌وجوی آیتم‌ها برای ویرایش" /></label>
              <div className="admin-items-table" role="list">
                <div className="admin-table-heading" aria-hidden="true"><span>نوشیدنی</span><span>قیمت (تومان)</span><span>موجودی</span><span>ویرایش و ترتیب</span></div>
                {filteredItems.map((item) => {
                  const index = activeCategory.items.findIndex((entry) => entry.id === item.id);
                  return (
                    <div className="admin-item-row" key={item.id} role="listitem">
                      <div className="admin-item-name"><img src={item.image || activeCategory.cover || defaultData.categories[0].cover} alt="" /><div><strong>{item.name}</strong><small>{item.detail || "بدون توضیحات"}</small></div></div>
                      <span className="admin-item-price">{faNumber(item.price)}<small>تومان</small></span>
                      <div className="admin-item-availability"><Toggle checked={item.available} label={`موجودی ${item.name}`} onChange={() => setDraft((current) => ({ ...current, categories: current.categories.map((category) => ({ ...category, items: category.items.map((entry) => entry.id === item.id ? { ...entry, available: !entry.available } : entry) })) }))} /></div>
                      <div className="admin-row-actions">
                        <button type="button" onClick={() => openItemEditor(item)} aria-label={`ویرایش ${item.name}`} title="ویرایش"><Icon name="edit" /></button>
                        <button type="button" disabled={index === 0} onClick={() => moveItem(item.id, -1)} aria-label={`بالا بردن ${item.name}`} title="جابجایی به بالا"><Icon name="arrow-up" /></button>
                        <button type="button" disabled={index === activeCategory.items.length - 1} onClick={() => moveItem(item.id, 1)} aria-label={`پایین بردن ${item.name}`} title="جابجایی به پایین"><Icon name="arrow-down" /></button>
                        <button className="is-danger" type="button" onClick={() => removeItem(item)} aria-label={`حذف ${item.name}`} title="حذف"><Icon name="trash" /></button>
                      </div>
                    </div>
                  );
                })}
                {!filteredItems.length && <div className="admin-empty"><Icon name={search ? "search" : "plus"} /><strong>{search ? "آیتمی پیدا نشد" : "این دسته هنوز آیتمی ندارد"}</strong><span>{search ? "جست‌وجوی دیگری را امتحان کنید." : "اولین نوشیدنی را به این دسته اضافه کنید."}</span>{!search && <button className="admin-button is-small" type="button" onClick={() => openItemEditor()}>افزودن آیتم</button>}</div>}
              </div>
            </section>
          </div>
        )}

        {tab === "categories" && (
          <section className="admin-categories-section">
            <header className="admin-section-heading"><div><h2>دسته‌بندی‌های منو</h2><p>نام، تصویر، ترتیب و نمایش هر دسته را مدیریت کنید.</p></div><button className="admin-button is-small" type="button" onClick={() => openCategoryEditor()}><Icon name="plus" />افزودن دسته</button></header>
            <div className="admin-category-list">
              {draft.categories.map((category, index) => (
                <div className="admin-category-row" key={category.id}>
                  <span className="admin-category-index">{faNumber(index + 1)}</span><img src={category.cover || defaultData.categories[0].cover} alt="" />
                  <div className="admin-category-name"><strong>{category.title}</strong><small>{category.englishTitle || "بدون عنوان انگلیسی"} <i />{faNumber(category.items.length)} آیتم</small></div>
                  <Toggle checked={category.visible} label={`نمایش ${category.title} در منو`} onChange={() => setDraft((current) => ({ ...current, categories: current.categories.map((entry) => entry.id === category.id ? { ...entry, visible: !entry.visible } : entry) }))} />
                  <div className="admin-row-actions">
                    {/* QR controls: thumbnail, view/download, upload, clear */}
                    {/* {qrLogoMap[category.id] ? (
                      <button type="button" title="پیش‌نمایش لوگوی QR" onClick={() => window.open(qrLogoMap[category.id] as string, "_blank") }>
                        <img src={qrLogoMap[category.id] as string} alt="qr logo" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 6, marginRight: 6 }} />
                      </button>
                    ) : null}
                    <button type="button" className="admin-button is-small" title="مشاهده / دانلود QR این دسته" onClick={() => handleViewCategoryQr(category.id)}><Icon name="download" /></button>
                    <button type="button" title="بارگذاری لوگوی جدید برای QR" onClick={() => handleUploadQrLogo(category.id)}><Icon name="upload" /></button>
                    <button type="button" title="حذف لوگوی اختصاصی QR" onClick={() => handleClearQrLogo(category.id)}><Icon name="trash" /></button> */}
                    <a
                      href={`#/category/${encodeURIComponent(category.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`مشاهده لینک ${category.title} در سایت`}
                      title="مشاهده مستقیم این دسته در سایت"
                    >
                      <Icon name="arrow-up-right" />
                    </a>
                    <button type="button" onClick={() => openCategoryEditor(category)} aria-label={`ویرایش ${category.title}`} title="ویرایش"><Icon name="edit" /></button><button type="button" disabled={index === 0} onClick={() => moveCategory(category.id, -1)} aria-label="جابجایی دسته به بالا" title="بالا"><Icon name="arrow-up" /></button><button type="button" disabled={index === draft.categories.length - 1} onClick={() => moveCategory(category.id, 1)} aria-label="جابجایی دسته به پایین" title="پایین"><Icon name="arrow-down" /></button><button type="button" className="is-danger" disabled={draft.categories.length === 1} onClick={() => removeCategory(category)} aria-label={`حذف ${category.title}`} title="حذف"><Icon name="trash" /></button></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "business" && (
          <section className="admin-business-section">
            <header className="admin-section-heading"><div><h2>هویت و اطلاعات کافه</h2><p>اطلاعاتی که در صفحه معرفی نمایش داده می‌شوند.</p></div></header>
            <div className="admin-form-grid">
              <label className="admin-field"><span>نام کافه</span><input value={draft.business.name} onChange={(event) => updateBusiness("name", event.target.value)} maxLength={80} required /></label>
              <label className="admin-field"><span>نام انگلیسی</span><input dir="ltr" value={draft.business.englishName} onChange={(event) => updateBusiness("englishName", event.target.value)} maxLength={80} /></label>
              <label className="admin-field is-full"><span>درباره کافه</span><textarea value={draft.business.description} onChange={(event) => updateBusiness("description", event.target.value)} rows={5} maxLength={2500} /></label>
              <label className="admin-field is-full"><span>آدرس</span><input value={draft.business.address} onChange={(event) => updateBusiness("address", event.target.value)} maxLength={300} /></label>
              <label className="admin-field"><span>لینک اینستاگرام</span><input dir="ltr" type="url" value={draft.business.instagramUrl} onChange={(event) => updateBusiness("instagramUrl", event.target.value)} placeholder="https://instagram.com/..." /></label>
              <label className="admin-field"><span>جمله کوتاه برند</span><input value={draft.business.tagline} onChange={(event) => updateBusiness("tagline", event.target.value)} maxLength={160} /></label>
              <div className="admin-color-panel is-full">
                <h3>رنگ‌های اصلی وب‌سایت</h3>
                <div className="admin-color-grid">
                  <label className="admin-field"><span>رنگ اصلی</span><div className="admin-color-row"><input type="color" value={draft.theme.primary} onChange={(event) => updateTheme("primary", event.target.value)} /><input dir="ltr" value={draft.theme.primary} onChange={(event) => updateTheme("primary", event.target.value)} /></div></label>
                  <label className="admin-field"><span>رنگ اصلی تیره</span><div className="admin-color-row"><input type="color" value={draft.theme.primaryStrong} onChange={(event) => updateTheme("primaryStrong", event.target.value)} /><input dir="ltr" value={draft.theme.primaryStrong} onChange={(event) => updateTheme("primaryStrong", event.target.value)} /></div></label>
                  <label className="admin-field"><span>رنگ تأکید</span><div className="admin-color-row"><input type="color" value={draft.theme.accent} onChange={(event) => updateTheme("accent", event.target.value)} /><input dir="ltr" value={draft.theme.accent} onChange={(event) => updateTheme("accent", event.target.value)} /></div></label>
                  <label className="admin-field"><span>زمینۀ صفحه</span><div className="admin-color-row"><input type="color" value={draft.theme.background} onChange={(event) => updateTheme("background", event.target.value)} /><input dir="ltr" value={draft.theme.background} onChange={(event) => updateTheme("background", event.target.value)} /></div></label>
                  <label className="admin-field"><span>پس‌زمینه کارت‌ها</span><div className="admin-color-row"><input type="color" value={draft.theme.surface} onChange={(event) => updateTheme("surface", event.target.value)} /><input dir="ltr" value={draft.theme.surface} onChange={(event) => updateTheme("surface", event.target.value)} /></div></label>
                  <label className="admin-field"><span>متن اصلی</span><div className="admin-color-row"><input type="color" value={draft.theme.text} onChange={(event) => updateTheme("text", event.target.value)} /><input dir="ltr" value={draft.theme.text} onChange={(event) => updateTheme("text", event.target.value)} /></div></label>
                </div>
              </div>
              <div className="is-full"><ImageField label="لوگوی کافه" value={draft.business.logo} onChange={(value) => updateBusiness("logo", value)} maxEdge={640} preserveAlpha hint="اگر خالی بماند، لوگوی پیش‌فرض کافه نمایش داده می‌شود." /></div>
              <div className="is-full"><ImageField label="تصویر صفحه معرفی" value={draft.business.heroImage} onChange={(value) => updateBusiness("heroImage", value)} maxEdge={1600} /></div>
            </div>
          </section>
        )}

        <footer className="admin-tools-footer">
          <div><strong>نسخه پشتیبان منو</strong><p>از تغییراتتان خروجی بگیرید تا همیشه یک نسخه همراهتان باشد.</p></div>
          <div className="admin-backup-actions"><button className="admin-button is-small is-secondary" type="button" onClick={exportMenu}><Icon name="download" />خروجی JSON</button><button className="admin-button is-small is-secondary" type="button" onClick={() => importRef.current?.click()}><Icon name="upload" />ورود فایل</button><button className="admin-text-button is-danger" type="button" onClick={() => setConfirmation({ title: "بازیابی منوی اولیه؟", message: "نام‌ها، قیمت‌ها، تصاویر و اطلاعات کافه به نسخه اولیه برمی‌گردند. برای اعمال نهایی باید تغییرات را ذخیره کنید.", label: "بازیابی نسخه اولیه", danger: true, action: () => { setDraft(cloneMenuData(defaultData)); setActiveCategoryId(defaultData.categories[0].id); setNotice("نسخه اولیه به پیش‌نویس برگشت. برای اعمال، تغییرات را ذخیره کنید."); } })}>بازیابی نسخه اولیه</button></div>
          <input type="file" accept="application/json,.json" ref={importRef} hidden onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              if (file.size > 10 * 1024 * 1024) throw new Error("حجم فایل منو نباید بیشتر از ۱۰ مگابایت باشد.");
              const imported = validateMenuData(JSON.parse(await file.text()));
              setConfirmation({ title: "جایگزینی منو از فایل؟", message: `${faNumber(imported.categories.length)} دسته از فایل «${file.name}» وارد می‌شود و جایگزین پیش‌نویس فعلی خواهد شد.`, label: "ورود و جایگزینی", action: () => { setDraft(imported); setActiveCategoryId(imported.categories[0].id); setNotice("فایل وارد شد؛ برای اعمال در سایت، تغییرات را ذخیره کنید."); } });
            } catch (error) { setNotice(error instanceof SyntaxError ? "فایل انتخاب‌شده JSON معتبر نیست." : error instanceof Error ? error.message : "ورود فایل انجام نشد."); }
          }} />
        </footer>
      </div>

      {editor && (
        <AdminDialog key={`${editor.kind}-${editor.kind === "item" ? editor.item.id : editor.category.id}`} title={editor.kind === "category" ? editor.isNew ? "افزودن دسته‌بندی" : "ویرایش دسته‌بندی" : editor.isNew ? "افزودن نوشیدنی" : "ویرایش نوشیدنی"} onClose={() => setEditor(null)}>
          <form onSubmit={applyEditor}>
            <div className="admin-modal-body">
              {editor.kind === "category" ? (
                <div className="admin-form-grid">
                  <label className="admin-field is-full"><span>نام دسته‌بندی</span><input data-autofocus required value={editor.category.title} maxLength={100} onChange={(event) => setEditor({ ...editor, category: { ...editor.category, title: event.target.value } })} placeholder="مثلاً قهوه‌های گرم" /></label>
                  <label className="admin-field is-full"><span>عنوان انگلیسی (اختیاری)</span><input dir="ltr" value={editor.category.englishTitle} maxLength={100} onChange={(event) => setEditor({ ...editor, category: { ...editor.category, englishTitle: event.target.value } })} placeholder="HOT COFFEE" /></label>
                  <div className="is-full"><ImageField label="تصویر دسته‌بندی" value={editor.category.cover} onChange={(value) => setEditor((current) => current?.kind === "category" ? { ...current, category: { ...current.category, cover: value } } : current)} /></div>
                  <label className="admin-check-field is-full"><input type="checkbox" checked={editor.category.visible} onChange={(event) => setEditor({ ...editor, category: { ...editor.category, visible: event.target.checked } })} /><span>این دسته در منوی کافه نمایش داده شود.</span></label>
                </div>
              ) : (
                <div className="admin-form-grid">
                  <label className="admin-field is-full"><span>نام نوشیدنی</span><input data-autofocus required value={editor.item.name} maxLength={160} onChange={(event) => setEditor({ ...editor, item: { ...editor.item, name: event.target.value } })} placeholder="مثلاً لاته ۱۰۰٪ عربیکا" /></label>
                  <label className="admin-field"><span>دسته‌بندی</span><select value={editor.categoryId} onChange={(event) => setEditor({ ...editor, categoryId: event.target.value })}>{draft.categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
                  <label className="admin-field"><span>قیمت کامل (تومان)</span><input inputMode="numeric" required value={editor.price} onChange={(event) => setEditor({ ...editor, price: event.target.value })} placeholder="150000" dir="ltr" /><small>مثال: ۱۵۰۰۰۰ یعنی ۱۵۰ هزار تومان</small></label>
                  <label className="admin-field is-full"><span>مواد تشکیل‌دهنده یا توضیحات</span><textarea rows={3} maxLength={1000} value={editor.item.detail ?? ""} onChange={(event) => setEditor({ ...editor, item: { ...editor.item, detail: event.target.value } })} placeholder="مثلاً اسپرسو، شیر و سس کارامل" /></label>
                  <div className="is-full"><ImageField label="تصویر نوشیدنی" value={editor.item.image} onChange={(value) => setEditor((current) => current?.kind === "item" ? { ...current, item: { ...current.item, image: value } } : current)} /></div>
                  <label className="admin-check-field is-full"><input type="checkbox" checked={editor.item.available} onChange={(event) => setEditor({ ...editor, item: { ...editor.item, available: event.target.checked } })} /><span>این نوشیدنی موجود است و به سبد اضافه می‌شود.</span></label>
                </div>
              )}
              {editorError && <p className="admin-field-error" role="alert">{editorError}</p>}
            </div>
            <footer className="admin-modal-actions"><button className="admin-button is-secondary" type="button" onClick={() => setEditor(null)}>انصراف</button><button className="admin-button" type="submit"><Icon name="check" />اعمال تغییرات</button></footer>
          </form>
        </AdminDialog>
      )}

      {confirmation && (
        <AdminDialog title={confirmation.title} onClose={() => setConfirmation(null)} compact>
          <div className="admin-modal-body"><p className="admin-confirm-copy">{confirmation.message}</p></div>
          <footer className="admin-modal-actions"><button className="admin-button is-secondary" type="button" onClick={() => setConfirmation(null)}>انصراف</button>{confirmation.extra && <button className="admin-text-button" type="button" onClick={() => { const action = confirmation.extra!.action; setConfirmation(null); action(); }}>{confirmation.extra.label}</button>}<button className={`admin-button${confirmation.danger ? " is-danger" : ""}`} type="button" onClick={() => { const action = confirmation.action; setConfirmation(null); action(); }}>{confirmation.label}</button></footer>
        </AdminDialog>
      )}
    </main>
  );
}