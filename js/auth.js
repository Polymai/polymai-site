(function () {
  const root = window.Polymai || {};
  const config = root.config || {};
  let client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase Auth library is not loaded.");
    }
    const supabaseConfig = config.supabase || {};
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      throw new Error("Supabase Auth is not configured yet.");
    }
    client = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        storageKey: supabaseConfig.authStorageKey || config.storageKey?.("auth"),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return client;
  }

  function pageUrl(path) {
    return new URL(path, window.location.href).toString();
  }

  async function getSession() {
    const auth = getClient();
    const { data, error } = await auth.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getAccessToken() {
    const session = await getSession();
    return session && session.access_token ? session.access_token : "";
  }

  async function signInWithEmail(email) {
    const auth = getClient();
    const { error } = await auth.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: pageUrl("account.html"),
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    const auth = getClient();
    await auth.auth.signOut();
  }

  async function callAction(action, payload, options) {
    const token = await getAccessToken();
    if (!token) throw new Error("Sign in to continue.");
    return root.api.callAction(action, payload || {}, Object.assign({}, options || {}, {
      headers: Object.assign({}, options?.headers || {}, {
        Authorization: "Bearer " + token,
      }),
    }));
  }

  root.auth = {
    callAction,
    getAccessToken,
    getClient,
    getSession,
    pageUrl,
    signInWithEmail,
    signOut,
  };

  window.Polymai = root;
})();
