(function () {
  const root = window.Polymai || {};
  const api = root.api || {};
  const config = root.config || {};
  const CAPTCHA_CHALLENGES = [
    { id: "sum-7", question: "What is 3 + 4?", answer: "7" },
    { id: "sum-9", question: "What is 5 + 4?", answer: "9" },
    { id: "sum-11", question: "What is 6 + 5?", answer: "11" },
    { id: "sum-13", question: "What is 8 + 5?", answer: "13" },
  ];

  function getElements() {
    return {
      form: document.getElementById("leadForm"),
      submit: document.getElementById("leadSubmit"),
      status: document.getElementById("leadStatus"),
    };
  }

  function pickCaptchaChallenge() {
    const index = Math.floor(Math.random() * CAPTCHA_CHALLENGES.length);
    return CAPTCHA_CHALLENGES[index];
  }

  function getCaptchaChallenge(id) {
    return CAPTCHA_CHALLENGES.find((challenge) => challenge.id === id) || null;
  }

  function initCaptcha(form) {
    const question = form.querySelector("[data-captcha-question]");
    const challengeInput = form.querySelector("[data-captcha-challenge]");
    const answerInput = form.querySelector("[name='captchaAnswer']");
    if (!question || !challengeInput || !answerInput) return;

    const challenge = pickCaptchaChallenge();
    question.textContent = challenge.question;
    challengeInput.value = challenge.id;
    answerInput.value = "";
  }

  function setStatus(elements, message, mode) {
    elements.status.textContent = message || "";
    elements.status.classList.toggle("is-success", mode === "success");
    elements.status.classList.toggle("is-warning", mode === "warning");
    elements.status.classList.toggle("is-error", mode === "error");
  }

  function getNotificationStatus(result) {
    return result && result.emailStatus ? result.emailStatus : null;
  }

  function describeMissingSetup(missing) {
    const labels = {
      WELCOME_FROM_EMAIL: "sender email (WELCOME_FROM_EMAIL)",
      POLYMAI_LEAD_NOTIFY_EMAIL: "notification recipient (POLYMAI_LEAD_NOTIFY_EMAIL)",
      POLYMAI_PROVIDER_TEST_EMAIL: "notification recipient (POLYMAI_LEAD_NOTIFY_EMAIL or POLYMAI_PROVIDER_TEST_EMAIL)",
      RESEND_API_KEY: "Resend key (RESEND_API_KEY or EMAIL_PROVIDER_API_KEY)",
    };
    if (!Array.isArray(missing) || !missing.length) return "";
    const items = missing
      .map((item) => labels[item] || String(item || "").trim())
      .filter(Boolean);
    return items.length ? " Missing: " + items.join(", ") + "." : "";
  }

  function describeProviderFailure(status) {
    const message = status && status.message ? String(status.message).trim() : "";
    const code = status && status.status ? "Resend " + status.status : "Resend";
    if (message) return " " + code + ": " + message;
    return "";
  }

  function getSentMessage(status) {
    if (!status || status.state === "notification-sent" || status.state === "provider-test-sent") {
      return {
        mode: "success",
        message: "Request sent. We will follow up soon.",
      };
    }
    if (status.state === "setup-required") {
      return {
        mode: "warning",
        message: "Request saved, but the email notification is not configured yet." + describeMissingSetup(status.missing),
      };
    }
    return {
      mode: "warning",
      message: "Request saved, but the email notification could not be sent yet." + describeProviderFailure(status),
    };
  }

  function readPayload(form) {
    const formData = new FormData(form);
    const requestType = String(formData.get("requestType") || "").trim();
    const packageInterest = String(formData.get("packageInterest") || "").trim();
    const useCase = String(formData.get("useCase") || "").trim();
    const proofAudience = String(formData.get("proofAudience") || "").trim();
    const mustHaves = String(formData.get("mustHaves") || "").trim();
    const publicPreview = String(formData.get("publicPreview") || "").trim();
    const proofNeeds = formData.getAll("proofNeeds")
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    const context = [
      requestType ? `Request type: ${requestType}.` : "",
      packageInterest ? `Package interest: ${packageInterest}.` : "",
      proofAudience ? `Who it is for: ${proofAudience}.` : "",
      mustHaves ? `Must-have features: ${mustHaves}.` : "",
      proofNeeds.length ? `Needs: ${proofNeeds.join(", ")}.` : "",
      publicPreview ? `Preview preference: ${publicPreview}.` : "",
    ].filter(Boolean).join("\n");

    return {
      requestType,
      fullName: String(formData.get("fullName") || "").trim(),
      email: String(formData.get("email") || "").trim().toLowerCase(),
      company: String(formData.get("company") || "").trim(),
      role: String(formData.get("role") || "").trim(),
      rawUseCase: useCase,
      proofAudience,
      mustHaves,
      useCase: context && useCase ? `${context}\n\nBuild brief:\n${useCase}` : useCase,
      timeline: String(formData.get("timeline") || "this-quarter"),
      teamSize: String(formData.get("teamSize") || ""),
      consent: formData.get("consent") === "on",
      website: String(formData.get("website") || "").trim(),
      captchaChallenge: String(formData.get("captchaChallenge") || "").trim(),
      captchaAnswer: String(formData.get("captchaAnswer") || "").trim(),
      page: window.location.href,
      referrer: document.referrer || "",
    };
  }

  function validatePayload(payload) {
    if (payload.website) return "silent";
    if (!payload.fullName || payload.fullName.length < 2) return "Add your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return "Add a valid email.";
    if (payload.requestType === "proof-build") {
      if (!payload.rawUseCase || payload.rawUseCase.length < 12) return "Describe what you want to build in a little more detail.";
      if (!payload.proofAudience || payload.proofAudience.length < 3) return "Add who the proof build is for.";
      if (!payload.mustHaves || payload.mustHaves.length < 6) return "Add the must-have features.";
    }
    if (!payload.useCase || payload.useCase.length < 12) return "Describe the app outcome in a little more detail.";
    const captcha = getCaptchaChallenge(payload.captchaChallenge);
    if (!captcha || payload.captchaAnswer.replace(/\s+/g, "") !== captcha.answer) return "Complete the security check.";
    if (!payload.consent) return "Confirm that we can contact you about this request.";
    return "";
  }

  function initLeadForm() {
    const elements = getElements();
    if (!elements.form || !elements.submit || !elements.status) return;

    initCaptcha(elements.form);

    elements.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = readPayload(elements.form);
      const validationMessage = validatePayload(payload);
      if (validationMessage === "silent") {
        elements.form.reset();
        initCaptcha(elements.form);
        setStatus(elements, "Request sent. We will follow up soon.", "success");
        return;
      }
      if (validationMessage) {
        setStatus(elements, validationMessage, "error");
        return;
      }

      elements.submit.disabled = true;
      elements.form.setAttribute("aria-busy", "true");
      setStatus(elements, "Sending your request...", "");

      try {
        const result = await api.callFunction(config.functions.leadCapture, payload);
        const status = getSentMessage(getNotificationStatus(result));
        elements.form.reset();
        initCaptcha(elements.form);
        setStatus(elements, status.message, status.mode);
      } catch (error) {
        setStatus(elements, error.message || "Could not send the request yet.", "error");
        initCaptcha(elements.form);
      } finally {
        elements.submit.disabled = false;
        elements.form.removeAttribute("aria-busy");
      }
    });
  }

  root.leadForm = {
    initLeadForm,
  };

  window.Polymai = root;
})();
