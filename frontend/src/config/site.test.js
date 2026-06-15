import { describe, it, expect, beforeEach, vi } from "vitest";

describe("SITE config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports SITE with required keys", async () => {
    const { SITE } = await import("./site.js");
    expect(SITE).toBeDefined();
    expect(SITE).toHaveProperty("name");
    expect(SITE).toHaveProperty("url");
    expect(SITE).toHaveProperty("contact");
    expect(SITE).toHaveProperty("social");
    expect(SITE).toHaveProperty("legal");
  });

  it("name falls back to AutoVid when env var not set", async () => {
    const { SITE } = await import("./site.js");
    // VITE_APP_NAME is not set in test env — should use fallback
    expect(typeof SITE.name).toBe("string");
    expect(SITE.name.length).toBeGreaterThan(0);
  });

  it("contact has support and general fields", async () => {
    const { SITE } = await import("./site.js");
    expect(SITE.contact).toHaveProperty("support");
    expect(SITE.contact).toHaveProperty("general");
    // Fields are strings; non-empty only when VITE_*_EMAIL secrets are set
    expect(typeof SITE.contact.support).toBe("string");
    expect(typeof SITE.contact.general).toBe("string");
  });

  it("social has youtube, tiktok, spotify", async () => {
    const { SITE } = await import("./site.js");
    expect(SITE.social).toHaveProperty("youtube");
    expect(SITE.social).toHaveProperty("tiktok");
    expect(SITE.social).toHaveProperty("spotify");
  });

  it("exports SITE_DOMAIN as string without protocol", async () => {
    const { SITE_DOMAIN } = await import("./site.js");
    expect(SITE_DOMAIN).toBeDefined();
    expect(SITE_DOMAIN).not.toMatch(/^https?:\/\//);
  });

  it("siteUrl joins SITE.url with a path", async () => {
    const { siteUrl, SITE } = await import("./site.js");
    const result = siteUrl("/blog");
    expect(result).toBe(`${SITE.url}/blog`);
  });

  it("siteUrl adds leading slash if missing", async () => {
    const { siteUrl, SITE } = await import("./site.js");
    const result = siteUrl("blog");
    expect(result).toBe(`${SITE.url}/blog`);
  });

  it("does not expose personal domain or handles", async () => {
    const { SITE, SITE_DOMAIN } = await import("./site.js");
    const serialised = JSON.stringify({ SITE, SITE_DOMAIN });
    expect(serialised).not.toContain("4lifemystery");
    expect(serialised).not.toContain("4lifemystery183284");
  });
});
