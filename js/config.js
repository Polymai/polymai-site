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
    },
    functions: {
      leadCapture: "app684-polymai-com-polymai-lead-capture",
      galleryRefreshTrigger: "app684-polymai-com-gallery-refresh-trigger",
    },
    supabase: supabaseConfig,
    storageKey,
  });

  window.Polymai = root;
})();
