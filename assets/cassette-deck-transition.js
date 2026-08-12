(() => {
  const SELECTOR = ".cassette-machine";
  let machine = null;
  let meters = [];
  let volumeInput = null;
  let levels = [0, 0];
  let peaks = [0, 0];
  let holds = [0, 0];

  function labelControls(root) {
    const controls = root.querySelectorAll(".cassette-transport button");
    const labels = [
      "Previous track",
      "Play or pause cassette",
      "Next track",
      "Eject cassette",
      "Show cassette video on the broadcast TV"
    ];
    controls.forEach((button, index) => {
      if (labels[index]) button.setAttribute("aria-label", labels[index]);
    });
    const videoText = controls[4]?.querySelector("small");
    if (videoText && videoText.textContent !== "CLOSE" && videoText.textContent !== "VIDEO") {
      videoText.textContent = "VIDEO";
    }
  }

  function connect() {
    const nextMachine = document.querySelector(SELECTOR);
    if (!nextMachine) return;
    machine = nextMachine;
    meters = Array.from(machine.querySelectorAll(".vu-meter"));
    volumeInput = machine.querySelector('.cassette-volume-panel input[type="range"]');
    labelControls(machine);
    machine.dataset.photoDeck = "ready";
  }

  function routeVideoToTv() {
    const engine = machine?.querySelector(".cassette-player-engine.is-open");
    const screen = document.querySelector("#broadcast-tuner .console-screen");
    if (!engine || !screen) return;
    const rect = screen.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    const insetX = Math.max(3, rect.width * 0.022);
    const insetY = Math.max(3, rect.height * 0.035);
    engine.style.setProperty("--tv-left", `${rect.left + insetX}px`);
    engine.style.setProperty("--tv-top", `${rect.top + insetY}px`);
    engine.style.setProperty("--tv-width", `${Math.max(200, rect.width - insetX * 2)}px`);
    engine.style.setProperty("--tv-height", `${Math.max(113, rect.height - insetY * 2)}px`);
    engine.style.setProperty("--tv-ratio", "auto");
    engine.dataset.routedTo = "broadcast-tv";
    engine.setAttribute("aria-hidden", "false");
  }

  function tick() {
    if (!machine || !machine.isConnected) connect();
    if (!machine || meters.length !== 2) return;
    labelControls(machine);
    routeVideoToTv();

    const active = meters.some((meter) => meter.querySelector("i.is-active"));
    const volume = Math.max(0, Math.min(1, Number(volumeInput?.value ?? 72) / 100));
    const common = active ? 0.22 + Math.random() * 0.68 : 0;

    meters.forEach((meter, channel) => {
      const spread = active ? (Math.random() - 0.5) * 0.28 : 0;
      const target = active ? Math.max(0.04, Math.min(1, (common + spread) * volume)) : 0;
      const response = target > levels[channel] ? 0.72 : 0.24;
      levels[channel] += (target - levels[channel]) * response;

      if (levels[channel] >= peaks[channel]) {
        peaks[channel] = levels[channel];
        holds[channel] = 7;
      } else if (holds[channel] > 0) {
        holds[channel] -= 1;
      } else {
        peaks[channel] = Math.max(levels[channel], peaks[channel] - 0.045);
      }

      const segments = Math.round(levels[channel] * 22) / 22;
      const peakSegments = Math.round(peaks[channel] * 22) / 22;
      meter.style.setProperty("--meter-level", `${segments * 100}%`);
      meter.style.setProperty("--meter-peak", `${peakSegments * 100}%`);
    });
  }

  const observer = new MutationObserver(() => {
    connect();
    if (machine) labelControls(machine);
  });

  function start() {
    connect();
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.(".cassette-transport button:nth-child(5)")) return;
      window.requestAnimationFrame(() => window.requestAnimationFrame(routeVideoToTv));
      window.setTimeout(routeVideoToTv, 120);
    });
    window.addEventListener("resize", routeVideoToTv);
    window.addEventListener("scroll", routeVideoToTv, { passive: true });
    window.setInterval(tick, 90);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

