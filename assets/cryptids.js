(() => {
  "use strict";

  const controls = document.querySelector("[data-evidence-controls]");
  if (controls) {
    const buttons = [...controls.querySelectorAll("button[data-filter]")];
    const rows = [...document.querySelectorAll("[data-evidence-type]")];
    const result = document.querySelector("[data-evidence-result]");

    controls.addEventListener("click", event => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      const filter = button.dataset.filter;
      let visible = 0;

      buttons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      rows.forEach(row => {
        row.hidden = filter !== "all" && row.dataset.evidenceType !== filter;
        if (!row.hidden) visible += 1;
      });

      if (result) {
        const label = filter === "all" ? "all" : button.textContent.trim().toLowerCase();
        result.textContent = `Showing ${label} · ${visible} evidence ${visible === 1 ? "record" : "records"}`;
      }
    });
  }

  const map = document.querySelector("[data-location-map]");
  if (!map) return;

  const markers = [...map.querySelectorAll(".map-marker[data-location]")];
  const entries = [...map.querySelectorAll(".location-list button[data-location]")];
  const number = map.querySelector("[data-map-number]");
  const title = map.querySelector("[data-map-title]");
  const coords = map.querySelector("[data-map-coords]");
  const note = map.querySelector("[data-map-note]");

  const selectLocation = id => {
    const entry = entries.find(item => item.dataset.location === id);
    if (!entry) return;

    markers.forEach(marker => {
      const active = marker.dataset.location === id;
      marker.classList.toggle("is-active", active);
      marker.setAttribute("aria-pressed", String(active));
    });
    entries.forEach(item => {
      const active = item === entry;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });

    if (number) number.textContent = entry.querySelector("b")?.textContent.trim() || "";
    if (title) title.textContent = entry.dataset.title || "";
    if (coords) coords.textContent = entry.dataset.coords || "";
    if (note) note.textContent = entry.dataset.note || "";
  };

  map.addEventListener("click", event => {
    const control = event.target.closest("[data-location]");
    if (control && map.contains(control)) selectLocation(control.dataset.location);
  });
})();
