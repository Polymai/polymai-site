(function () {
  const root = window.Polymai || {};
  let lastFocus = null;
  let currentItem = null;

  function getElements() {
    return {
      backdrop: document.getElementById("previewModal"),
      closeButtons: Array.from(document.querySelectorAll("[data-modal-close]")),
      title: document.getElementById("modalTitle"),
      industry: document.getElementById("modalIndustry"),
      summary: document.getElementById("modalSummary"),
      focus: document.getElementById("modalFocus"),
      audience: document.getElementById("modalAudience"),
      status: document.getElementById("modalStatus"),
      leadLink: document.getElementById("modalLeadLink"),
      openLink: document.getElementById("modalOpenLink"),
      frameShell: document.getElementById("modalFrameShell"),
      frame: document.getElementById("modalFrame"),
    };
  }

  function getSafePreviewUrl(item) {
    const raw = item && (item.previewUrl || item.url) ? String(item.previewUrl || item.url).trim() : "";
    if (!raw) return "";
    try {
      const parsed = new URL(raw, window.location.href);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
    } catch (error) {
      return "";
    }
  }

  function closePreview() {
    const elements = getElements();
    if (!elements.backdrop) return;
    elements.backdrop.hidden = true;
    if (elements.frame) elements.frame.src = "about:blank";
    document.body.classList.remove("nav-open");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function openPreview(item, trigger) {
    const elements = getElements();
    if (!elements.backdrop || !item) return;
    currentItem = item;
    lastFocus = trigger || document.activeElement;
    elements.title.textContent = item.title;
    elements.industry.textContent = item.industry;
    elements.summary.textContent = item.description || item.summary;
    elements.focus.textContent = item.focus;
    elements.audience.textContent = item.audience;
    elements.status.textContent = item.status;
    const previewUrl = getSafePreviewUrl(item);
    elements.openLink.hidden = !previewUrl;
    elements.openLink.href = previewUrl || "#";
    if (elements.frameShell && elements.frame) {
      elements.frameShell.hidden = !previewUrl;
      elements.frame.src = previewUrl || "about:blank";
      elements.frame.title = item.title ? item.title + " preview" : "Build preview";
    }
    elements.backdrop.hidden = false;
    document.body.classList.add("nav-open");
    const closeButton = elements.closeButtons[0];
    if (closeButton) closeButton.focus();
  }

  function initPreviewModal() {
    const elements = getElements();
    if (!elements.backdrop) return;

    elements.closeButtons.forEach((button) => button.addEventListener("click", closePreview));
    elements.backdrop.addEventListener("click", (event) => {
      if (event.target === elements.backdrop) closePreview();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.backdrop.hidden) closePreview();
    });
    if (elements.leadLink) {
      elements.leadLink.addEventListener("click", () => {
        closePreview();
        window.setTimeout(() => document.getElementById("fullName")?.focus(), 220);
      });
    }
  }

  root.previewModal = {
    closePreview,
    get currentItem() {
      return currentItem;
    },
    getSafePreviewUrl,
    initPreviewModal,
    openPreview,
  };

  window.Polymai = root;
})();