/* Static-page safety controller.
   GitHub Pages can display the server-rendered deck before the application
   runtime attaches its click handlers. This controller keeps the five tapes
   and transport functional in that state, and stays out of the way whenever
   React handlers are present. */
(() => {
  const PLAYER_ORIGIN = "https://zendigo-redline-82.zendigo-playz.chatgpt.site";
  const tapes = [
    {
      id: "rush",
      label: "All Rush Mixtape",
      playlistId: "PLdYm82eUYRWg",
      accent: "#df1828",
      caseArt: "/mixtapes/all-rush-spine.webp",
      tapeArt: "/mixtapes/all-rush-tape.webp",
      tracks: ["g_QtO0Rhp0w", "rz-MKLcUF4g", "sQRShD0xuAk", "LdpMpfp-J_I", "FAvQSkK8Z8U", "WQgu0MpnKq8", "8Kiz5jyG5j4", "qSWn9qbaFu8", "5jPondwDDOE", "ZiRuj2_czzw", "rMYDuPWHFAo", "Gztabfs5ngA", "iIGKlicb8n0"]
    },
    {
      id: "college-rock",
      label: "90s College Rock",
      playlistId: "PLZ8R2NimMyCc",
      accent: "#b83b35",
      caseArt: "/mixtapes/90s-college-rock-spine.webp",
      tapeArt: "/mixtapes/90s-college-rock-tape.webp",
      tracks: ["acK0KH2uJGc", "lVL-zZnD3VU", "cXWbMu4PtpE", "ah5gAkna3jI", "1ClCpfeIELw", "Nntd2fgMUYw", "i8dh9gDzmz8", "xPU8OAjjS4k", "eBG7P-K-r1Y", "4aeETEoNfOg"]
    },
    {
      id: "neon-vice",
      label: "Neon Vice: Sunset Drive",
      playlistId: "PLSPDLnMxWQM8",
      accent: "#ff2a8b",
      caseArt: "/mixtapes/neon-vice-spine.webp",
      tapeArt: "/mixtapes/neon-vice-tape.webp",
      tracks: ["iIpfWORQWhU", "hGI2d31M7Ns", "3aJvIFK9-xk", "aGCdLKXNF3w", "mI1sxQi7USA", "HzdD8kbDzZA", "ZP69PLBqFUo", "eFTLKWw542g"]
    },
    {
      id: "last-life",
      label: "Last Life",
      playlistId: "PLOWZlGbMCPzg",
      accent: "#e84635",
      caseArt: "/mixtapes/last-life-spine.webp",
      tapeArt: "/mixtapes/last-life-tape.webp",
      tracks: ["3dbRdzATXBE", "eFUd0_9F84k", "1lqrzGauUN4", "GsMiTssfoVs", "Xp-8BfC0FyE", "TiBhyAptK2s", "c7hZzWAeY0k", "LgfKs7UMiHM", "e17mr5ZtWPI", "W0o6o87h2NU", "2ASMmke_J70", "cLD1rWuH1JA", "oiwuofT-DaA", "U8tT9vpnFHI"]
    },
    {
      id: "secret-level",
      label: "Secret Level",
      playlistId: "PLDUWkNXL-Yvk",
      accent: "#d83991",
      caseArt: "/mixtapes/secret-level-spine.webp",
      tapeArt: "/mixtapes/secret-level-tape.webp",
      tracks: ["LNyIhirtXUI", "YRFKU6QvBJY", "WnJFQEHsSrU", "fTAOLmEba4I", "F89-MOy7Xfg", "5EbiRRpaYB4", "cJnR0dwCJ0E", "ft0i-nSfGRs", "dHCAD95i5IU", "FOi3fPIqwo8", "KkbGgmREHuk", "0NrVwGsX16E", "Wbhr9RjO9Q0", "Nm7AA78Vq8o"]
    }
  ];

  let ready = false;
  let selected = null;
  let index = 0;
  let playing = false;
  let videoOpen = false;

  const reactOwns = element => Object.keys(element || {}).some(key => key.startsWith("__reactProps$"));
  const machine = () => document.querySelector(".cassette-machine");
  const engine = () => machine()?.querySelector(".cassette-player-engine");
  const frame = () => engine()?.querySelector("iframe");
  const controls = () => Array.from(machine()?.querySelectorAll(".cassette-transport button") || []);

  function post(message) {
    const target = frame()?.contentWindow;
    if (target) target.postMessage(message, PLAYER_ORIGIN);
  }

  function getVolume() {
    const value = Number(machine()?.querySelector('.cassette-volume-panel input[type="range"]')?.value ?? 72);
    return Math.max(0, Math.min(100, value));
  }

  function identifyCase(button) {
    const explicit = button.dataset.fallbackTape;
    if (explicit) return tapes.find(tape => tape.id === explicit) || null;
    const words = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.toLowerCase();
    return tapes.find(tape => words.includes(tape.label.toLowerCase())) || null;
  }

  function ensureFiveCases() {
    const pile = document.querySelector(".cassette-case-pile");
    if (!pile) return;
    Array.from(pile.querySelectorAll(".cassette-case")).forEach(button => {
      const tape = identifyCase(button);
      if (tape) button.dataset.fallbackTape = tape.id;
    });
    tapes.forEach((tape, tapeIndex) => {
      if (pile.querySelector(`[data-fallback-tape="${tape.id}"]`)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cassette-case";
      button.dataset.fallbackTape = tape.id;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `Insert and play ${tape.label}`);
      button.style.setProperty("--case-accent", tape.accent);
      button.style.setProperty("--case-offset", `${(tapeIndex % 3) * 2}px`);
      button.innerHTML = `<span class="cassette-case-shell"><img class="cassette-case-art" src="${tape.caseArt}" alt="" aria-hidden="true"><span class="cassette-case-title"><small></small><strong>${tape.label}</strong><i></i></span></span>`;
      pile.appendChild(button);
    });
    const count = document.querySelector(".cassette-case-stack .cassette-stack-heading b");
    if (count) count.textContent = "05 TAPES";
  }

  function paintTape(tape) {
    const bay = machine()?.querySelector(".cassette-bay");
    if (!bay) return;
    let inserted = bay.querySelector(".inserted-tape");
    bay.querySelector(".cassette-bay-empty")?.remove();
    if (!inserted) {
      inserted = document.createElement("div");
      inserted.className = "inserted-tape";
      inserted.innerHTML = '<img class="inserted-tape-art" alt="" aria-hidden="true">';
      bay.prepend(inserted);
    }
    inserted.style.setProperty("--tape-accent", tape.accent);
    inserted.querySelector("img").src = tape.tapeArt;
    inserted.setAttribute("aria-label", `${tape.label} inserted`);
    machine()?.classList.add("has-cassette");
    document.querySelectorAll(".cassette-case").forEach(button => {
      const active = identifyCase(button)?.id === tape.id;
      button.classList.toggle("is-loaded", active);
      button.setAttribute("aria-pressed", String(active));
    });
    controls().forEach((button, buttonIndex) => {
      if (buttonIndex !== 1) button.disabled = false;
    });
  }

  function updatePlayButton() {
    const play = controls()[1];
    if (!play) return;
    const symbol = play.querySelector("span");
    const label = play.querySelector("small");
    if (symbol) symbol.textContent = playing ? "Ⅱ" : "▶";
    if (label) label.textContent = playing ? "PAUSE" : "PLAY";
    machine()?.querySelector(".inserted-tape")?.classList.toggle("is-playing", playing);
  }

  function loadTape(tape, nextIndex = 0) {
    selected = tape;
    index = Math.max(0, Math.min(tape.tracks.length - 1, nextIndex));
    playing = true;
    paintTape(tape);
    updatePlayButton();
    post({
      type: "zendigo-cassette:load",
      cassetteId: tape.id,
      playlistId: tape.playlistId,
      tracks: tape.tracks,
      index,
      volume: getVolume(),
      muted: getVolume() === 0
    });
  }

  function step(amount) {
    if (!selected) return;
    index = (index + amount + selected.tracks.length) % selected.tracks.length;
    playing = true;
    post({ type: "zendigo-cassette:play-at", index });
    updatePlayButton();
  }

  function eject() {
    post({ type: "zendigo-cassette:stop" });
    selected = null;
    index = 0;
    playing = false;
    videoOpen = false;
    const bay = machine()?.querySelector(".cassette-bay");
    bay?.querySelector(".inserted-tape")?.remove();
    if (bay && !bay.querySelector(".cassette-bay-empty")) {
      const empty = document.createElement("div");
      empty.className = "cassette-bay-empty";
      empty.innerHTML = "<span>NO TAPE</span>";
      bay.appendChild(empty);
    }
    machine()?.classList.remove("has-cassette", "is-player-open");
    engine()?.classList.remove("is-open");
    document.querySelectorAll(".cassette-case").forEach(button => {
      button.classList.remove("is-loaded");
      button.setAttribute("aria-pressed", "false");
    });
    controls().forEach((button, buttonIndex) => {
      if (buttonIndex !== 1) button.disabled = true;
    });
    updatePlayButton();
  }

  function toggleVideo() {
    if (!selected) return;
    videoOpen = !videoOpen;
    engine()?.classList.toggle("is-open", videoOpen);
    machine()?.classList.toggle("is-player-open", videoOpen);
    if (!videoOpen) engine()?.setAttribute("aria-hidden", "true");
    const videoLabel = controls()[4]?.querySelector("small");
    if (videoLabel) videoLabel.textContent = videoOpen ? "CLOSE" : "VIDEO";
  }

  function handleClick(event) {
    const tapeButton = event.target.closest?.(".cassette-case");
    if (tapeButton && !reactOwns(tapeButton)) {
      event.preventDefault();
      event.stopPropagation();
      const tape = identifyCase(tapeButton);
      if (tape) loadTape(tape);
      return;
    }

    const button = event.target.closest?.(".cassette-transport button");
    if (!button || reactOwns(button)) return;
    event.preventDefault();
    event.stopPropagation();
    const buttonIndex = controls().indexOf(button);
    if (buttonIndex === 0) step(-1);
    if (buttonIndex === 1) {
      if (!selected) return loadTape(tapes[0]);
      playing = !playing;
      post({ type: playing ? "zendigo-cassette:play" : "zendigo-cassette:pause" });
      updatePlayButton();
    }
    if (buttonIndex === 2) step(1);
    if (buttonIndex === 3) eject();
    if (buttonIndex === 4) toggleVideo();
  }

  function handleInput(event) {
    if (!event.target.matches?.('.cassette-volume-panel input[type="range"]')) return;
    if (reactOwns(event.target)) return;
    const volume = getVolume();
    post({ type: "zendigo-cassette:volume", volume, muted: volume === 0 });
  }

  function handleMessage(event) {
    if (event.origin !== PLAYER_ORIGIN || !event.data) return;
    if (event.data.type === "zendigo-cassette:ready") {
      ready = true;
      if (selected) loadTape(selected, index);
    }
    if (event.data.type === "zendigo-cassette:state" && selected) {
      playing = event.data.state === 1;
      if (Number.isFinite(event.data.index)) index = event.data.index;
      updatePlayButton();
    }
  }

  function startFallback() {
    ensureFiveCases();
    document.addEventListener("click", handleClick, true);
    document.addEventListener("input", handleInput, true);
    window.addEventListener("message", handleMessage);
    const observer = new MutationObserver(ensureFiveCases);
    const stack = document.querySelector(".cassette-case-stack");
    if (stack) observer.observe(stack, { childList: true, subtree: true });
    window.setInterval(ensureFiveCases, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startFallback, { once: true });
  } else {
    startFallback();
  }
})();
