(function () {
  const root = window.Polymai || {};
  let generatedDetailsId = 0;

  function ensureToggle(card) {
    const details = card.querySelector(".info-card-details");
    if (!details) return null;

    if (!details.id) {
      generatedDetailsId += 1;
      details.id = `info-card-details-${generatedDetailsId}`;
    }

    let toggle = card.querySelector(".info-card-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.className = "info-card-toggle";
      toggle.type = "button";
      toggle.innerHTML = '<span data-info-card-label>Read more</span><span class="info-card-toggle-icon" aria-hidden="true"></span>';
      card.appendChild(toggle);
    }

    toggle.setAttribute("aria-controls", details.id);
    toggle.setAttribute("aria-expanded", "false");
    return toggle;
  }

  function setExpanded(card, expanded) {
    const toggle = ensureToggle(card);
    const details = card.querySelector(".info-card-details");
    const label = card.querySelector("[data-info-card-label]");
    if (!toggle || !details) return;

    card.classList.toggle("is-expanded", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    details.setAttribute("aria-hidden", String(!expanded));
    details.toggleAttribute("inert", !expanded);
    if (label) label.textContent = expanded ? "Show less" : "Read more";
  }

  function toggleCard(card) {
    const willExpand = !card.classList.contains("is-expanded");
    const group = card.closest("[data-info-card-group]");

    if (willExpand && group) {
      group.querySelectorAll("[data-info-card].is-expanded").forEach((openCard) => {
        if (openCard !== card) setExpanded(openCard, false);
      });
    }

    setExpanded(card, willExpand);
  }

  function initInfoCards() {
    document.querySelectorAll("[data-info-card]").forEach((card) => {
      const toggle = ensureToggle(card);
      if (!toggle || card.dataset.infoCardReady === "true") return;

      card.dataset.infoCardReady = "true";
      setExpanded(card, false);

      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleCard(card);
      });

      card.addEventListener("click", (event) => {
        if (event.target.closest("button, a")) return;
        toggleCard(card);
      });
    });
  }

  root.infoCards = { initInfoCards };
  window.Polymai = root;
})();
