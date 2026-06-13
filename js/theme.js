(function () {
  const root = window.Polymai || {};
  const config = root.config || {};
  const themeOrder = ["bright", "dark", "crazy"];
  const themes = {
    bright: {
      label: "Light",
      nextLabel: "Dark",
      iconClass: "theme-option-icon-bright",
      aria: "Switch to dark theme",
      pressed: "false",
    },
    dark: {
      label: "Dark",
      nextLabel: "Crazy",
      iconClass: "theme-option-icon-dark",
      aria: "Switch to crazy theme",
      pressed: "true",
    },
    crazy: {
      label: "Crazy",
      nextLabel: "Light",
      iconClass: "theme-option-icon-crazy",
      aria: "Switch to light theme",
      pressed: "mixed",
    },
  };

  function getStorageKey() {
    return config.storageKey ? config.storageKey("theme") : "polymai:app684:theme";
  }

  function readStoredTheme() {
    try {
      const value = localStorage.getItem(getStorageKey());
      return themes[value] ? value : "";
    } catch (error) {
      return "";
    }
  }

  function getPreferredTheme() {
    const stored = readStoredTheme();
    if (stored) return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "bright";
  }

  function writeTheme(theme) {
    try {
      localStorage.setItem(getStorageKey(), theme);
    } catch (error) {
      return undefined;
    }
  }

  function applyTheme(theme, shouldStore) {
    const selected = themes[theme] ? theme : "bright";
    document.documentElement.dataset.theme = selected;
    if (shouldStore) writeTheme(selected);

    const picker = document.getElementById("themeOptions");
    if (picker) {
      const meta = themes[selected];
      picker.dataset.activeTheme = selected;
      picker.setAttribute("aria-label", "Style theme: " + meta.label + " selected. " + meta.aria + ".");
      picker.setAttribute("aria-pressed", selected === "bright" ? "false" : selected === "dark" ? "true" : "mixed");
      picker.title = meta.aria;
      const label = picker.querySelector(".theme-current-label");
      if (label) label.textContent = meta.label;
      const icon = picker.querySelector(".theme-current-icon");
      if (icon) {
        icon.classList.remove("theme-option-icon-bright", "theme-option-icon-dark", "theme-option-icon-crazy");
        icon.classList.add(meta.iconClass);
      }
    }

    const button = document.getElementById("themeToggle");
    if (button) {
      const meta = themes[selected];
      button.setAttribute("aria-label", meta.aria);
      button.setAttribute("aria-pressed", meta.pressed);
      const text = button.querySelector(".theme-toggle-text");
      if (text) text.textContent = meta.nextLabel;
      button.title = meta.aria;
    }
  }

  function toggleTheme() {
    const current = themes[document.documentElement.dataset.theme] ? document.documentElement.dataset.theme : "bright";
    const index = themeOrder.indexOf(current);
    applyTheme(themeOrder[(index + 1) % themeOrder.length], true);
  }

  function initThemeControls() {
    applyTheme(document.documentElement.dataset.theme || getPreferredTheme(), false);
    const picker = document.getElementById("themeOptions");
    if (picker) {
      picker.addEventListener("click", toggleTheme);
    }

    const button = document.getElementById("themeToggle");
    if (!button) return;
    button.addEventListener("click", toggleTheme);
  }

  applyTheme(getPreferredTheme(), false);

  root.theme = {
    applyTheme,
    initThemeControls,
    toggleTheme,
  };

  window.Polymai = root;
})();
