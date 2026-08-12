(() => {
  const SELECTOR = ".cassette-machine";
  let machine = null;
  let meters = [];
  let volumeInput = null;
  let levels = [0, 0];
  let peaks = [0, 0];
  let holds = [0, 0];
  let readoutState = {
    cassetteId: null,
    mixtape: "SELECT A MIXTAPE",
    title: "NO TAPE LOADED",
    index: 0,
    total: 0,
    playerState: -1
  };

  const MIXTAPE_NAMES = {
    rush: "ALL RUSH MIXTAPE",
    "college-rock": "90S COLLEGE ROCK",
    "neon-vice": "NEON VICE: SUNSET DRIVE",
    "last-life": "LAST LIFE",
    "secret-level": "SECRET LEVEL"
  };

  function ensureReadout() {
    const deck = document.querySelector(SELECTOR);
    if (!deck) return null;
    const component = deck.closest(".cassette-component");
    if (!component) return null;
    let readout = component.querySelector(".cassette-readout-unit");
    if (!readout) {
      readout = document.createElement("section");
      readout.className = "cassette-readout-unit";
      readout.setAttribute("aria-label", "Cassette now playing display");
      readout.innerHTML = `
        <div class="readout-glass" aria-live="polite" aria-atomic="true">
          <svg class="readout-asteroid-field" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
            <g class="readout-stars">
              <circle cx="24" cy="19" r=".8"/><circle cx="81" cy="68" r=".65"/>
              <circle cx="147" cy="13" r=".55"/><circle cx="205" cy="52" r=".75"/>
              <circle cx="278" cy="25" r=".55"/><circle cx="336" cy="74" r=".7"/>
              <circle cx="411" cy="14" r=".7"/><circle cx="468" cy="58" r=".55"/>
              <circle cx="548" cy="29" r=".8"/><circle cx="585" cy="76" r=".6"/>
            </g>
            <path class="readout-rock readout-rock-one" d="M8 18l7-9 12 2 6 9-5 11-13 3-9-7z"/>
            <path class="readout-rock readout-rock-two" d="M4 10l9-7 10 5 2 11-8 8-12-4-3-7z"/>
            <path class="readout-rock readout-rock-three" d="M5 15l4-10 13-2 8 8-2 12-11 5-12-6z"/>
            <g class="readout-ship">
              <path d="M0 10L27 1 18 11 27 20 0 10z"/>
              <path class="readout-thrust" d="M3 8l-9-4m9 8l-9 4"/>
            </g>
            <path class="readout-shot" d="M0 0h24"/>
          </svg>
          <div class="readout-title-window"><strong class="readout-title"></strong></div>
          <div class="readout-meta">
            <span class="readout-mixtape"></span>
            <b class="readout-track"></b>
            <i class="readout-status"></i>
          </div>
        </div>`;
    }
    if (readout.parentElement !== deck) deck.appendChild(readout);
    return readout;
  }

  function playerStatus(state) {
    if (!readoutState.cassetteId) return "STANDBY";
    if (state === 1) return "PLAY";
    if (state === 2) return "PAUSE";
    if (state === 3) return "BUFFER";
    if (state === 0) return "END";
    return "READY";
  }

  function paintReadout() {
    const readout = ensureReadout();
    if (!readout) return;
    const title = String(readoutState.title || "NO TAPE LOADED").trim();
    const mixtape = String(readoutState.mixtape || "SELECT A MIXTAPE").trim();
    const titleNode = readout.querySelector(".readout-title");
    const mixtapeNode = readout.querySelector(".readout-mixtape");
    const trackNode = readout.querySelector(".readout-track");
    const statusNode = readout.querySelector(".readout-status");
    if (titleNode && titleNode.textContent !== title) titleNode.textContent = title;
    if (mixtapeNode && mixtapeNode.textContent !== mixtape) mixtapeNode.textContent = mixtape;
    if (trackNode) {
      const current = readoutState.index > 0 ? String(readoutState.index).padStart(2, "0") : "--";
      const total = readoutState.total > 0 ? String(readoutState.total).padStart(2, "0") : "--";
      const trackText = `TRACK ${current} / ${total}`;
      if (trackNode.textContent !== trackText) trackNode.textContent = trackText;
    }
    if (statusNode) {
      const status = playerStatus(readoutState.playerState);
      if (statusNode.textContent !== status) statusNode.textContent = status;
    }
    readout.classList.toggle("has-tape", Boolean(readoutState.cassetteId));
    readout.classList.toggle("is-playing", readoutState.playerState === 1);
    window.requestAnimationFrame(() => {
      const windowNode = readout.querySelector(".readout-title-window");
      if (!windowNode || !titleNode) return;
      const overflow = Math.max(0, titleNode.scrollWidth - windowNode.clientWidth);
      readout.style.setProperty("--readout-overflow", `${overflow}px`);
      readout.classList.toggle("is-scrolling", overflow > 4);
    });
  }

  function updateReadout(next = {}) {
    readoutState = { ...readoutState, ...next };
    if (next.cassetteId !== undefined) {
      readoutState.mixtape = next.cassetteId
        ? (next.mixtape || MIXTAPE_NAMES[next.cassetteId] || readoutState.mixtape)
        : "SELECT A MIXTAPE";
      if (!next.cassetteId) {
        readoutState.title = "NO TAPE LOADED";
        readoutState.index = 0;
        readoutState.total = 0;
        readoutState.playerState = -1;
      }
    }
    paintReadout();
  }

  window.__zendigoUpdateCassetteReadout = updateReadout;

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
    ensureReadout();
    paintReadout();
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

  function syncReadoutFromDeck() {
    if (!machine) return;
    const inserted = machine.querySelector(".inserted-tape");
    if (!inserted) {
      if (readoutState.cassetteId) updateReadout({ cassetteId: null });
      return;
    }

    const selectedCase = document.querySelector(".cassette-case.is-loaded");
    const caseWords = `${selectedCase?.getAttribute("aria-label") || ""} ${selectedCase?.textContent || ""}`.toLowerCase();
    const cassetteId = Object.keys(MIXTAPE_NAMES).find(id => {
      const name = MIXTAPE_NAMES[id].toLowerCase();
      return caseWords.includes(name) || (id === "rush" && caseWords.includes("all rush"));
    }) || readoutState.cassetteId;
    const hiddenTitle = machine.querySelector(".cassette-machine-display strong")?.textContent?.trim();
    const hiddenTrack = machine.querySelector(".cassette-machine-display small")?.textContent || "";
    const trackMatch = hiddenTrack.match(/TRACK\s+(\d+)\s*\/\s*(\d+)/i);
    const next = {};
    if (cassetteId && cassetteId !== readoutState.cassetteId) next.cassetteId = cassetteId;
    if (hiddenTitle && !/no cassette|select a case/i.test(hiddenTitle) && hiddenTitle !== readoutState.title) {
      next.title = hiddenTitle;
    }
    if (trackMatch) {
      next.index = Number(trackMatch[1]);
      next.total = Number(trackMatch[2]);
    }
    if (Object.keys(next).length) updateReadout(next);
  }

  function tick() {
    if (!machine || !machine.isConnected) connect();
    if (!machine || meters.length !== 2) return;
    labelControls(machine);
    ensureReadout();
    syncReadoutFromDeck();
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
    window.addEventListener("message", (event) => {
      if (event.origin !== "https://zendigo-redline-82.zendigo-playz.chatgpt.site" || !event.data) return;
      if (event.data.type === "zendigo-cassette:state") {
        const cassetteId = event.data.cassetteId || readoutState.cassetteId;
        updateReadout({
          cassetteId,
          mixtape: MIXTAPE_NAMES[cassetteId] || readoutState.mixtape,
          title: event.data.title?.trim() || readoutState.title,
          index: Number.isFinite(event.data.index) ? event.data.index + 1 : readoutState.index,
          total: Number.isFinite(event.data.total) ? event.data.total : readoutState.total,
          playerState: Number.isFinite(event.data.state) ? event.data.state : readoutState.playerState
        });
      }
      if (event.data.type === "zendigo-cassette:error") {
        updateReadout({ title: "TRACK UNAVAILABLE", playerState: -1 });
      }
    });
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
    if (selected) {
      window.__zendigoUpdateCassetteReadout?.({
        cassetteId: selected.id,
        mixtape: selected.label,
        index: index + 1,
        total: selected.tracks.length,
        playerState: playing ? 1 : 2
      });
    }
  }

  function loadTape(tape, nextIndex = 0) {
    selected = tape;
    index = Math.max(0, Math.min(tape.tracks.length - 1, nextIndex));
    playing = true;
    window.__zendigoUpdateCassetteReadout?.({
      cassetteId: tape.id,
      mixtape: tape.label,
      title: `LOADING TRACK ${String(index + 1).padStart(2, "0")}`,
      index: index + 1,
      total: tape.tracks.length,
      playerState: 3
    });
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
    window.__zendigoUpdateCassetteReadout?.({
      cassetteId: selected.id,
      mixtape: selected.label,
      title: `LOADING TRACK ${String(index + 1).padStart(2, "0")}`,
      index: index + 1,
      total: selected.tracks.length,
      playerState: 3
    });
    post({ type: "zendigo-cassette:play-at", index });
    updatePlayButton();
  }

  function eject() {
    post({ type: "zendigo-cassette:stop" });
    selected = null;
    index = 0;
    playing = false;
    videoOpen = false;
    window.__zendigoUpdateCassetteReadout?.({ cassetteId: null });
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
      window.__zendigoUpdateCassetteReadout?.({
        cassetteId: selected.id,
        mixtape: selected.label,
        title: event.data.title?.trim() || `TRACK ${String(index + 1).padStart(2, "0")}`,
        index: index + 1,
        total: event.data.total || selected.tracks.length,
        playerState: Number.isFinite(event.data.state) ? event.data.state : (playing ? 1 : 2)
      });
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
