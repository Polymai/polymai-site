(function () {
  // Enlarges product screenshots marked with [data-lightbox] in a native <dialog>.
  // Escape, the close button and a click outside the image close it; focus returns to the image.
  function initImageLightbox() {
    const dialog = document.querySelector(".m365-lightbox");
    const figures = Array.from(document.querySelectorAll("[data-lightbox]"));
    if (!dialog || !figures.length || typeof dialog.showModal !== "function") return;

    const image = dialog.querySelector("img");
    const caption = dialog.querySelector("p");
    const closeButton = dialog.querySelector(".m365-lightbox-close");
    let opener = null;

    function open(figure) {
      const source = figure.querySelector("img");
      if (!source) return;
      opener = figure;
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      const text = figure.querySelector("figcaption");
      caption.textContent = text ? text.textContent.trim() : "";
      caption.hidden = !caption.textContent;
      dialog.showModal();
      document.body.classList.add("m365-lightbox-open");
    }

    function close() {
      if (dialog.open) dialog.close();
    }

    dialog.addEventListener("close", () => {
      document.body.classList.remove("m365-lightbox-open");
      if (opener) opener.focus({ preventScroll: true });
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });

    closeButton.addEventListener("click", close);

    figures.forEach((figure) => {
      figure.tabIndex = 0;
      figure.setAttribute("role", "button");
      const alt = figure.querySelector("img")?.alt || "";
      figure.setAttribute("aria-label", "Enlarge screenshot: " + alt);
      figure.addEventListener("click", () => open(figure));
      figure.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(figure);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImageLightbox, { once: true });
  } else {
    initImageLightbox();
  }
})();
