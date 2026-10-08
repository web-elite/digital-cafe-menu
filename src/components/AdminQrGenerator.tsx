import React, { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import { routeLinks } from "../lib/router";
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

type Category = { id: string; title: string };

export default function AdminQrGenerator({ defaultLogoUrl = null }: { defaultLogoUrl?: string | null }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  // Form state
  const [target, setTarget] = useState<"business" | "categories" | "category">("category");
  const [categoryId, setCategoryId] = useState<string>("");
  const [size, setSize] = useState<number>(500);
  const [fileType, setFileType] = useState<"png" | "svg">("png");
  const [logoUrl, setLogoUrl] = useState<string | null>(defaultLogoUrl || null);
  const [logoSize, setLogoSize] = useState<"small" | "medium" | "large">("medium");
  const [contrastBg, setContrastBg] = useState<boolean>(true);
  const [downloadName, setDownloadName] = useState<string>("category-qrcode");

  const [generatedBlobUrl, setGeneratedBlobUrl] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  // print modal / export settings
  const [showModal, setShowModal] = useState(false);
  const [bleedMm, setBleedMm] = useState<number>(3);
  const [pageSize, setPageSize] = useState<"A4" | "Letter">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(apiUrl("/api/admin/categories"), { credentials: "include" });
        if (!resp.ok) return;
        const payload = await resp.json().catch(() => ({}));
        if (!payload || !payload.data) return;
        const list: Category[] = payload.data.map((c: any) => ({ id: c.id, title: c.title }));
        if (mounted) {
          setCategories(list);
          if (list.length) setCategoryId(list[0].id);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (defaultLogoUrl && !logoUrl) {
      setLogoUrl(defaultLogoUrl);
    }
  }, [defaultLogoUrl, logoUrl]);

  // helper: process image client-side (validate, crop to square center, resize) and return a Blob ready to upload
  const processAndCropImage = (file: File, maxEdge = 800): Promise<Blob> => new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) return reject(new Error("فایل باید JPG، PNG یا WebP باشد."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("حجم فایل باید کمتر از 8 مگابایت باشد."));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خطا در خواندن فایل تصویر."));
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // crop to square center
        const minSide = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - minSide) / 2);
        const sy = Math.floor((img.height - minSide) / 2);
        const canvas = document.createElement("canvas");
        const target = Math.min(maxEdge, minSide);
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("مرورگر از canvas پشتیبانی نمی‌کند."));
        // fill transparent or white depending on file type
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, target, target);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("خطا در پردازش تصویر."));
          resolve(blob);
        }, "image/png", 0.92);
      };
      img.onerror = () => reject(new Error("تصویر قابل بارگذاری نیست."));
      img.src = url;
    };
    reader.readAsDataURL(file);
  });

  useEffect(() => {
    return () => { if (generatedBlobUrl) URL.revokeObjectURL(generatedBlobUrl); };
  }, [generatedBlobUrl]);

  const validate = () => {
    // if (!categoryId) return "دسته‌ای انتخاب نشده است.";
    if (size < 64 || size > 2000) return "سایز باید بین 64 تا 2000 باشد.";
    // if (!downloadName.trim()) return "نام فایل دانلود را وارد کنید.";
    return null;
  };

  const handleGenerate = async (opts?: { preview?: boolean }) => {
    const err = validate();
    if (err) { setNotice(err); return; }
    setNotice("");
    setGenerating(true);
    setGeneratedBlobUrl(null);
    setPreviewDataUrl(null);
    try {
      // Build absolute target URL depending on selected target
      const base = `${window.location.origin}${window.location.pathname}`;
      let endpoint = "";
      let useGetCategory = false;
      if (target === "category") {
        // call category endpoint
        endpoint = apiUrl(`/api/admin/qrcode/category/${encodeURIComponent(categoryId)}`);
        useGetCategory = true;
      } else {
        endpoint = apiUrl("/api/admin/qrcode");
      }

      if (useGetCategory) {
        const q = new URL(endpoint);
        q.searchParams.set("file", fileType);
        q.searchParams.set("size", String(size));
        if (logoUrl) q.searchParams.set("logoUrl", logoUrl);
        q.searchParams.set("logoSize", logoSize);
        if (!contrastBg) q.searchParams.set("noLogoBg", "1");
        const resp = await fetch(q.toString(), { credentials: "include" });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "خطا در تولید QR");
          throw new Error(txt || "خطا در تولید QR");
        }

        if (fileType === "svg") {
          const text = await resp.text();
          const blob = new Blob([text], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          setGeneratedBlobUrl(url);
          if (opts?.preview) setPreviewDataUrl("data:image/svg+xml;utf8," + encodeURIComponent(text));
        } else {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          setGeneratedBlobUrl(url);
          if (opts?.preview) {
            const reader = new FileReader();
            reader.onload = () => setPreviewDataUrl(reader.result as string);
            reader.readAsDataURL(blob);
          }
        }
      } else {
        // Build intended page URL to encode in QR
        let targetHash = "#/";
        if (target === "business") targetHash = "#/";
        if (target === "categories") targetHash = "#/categories";
        const fullUrl = `${base}${targetHash}${target === "category" ? encodeURIComponent(categoryId) : ""}`;
        // For category this branch won't be used, but keep safe.
        const body: any = { data: fullUrl, size, file: fileType, logoSize };
        if (logoUrl) body.logoUrl = logoUrl;
        if (!contrastBg) body.noLogoBg = 1;
        const resp = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!resp.ok) {
          const payload = await resp.json().catch(() => ({}));
          throw new Error(payload?.message || "خطا در تولید QR");
        }
        if (fileType === "svg") {
          const text = await resp.text();
          const blob = new Blob([text], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          setGeneratedBlobUrl(url);
          if (opts?.preview) setPreviewDataUrl("data:image/svg+xml;utf8," + encodeURIComponent(text));
        } else {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          setGeneratedBlobUrl(url);
          if (opts?.preview) {
            const reader = new FileReader();
            reader.onload = () => setPreviewDataUrl(reader.result as string);
            reader.readAsDataURL(blob);
          }
        }
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "خطا در تولید QR");
    } finally {
      setGenerating(false);
    }
  };

  const [label, setLabel] = useState<string>("");
  const [resolution, setResolution] = useState<1 | 2 | 3>(1);
  const [exportFormat, setExportFormat] = useState<"png" | "svg" | "pdf">("png");

  const handleDownload = async () => {
    if (!generatedBlobUrl && !previewDataUrl) { setNotice("ابتدا QR را تولید کنید."); return; }
    try {
      if (exportFormat === "svg") {
        // try to fetch original svg and inject label if it's svg
        let svgText: string | null = null;
        if (previewDataUrl && previewDataUrl.startsWith("data:image/svg+xml")) {
          // decode
          const comma = previewDataUrl.indexOf(",");
          svgText = decodeURIComponent(previewDataUrl.slice(comma + 1));
        } else if (generatedBlobUrl) {
          const resp = await fetch(generatedBlobUrl);
          const ct = resp.headers.get("content-type") || "";
          if (ct.includes("svg")) svgText = await resp.text();
        }
        if (svgText) {
          // inject label if present
          if (label.trim()) {
            // insert before </svg>
            const insert = `\n  <text x="50%" y="95%" font-size="14" text-anchor="middle" fill="#111">${label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`;
            const out = svgText.replace(/<\/svg>\s*$/i, `${insert}</svg>`);
            const blob = new Blob([out], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `${downloadName}.svg`; document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            return;
          }
        }
        // fallback: if no svg text, rasterize and download PNG
      }

      // For PNG or fallback, compose image with label and resolution & bleed 0
      const composed = await composeImageWithLabel(resolution, !!label, 0);
      if (exportFormat === "pdf") {
        // open print window with composed image
        const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("خطا در خواندن تصویر")); r.readAsDataURL(composed.blob); });
        const win = window.open("", "_blank", "noopener");
        if (!win) { setNotice("مرورگر اجازه باز کردن پنجره چاپ را نداد."); return; }
        const sizes: Record<string, { w: number; h: number }> = { A4: { w: 210, h: 297 }, Letter: { w: 216, h: 279 } };
        const page = sizes[pageSize];
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR Print</title>
          <style>@page{size:${page.w}mm ${page.h}mm;margin:0}html,body{height:100%;margin:0}.sheet{width:${page.w}mm;height:${page.h}mm;display:flex;align-items:center;justify-content:center}.content{padding:0.1px}</style></head><body><div class="sheet"><img src="${dataUrl}" style="max-width:100%;max-height:100%"/></div><script>setTimeout(()=>window.print(),250)</script></body></html>`;
        win.document.open(); win.document.write(html); win.document.close();
        return;
      }

      // download PNG
      const url = URL.createObjectURL(composed.blob);
      const a = document.createElement("a"); a.href = url; a.download = `${downloadName}.png`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "خطا در دانلود تصویر");
    }
  };

  // Compose an image (PNG) from current preview/generated blob, with label and bleed, and return { blob, dataUrl }
  const composeImageWithLabel = async (scale = 1, includeLabel = true, bleedMM = 0): Promise<{ blob: Blob; dataUrl: string }> => {
    if (!previewDataUrl && !generatedBlobUrl) throw new Error("ابتدا پیش‌نمایش یا تولید را انجام دهید.");

    // helper to get data URL of source image (ensure it's raster image)
    const getSourceDataUrl = async (): Promise<string> => {
      if (previewDataUrl) return previewDataUrl;
      // fetch blob from generatedBlobUrl
      const resp = await fetch(generatedBlobUrl!);
      const b = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("خطا در خواندن تصویر منبع"));
        r.readAsDataURL(b);
      });
    };

    const srcDataUrl = await getSourceDataUrl();

    // Create image element
    const img = new Image();
    img.src = srcDataUrl;
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("خطا در بارگذاری تصویر برای ساخت خروجی")); });

    const pxPerMm = 3.7795275591; // approx 96 DPI -> mm
    const bleedPx = Math.round(bleedMM * pxPerMm * scale);
    const srcW = img.width;
    const srcH = img.height;
    const labelText = label?.trim() || "";
    const labelHeight = includeLabel && labelText ? Math.round(Math.max(20, srcW * 0.08) * scale) : 0;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(srcW * scale) + bleedPx * 2;
    canvas.height = Math.round(srcH * scale) + bleedPx * 2 + labelHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("مرورگر از canvas پشتیبانی نمی‌کند");

    // background white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw image centered
    const dx = bleedPx + Math.round((canvas.width - bleedPx * 2 - Math.round(srcW * scale)) / 2);
    const dy = bleedPx;
    ctx.drawImage(img, 0, 0, srcW, srcH, dx, dy, Math.round(srcW * scale), Math.round(srcH * scale));

    // draw label
    if (labelHeight && labelText) {
      ctx.fillStyle = "#111";
      const fontSize = Math.round(labelHeight * 0.6);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tx = canvas.width / 2;
      const ty = bleedPx + Math.round(srcH * scale) + labelHeight / 2;
      ctx.fillText(labelText, tx, ty);
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 0.96));
    if (!blob) throw new Error("خطا در ساخت تصویر خروجی");
    const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("خطا در خواندن تصویر خروجی")); r.readAsDataURL(blob); });
    return { blob, dataUrl };
  };

  // Export to PDF / Print using composed image
  const exportAsPdf = async (scale = 1, bleed = 0) => {
    try {
      const composed = await composeImageWithLabel(scale, true, bleed);
      const imgSrc = composed.dataUrl;
      const sizes: Record<string, { w: number; h: number }> = { A4: { w: 210, h: 297 }, Letter: { w: 216, h: 279 } };
      const page = sizes[pageSize];
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR Print</title>
        <style>
          @page { size: ${page.w}mm ${page.h}mm; margin:0; }
          html,body{height:100%;margin:0}
          .sheet{box-sizing:border-box;width:${page.w}mm;height:${page.h}mm;position:relative;display:flex;align-items:center;justify-content:center;background:#fff}
          .content{position:relative;box-sizing:border-box;padding:${bleed}mm; width:calc(100% - ${bleed * 2}mm); height:calc(100% - ${bleed * 2}mm); display:flex;align-items:center;justify-content:center}
          img{max-width:100%; max-height:100%; display:block}
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
        </head><body><div class="sheet"><div class="content"><img src="${imgSrc}" alt="QR" /></div></div>
        <script>setTimeout(() => { window.print(); }, 250); </script></body></html>`;
      const win = window.open("", "_blank", "noopener");
      if (!win) { setNotice("مرورگر اجازه باز کردن پنجره چاپ را نداد."); return; }
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "خطا در ایجاد PDF");
    }
  };

  const handleLogoUpload = async (file: File) => {
    setNotice("");
    try {
      setUploadProgress(0);
      // process and crop image client-side
      const blob = await processAndCropImage(file, 800);
      // upload with XMLHttpRequest to show progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiUrl("/api/upload"));
        xhr.withCredentials = true;
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const payload = JSON.parse(xhr.responseText);
              if (!payload || !payload.ok || !payload.url) return reject(new Error(payload?.message || "بارگذاری انجام نشد."));
              setLogoUrl(payload.url);
              setNotice("لوگو بارگذاری و ثبت شد.");
              setUploadProgress(null);
              return resolve();
            } catch (e) { return reject(new Error("خطا در خواندن پاسخ سرور.")); }
          } else {
            return reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("خطا در آپلود تصویر."));
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        const fd = new FormData();
        // send processed blob as file named logo.png
        fd.append("image", blob, "logo.png");
        xhr.send(fd);
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "خطا در آپلود لوگو");
      setUploadProgress(null);
    }
  };

  const formIsDirty = useMemo(() => !!logoUrl || size !== 500 || fileType !== "png" || !downloadName || !contrastBg || logoSize !== "medium", [logoUrl, size, fileType, downloadName, contrastBg, logoSize]);

  return (
    <main className="admin-screen admin-qr-generator">
      {/* <header className="admin-topbar">
        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-button is-secondary"
            onClick={() => {
              const nextHash = routeLinks.admin();
              if (window.location.hash !== nextHash) window.location.hash = nextHash;
            }}
          >
            <Icon name="arrow-left" />
            <span>بازگشت به داشبورد</span>
          </button>
          <div style={{ width: 12 }} />
        </div>
        <div style={{ flex: 1 }} />
      </header> */}

      <section className="admin-workspace admin-qr-workspace">
        <div className="admin-qr-shell">
          <div className="admin-qr-header">
            <div>
              <p>QR GENERATOR</p>
              <h2>تولید QR ویژه دسته‌ها</h2>
            </div>
            <span className="admin-qr-badge">اختصاصی</span>
          </div>

          <div className="admin-qr-layout">
            <form className="admin-qr-form" onSubmit={(e) => { e.preventDefault(); handleGenerate({ preview: true }); }}>
              <h3>تنظیمات QR</h3>

              <label className="admin-field admin-qr-field">
                <span>هدف QR</span>
                <div className="admin-qr-option-row">
                  <label className="admin-qr-radio"><input type="radio" name="target" value="category" checked={target === "category"} onChange={() => setTarget("category")} /> دسته خاص</label>
                  <label className="admin-qr-radio"><input type="radio" name="target" value="categories" checked={target === "categories"} onChange={() => setTarget("categories")} /> صفحهٔ دسته‌ها</label>
                  <label className="admin-qr-radio"><input type="radio" name="target" value="business" checked={target === "business"} onChange={() => setTarget("business")} /> صفحهٔ کسب‌وکار</label>
                </div>
              </label>

              {target === "category" && (
                <label className="admin-field admin-qr-field">
                  <span>دسته</span>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
              )}

              {/* <label className="admin-field admin-qr-field">
                <span>فرمت فایل</span>
                <div className="admin-qr-option-row is-inline">
                  <label className={`admin-qr-chip${fileType === "png" ? " is-selected" : ""}`}><input type="radio" name="ft" value="png" checked={fileType === "png"} onChange={() => setFileType("png")} /> PNG</label>
                  <label className={`admin-qr-chip${fileType === "svg" ? " is-selected" : ""}`}><input type="radio" name="ft" value="svg" checked={fileType === "svg"} onChange={() => setFileType("svg")} /> SVG</label>
                </div>
              </label> */}

              {/* <label className="admin-field admin-qr-field"><span>عرض (px)</span><input type="number" min={64} max={2000} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label> */}
              {/* <label className="admin-field admin-qr-field"><span>نام فایل دانلود</span><input type="text" value={downloadName} onChange={(e) => setDownloadName(e.target.value)} placeholder="category-qrcode" /></label> */}
              {/* <label className="admin-field admin-qr-field"><span>متن زیر QR (اختیاری)</span><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثلاً نام کافه یا نام دسته" /></label> */}

              {/* <label className="admin-field">
                <span>فرمت خروجی / رزولوشن</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)}>
                    <option value="png">PNG</option>
                    <option value="svg">SVG</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <label className="admin-text-button">رزولوشن:
                    <select value={String(resolution)} onChange={(e) => setResolution(Number(e.target.value) as 1 | 2 | 3)} style={{ marginRight: 8 }}>
                      <option value="1">1×</option>
                      <option value="2">2×</option>
                      <option value="3">3×</option>
                    </select>
                  </label>
                </div>
              </label> */}

              <label className="admin-field">
                <span>لوگو (اختیاری)</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="text" dir="ltr" value={logoUrl ?? ""} onChange={(e) => setLogoUrl(e.target.value || null)} placeholder="آدرس لوگو یا پس از آپلود URL" style={{ flex: 1 }} />
                  <label className="admin-text-button" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                    <span>انتخاب فایل</span>
                    <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} style={{ display: "none" }} />
                  </label>
                </div>
                {uploadProgress !== null && (
                  <div style={{ marginTop: 8 }}>
                    <small>در حال آپلود: {uploadProgress}%</small>
                    <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
                      <div style={{ width: `${uploadProgress}%`, height: "100%", background: "#4caf50" }} />
                    </div>
                  </div>
                )}
                <small>می‌توانید آدرس یک تصویر را وارد کنید یا فایل را آپلود کنید (JPG/PNG/WebP). تصویر به‌صورت خودکار کراپ و تغییر اندازه می‌شود.</small>
              </label>

              <div className="admin-field">
                <span>سایز لوگو وسط QR</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label="سایز لوگو">
                  {([
                    { value: "small", label: "کوچک", hint: "۱۵٪" },
                    { value: "medium", label: "متوسط", hint: "۲۰٪" },
                    { value: "large", label: "بزرگ", hint: "۲۸٪" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={logoSize === opt.value}
                      onClick={() => setLogoSize(opt.value)}
                      className={logoSize === opt.value ? "admin-button" : "admin-button is-secondary"}
                    >
                      {opt.label} <small style={{ opacity: 0.75 }}>({opt.hint})</small>
                    </button>
                  ))}
                </div>
                <small>بزرگ‌تر از ۳۰٪ خوانایی QR را کم می‌کند؛ «متوسط» امن‌ترین است.</small>
              </div>

              <label className="admin-check-field is-full"><input type="checkbox" checked={contrastBg} onChange={() => setContrastBg(!contrastBg)} /><span>اضافه کردن پس‌زمینهٔ سفید پشت لوگو برای خوانایی بهتر (پیشنهادی)</span></label>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="admin-button" type="submit" disabled={generating}>{generating ? "در حال تولید..." : "پیش‌نمایش"}</button>
                <button className="admin-button is-secondary" type="button" onClick={() => handleGenerate({ preview: false })} disabled={generating}>{generating ? "در حال تولید..." : "تولید"}</button>
                <button className="admin-button" type="button" onClick={handleDownload} disabled={!generatedBlobUrl}>دانلود</button>
                {/* <button className="admin-button" type="button" onClick={() => { if (previewDataUrl || generatedBlobUrl) setShowModal(true); }} disabled={!previewDataUrl && !generatedBlobUrl}>پیش‌نمایش چاپ</button> */}
                <button className="admin-text-button" type="button" onClick={() => { setLogoUrl(defaultLogoUrl || null); setLogoSize("medium"); setPreviewDataUrl(null); setGeneratedBlobUrl(null); }}>بازنشانی</button>
              </div>

              {notice && <p className="admin-field-error" role="alert" style={{ marginTop: 12 }}>{notice}</p>}

              <div style={{ marginTop: 16, color: "#8da57d", fontSize: 12 }}>
                <strong style={{ color: "#d8efd0" }}>راهنما:</strong>
                <ul style={{ margin: "8px 0 0 18px", padding: 0, lineHeight: 1.9 }}>
                  <li>اگر لوگو خیلی بزرگ باشد، سرور آن را مقیاس می‌کند تا درون QR جا بگیرد.</li>
                  <li>در صورتی که QR برای چاپ است، از فرمت SVG استفاده کنید.</li>
                </ul>
              </div>
            </form>

            <div>
              <div className="admin-card" style={{ minHeight: 360 }}>
                <h3>پیش‌نمایش</h3>
                <div className="admin-qr-preview">
                  {previewDataUrl ? (
                    <img src={previewDataUrl} alt="QR preview" />
                  ) : (
                    <div className="admin-qr-empty">
                      <Icon name="eye" />
                      <div>برای دیدن پیش‌نمایش، روی «پیش‌نمایش» کلیک کنید.</div>
                    </div>
                  )}
                </div>

                <div className="admin-qr-meta">
                  <button className="admin-button" type="button" onClick={() => { if (generatedBlobUrl) window.open(generatedBlobUrl, "_blank"); }} disabled={!generatedBlobUrl}><Icon name="eye" />مشاهده کامل</button>
                  <button className="admin-button is-secondary" type="button" onClick={handleDownload} disabled={!generatedBlobUrl}><Icon name="download" />دانلود</button>
                  {/* <button className="admin-button" type="button" onClick={() => setShowModal(true)} disabled={!previewDataUrl && !generatedBlobUrl}><Icon name="settings" />پیش‌نمایش چاپ</button> */}
                  <small>{formIsDirty ? "پیکربندی تغییر کرده" : "پیکربندی پیش‌فرض"}</small>
                </div>
              </div>

              {/* <div className="admin-card" style={{ marginTop: 20 }}>
                <h4>گزینه‌های پیشرفته</h4>
                <label className="admin-field">
                  <span>تنظیمات چاپ (برای پیش‌نمایش پیشرفته)</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <label className="admin-text-button">صفحه:
                      <select value={pageSize} onChange={(e) => setPageSize(e.target.value as any)} style={{ marginRight: 8 }}><option value="A4">A4</option><option value="Letter">Letter</option></select>
                    </label>
                    <label className="admin-text-button">جهت:
                      <select value={orientation} onChange={(e) => setOrientation(e.target.value as any)} style={{ marginRight: 8 }}><option value="portrait">عمودی</option><option value="landscape">افقی</option></select>
                    </label>
                  </div>
                </label>
                <label className="admin-field"><span>Bleed (mm)</span><input type="number" min={0} max={20} value={bleedMm} onChange={(e) => setBleedMm(Number(e.target.value))} /></label>
                <small style={{ color: "#8d9d82" }}>Bleed مقدار برش اضافه برای چاپ است. اگر می‌خواهید QR نزدیک حاشیه چاپ شود، مقدار را افزایش دهید (مثلاً 3mm).</small>
              </div> */}
            </div>
          </div>
        </div>
      </section>

      {showModal && (
        <div className="admin-modal-layer">
          <button className="overlay-scrim" type="button" onClick={() => setShowModal(false)} aria-label="بستن پنجره" />
          <section className="admin-modal is-compact" role="dialog" aria-modal="true">
            <header className="admin-modal-header"><h2>پیش‌نمایش چاپی QR</h2><button className="sheet-close" type="button" onClick={() => setShowModal(false)} aria-label="بستن"><Icon name="close" /></button></header>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="admin-field"><span>Bleed (mm)</span><input type="number" min={0} max={20} value={bleedMm} onChange={(e) => setBleedMm(Number(e.target.value))} /></label>
                  <label className="admin-field"><span>صفحه</span><select value={pageSize} onChange={(e) => setPageSize(e.target.value as any)}><option value="A4">A4</option><option value="Letter">Letter</option></select></label>
                  <label className="admin-field"><span>جهت</span><select value={orientation} onChange={(e) => setOrientation(e.target.value as any)}><option value="portrait">عمودی</option><option value="landscape">افقی</option></select></label>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="admin-button" onClick={() => exportAsPdf(resolution, bleedMm)}>Export to PDF / Print</button>
                    <button className="admin-text-button" onClick={() => setShowModal(false)}>بستن</button>
                  </div>
                </div>
                <div style={{ width: 360, height: 480, border: "1px solid #e6e6e6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {(previewDataUrl || generatedBlobUrl) ? <img src={previewDataUrl || generatedBlobUrl || ""} alt="preview" style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <div style={{ color: "#999" }}>ابتدا پیش‌نمایش بسازید</div>}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
