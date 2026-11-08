(function () {
  const root = window.Polymai || {};

  function initNavigation() {
    const header = document.querySelector("[data-nav-header]");
    const toggle = document.getElementById("navToggle");
    const menu = document.getElementById("navMenu");
    const links = menu ? Array.from(menu.querySelectorAll("a")) : [];
    const sectionLinks = links.filter((link) => String(link.getAttribute("href") || "").startsWith("#"));
    const sections = sectionLinks
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    if (!header || !toggle || !menu) return;

    function setOpen(isOpen) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
      menu.classList.toggle("is-open", isOpen);
      document.body.classList.toggle("nav-open", isOpen);
    }

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    links.forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });

    const updateHeader = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };

    const updateActive = () => {
      const offset = window.innerHeight * 0.28;
      let activeSection = sections[0];
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= offset) activeSection = section;
      });
      sectionLinks.forEach((link) => {
        const isActive = activeSection && link.getAttribute("href") === "#" + activeSection.id;
        link.classList.toggle("is-active", !!isActive);
      });
    };

    updateHeader();
    updateActive();
    window.addEventListener("scroll", () => {
      updateHeader();
      updateActive();
    }, { passive: true });
  }

  root.navigation = {
    initNavigation,
  };

  window.Polymai = root;
})();
