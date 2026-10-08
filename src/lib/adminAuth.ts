const SESSION_KEY = "stage.admin.session.v1";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
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

export type AdminSession = {
  username: string;
  expiresAt: number;
};

export function isAdminSessionValid(session: AdminSession | null): session is AdminSession {
  const now = Date.now();
  return session !== null
    && typeof session.username === "string"
    && session.username.trim().length > 0
    && Number.isFinite(session.expiresAt)
    && session.expiresAt > now
    && session.expiresAt <= now + SESSION_DURATION_MS;
}

export function clearAdminSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // The React session is also cleared when browser storage is unavailable.
  }
  fetch(apiUrl("/api/admin/logout"), { method: "POST", credentials: "include" }).catch(() => undefined);
}

export function readAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && "username" in value && "expiresAt" in value && typeof value.username === "string" && typeof value.expiresAt === "number") {
      const session = { username: value.username, expiresAt: value.expiresAt };
      if (isAdminSessionValid(session)) return session;
    }
  } catch {
    // Malformed or inaccessible storage always starts at the login screen.
  }
  clearAdminSession();
  return null;
}

export async function authenticateAdmin(username: string, password: string): Promise<AdminSession | null> {
  const response = await fetch(apiUrl("/api/admin/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) return null;

  const payload: { ok?: boolean; user?: { username?: string }; expiresAt?: number } = await response.json().catch(() => ({}));
  const session = {
    username: payload.user?.username ?? username.trim(),
    expiresAt: payload.expiresAt ?? Date.now() + SESSION_DURATION_MS,
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Login still works in memory; a reload will require signing in again.
  }

  return session;
}

export async function hydrateAdminSession(): Promise<AdminSession | null> {
  try {
    const response = await fetch(apiUrl("/api/admin/session"), { credentials: "include" });
    if (!response.ok) return null;
    const payload: { authenticated?: boolean; user?: { username?: string }; expiresAt?: number } = await response.json().catch(() => ({}));
    if (!payload.authenticated || !payload.user?.username) return null;
    const session = { username: payload.user.username, expiresAt: payload.expiresAt ?? Date.now() + SESSION_DURATION_MS };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Ignored when storage is unavailable.
    }
    return session;
  } catch {
    return readAdminSession();
  }
}