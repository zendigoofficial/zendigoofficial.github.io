(() => {
  "use strict";

  const controls = document.querySelector("[data-evidence-controls]");
  if (!controls) return;

  const buttons = [...controls.querySelectorAll("button[data-filter]")];
  const rows = [...document.querySelectorAll("[data-evidence-type]")];

  controls.addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    const filter = button.dataset.filter;

    buttons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    rows.forEach(row => {
      row.hidden = filter !== "all" && row.dataset.evidenceType !== filter;
    });
  });
})();
