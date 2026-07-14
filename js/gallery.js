(function () {
  const root = window.Polymai || {};
  const config = root.config || {};
  const galleryData = root.galleryData || {};
  const previewModal = root.previewModal || {};
  const INITIAL_VISIBLE_LIMIT = 10;
  const state = {
    items: [],
    query: "",
    focus: "all",
    visibleLimit: INITIAL_VISIBLE_LIMIT,
    carouselIndex: 0,
    carouselDirection: "next",
    pointerStartX: 0,
    pointerActive: false,
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function getSheenStyle(index) {
    const directions = [
      { angle: "115deg", startX: "-128%", startY: "0%", endX: "128%", endY: "0%" },
      { angle: "65deg", startX: "128%", startY: "0%", endX: "-128%", endY: "0%" },
      { angle: "22deg", startX: "0%", startY: "-128%", endX: "0%", endY: "128%" },
      { angle: "158deg", startX: "0%", startY: "128%", endX: "0%", endY: "-128%" },
    ];
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const delay = ((index % 9) * 1.8 + Math.random() * 1.4).toFixed(2) + "s";
    const duration = (17 + Math.random() * 9).toFixed(2) + "s";
    return [
      "--sheen-angle:" + direction.angle,
      "--sheen-start-x:" + direction.startX,
      "--sheen-start-y:" + direction.startY,
      "--sheen-end-x:" + direction.endX,
      "--sheen-end-y:" + direction.endY,
      "--sheen-delay:" + delay,
      "--sheen-duration:" + duration,
    ].join(";");
  }

  function getCapabilityBadges(item) {
    const text = [item.title, item.focus, item.audience, item.industry, item.summary, item.description, item.impact].join(" ").toLowerCase();
    const badges = item.screenStatus === "ok"
      ? ["Screened live"]
      : item.screenStatus === "needs-check"
        ? ["Needs check"]
        : ["Preview"];
    if (/\b(auth|login|account|portal|member|admin|customer)\b/.test(text)) badges.push("Auth pattern");
    if (/\b(data|dashboard|record|table|list|crm|finance|receipt|inbox|tracking)\b/.test(text)) badges.push("Data flow");
    if (/\b(upload|file|document|receipt|image|media|asset)\b/.test(text)) badges.push("Storage pattern");
    if (/\b(email|invite|notification|lead|contact|onboarding)\b/.test(text)) badges.push("Email path");
    if (/\b(map|location|geo|route|nearby)\b/.test(text)) badges.push("Map surface");
    if (badges.length < 3) badges.push("Structured UI");
    return badges.slice(0, 4);
  }

  function renderCapabilityBadges(item) {
    return [
      '<div class="capability-badges" aria-label="Example capability signals">',
      getCapabilityBadges(item).map((badge) => '<span class="capability-badge">' + escapeHtml(badge) + "</span>").join(""),
      "</div>",
    ].join("");
  }

  function isInteractiveElement(target) {
    return !!(target && target.closest && target.closest("a, button, input, select, textarea, summary"));
  }

  function renderThumbnail(item, index) {
    const previewUrl = getSafePreviewUrl(item);
    if (!previewUrl) {
      return [
        '<div class="gallery-preview gallery-preview-empty" style="' + getSheenStyle(index) + '">',
        "  <span>No preview available</span>",
        "</div>",
      ].join("");
    }
    const title = item.title ? item.title + " miniature preview" : "App miniature preview";
    return [
      '<div class="gallery-preview" style="' + getSheenStyle(index) + '" aria-label="' + escapeHtml(title) + '">',
      '  <iframe src="' + escapeHtml(previewUrl) + '" title="' + escapeHtml(title) + '" loading="eager" tabindex="-1" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts"></iframe>',
      "</div>",
    ].join("");
  }

  function renderFeaturePreview(item) {
    const previewUrl = getSafePreviewUrl(item);
    if (!previewUrl) {
      return [
        '<div class="example-feature-preview gallery-preview-empty" style="' + getSheenStyle(state.carouselIndex) + '">',
        "  <span>No preview available</span>",
        "</div>",
      ].join("");
    }
    const title = item.title ? item.title + " featured preview" : "Featured app preview";
    return [
      '<div class="example-feature-preview" style="' + getSheenStyle(state.carouselIndex) + '" aria-label="' + escapeHtml(title) + '">',
      '  <iframe src="' + escapeHtml(previewUrl) + '" title="' + escapeHtml(title) + '" loading="eager" tabindex="-1" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts"></iframe>',
      "</div>",
    ].join("");
  }

  function renderFeatureCard(item) {
    const description = item.description || item.summary;
    const tilt = ((state.carouselIndex % 5) - 2) * 0.75;
    return [
      '<article class="example-feature-card" style="--feature-tilt:' + tilt + 'deg">',
      renderFeaturePreview(item),
      '  <div class="example-feature-copy">',
      '    <div class="card-top">',
      '      <span class="tag">' + escapeHtml(item.focus) + "</span>",
      '      <span class="signal">' + escapeHtml(item.status) + "</span>",
      "    </div>",
      "    <h3>" + escapeHtml(item.title) + "</h3>",
      '    <p class="example-feature-description">' + escapeHtml(description) + "</p>",
      renderCapabilityBadges(item),
      '    <div class="card-actions">',
      '      <a class="impact" href="' + escapeHtml(getSafePreviewUrl(item) || "#") + '" target="_blank" rel="noreferrer">Open live app</a>',
      '      <button class="button button-secondary" type="button" data-feature-preview-id="' + escapeHtml(item.id) + '">Preview</button>',
      "    </div>",
      "  </div>",
      "</article>",
    ].join("");
  }

  function getElements() {
    return {
      grid: document.getElementById("galleryGrid"),
      search: document.getElementById("gallerySearch"),
      focus: document.getElementById("galleryTypeFilter"),
      count: document.getElementById("galleryCount"),
      status: document.getElementById("galleryStatus"),
      empty: document.getElementById("galleryEmpty"),
      error: document.getElementById("galleryError"),
      errorText: document.getElementById("galleryErrorText"),
      clear: document.getElementById("clearGalleryFilters"),
      loadMore: document.getElementById("galleryLoadMore"),
      carousel: document.getElementById("exampleCarousel"),
      carouselStage: document.getElementById("exampleCarouselStage"),
      carouselPrev: document.getElementById("examplePrev"),
      carouselNext: document.getElementById("exampleNext"),
      carouselCount: document.getElementById("exampleCarouselCount"),
      carouselProgress: document.getElementById("exampleCarouselProgress"),
      carouselStatus: document.getElementById("exampleCarouselStatus"),
    };
  }

  function saveFilters() {
    try {
      localStorage.setItem(config.storageKey("gallery-filters"), JSON.stringify({ query: state.query, focus: state.focus }));
    } catch (error) {
      return undefined;
    }
  }

  function restoreFilters() {
    try {
      const raw = localStorage.getItem(config.storageKey("gallery-filters"));
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function getFilteredItems() {
    const query = state.query.trim().toLowerCase();
    return state.items.filter((item) => {
      const focusMatches = state.focus === "all" || item.focus === state.focus;
      const haystack = [item.title, item.focus, item.audience, item.industry, item.summary, item.description, item.impact, getCapabilityBadges(item).join(" ")].join(" ").toLowerCase();
      return focusMatches && (!query || haystack.includes(query));
    });
  }

  function resetVisibleLimit() {
    state.visibleLimit = INITIAL_VISIBLE_LIMIT;
  }

  function renderFocusOptions(elements) {
    if (!elements.focus) return;
    const focuses = Array.from(new Set(state.items.map((item) => item.focus))).sort();
    elements.focus.innerHTML = '<option value="all">All focuses</option>' + focuses.map((focus) => {
      const selected = state.focus === focus ? " selected" : "";
      return '<option value="' + escapeHtml(focus) + '"' + selected + ">" + escapeHtml(focus) + "</option>";
    }).join("");
  }

  function getGridLimit(elements) {
    if (elements.grid && elements.grid.dataset.galleryPageSize === "all") return Number.POSITIVE_INFINITY;
    return state.visibleLimit;
  }

  function renderGallery() {
    const elements = getElements();
    if (!elements.grid) return;
    const filtered = getFilteredItems();
    const gridLimit = getGridLimit(elements);
    const visibleItems = filtered.slice(0, gridLimit);
    const hasActiveFilter = state.query.trim() || state.focus !== "all";
    elements.grid.innerHTML = visibleItems.map((item, index) => {
      const description = item.description || item.summary;
      const previewUrl = getSafePreviewUrl(item);
      return [
        '<article class="gallery-card">',
        renderThumbnail(item, index),
        '  <div class="card-top">',
        '    <span class="tag">' + escapeHtml(item.focus) + "</span>",
        '    <span class="signal">' + escapeHtml(item.status) + "</span>",
        "  </div>",
        '  <div class="gallery-card-body">',
        "    <h3>" + escapeHtml(item.title) + "</h3>",
        '    <p class="gallery-description">' + escapeHtml(description) + "</p>",
        renderCapabilityBadges(item),
        "  </div>",
        '  <div class="card-actions">',
        previewUrl
          ? '    <a class="impact" href="' + escapeHtml(previewUrl) + '" target="_blank" rel="noreferrer">Open live app</a>'
          : '    <span class="impact">' + escapeHtml(item.impact) + "</span>",
        '    <button class="button button-secondary" type="button" data-preview-id="' + escapeHtml(item.id) + '">Preview</button>',
        "  </div>",
        "</article>",
      ].join("");
    }).join("");

    if (elements.empty) elements.empty.hidden = filtered.length > 0;
    if (elements.status) {
      elements.status.textContent = filtered.length
        ? (visibleItems.length < filtered.length ? (hasActiveFilter ? "Showing the latest matching builds." : "Showing the 10 latest builds.") : "Showing matching builds.")
        : "No matching builds.";
    }
    if (elements.count) {
      elements.count.textContent = visibleItems.length + " of " + filtered.length + (filtered.length === state.items.length ? " builds" : " matching builds");
    }
    if (elements.loadMore) {
      const remaining = Math.max(0, filtered.length - visibleItems.length);
      elements.loadMore.hidden = remaining === 0;
      elements.loadMore.textContent = "Show " + Math.min(INITIAL_VISIBLE_LIMIT, remaining) + " more builds";
    }
  }

  function renderCarousel() {
    const elements = getElements();
    if (!elements.carouselStage) return;
    if (!state.items.length) {
      elements.carouselStage.innerHTML = "";
      if (elements.carouselStatus) elements.carouselStatus.textContent = "Examples unavailable.";
      return;
    }

    const index = ((state.carouselIndex % state.items.length) + state.items.length) % state.items.length;
    state.carouselIndex = index;
    const item = state.items[index];
    if (elements.carousel) {
      elements.carousel.classList.remove("is-next", "is-prev");
      void elements.carousel.offsetWidth;
      elements.carousel.classList.add(state.carouselDirection === "prev" ? "is-prev" : "is-next");
    }
    elements.carouselStage.innerHTML = renderFeatureCard(item);
    if (elements.carouselCount) elements.carouselCount.textContent = (index + 1) + " of " + state.items.length + " examples";
    if (elements.carouselProgress) elements.carouselProgress.style.width = (((index + 1) / state.items.length) * 100) + "%";
    if (elements.carouselStatus) elements.carouselStatus.textContent = item.title + " is selected.";
  }

  function moveCarousel(direction) {
    if (!state.items.length) return;
    state.carouselDirection = direction;
    state.carouselIndex += direction === "prev" ? -1 : 1;
    renderCarousel();
  }

  function initCarouselEvents(elements) {
    if (!elements.carouselStage) return;
    if (elements.carouselPrev) elements.carouselPrev.addEventListener("click", () => moveCarousel("prev"));
    if (elements.carouselNext) elements.carouselNext.addEventListener("click", () => moveCarousel("next"));
    elements.carouselStage.addEventListener("click", (event) => {
      const button = event.target.closest("[data-feature-preview-id]");
      if (!button) return;
      event.stopPropagation();
      const item = state.items.find((entry) => entry.id === button.dataset.featurePreviewId);
      previewModal.openPreview(item, button);
    });
    elements.carouselStage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") moveCarousel("prev");
      if (event.key === "ArrowRight") moveCarousel("next");
    });
    elements.carouselStage.addEventListener("pointerdown", (event) => {
      if (isInteractiveElement(event.target)) {
        state.pointerActive = false;
        return;
      }
      state.pointerActive = true;
      state.pointerStartX = event.clientX;
      elements.carouselStage.setPointerCapture?.(event.pointerId);
    });
    elements.carouselStage.addEventListener("pointerup", (event) => {
      if (!state.pointerActive) return;
      state.pointerActive = false;
      const deltaX = event.clientX - state.pointerStartX;
      if (Math.abs(deltaX) > 42) moveCarousel(deltaX > 0 ? "prev" : "next");
    });
    elements.carouselStage.addEventListener("pointercancel", () => {
      state.pointerActive = false;
    });
  }

  function initGalleryEvents(elements) {
    if (!elements.grid) return;
    elements.grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-preview-id]");
      if (!button) return;
      event.stopPropagation();
      const item = state.items.find((entry) => entry.id === button.dataset.previewId);
      previewModal.openPreview(item, button);
    });
  }

  function applyLiveGalleryItems(items, elements) {
    if (!Array.isArray(items) || !items.length) return;
    state.items = items;
    if (state.focus !== "all" && !state.items.some((item) => item.focus === state.focus)) {
      state.focus = "all";
      if (elements.focus) elements.focus.value = "all";
      saveFilters();
    }
    renderFocusOptions(elements);
    renderGallery();
    renderCarousel();
    if (elements.error) elements.error.hidden = true;
  }

  function initLiveUpdateEvents(elements) {
    const eventName = galleryData.GALLERY_UPDATED_EVENT;
    if (!eventName) return;
    window.addEventListener(eventName, (event) => {
      applyLiveGalleryItems(event.detail && event.detail.items, elements);
    });
  }

  async function initGallery() {
    const elements = getElements();
    const hasGallerySurface = elements.grid || elements.carouselStage;
    if (!hasGallerySurface || !galleryData.loadGalleryItems) return;

    const restored = restoreFilters();
    state.query = String(restored.query || "");
    state.focus = String(restored.focus || "all");
    if (elements.search) elements.search.value = state.query;
    initLiveUpdateEvents(elements);

    try {
      state.items = await galleryData.loadGalleryItems();
      renderFocusOptions(elements);
      renderGallery();
      renderCarousel();
      if (elements.error) elements.error.hidden = true;
    } catch (error) {
      if (elements.status) elements.status.textContent = "Gallery unavailable.";
      if (elements.count) elements.count.textContent = "Gallery unavailable";
      if (elements.carouselStatus) elements.carouselStatus.textContent = "Examples unavailable.";
      if (elements.error) elements.error.hidden = false;
      if (elements.errorText) elements.errorText.textContent = error.message || "Refresh the page or try again later.";
    }

    if (elements.search) {
      elements.search.addEventListener("input", () => {
        state.query = elements.search.value;
        resetVisibleLimit();
        saveFilters();
        renderGallery();
      });
    }

    if (elements.focus) {
      elements.focus.addEventListener("change", () => {
        state.focus = elements.focus.value;
        resetVisibleLimit();
        saveFilters();
        renderGallery();
      });
    }

    if (elements.clear) {
      elements.clear.addEventListener("click", () => {
        state.query = "";
        state.focus = "all";
        resetVisibleLimit();
        if (elements.search) elements.search.value = "";
        if (elements.focus) elements.focus.value = "all";
        saveFilters();
        renderGallery();
      });
    }

    if (elements.loadMore) {
      elements.loadMore.addEventListener("click", () => {
        state.visibleLimit += INITIAL_VISIBLE_LIMIT;
        renderGallery();
      });
    }

    initGalleryEvents(elements);
    initCarouselEvents(elements);
  }

  root.gallery = {
    initGallery,
  };

  window.Polymai = root;
})();
