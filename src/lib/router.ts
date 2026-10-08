export type ParsedRoute =
  | { screen: "profile"; openSheet: boolean }
  | { screen: "menu"; categoryId?: string }
  | { screen: "admin" };

export const routeLinks = {
  home: () => "#/",
  categories: () => "#/categories",
  menu: () => "#/menu",
  category: (categoryId: string) => `#/category/${encodeURIComponent(categoryId)}`,
  admin: () => "#/admin",
  adminQr: () => "#/admin/qrcode",
};

export function normalizeRoutePath(hashOrPath: string): string {
  return hashOrPath.replace(/^#\/?/, "").replace(/\/+$/, "").trim();
}

export function isAdminRoute(hash: string, pathname = ""): boolean {
  const clean = normalizeRoutePath(hash);
  return Boolean(clean && /^admin(?:\/qrcode)?\/?$/i.test(clean))
    || (!hash && /\/admin(?:\/qrcode)?\/?$/i.test(pathname));
}

export function isAdminQrRoute(hash: string, pathname = ""): boolean {
  const clean = normalizeRoutePath(hash);
  return Boolean(clean && /^admin\/qrcode\/?$/i.test(clean))
    || (!hash && /\/admin\/qrcode\/?$/i.test(pathname));
}

export function getAbsoluteUrl(hashPath: string): string {
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${base}${hashPath}`;
}

export function parseCurrentRoute(hash: string, pathname: string): ParsedRoute {
  if (!hash && /\/admin(?:\/qrcode)?\/?$/i.test(pathname)) {
    return { screen: "admin" };
  }

  const clean = normalizeRoutePath(hash);
  if (!clean || clean === "/") {
    return { screen: "profile", openSheet: false };
  }

  if (/^categories\/?$/i.test(clean) || /^menu\/categories\/?$/i.test(clean)) {
    return { screen: "profile", openSheet: true };
  }

  if (isAdminRoute(hash, pathname)) {
    return { screen: "admin" };
  }

  // Matches #/category/:id or #/products/:id or #/menu/:id
  const categoryMatch = clean.match(/^(?:category|products|menu\/products)\/([^/?#]+)/i);
  if (categoryMatch) {
    try {
      return { screen: "menu", categoryId: decodeURIComponent(categoryMatch[1]) };
    } catch {
      return { screen: "menu", categoryId: categoryMatch[1] };
    }
  }

  // Matches #/menu?category=:id or #/products?category=:id
  const queryMatch = clean.match(/^(?:menu|products)\?(?:.*&)?category=([^&#]+)/i);
  if (queryMatch) {
    try {
      return { screen: "menu", categoryId: decodeURIComponent(queryMatch[1]) };
    } catch {
      return { screen: "menu", categoryId: queryMatch[1] };
    }
  }

  if (/^(?:menu|products)\/?$/i.test(clean)) {
    return { screen: "menu" };
  }

  // Default fallback
  return { screen: "profile", openSheet: false };
}
