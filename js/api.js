(function () {
  const root = window.Polymai || {};
  const config = root.config || {};

  function getFunctionsBaseUrl() {
    const fromConfig = config.supabase && config.supabase.functionsBaseUrl;
    if (fromConfig) return fromConfig.replace(/\/$/, "");
    const projectUrl = config.supabase && config.supabase.url;
    return projectUrl ? projectUrl.replace(/\/$/, "") + "/functions/v1" : "";
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs || 12000);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function readJsonResponse(response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("Response was not valid JSON.");
    }
  }

  async function getJson(path, options) {
    const response = await fetchWithTimeout(path, { cache: options?.cache || "default" }, 10000);
    const body = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(body.message || "Could not load " + path + ".");
    }
    return body;
  }

  async function callFunction(name, payload, options) {
    const baseUrl = getFunctionsBaseUrl();
    if (!baseUrl) {
      throw new Error("This action is not ready yet.");
    }
    const extraHeaders = options && options.headers ? options.headers : {};
    const timeoutMs = Number(options && options.timeoutMs);

    const response = await fetchWithTimeout(
      baseUrl + "/" + encodeURIComponent(name),
      {
        method: "POST",
        headers: Object.assign({
          "apikey": config.supabase?.anonKey || "",
          "Authorization": "Bearer " + (config.supabase?.anonKey || ""),
          "Content-Type": "application/json",
        }, extraHeaders),
        body: JSON.stringify(payload || {}),
      },
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000
    );
    const body = await readJsonResponse(response);
    if (!response.ok || body.error) {
      throw new Error(body.message || body.error || "Request failed.");
    }
    return body;
  }

  async function callAction(action, payload, options) {
    const apiName = config.functions && config.functions.api;
    if (!apiName) {
      throw new Error("This action is not ready yet.");
    }
    return callFunction(apiName, {
      action,
      payload: payload || {},
    }, options);
  }

  root.api = {
    callAction,
    callFunction,
    getJson,
  };

  window.Polymai = root;
})();
