(function () {
  function init() {
    const app = window.Polymai || {};
    app.theme?.initThemeControls();
    app.navigation?.initNavigation();
    app.previewModal?.initPreviewModal();
    app.gallery?.initGallery();
    app.buildFlow?.initBuildFlow();
    app.leadForm?.initLeadForm();
    app.legalDocs?.initLegalDocs();
    app.reveal?.initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
