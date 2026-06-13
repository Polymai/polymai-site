(function () {
  const root = window.Polymai || {};
  const supabaseConfig = window.__POLYMAI_SUPABASE_CONFIG__ || {};
  const fallbackStoragePrefix = "polymai:app684:";

  function storageKey(name) {
    return String(supabaseConfig.appStoragePrefix || fallbackStoragePrefix) + String(name || "");
  }

  root.config = Object.freeze({
    appId: "app684",
    appName: "Polymai",
    appSchema: "app684_polymai",
    dataPaths: {
      galleryIndexBase: "data/polymai-apps-index",
    },
    gallery: {
      cacheTtlMs: 10 * 60 * 1000,
      liveIndexOnVisit: true,
      liveIndexMode: "cached",
      autoRefreshTriggerOnVisit: false,
      forceRefreshOnVisit: false,
    },
    github: {
      owner: "Polymai",
      pagesBase: "https://polymai.github.io",
      repoLimit: 45,
      browserDiscovery: false,
    },
    functions: {
      api: "app684-polymai-com-api",
    },
    actions: {
      leadCapture: "lead.capture",
      galleryIndex: "gallery.index",
      galleryRefresh: "gallery.refresh",
    },
    supabase: supabaseConfig,
    storageKey,
  });

  window.Polymai = root;
})();
