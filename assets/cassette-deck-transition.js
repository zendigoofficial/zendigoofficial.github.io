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
    if (videoText && videoText.textContent !== "CLOSE") videoText.textContent = "VIDEO";
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
    const insetX = Math.max(3, rect.width * 0.022);
    const insetY = Math.max(3, rect.height * 0.035);
    engine.style.setProperty("--tv-left", `${rect.left + insetX}px`);
    engine.style.setProperty("--tv-top", `${rect.top + insetY}px`);
    engine.style.setProperty("--tv-width", `${Math.max(200, rect.width - insetX * 2)}px`);
    engine.style.setProperty("--tv-height", `${Math.max(113, rect.height - insetY * 2)}px`);
    engine.style.setProperty("--tv-ratio", "auto");
    engine.dataset.routedTo = "broadcast-tv";
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
    window.setInterval(tick, 90);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
