(() => {
  const SELECTOR = ".cassette-machine";
  let machine = null;
  let meters = [];
  let volumeInput = null;
  let levels = [0, 0];
  let peaks = [0, 0];
  let holds = [0, 0];
  let gameModal = null;
  let gameReturnFocus = null;
  let gameBodyOverflow = "";
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

  function installAsteroidGame(readout) {
    const canvas = readout.querySelector(".readout-asteroid-field");
    if (!canvas || canvas.dataset.gameReady) return;
    canvas.dataset.gameReady = "true";

    let context = null;
    try {
      context = canvas.getContext("2d");
    } catch (_) {
      return;
    }
    if (!context) return;

    const random = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
    let width = 600;
    let height = 90;
    let lastFrame = performance.now();
    let fireDelay = .35;
    let respawnDelay = 0;
    let rocks = [];
    let bullets = [];
    let particles = [];
    let stars = [];
    const ship = { x: 390, y: 45, vx: 0, vy: 0, angle: Math.PI, alive: true, thrusting: false };

    function rockRadius(size) {
      return size === 3 ? 12 : size === 2 ? 8 : 4.7;
    }

    function makeRock(size, x, y, vx, vy) {
      const radius = rockRadius(size);
      const vertices = Array.from({ length: 9 }, (_, index) => ({
        angle: (Math.PI * 2 * index) / 9,
        radius: radius * random(.68, 1.18)
      }));
      return {
        size,
        x,
        y,
        vx,
        vy,
        angle: random(0, Math.PI * 2),
        spin: random(-1.15, 1.15),
        radius,
        vertices
      };
    }

    function spawnRock(size = Math.random() > .3 ? 3 : 2) {
      const radius = rockRadius(size);
      const edge = Math.floor(random(0, 4));
      let x = random(0, width);
      let y = random(0, height);
      if (edge === 0) x = -radius;
      if (edge === 1) x = width + radius;
      if (edge === 2) y = -radius;
      if (edge === 3) y = height + radius;
      const targetX = random(width * .2, width * .8);
      const targetY = random(height * .2, height * .8);
      const direction = Math.atan2(targetY - y, targetX - x) + random(-.38, .38);
      const speed = random(8, 15) + (3 - size) * 4;
      rocks.push(makeRock(size, x, y, Math.cos(direction) * speed, Math.sin(direction) * speed));
    }

    function resetScene() {
      rocks = [];
      bullets = [];
      particles = [];
      stars = Array.from({ length: 24 }, () => ({
        x: random(0, width),
        y: random(0, height),
        size: random(.35, 1),
        alpha: random(.15, .5)
      }));
      ship.x = width * .66;
      ship.y = height * .52;
      ship.vx = 0;
      ship.vy = 0;
      ship.angle = Math.PI;
      ship.alive = true;
      respawnDelay = 0;
      for (let index = 0; index < 5; index += 1) spawnRock(index < 3 ? 3 : 2);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(240, Math.round(bounds.width || 600));
      const nextHeight = Math.max(54, Math.round(bounds.height || 90));
      if (nextWidth === width && nextHeight === height && canvas.width) return;
      width = nextWidth;
      height = nextHeight;
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      resetScene();
    }

    function wrap(body, margin = 0) {
      if (body.x < -margin) body.x = width + margin;
      if (body.x > width + margin) body.x = -margin;
      if (body.y < -margin) body.y = height + margin;
      if (body.y > height + margin) body.y = -margin;
    }

    function burst(x, y, amount, speed = 22) {
      for (let index = 0; index < amount; index += 1) {
        const direction = random(0, Math.PI * 2);
        const velocity = random(speed * .35, speed);
        particles.push({
          x,
          y,
          vx: Math.cos(direction) * velocity,
          vy: Math.sin(direction) * velocity,
          life: random(.22, .62),
          length: random(1.5, 4)
        });
      }
    }

    function breakRock(rockIndex) {
      const rock = rocks[rockIndex];
      rocks.splice(rockIndex, 1);
      burst(rock.x, rock.y, rock.size === 3 ? 10 : 7, 29);
      if (rock.size > 1) {
        for (let index = 0; index < 2; index += 1) {
          const direction = Math.atan2(rock.vy, rock.vx) + (index ? .9 : -.9) + random(-.25, .25);
          const speed = Math.hypot(rock.vx, rock.vy) * 1.15 + random(5, 10);
          rocks.push(makeRock(
            rock.size - 1,
            rock.x,
            rock.y,
            Math.cos(direction) * speed,
            Math.sin(direction) * speed
          ));
        }
      }
    }

    function wrappedDistance(first, second) {
      let dx = second.x - first.x;
      let dy = second.y - first.y;
      if (Math.abs(dx) > width / 2) dx -= Math.sign(dx) * width;
      if (Math.abs(dy) > height / 2) dy -= Math.sign(dy) * height;
      return { dx, dy, distance: Math.hypot(dx, dy) };
    }

    function updateShip(delta) {
      if (!ship.alive) {
        respawnDelay -= delta;
        if (respawnDelay <= 0) {
          ship.x = width * .64;
          ship.y = height * .5;
          ship.vx = 0;
          ship.vy = 0;
          ship.angle = Math.PI;
          ship.alive = true;
        }
        return;
      }

      let target = null;
      for (const rock of rocks) {
        const position = wrappedDistance(ship, rock);
        if (!target || position.distance < target.distance) target = { rock, ...position };
      }
      if (!target) return;

      const avoiding = target.distance < 27;
      const desiredAngle = Math.atan2(target.dy, target.dx) + (avoiding ? Math.PI : 0);
      const angleDifference = Math.atan2(Math.sin(desiredAngle - ship.angle), Math.cos(desiredAngle - ship.angle));
      ship.angle += clamp(angleDifference, -2.8 * delta, 2.8 * delta);
      ship.thrusting = avoiding || Math.abs(angleDifference) > .42 || Math.sin(performance.now() / 640) > .44;

      if (ship.thrusting) {
        ship.vx += Math.cos(ship.angle) * 15 * delta;
        ship.vy += Math.sin(ship.angle) * 15 * delta;
      }
      const drag = Math.pow(.986, delta * 60);
      ship.vx *= drag;
      ship.vy *= drag;
      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > 22) {
        ship.vx = (ship.vx / speed) * 22;
        ship.vy = (ship.vy / speed) * 22;
      }
      ship.x += ship.vx * delta;
      ship.y += ship.vy * delta;
      wrap(ship, 7);

      fireDelay -= delta;
      if (!avoiding && Math.abs(angleDifference) < .16 && fireDelay <= 0) {
        const noseX = ship.x + Math.cos(ship.angle) * 8;
        const noseY = ship.y + Math.sin(ship.angle) * 8;
        bullets.push({
          x: noseX,
          y: noseY,
          vx: ship.vx + Math.cos(ship.angle) * 112,
          vy: ship.vy + Math.sin(ship.angle) * 112,
          life: 1.25
        });
        fireDelay = random(.32, .62);
      }
    }

    function update(delta) {
      updateShip(delta);
      rocks.forEach(rock => {
        rock.x += rock.vx * delta;
        rock.y += rock.vy * delta;
        rock.angle += rock.spin * delta;
        wrap(rock, rock.radius);
      });

      bullets.forEach(bullet => {
        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;
        bullet.life -= delta;
        wrap(bullet, 1);
      });
      bullets = bullets.filter(bullet => bullet.life > 0);

      for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
        for (let rockIndex = rocks.length - 1; rockIndex >= 0; rockIndex -= 1) {
          if (wrappedDistance(bullets[bulletIndex], rocks[rockIndex]).distance > rocks[rockIndex].radius) continue;
          bullets.splice(bulletIndex, 1);
          breakRock(rockIndex);
          break;
        }
      }

      if (ship.alive) {
        for (let rockIndex = rocks.length - 1; rockIndex >= 0; rockIndex -= 1) {
          if (wrappedDistance(ship, rocks[rockIndex]).distance > rocks[rockIndex].radius + 4.5) continue;
          burst(ship.x, ship.y, 15, 36);
          ship.alive = false;
          ship.thrusting = false;
          respawnDelay = .85;
          breakRock(rockIndex);
          break;
        }
      }

      particles.forEach(particle => {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.life -= delta;
      });
      particles = particles.filter(particle => particle.life > 0);
      while (rocks.length < 5) spawnRock();
      if (rocks.length > 13) rocks.splice(0, rocks.length - 13);
    }

    function drawRock(rock) {
      context.save();
      context.translate(rock.x, rock.y);
      context.rotate(rock.angle);
      context.beginPath();
      rock.vertices.forEach((vertex, index) => {
        const x = Math.cos(vertex.angle) * vertex.radius;
        const y = Math.sin(vertex.angle) * vertex.radius;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.stroke();
      context.restore();
    }

    function drawShip() {
      if (!ship.alive) return;
      context.save();
      context.translate(ship.x, ship.y);
      context.rotate(ship.angle);
      context.beginPath();
      context.moveTo(8, 0);
      context.lineTo(-6, -5);
      context.lineTo(-3, 0);
      context.lineTo(-6, 5);
      context.closePath();
      context.stroke();
      if (ship.thrusting) {
        context.beginPath();
        context.moveTo(-4, -2.5);
        context.lineTo(-random(8, 13), 0);
        context.lineTo(-4, 2.5);
        context.stroke();
      }
      context.restore();
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";
      stars.forEach(star => {
        context.globalAlpha = star.alpha;
        context.fillStyle = "#75e7c2";
        context.fillRect(star.x, star.y, star.size, star.size);
      });
      context.globalAlpha = .78;
      context.strokeStyle = "#74efc5";
      context.fillStyle = "#8bffd6";
      context.lineWidth = .85;
      context.lineJoin = "round";
      context.shadowColor = "#32d9a4";
      context.shadowBlur = 2.2;
      rocks.forEach(drawRock);
      drawShip();
      bullets.forEach(bullet => {
        context.beginPath();
        context.arc(bullet.x, bullet.y, 1.05, 0, Math.PI * 2);
        context.fill();
      });
      particles.forEach(particle => {
        context.globalAlpha = clamp(particle.life * 2.4, 0, .9);
        const speed = Math.hypot(particle.vx, particle.vy) || 1;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(
          particle.x - (particle.vx / speed) * particle.length,
          particle.y - (particle.vy / speed) * particle.length
        );
        context.stroke();
      });
      context.restore();
    }

    function frame(now) {
      if (!canvas.isConnected) return;
      resize();
      const delta = clamp((now - lastFrame) / 1000, 0, .04);
      lastFrame = now;
      if (!reduceMotion && !document.hidden && readout.classList.contains("is-playing")) update(delta);
      draw();
      window.requestAnimationFrame(frame);
    }

    if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(canvas);
    resize();
    window.requestAnimationFrame(frame);
  }

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
          <canvas class="readout-asteroid-field" aria-hidden="true"></canvas>
          <div class="readout-title-window"><strong class="readout-title"></strong></div>
          <div class="readout-meta">
            <span class="readout-mixtape"></span>
            <b class="readout-track"></b>
            <i class="readout-status"></i>
          </div>
        </div>`;
    }
    if (readout.parentElement !== deck) deck.appendChild(readout);
    installAsteroidGame(readout);
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

  function syncGameSystem() {
    const system = document.querySelector(".game-system-section");
    if (!system) return;
    const modalOpen = Boolean(document.querySelector(".game-modal-backdrop"));
    const display = system.querySelector(".game-system-status strong");
    const caseButton = system.querySelector(".game-storage-case");
    system.classList.toggle("is-running", modalOpen);
    const displayText = modalOpen ? "FLAPPY FACE" : "GAME READY";
    const expanded = String(modalOpen);
    if (display && display.textContent !== displayText) display.textContent = displayText;
    if (caseButton && caseButton.getAttribute("aria-expanded") !== expanded) {
      caseButton.setAttribute("aria-expanded", expanded);
    }
  }

  function closeGameModal() {
    if (!gameModal) return;
    const escapeHandler = gameModal._escapeHandler;
    if (escapeHandler) window.removeEventListener("keydown", escapeHandler);
    gameModal.remove();
    gameModal = null;
    document.body.style.overflow = gameBodyOverflow;
    gameReturnFocus?.focus?.();
    gameReturnFocus = null;
    syncGameSystem();
  }

  function openGameModal(trigger) {
    if (gameModal?.isConnected) {
      gameModal.querySelector(".game-modal-header button")?.focus();
      return;
    }
    gameReturnFocus = trigger || document.activeElement;
    gameBodyOverflow = document.body.style.overflow;
    gameModal = document.createElement("div");
    gameModal.className = "game-modal-backdrop";
    gameModal.dataset.gameSystemModal = "true";
    gameModal.innerHTML = `
      <section class="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-system-flappy-title">
        <header class="game-modal-header">
          <div><span>FULL SCREEN GAME</span><h2 id="game-system-flappy-title">Flappy Face</h2></div>
          <button type="button" aria-label="Close Flappy Face and return to the homepage">Close <span aria-hidden="true">×</span></button>
        </header>
        <div class="game-modal-frame">
          <iframe src="/games/flappy-face/?embed=1" title="Play Flappy Face" allow="autoplay; gamepad" loading="eager"></iframe>
        </div>
      </section>`;
    gameModal.querySelector(".game-modal-header button")?.addEventListener("click", closeGameModal);
    gameModal.addEventListener("mousedown", event => {
      if (event.target === gameModal) closeGameModal();
    });
    gameModal._escapeHandler = event => {
      if (event.key === "Escape") closeGameModal();
    };
    window.addEventListener("keydown", gameModal._escapeHandler);
    document.body.style.overflow = "hidden";
    document.body.appendChild(gameModal);
    syncGameSystem();
    gameModal.querySelector(".game-modal-header button")?.focus();
  }

  function ensureGameSystem() {
    const component = document.querySelector(".cassette-component");
    const deck = component?.querySelector(SELECTOR);
    if (!component || !deck) return null;
    let system = component.querySelector(".game-system-section");
    if (!system) {
      system = document.createElement("section");
      system.className = "game-system-section";
      system.setAttribute("aria-label", "Game console and game case cabinet");
      system.innerHTML = `
        <div class="game-system-console" aria-label="Decorative late 1980s style game console">
          <span class="game-system-screw game-system-screw-one" aria-hidden="true"></span>
          <span class="game-system-screw game-system-screw-two" aria-hidden="true"></span>
          <div class="game-console-switches" aria-hidden="true">
            <span><i></i><small>POWER</small></span>
            <span><i></i><small>RESET</small></span>
          </div>
          <div class="game-console-bay" aria-hidden="true"><span></span><i></i></div>
          <div class="game-system-status" aria-live="polite"><i aria-hidden="true"></i><strong>GAME READY</strong></div>
          <div class="game-controller-ports" aria-hidden="true">
            <span><i></i><small>CONTROLLER 1</small></span>
            <span><i></i><small>CONTROLLER 2</small></span>
          </div>
        </div>
        <div class="game-storage-cabinet" aria-label="Game case storage">
          <span class="game-cabinet-rail game-cabinet-rail-left" aria-hidden="true"></span>
          <span class="game-cabinet-rail game-cabinet-rail-right" aria-hidden="true"></span>
          <div class="game-storage-grid">
            <button class="game-storage-slot game-storage-case" type="button" aria-label="Play Flappy Face full screen" aria-haspopup="dialog" aria-expanded="false">
              <img src="/games/flappy-face/assets/flappy_face_game_case.webp" alt="Flappy Face game case" width="1178" height="296">
            </button>
            <span class="game-storage-slot is-empty" aria-hidden="true"></span>
            <span class="game-storage-slot is-empty" aria-hidden="true"></span>
            <span class="game-storage-slot is-empty" aria-hidden="true"></span>
            <span class="game-storage-slot is-empty" aria-hidden="true"></span>
            <span class="game-storage-slot is-empty" aria-hidden="true"></span>
            <span class="game-storage-slot is-empty" aria-hidden="true"></span>
            <span class="game-storage-slot is-empty" aria-hidden="true"></span>
          </div>
        </div>`;
      deck.insertAdjacentElement("afterend", system);
      system.querySelector(".game-storage-case")?.addEventListener("click", event => {
        openGameModal(event.currentTarget);
      });
    }
    syncGameSystem();
    return system;
  }

  function connect() {
    const nextMachine = document.querySelector(SELECTOR);
    if (!nextMachine) return;
    machine = nextMachine;
    meters = Array.from(machine.querySelectorAll(".vu-meter"));
    volumeInput = machine.querySelector('.cassette-volume-panel input[type="range"]');
    labelControls(machine);
    ensureReadout();
    ensureGameSystem();
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
    ensureGameSystem();
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
    syncGameSystem();
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
