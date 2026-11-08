(function () {
  const root = window.Polymai || {};
  const PRINT_TITLE = "Polymai Legal Document Set";
  let titleBeforePrint = "";

  function initLegalDocs() {
    const room = document.querySelector(".legal-document-room");
    if (!room) return;

    const tabs = Array.from(room.querySelectorAll("[data-doc-tab]"));
    const panels = Array.from(room.querySelectorAll("[data-doc-panel]"));
    const printButton = room.querySelector("[data-print-docs]");
    if (!tabs.length || !panels.length) return;

    const panelById = new Map(panels.map((panel) => [panel.id, panel]));

    function preparePrintTitle() {
      if (!titleBeforePrint) titleBeforePrint = document.title;
      document.title = PRINT_TITLE;
    }

    function restorePrintTitle() {
      if (!titleBeforePrint) return;
      document.title = titleBeforePrint;
      titleBeforePrint = "";
    }

    function setActive(targetId, shouldFocusPanel) {
      const activePanel = panelById.get(targetId);
      if (!activePanel) return;

      tabs.forEach((tab) => {
        const isActive = tab.dataset.docTab === targetId;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
      });

      panels.forEach((panel) => {
        const isActive = panel === activePanel;
        panel.classList.toggle("is-active", isActive);
        panel.hidden = !isActive;
      });

      if (shouldFocusPanel) {
        activePanel.focus({ preventScroll: true });
      }
    }

    tabs.forEach((tab, index) => {
      tab.tabIndex = tab.classList.contains("is-active") ? 0 : -1;

      tab.addEventListener("click", () => {
        setActive(tab.dataset.docTab, false);
      });

      tab.addEventListener("keydown", (event) => {
        const keyMap = {
          ArrowDown: 1,
          ArrowRight: 1,
          ArrowUp: -1,
          ArrowLeft: -1,
        };

        if (event.key === "Home") {
          event.preventDefault();
          tabs[0].focus();
          setActive(tabs[0].dataset.docTab, false);
          return;
        }

        if (event.key === "End") {
          event.preventDefault();
          const last = tabs[tabs.length - 1];
          last.focus();
          setActive(last.dataset.docTab, false);
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setActive(tab.dataset.docTab, true);
          return;
        }

        if (!keyMap[event.key]) return;

        event.preventDefault();
        const nextIndex = (index + keyMap[event.key] + tabs.length) % tabs.length;
        tabs[nextIndex].focus();
        setActive(tabs[nextIndex].dataset.docTab, false);
      });
    });

    // Deep links such as legal.html#microsoft-365-privacy open that document directly.
    function panelFromHash() {
      let hash = "";
      try {
        hash = decodeURIComponent(String(window.location.hash || "").slice(1));
      } catch (error) {
        return "";
      }
      if (!hash) return "";
      const id = hash.startsWith("doc-") ? hash : "doc-" + hash;
      return panelById.has(id) ? id : "";
    }

    function openFromHash() {
      const id = panelFromHash();
      if (!id) return;
      setActive(id, false);
      // Keep the document below the fixed site header.
      const header = document.querySelector("[data-nav-header]");
      room.style.scrollMarginTop = ((header ? header.getBoundingClientRect().height : 0) + 16) + "px";
      room.scrollIntoView({ block: "start" });
    }

    openFromHash();
    // Fonts and reveal motion can move the room after first paint; align again once loaded.
    if (panelFromHash() && document.readyState !== "complete") {
      window.addEventListener("load", openFromHash, { once: true });
    }
    window.addEventListener("hashchange", openFromHash);

    if (printButton) {
      printButton.addEventListener("click", () => {
        preparePrintTitle();
        window.print();
      });
    }

    window.addEventListener("beforeprint", preparePrintTitle);
    window.addEventListener("afterprint", restorePrintTitle);
  }

  root.legalDocs = {
    initLegalDocs,
  };

  window.Polymai = root;
})();
