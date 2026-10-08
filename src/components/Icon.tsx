export type IconName =
  | "arrow-down" | "arrow-left" | "arrow-up" | "arrow-up-right"
  | "check" | "clock" | "close" | "download" | "edit" | "eye" | "eye-off"
  | "instagram" | "link" | "location" | "lock" | "logout" | "minus" | "menu" | "plus"
  | "save" | "search" | "settings" | "share" | "trash" | "upload";

export default function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "arrow-down":
      return <svg {...common}><path d="M12 4v15M6 13l6 6 6-6" /></svg>;
    case "arrow-left":
      return <svg {...common}><path d="M19 12H5m7 7-7-7 7-7" /></svg>;
    case "arrow-up":
      return <svg {...common}><path d="M12 20V5m-6 6 6-6 6 6" /></svg>;
    case "arrow-up-right":
      return <svg {...common}><path d="M7 17 17 7M8 7h9v9" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case "download":
      return <svg {...common}><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" /></svg>;
    case "edit":
      return <svg {...common}><path d="m15 4 5 5M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z" /></svg>;
    case "eye":
      return <svg {...common}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "eye-off":
      return <svg {...common}><path d="m3 3 18 18M10.6 5.1A11.3 11.3 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.1 4.1M6.5 6.5A17 17 0 0 0 2 12s3 7 10 7a11.2 11.2 0 0 0 5.1-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
    case "instagram":
      return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.5" /><path d="M17.6 6.7h.01" /></svg>;
    case "link":
      return <svg {...common}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
    case "location":
      return <svg {...common}><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></svg>;
    case "lock":
      return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>;
    case "logout":
      return <svg {...common}><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M13 8l4 4-4 4M8 12h12" /></svg>;
    case "minus":
      return <svg {...common}><path d="M5 12h14" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "save":
      return <svg {...common}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></svg>;
    case "search":
      return <svg {...common}><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.5 4.5" /></svg>;
    case "settings":
      return <svg {...common}><path d="m9 3-.7 2.3-2 .9L4 5.8 2 9l1.9 1.7v2.6L2 15l2 3.2 2.3-.4 2 .9L9 21h6l.7-2.3 2-.9 2.3.4 2-3.2-1.9-1.7v-2.6L22 9l-2-3.2-2.3.4-2-.9L15 3H9Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "share":
      return <svg {...common}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5m-7.6 7 7.6 4.5" /></svg>;
    case "trash":
      return <svg {...common}><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>;
    case "upload":
      return <svg {...common}><path d="M12 16V3m-4 4 4-4 4 4M4 16v4h16v-4" /></svg>;
    default:
      return null;
  }
}