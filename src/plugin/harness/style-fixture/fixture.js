/* Standalone visual specimen controls, not production services or adapters. */
(() => {
  "use strict";
  const required = (id) => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing fixture element: ${id}`);
    return element;
  };
  const body = document.body;
  const theme = required("theme");
  const language = required("language");
  const messages = {
    en: { invalid: "Enter a title before creating a note.", success: "Task note created — fixture message only.", dismiss: "Dismiss notice" },
    de: { invalid: "Bitte geben Sie einen Titel ein, bevor Sie eine Notiz erstellen.", success: "Die Aufgabennotiz wurde erstellt — nur eine Beispielmeldung, keine Datei wurde geschrieben.", dismiss: "Meldung schließen" },
  };
  let notice = null;
  const text = () => messages[language.value];
  const applyTheme = () => {
    body.classList.toggle("theme-dark", theme.value === "dark");
    body.classList.toggle("theme-light", theme.value === "light");
  };
  theme.addEventListener("change", applyTheme);
  required("density").addEventListener("change", (event) => { body.dataset.density = event.target.value; });
  required("width").addEventListener("change", (event) => { body.dataset.narrow = String(event.target.value === "narrow"); });
  const setError = () => {
    const input = required("task-title");
    const error = required("title-error");
    error.lang = language.value;
    input.setAttribute("aria-invalid", "true");
    error.textContent = text().invalid;
    input.focus();
  };
  required("validate").addEventListener("click", setError);
  required("task-title").addEventListener("input", (event) => {
    event.target.removeAttribute("aria-invalid");
    required("title-error").textContent = "";
  });
  required("show-notice").addEventListener("click", () => {
    if (!required("success-enabled").checked) return;
    if (notice) notice.remove();
    notice = document.createElement("div");
    notice.className = "notice";
    const message = document.createElement("div");
    message.className = "notice-message";
    message.setAttribute("role", "status");
    message.lang = language.value;
    const actions = document.createElement("div");
    actions.className = "fixture-notice-actions";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = text().dismiss;
    dismiss.lang = language.value;
    dismiss.addEventListener("click", () => {
      const focused = notice?.contains(document.activeElement);
      notice?.remove();
      notice = null;
      if (focused) required("show-notice").focus();
    });
    actions.append(dismiss);
    notice.append(message, actions);
    required("notice-root").append(notice);
    // Existing empty live region first; text is a later DOM update.
    requestAnimationFrame(() => { if (message.isConnected) message.textContent = text().success; });
  });
  const modal = required("modal");
  required("open-modal").addEventListener("click", () => modal.showModal());
  required("close-modal").addEventListener("click", () => modal.close());
  modal.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...modal.querySelectorAll("input:not(:disabled), button:not(:disabled)")];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  modal.addEventListener("close", () => required("open-modal").focus());
  applyTheme();
  body.dataset.fixtureReady = "true";
})();
