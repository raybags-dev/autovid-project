/**
 * Centralised site configuration — every user-facing string, URL, and brand
 * value flows through here. Override via environment variables in your
 * frontend/.env.local (dev) or frontend/.env.production (prod) file.
 *
 * All keys use the VITE_ prefix so Vite inlines them at build time.
 * Defaults are generic placeholders; set real values per-deployment.
 */

export const SITE = {
  /** Application name shown in titles, footers, legal docs */
  name: import.meta.env.VITE_APP_NAME || "AutoVid",

  /** One-line tagline used in hero sections and meta descriptions */
  tagline: import.meta.env.VITE_APP_TAGLINE || "AI-Powered Video Automation",

  /** Full description for meta/og tags */
  description:
    import.meta.env.VITE_APP_DESCRIPTION ||
    "Generate, assemble, caption, and publish AI-powered videos automatically.",

  /** Canonical origin (no trailing slash) */
  url: import.meta.env.VITE_APP_URL || "https://your-domain.com",

  // ── Contact ────────────────────────────────────────────────────────────────
  contact: {
    support: import.meta.env.VITE_SUPPORT_EMAIL || "support@your-domain.com",
    general: import.meta.env.VITE_CONTACT_EMAIL || "contact@your-domain.com",
  },

  // ── Social ─────────────────────────────────────────────────────────────────
  social: {
    youtube: import.meta.env.VITE_YOUTUBE_URL || "",
    tiktok: import.meta.env.VITE_TIKTOK_URL || "",
    spotify: import.meta.env.VITE_SPOTIFY_URL || "",
    spotifyShowId: import.meta.env.VITE_SPOTIFY_SHOW_ID || "",
  },

  // ── Legal ──────────────────────────────────────────────────────────────────
  legal: {
    privacyUpdated: import.meta.env.VITE_PRIVACY_UPDATED || "March 2026",
    termsUpdated: import.meta.env.VITE_TERMS_UPDATED || "March 2026",
    cookieConsentKey:
      import.meta.env.VITE_COOKIE_CONSENT_KEY || "autovid_cookie_consent",
  },

  // ── API ────────────────────────────────────────────────────────────────────
  /** Base URL for the backend API (dev: proxied via Vite, prod: absolute) */
  apiUrl: import.meta.env.VITE_API_URL || "",
};

/**
 * Derive the displayed domain from SITE.url (strips protocol).
 * e.g. "https://your-domain.com" → "your-domain.com"
 */
export const SITE_DOMAIN = SITE.url.replace(/^https?:\/\//, "");

/**
 * Build an absolute URL by appending a path to SITE.url.
 * e.g. siteUrl("/blog") → "https://your-domain.com/blog"
 */
export function siteUrl(path = "") {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
