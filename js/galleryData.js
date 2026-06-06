(function () {
  const root = window.Polymai || {};
  const config = root.config || {};
  const api = root.api || {};
  const CACHE_VERSION = "v2";
  const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
  const REFRESH_TRIGGER_VERSION = "v1";
  const GALLERY_UPDATED_EVENT = "polymai:gallery-updated";
  const GENERIC_SUMMARY_PATTERN = /^(a polymai app build discovered from github|a focused app build prepared for launch)\.?$/i;

  function normalizeText(value, fallback) {
    return String(value || fallback || "").trim();
  }

  function normalizeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function fallbackDescription(title, focus) {
    const focusLabel = GENERIC_SUMMARY_PATTERN.test(focus) || /^github build$/i.test(focus) ? "app" : focus.toLowerCase();
    return title + " is a live Polymai " + focusLabel + " preview with an embeddable product surface and a full-screen example to inspect.";
  }

  function normalizeDescription(item, title, focus) {
    const raw = normalizeText(item.description || item.metaDescription || item.summary, "");
    if (raw && !GENERIC_SUMMARY_PATTERN.test(raw)) return raw.slice(0, 300);
    return fallbackDescription(title, focus);
  }

  function normalizeItem(item, index) {
    const focus = normalizeText(item.focus, "Workflow");
    const title = normalizeText(item.title, "Untitled build");
    const description = normalizeDescription(item, title, focus);
    const screenStatus = normalizeText(item.screenStatus, "");
    return {
      id: normalizeText(item.id, "build-" + index),
      title,
      focus,
      audience: normalizeText(item.audience, "Growing teams"),
      industry: normalizeText(item.industry, "Operations"),
      summary: description,
      description,
      status: screenStatus === "needs-check" ? "Needs check" : normalizeText(item.status, "Ready"),
      impact: screenStatus === "needs-check" ? "Check publish" : normalizeText(item.impact, "Launch-ready"),
      url: normalizeText(item.url, ""),
      previewUrl: normalizeText(item.previewUrl || item.embedUrl || item.url, ""),
      screenStatus,
      screenStatusCode: normalizeNumber(item.screenStatusCode, 0),
      publishedAt: normalizeText(item.publishedAt || item.updatedAt, ""),
      updatedAt: normalizeText(item.updatedAt || item.publishedAt, ""),
      repo: normalizeText(item.repo, ""),
      manifest: normalizeText(item.manifest, ""),
    };
  }

  function normalizeItems(data) {
    const apps = Array.isArray(data.apps) ? data.apps : [];
    return apps.map(normalizeItem);
  }

  function cacheTtlMs() {
    const configured = Number(config.gallery && config.gallery.cacheTtlMs);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CACHE_TTL_MS;
  }

  function cacheKey() {
    return config.storageKey ? config.storageKey("gallery-index:" + CACHE_VERSION) : "polymai:gallery-index:" + CACHE_VERSION;
  }

  function refreshTriggerKey() {
    return config.storageKey ? config.storageKey("gallery-refresh-trigger:" + REFRESH_TRIGGER_VERSION) : "polymai:gallery-refresh-trigger:" + REFRESH_TRIGGER_VERSION;
  }

  function parseDateMs(value) {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function shouldTriggerRefresh(data) {
    if (!api.callFunction || !config.functions || !config.functions.galleryRefreshTrigger) return false;
    if (["localhost", "127.0.0.1", ""].includes(window.location.hostname)) return false;
    const generatedAt = parseDateMs(data && data.generatedAt);
    if (!generatedAt) return false;
    if (Date.now() - generatedAt < cacheTtlMs()) return false;
    try {
      const lastAttemptAt = Number(localStorage.getItem(refreshTriggerKey()) || "0");
      if (Number.isFinite(lastAttemptAt) && Date.now() - lastAttemptAt < cacheTtlMs()) return false;
      localStorage.setItem(refreshTriggerKey(), String(Date.now()));
    } catch (error) {
      return false;
    }
    return true;
  }

  function maybeTriggerRefresh(data) {
    if (!shouldTriggerRefresh(data)) return;
    api.callFunction(config.functions.galleryRefreshTrigger, {
      generatedAt: data.generatedAt || "",
      source: data.source || "",
    }).catch(() => undefined);
  }

  function readCachedGalleryItems(allowStale) {
    try {
      const raw = localStorage.getItem(cacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const savedAt = Number(parsed.savedAt || 0);
      const items = Array.isArray(parsed.items) ? parsed.items.map((item, index) => normalizeItem(item, index)) : [];
      if (!items.length) return null;
      const fresh = Date.now() - savedAt < cacheTtlMs();
      return fresh || allowStale ? items : null;
    } catch (error) {
      return null;
    }
  }

  function writeCachedGalleryItems(items) {
    try {
      if (!Array.isArray(items) || !items.length) return;
      localStorage.setItem(cacheKey(), JSON.stringify({
        savedAt: Date.now(),
        items,
      }));
    } catch (error) {
      return undefined;
    }
  }

  async function loadStaticGalleryItems() {
    const data = await api.getJson(config.dataPaths.galleryIndexBase + ".json", { cache: "no-store" });
    maybeTriggerRefresh(data);
    return normalizeItems(data);
  }

  async function loadDynamicGalleryItems() {
    if (!api.callFunction || !config.functions || !config.functions.galleryIndex) {
      throw new Error("Live gallery source is not configured.");
    }
    const data = await api.callFunction(config.functions.galleryIndex, { mode: "github" });
    return normalizeItems(data);
  }

  function publishGalleryItems(items) {
    if (!Array.isArray(items) || !items.length) return;
    window.dispatchEvent(new CustomEvent(GALLERY_UPDATED_EVENT, {
      detail: {
        items,
      },
    }));
  }

  function refreshDynamicGalleryItems() {
    const request = loadDynamicGalleryItems();
    request.then((dynamicItems) => {
      if (!dynamicItems.length) return;
      writeCachedGalleryItems(dynamicItems);
      publishGalleryItems(dynamicItems);
    }).catch(() => undefined);
    return request;
  }

  async function loadGalleryItems() {
    const dynamicRequest = refreshDynamicGalleryItems();

    try {
      const staticItems = await loadStaticGalleryItems();
      writeCachedGalleryItems(staticItems);
      return staticItems;
    } catch (error) {
      try {
        const dynamicItems = await dynamicRequest;
        if (dynamicItems.length) {
          writeCachedGalleryItems(dynamicItems);
          return dynamicItems;
        }
      } catch {
        // Keep the static/stale fallback error path below.
      }
      const stale = readCachedGalleryItems(true);
      if (stale) return stale;
      throw error;
    }
  }

  root.galleryData = {
    GALLERY_UPDATED_EVENT,
    loadGalleryItems,
  };

  window.Polymai = root;
})();
