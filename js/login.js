(function () {
  const root = window.Polymai || {};

  function setStatus(message, state) {
    const status = document.getElementById("loginStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-success", state === "success");
    status.classList.toggle("is-error", state === "error");
    status.classList.toggle("is-warning", state === "warning");
  }

  function cleanEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function redirectToAccount(message) {
    setStatus(message || "Opening your account...", "success");
    window.setTimeout(() => {
      window.location.href = root.auth.pageUrl("account.html");
    }, 350);
  }

  async function initLogin() {
    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const submit = document.getElementById("loginSubmit");

    try {
      const session = await root.auth.getSession();
      if (session) {
        await redirectToAccount("You are already signed in. Opening your account...");
        return;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Auth is not ready yet.", "error");
    }

    if (!form || !emailInput || !submit) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = cleanEmail(emailInput.value);
      if (!validEmail(email)) {
        setStatus("Add a valid email address.", "error");
        emailInput.focus();
        return;
      }

      submit.disabled = true;
      setStatus("Sending magic link...", "warning");
      try {
        await root.auth.signInWithEmail(email);
        setStatus("Check your email for the Polymai sign-in link.", "success");
        form.reset();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not send the magic link yet.", "error");
      } finally {
        submit.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initLogin);
})();
