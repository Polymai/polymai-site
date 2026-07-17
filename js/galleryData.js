(function () {
  const root = window.Polymai || {};
  const config = root.config || {};
  const api = root.api || {};
  const CACHE_VERSION = "v2";
  const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
  const GITHUB_API_BASE = "https://api.github.com";
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

  function normalizePayload(data) {
    const items = normalizeItems(data || {});
    return {
      items,
      generatedAtMs: parseDateMs(data && data.generatedAt),
      count: normalizeNumber(data && data.count, items.length),
      cached: Boolean(data && data.cached),
      stale: Boolean(data && data.stale),
      source: normalizeText(data && data.source, ""),
    };
  }

  function shouldPreferPayload(candidate, current) {
    if (!candidate || !Array.isArray(candidate.items) || !candidate.items.length) return false;
    if (!current || !Array.isArray(current.items) || !current.items.length) return true;
    const candidateTime = Number(candidate.generatedAtMs || 0);
    const currentTime = Number(current.generatedAtMs || 0);
    if (candidateTime && currentTime && candidateTime > currentTime + 1000) return true;
    if (candidate.items.length > current.items.length) return true;
    if (!candidate.stale && current.stale) return true;
    return false;
  }

  function titleFromSlug(value) {
    return normalizeText(value, "Polymai build")
      .replace(/^app\d+[-_]?/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function githubOwner() {
    return normalizeText(config.github && config.github.owner, "Polymai");
  }

  function githubRepoLimit() {
    const parsed = Number(config.github && config.github.repoLimit);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.floor(parsed))) : 80;
  }

  function githubPagesBase() {
    return normalizeText(config.github && config.github.pagesBase, "https://polymai.github.io").replace(/\/+$/, "");
  }

  function githubPagesUrlForRepo(repo) {
    const name = normalizeText(repo && repo.name, "");
    const base = githubPagesBase();
    return name && base ? base + "/" + encodeURIComponent(name) + "/" : "";
  }

  function repoMatches(repo) {
    const name = normalizeText(repo && repo.name, "").toLowerCase();
    return Boolean(name) && !repo.archived && !repo.fork && name !== "polymai-site";
  }

  async function githubFetchJson(path, optional) {
    const response = await fetchWithGithubTimeout(GITHUB_API_BASE + path, 10000);
    if (optional && response.status === 404) return null;
    if (!response.ok) {
      throw new Error("GitHub returned HTTP " + response.status + ".");
    }
    return response.json();
  }

  async function fetchWithGithubTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs || 10000);
    try {
      return await fetch(url, {
        headers: {
          "Accept": "application/vnd.github+json",
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function listGithubRepos() {
    const owner = encodeURIComponent(githubOwner());
    const limit = githubRepoLimit();
    try {
      return await githubFetchJson("/orgs/" + owner + "/repos?type=public&sort=updated&direction=desc&per_page=" + limit, false);
    } catch (error) {
      return githubFetchJson("/users/" + owner + "/repos?type=public&sort=updated&direction=desc&per_page=" + limit, false);
    }
  }

  function appFromGithubRepo(repo, pagesUrl, index) {
    const repoName = normalizeText(repo && repo.name, "polymai-build");
    const title = titleFromSlug(repoName);
    const url = normalizeText(pagesUrl || repo.homepage, "") || githubPagesUrlForRepo(repo);
    const description = normalizeText(repo && repo.description, "") || fallbackDescription(title, "GitHub build");
    return normalizeItem({
      id: repoName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title,
      focus: "GitHub build",
      audience: "Polymai customers",
      industry: "Custom software",
      summary: description,
      description,
      status: "Live app",
      impact: "Open live app",
      url,
      previewUrl: url,
      publishedAt: repo && repo.updated_at,
      updatedAt: repo && repo.updated_at,
      repo: repo && repo.full_name,
    }, index);
  }

  async function loadGithubPagesItems() {
    const repos = (await listGithubRepos()).filter(repoMatches);
    return repos.map((repo, index) => appFromGithubRepo(
      repo,
      normalizeText(repo && repo.homepage, "") || githubPagesUrlForRepo(repo),
      index
    ));
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
    if (!config.gallery || !config.gallery.autoRefreshTriggerOnVisit) return false;
    if (!api.callAction || !config.actions || !config.actions.galleryRefresh) return false;
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
    api.callAction(config.actions.galleryRefresh, {
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

  async function loadStaticGalleryPayload() {
    const data = await api.getJson(config.dataPaths.galleryIndexBase + ".json", { cache: "no-store" });
    maybeTriggerRefresh(data);
    return normalizePayload(data);
  }

  async function loadStaticGalleryItems() {
    return (await loadStaticGalleryPayload()).items;
  }

  async function loadApiGalleryPayload(refresh) {
    if (!api.callAction || !config.actions || !config.actions.galleryIndex) {
      throw new Error("Live gallery source is not configured.");
    }
    const mode = refresh ? "github" : normalizeText(config.gallery && config.gallery.liveIndexMode, "cached");
    const data = await api.callAction(
      config.actions.galleryIndex,
      refresh ? { mode, refresh: true } : { mode },
      { timeoutMs: refresh ? 45000 : 15000 }
    );
    return normalizePayload(data);
  }

  async function loadApiGalleryItems(refresh) {
    return (await loadApiGalleryPayload(refresh)).items;
  }

  async function loadDynamicGalleryPayload() {
    try {
      return await loadApiGalleryPayload(false);
    } catch (error) {
      if (config.github && config.github.browserDiscovery) {
        const githubItems = await loadGithubPagesItems();
        if (githubItems.length) {
          return {
            items: githubItems,
            generatedAtMs: Date.now(),
            count: githubItems.length,
            cached: false,
            stale: false,
            source: "browser-github",
          };
        }
      }
      throw error;
    }
  }

  async function loadDynamicGalleryItems() {
    return (await loadDynamicGalleryPayload()).items;
  }

  async function loadFreshGalleryItems() {
    if (!config.gallery || !config.gallery.forceRefreshOnVisit) {
      return [];
    }
    if (config.github && config.github.browserDiscovery) {
      try {
        const githubItems = await loadGithubPagesItems();
        if (githubItems.length) return githubItems;
      } catch (error) {
        // Fall back to the app API router when direct public GitHub discovery is unavailable.
      }
    }
    return loadApiGalleryItems(true);
  }

  function publishGalleryItems(items) {
    if (!Array.isArray(items) || !items.length) return;
    window.dispatchEvent(new CustomEvent(GALLERY_UPDATED_EVENT, {
      detail: {
        items,
      },
    }));
  }

  function shouldUseLiveIndexOnVisit() {
    return Boolean(config.gallery && config.gallery.liveIndexOnVisit);
  }

  function refreshDynamicGalleryItems(currentPayload) {
    if (!shouldUseLiveIndexOnVisit()) {
      return Promise.resolve(null);
    }
    const request = loadDynamicGalleryPayload();
    request.then((dynamicPayload) => {
      if (!shouldPreferPayload(dynamicPayload, currentPayload)) return;
      writeCachedGalleryItems(dynamicPayload.items);
      publishGalleryItems(dynamicPayload.items);
    }).catch(() => undefined);
    loadFreshGalleryItems().then((freshItems) => {
      if (!freshItems.length) return;
      writeCachedGalleryItems(freshItems);
      publishGalleryItems(freshItems);
    }).catch(() => undefined);
    return request;
  }

  async function loadGalleryItems() {
    if (!shouldUseLiveIndexOnVisit()) {
      try {
        const staticPayload = await loadStaticGalleryPayload();
        writeCachedGalleryItems(staticPayload.items);
        return staticPayload.items;
      } catch (error) {
        const cached = readCachedGalleryItems(true);
        if (cached) return cached;
        throw error;
      }
    }

    let staticPayload = null;
    try {
      staticPayload = await loadStaticGalleryPayload();
      writeCachedGalleryItems(staticPayload.items);
      refreshDynamicGalleryItems(staticPayload);
      return staticPayload.items;
    } catch {
      // Fall back to the cached live endpoint below.
    }

    try {
      const dynamicPayload = await Promise.race([
        loadDynamicGalleryPayload(),
        new Promise((resolve) => window.setTimeout(() => resolve([]), 2200)),
      ]);
      if (dynamicPayload && Array.isArray(dynamicPayload.items) && dynamicPayload.items.length) {
        writeCachedGalleryItems(dynamicPayload.items);
        return dynamicPayload.items;
      }
    } catch {
      // Keep the stale fallback error path below.
    }

    const stale = readCachedGalleryItems(true);
    if (stale) return stale;
    return [];
  }

  root.galleryData = {
    GALLERY_UPDATED_EVENT,
    loadGalleryItems,
  };

  window.Polymai = root;
})();
