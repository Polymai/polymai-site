(function () {
  const root = window.Polymai || {};
  let lastSummary = null;
  let loadingDepth = 0;

  function qs(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = qs(id);
    if (el) el.textContent = String(value ?? "");
  }

  function setStatus(message, state) {
    const status = qs("accountStatus");
    if (!status) return;
    const textEl = status.querySelector(".account-status-text") || status;
    textEl.textContent = message || "";
    status.classList.toggle("is-success", state === "success");
    status.classList.toggle("is-error", state === "error");
    status.classList.toggle("is-warning", state === "warning");
  }

  function setButtonsDisabled(disabled) {
    document.querySelectorAll("[data-checkout-plan], #billingPortalButton, #refreshInvoicesButton, #refreshAccountButton, #signOutButton, #refreshPluginTokensButton, #createPluginTokenButton, #copyPluginTokenButton, [data-token-revoke]").forEach((button) => {
      button.disabled = !!disabled || button.dataset.planDisabled === "true";
      button.setAttribute("aria-busy", disabled ? "true" : "false");
    });
  }

  function showLoader(title, detail) {
    loadingDepth += 1;
    const overlay = qs("accountLoadingOverlay");
    if (!overlay) return;
    setText("accountLoadingTitle", title || "Loading account");
    setText("accountLoadingDetail", detail || "Syncing your workspace, subscription, receipts, and app stats.");
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("account-is-loading");
    setButtonsDisabled(true);
  }

  function hideLoader(force) {
    loadingDepth = force ? 0 : Math.max(0, loadingDepth - 1);
    if (loadingDepth > 0) return;
    const overlay = qs("accountLoadingOverlay");
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
    }
    document.documentElement.classList.remove("account-is-loading");
    setButtonsDisabled(false);
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit" }).format(date);
  }

  function formatMoney(cents, currency) {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: String(currency || "eur").toUpperCase(),
    }).format(Number(cents || 0) / 100);
  }

  function planName(slug) {
    const value = String(slug || "free").toLowerCase();
    if (value === "pro") return "Pro";
    if (value === "studio") return "Studio";
    return "Free";
  }

  function renderApps(apps) {
    const list = qs("appsList");
    if (!list) return;
    if (!apps || !apps.length) {
      list.innerHTML = '<div class="account-empty">No apps recorded yet. Apps appear here after the VS Code extension reports a build.</div>';
      return;
    }
    list.innerHTML = apps.map((app) => {
      const title = app.display_name || app.app_key || "Untitled app";
      const key = app.app_key || "";
      return `
        <article class="account-row">
          <div>
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(key)}</span>
          </div>
          <div>
            <span class="account-pill">${escapeHtml(app.status || "created")}</span>
            <span>${formatDate(app.created_at)}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderInvoices(invoices) {
    const list = qs("invoiceList");
    if (!list) return;
    if (!invoices || !invoices.length) {
      list.innerHTML = '<div class="account-empty">No receipts yet. Stripe invoices appear after checkout and webhook sync.</div>';
      return;
    }
    list.innerHTML = invoices.map((invoice) => {
      const amount = formatMoney(invoice.amount_paid_cents || invoice.amount_due_cents, invoice.currency);
      const pdf = invoice.invoice_pdf ? `<a href="${escapeAttr(invoice.invoice_pdf)}" target="_blank" rel="noreferrer">PDF</a>` : "";
      const hosted = invoice.hosted_invoice_url ? `<a href="${escapeAttr(invoice.hosted_invoice_url)}" target="_blank" rel="noreferrer">Stripe</a>` : "";
      return `
        <article class="account-row">
          <div>
            <strong>${amount}</strong>
            <span>${formatDate(invoice.issued_at || invoice.created_at)}</span>
          </div>
          <div>
            <span class="account-pill">${escapeHtml(invoice.status || "unknown")}</span>
            <span class="account-links">${hosted}${pdf}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderPluginTokens(tokens) {
    const list = qs("pluginTokensList");
    if (!list) return;
    const rows = Array.isArray(tokens) ? tokens : [];
    if (!rows.length) {
      list.innerHTML = '<div class="account-empty">No plugin tokens yet. Create one above and paste it into the VS Code plugin.</div>';
      return;
    }
    const sorted = rows.slice().sort((a, b) => (a.revoked_at ? 1 : 0) - (b.revoked_at ? 1 : 0));
    list.innerHTML = sorted.map((token) => {
      const revoked = !!token.revoked_at;
      const bound = !!token.bound_at;
      const status = revoked ? "revoked" : bound ? "bound" : "unbound";
      const mask = token.token_prefix ? `${token.token_prefix}…${token.token_last4 || ""}` : "—";
      const usage = token.last_used_at ? `Last used ${formatDate(token.last_used_at)}` : "Not used yet";
      const revokeButton = revoked
        ? ""
        : `<button class="button button-secondary" type="button" data-token-revoke="${escapeAttr(token.id || "")}">Revoke</button>`;
      return `
        <article class="account-row account-token-row${revoked ? " is-revoked" : ""}">
          <div>
            <strong>${escapeHtml(token.name || "VS Code plugin")}</strong>
            <span class="account-token-mask">${escapeHtml(mask)}</span>
            <span>${escapeHtml(usage)}</span>
          </div>
          <div>
            <span class="account-pill account-pill--${status}">${escapeHtml(status)}</span>
            ${revokeButton}
          </div>
        </article>
      `;
    }).join("");
  }

  function setCheckoutButton(planSlug, label, disabled, hidden, primary) {
    const button = document.querySelector(`[data-checkout-plan="${planSlug}"]`);
    if (!button) return;
    button.textContent = label;
    button.hidden = !!hidden;
    button.dataset.planDisabled = disabled ? "true" : "false";
    button.disabled = !!disabled || document.documentElement.classList.contains("account-is-loading");
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
    button.classList.toggle("button-primary", !!primary);
    button.classList.toggle("button-secondary", !primary);
  }

  function renderPlanActions(planSlug) {
    const current = String(planSlug || "free").toLowerCase();
    if (current === "studio") {
      setCheckoutButton("pro", "Pro included", true, true, false);
      setCheckoutButton("studio", "Current Studio plan", true, false, false);
      return;
    }
    if (current === "pro") {
      setCheckoutButton("pro", "Current Pro plan", true, false, false);
      setCheckoutButton("studio", "Upgrade to Studio", false, false, true);
      return;
    }
    setCheckoutButton("pro", "Upgrade to Pro", false, false, true);
    setCheckoutButton("studio", "Choose Studio", false, false, false);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function renderSummary(summary) {
    lastSummary = summary;
    const entitlement = summary.entitlement || {};
    const stats = summary.stats || {};
    const account = summary.account || {};
    const user = summary.user || {};
    const used = Number(entitlement.apps_used || 0);
    const limit = Number(entitlement.apps_limit || 0);
    const pct = limit > 0 ? Math.max(0, Math.min(100, Math.round((used / limit) * 100))) : 0;

    const email = user.email || "";
    const workspaceLabel = account.name && account.name !== email ? account.name : "Personal workspace";
    setText("accountEmail", email || "-");
    setText("workspaceName", workspaceLabel);
    setText("planName", planName(entitlement.plan_slug));
    setText("subscriptionStatus", entitlement.subscription_status || "free");
    renderPlanActions(entitlement.plan_slug);
    setText("quotaUsed", used);
    setText("quotaLimit", limit);
    setText("quotaRemaining", Number(entitlement.apps_remaining || 0));
    setText("periodEnd", formatDate(entitlement.period_end));
    setText("totalApps", Number(stats.totalApps || 0));
    setText("memberCount", Array.isArray(stats.members) ? stats.members.length : 1);

    const progress = qs("quotaProgress");
    if (progress) progress.style.width = pct + "%";
    renderApps(stats.apps || []);
    renderInvoices(stats.invoices || []);
  }

  async function loadSummary(message) {
    setStatus(message || "Loading account...", "warning");
    showLoader(
      message || "Loading account",
      "Syncing your workspace, subscription, receipts, and app stats."
    );
    try {
      const summary = await root.auth.callAction("account.summary", {}, { timeoutMs: 18000 });
      renderSummary(summary);
      setStatus("Account is up to date.", "success");
    } catch (error) {
      if (/sign in/i.test(String(error && error.message || error))) {
        window.location.href = root.auth.pageUrl("login.html");
        return;
      }
      setStatus(error instanceof Error ? error.message : "Could not load the account yet.", "error");
    } finally {
      hideLoader();
    }
  }

  async function loadPluginTokens(message) {
    if (message) setStatus(message, "warning");
    const list = qs("pluginTokensList");
    if (list) list.innerHTML = '<div class="account-empty">Loading plugin tokens...</div>';
    try {
      const result = await root.auth.callAction("plugin-token.list", {}, { timeoutMs: 12000 });
      renderPluginTokens(result.tokens || []);
      if (message) setStatus("Plugin tokens refreshed.", "success");
    } catch (error) {
      if (/sign in/i.test(String(error && error.message || error))) {
        window.location.href = root.auth.pageUrl("login.html");
        return;
      }
      if (list) list.innerHTML = '<div class="account-empty">Could not load plugin tokens yet.</div>';
      setStatus(error instanceof Error ? error.message : "Could not load plugin tokens yet.", "error");
    }
  }

  async function createPluginToken() {
    const nameInput = qs("pluginTokenName");
    const createButton = qs("createPluginTokenButton");
    const name = nameInput ? String(nameInput.value || "").trim() : "";
    setStatus("Creating plugin activation token...", "warning");
    showLoader("Creating activation token", "Preparing a one-plugin activation token for VS Code.");
    try {
      if (createButton) createButton.disabled = true;
      const result = await root.auth.callAction("plugin-token.create", { name }, { timeoutMs: 12000 });
      const panel = qs("createdPluginTokenPanel");
      const tokenInput = qs("createdPluginToken");
      if (tokenInput) tokenInput.value = result.token || "";
      if (panel) panel.hidden = false;
      setStatus("Plugin activation token created. Copy it into the VS Code plugin.", "success");
      await loadPluginTokens("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create a plugin token yet.", "error");
    } finally {
      if (createButton) createButton.disabled = false;
      hideLoader();
    }
  }

  async function revokePluginToken(id) {
    const tokenId = String(id || "").trim();
    if (!tokenId) return;
    setStatus("Revoking plugin activation token...", "warning");
    showLoader("Revoking activation token", "Disconnecting this token from future plugin calls.");
    try {
      await root.auth.callAction("plugin-token.revoke", { id: tokenId }, { timeoutMs: 12000 });
      setStatus("Plugin activation token revoked.", "success");
      await loadPluginTokens("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not revoke plugin token yet.", "error");
    } finally {
      hideLoader();
    }
  }

  async function copyCreatedPluginToken() {
    const input = qs("createdPluginToken");
    const token = input ? String(input.value || "") : "";
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setStatus("Activation token copied.", "success");
    } catch {
      if (input) {
        input.focus();
        input.select();
      }
      setStatus("Select and copy the activation token.", "warning");
    }
  }

  async function startCheckout(plan) {
    setStatus("Opening Stripe Checkout...", "warning");
    showLoader("Opening Stripe Checkout", "Preparing a secure Stripe checkout session for your selected plan.");
    let redirecting = false;
    try {
      const result = await root.auth.callAction("billing.checkout", {
        plan,
        successUrl: root.auth.pageUrl("account.html?checkout=success"),
        cancelUrl: root.auth.pageUrl("pricing.html?checkout=cancelled"),
      }, { timeoutMs: 18000 });
      if (result.url) {
        setText("accountLoadingTitle", "Redirecting to Stripe");
        setText("accountLoadingDetail", "Keep this tab open while Stripe loads the checkout page.");
        redirecting = true;
        window.location.href = result.url;
        return;
      }
      setStatus("Checkout did not return a redirect URL.", "error");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start checkout yet.", "error");
    } finally {
      if (!redirecting) hideLoader();
    }
  }

  async function openBillingPortal() {
    setStatus("Opening Stripe billing portal...", "warning");
    showLoader("Opening Stripe billing portal", "Preparing your Stripe customer portal session.");
    let redirecting = false;
    try {
      const result = await root.auth.callAction("billing.portal", {}, { timeoutMs: 18000 });
      if (result.url) {
        setText("accountLoadingTitle", "Redirecting to Stripe");
        setText("accountLoadingDetail", "Keep this tab open while Stripe loads the billing portal.");
        redirecting = true;
        window.location.href = result.url;
        return;
      }
      setStatus("Billing portal did not return a redirect URL.", "error");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open billing yet.", "error");
    } finally {
      if (!redirecting) hideLoader();
    }
  }

  async function refreshInvoices() {
    setStatus("Refreshing receipts...", "warning");
    showLoader("Refreshing receipts", "Syncing paid invoices and subscription status from Stripe.");
    try {
      const result = await root.auth.callAction("billing.invoices", {}, { timeoutMs: 20000 });
      renderInvoices(result.invoices || []);
      setStatus(result.synced ? "Receipts synced from Stripe." : "Receipt list refreshed.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh receipts yet.", "error");
    } finally {
      hideLoader();
    }
  }

  async function initAccount() {
    try {
      const session = await root.auth.getSession();
      if (!session) {
        window.location.href = root.auth.pageUrl("login.html");
        return;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Auth is not ready yet.", "error");
      return;
    }

    document.querySelectorAll("[data-checkout-plan]").forEach((button) => {
      button.addEventListener("click", () => startCheckout(button.getAttribute("data-checkout-plan")));
    });
    const portal = qs("billingPortalButton");
    if (portal) portal.addEventListener("click", openBillingPortal);
    const refresh = qs("refreshInvoicesButton");
    if (refresh) refresh.addEventListener("click", refreshInvoices);
    const reload = qs("refreshAccountButton");
    if (reload) reload.addEventListener("click", () => loadSummary("Refreshing account..."));
    const refreshTokens = qs("refreshPluginTokensButton");
    if (refreshTokens) refreshTokens.addEventListener("click", () => loadPluginTokens("Refreshing plugin tokens..."));
    const createToken = qs("createPluginTokenButton");
    if (createToken) createToken.addEventListener("click", createPluginToken);
    const copyToken = qs("copyPluginTokenButton");
    if (copyToken) copyToken.addEventListener("click", copyCreatedPluginToken);
    const tokenList = qs("pluginTokensList");
    if (tokenList) {
      tokenList.addEventListener("click", (event) => {
        const button = event.target && event.target.closest ? event.target.closest("[data-token-revoke]") : null;
        if (button) revokePluginToken(button.getAttribute("data-token-revoke"));
      });
    }
    const signOut = qs("signOutButton");
    if (signOut) {
      signOut.addEventListener("click", async () => {
        await root.auth.signOut();
        window.location.href = root.auth.pageUrl("login.html");
      });
    }

    const params = new URLSearchParams(window.location.search);
    await loadSummary(params.get("checkout") === "success" ? "Checkout completed. Syncing account..." : "");
    await loadPluginTokens("");
  }

  document.addEventListener("DOMContentLoaded", initAccount);
})();
