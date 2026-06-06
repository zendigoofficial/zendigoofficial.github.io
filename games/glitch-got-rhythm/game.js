const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

ctx.imageSmoothingEnabled = false;

const COLORS = {
  cyan: "#00FFEE",
  magenta: "#FF20FF",
  purple: "#A230F0",
  white: "#EEEEEE",
  muted: "#A9AEC3",
  black: "#05070d",
  green: "#65FF7A",
  gold: "#FFD84D",
  red: "#FF4D6D"
};

const CONFIG = {
  // Gameplay clock center.
  centerX: WIDTH / 2,
  centerY: HEIGHT / 2 + 68,

  clockRadius: 145,

  // Clock hand visual sizing/pivot.
  clockHandW: 52,
  clockHandH: 160,
  clockHandPivotOffsetY: 18,

  // Speed system.
  // Starts at 1.0x.
  // Increases by 0.1x every 10 successful jumps.
  // No speed cap.
  rotationMsStart: 1450,
  speedStepEvery: 10,
  speedStepAmount: 0.1,

  perfectWindowMs: 45,
  goodWindowMs: 95,
  allowedWindowMs: 150,

  // Glitch position.
  glitchBaseX: WIDTH / 2,
  glitchBaseY: HEIGHT / 2 - 104,

  jumpHeight: 96,
  jumpDurationMs: 330,

  glitchW: 132,
  glitchH: 132,

  fxSize: 120
};

const ASSET_PATHS = {
  body: {
    idle: [
      "assets/sprites/body/idle_01.png",
      "assets/sprites/body/idle_02.png"
    ],
    ready: [
      "assets/sprites/body/ready_01.png",
      "assets/sprites/body/ready_02.png"
    ],
    jump: [
      "assets/sprites/body/jump_takeoff.png",
      "assets/sprites/body/jump_01.png",
      "assets/sprites/body/jump_02.png"
    ],
    land: [
      "assets/sprites/body/land_01.png",
      "assets/sprites/body/land_02.png"
    ],
    panic: [
      "assets/sprites/body/panic_01.png",
      "assets/sprites/body/panic_02.png"
    ],
    gameover: [
      "assets/sprites/body/gameover_01.png",
      "assets/sprites/body/gameover_02.png"
    ]
  },

  clock: {
    hand: "assets/clock/clock_hand.png",
    marker: "assets/clock/hit_marker_12.png"
  },

  fx: {
    shadow: "assets/fx/character_shadow.png",
    combo: "assets/fx/combo_sparkle.png",
    miss: "assets/fx/miss_burst.png",
    perfect: "assets/fx/perfect_hit_spark.png"
  }
};

const assets = {
  body: {},
  clock: {},
  fx: {}
};

let loadedCount = 0;
let totalAssets = 0;

function loadImage(src){
  totalAssets++;

  const img = new Image();
  img.src = src;

  img.onload = () => {
    loadedCount++;
  };

  img.onerror = () => {
    loadedCount++;
    console.warn("Failed to load asset:", src);
  };

  return img;
}

function loadAssets(){
  for(const [group, paths] of Object.entries(ASSET_PATHS.body)){
    assets.body[group] = paths.map(path => loadImage(path));
  }

  assets.clock.hand = loadImage(ASSET_PATHS.clock.hand);
  assets.clock.marker = loadImage(ASSET_PATHS.clock.marker);

  assets.fx.shadow = loadImage(ASSET_PATHS.fx.shadow);
  assets.fx.combo = loadImage(ASSET_PATHS.fx.combo);
  assets.fx.miss = loadImage(ASSET_PATHS.fx.miss);
  assets.fx.perfect = loadImage(ASSET_PATHS.fx.perfect);
}

let gameState = "title";

let score = 0;
let combo = 0;
let bestCombo = 0;
let bestScore = Number(localStorage.getItem("glitchGotRhythmBestScore") || 0);

let successfulJumps = 0;
let speedMultiplier = 1.0;
let rotationMs = CONFIG.rotationMsStart;

let handAngle = -Math.PI / 2;
let totalAngle = -Math.PI * 0.72;
let nextTopAngle = 0;
let jumpedThisCycle = false;

let lastTimestamp = 0;
let jumpStartTime = -9999;
let currentTime = 0;

let feedback = "";
let feedbackColor = COLORS.cyan;
let feedbackTimer = 0;
let missFlash = 0;
let hitFlash = 0;

let particles = [];
let bgLines = [];
let fxPopups = [];

function initBackground(){
  bgLines = [];

  for(let i = 0; i < 80; i++){
    bgLines.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      speed: Math.random() * 0.45 + 0.12,
      length: Math.random() * 80 + 35,
      alpha: Math.random() * 0.35 + 0.08
    });
  }
}

function resetGame(){
  score = 0;
  combo = 0;
  bestCombo = 0;

  successfulJumps = 0;
  speedMultiplier = 1.0;
  rotationMs = CONFIG.rotationMsStart;

  totalAngle = -Math.PI * 0.72;
  nextTopAngle = 0;
  handAngle = -Math.PI / 2 + totalAngle;
  jumpedThisCycle = false;

  jumpStartTime = -9999;
  currentTime = performance.now();

  feedback = "";
  feedbackTimer = 0;
  missFlash = 0;
  hitFlash = 0;

  particles = [];
  fxPopups = [];
}

function startGame(){
  resetGame();
  gameState = "playing";
}

function restartToTitle(){
  resetGame();
  gameState = "title";
}

function updateSpeedFromJumps(){
  const speedLevel = Math.floor(successfulJumps / CONFIG.speedStepEvery);
  speedMultiplier = 1 + speedLevel * CONFIG.speedStepAmount;
  rotationMs = CONFIG.rotationMsStart / speedMultiplier;
}

function attemptJump(){
  if(gameState === "title"){
    startGame();
    return;
  }

  if(gameState === "gameover"){
    startGame();
    return;
  }

  if(gameState !== "playing"){
    return;
  }

  const diffAngle = Math.abs(totalAngle - nextTopAngle);
  const anglePerMs = (Math.PI * 2) / rotationMs;
  const diffMs = diffAngle / anglePerMs;

  if(diffMs <= CONFIG.perfectWindowMs){
    registerJump("PERFECT JUMP", COLORS.gold, 125, "perfect");
  }else if(diffMs <= CONFIG.goodWindowMs){
    registerJump("GOOD JUMP", COLORS.green, 75, "combo");
  }else if(diffMs <= CONFIG.allowedWindowMs){
    registerJump("BARELY", COLORS.magenta, 35, "combo");
  }else{
    registerMiss("BAD JUMP");
  }
}

function registerJump(label, color, points, fxType){
  if(jumpedThisCycle){
    return;
  }

  jumpedThisCycle = true;
  jumpStartTime = performance.now();

  combo++;
  successfulJumps++;

  bestCombo = Math.max(bestCombo, combo);
  score += points + Math.min(combo * 5, 250);

  updateSpeedFromJumps();

  if(score > bestScore){
    bestScore = score;
    localStorage.setItem("glitchGotRhythmBestScore", String(bestScore));
  }

  feedback = label;
  feedbackColor = color;
  feedbackTimer = 34;
  hitFlash = 18;

  spawnBurst(CONFIG.glitchBaseX, CONFIG.glitchBaseY, color, 18);
  spawnFx(fxType, CONFIG.glitchBaseX, CONFIG.glitchBaseY - 16);
}

function registerMiss(label){
  combo = 0;
  feedback = label;
  feedbackColor = COLORS.red;
  feedbackTimer = 45;
  missFlash = 32;

  spawnBurst(CONFIG.glitchBaseX, CONFIG.glitchBaseY, COLORS.red, 26);
  spawnFx("miss", CONFIG.glitchBaseX, CONFIG.glitchBaseY - 10);

  endGame();
}

function endGame(){
  gameState = "gameover";

  if(score > bestScore){
    bestScore = score;
    localStorage.setItem("glitchGotRhythmBestScore", String(bestScore));
  }
}

function spawnFx(type, x, y){
  let img = null;

  if(type === "perfect"){
    img = assets.fx.perfect;
  }

  if(type === "combo"){
    img = assets.fx.combo;
  }

  if(type === "miss"){
    img = assets.fx.miss;
  }

  if(!img){
    return;
  }

  fxPopups.push({
    img,
    x,
    y,
    life: 32,
    size: CONFIG.fxSize
  });
}

function update(timestamp){
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  currentTime = timestamp;

  updateBackground();
  updateParticles();
  updateFxPopups();

  if(feedbackTimer > 0){
    feedbackTimer--;
  }

  if(hitFlash > 0){
    hitFlash--;
  }

  if(missFlash > 0){
    missFlash--;
  }

  if(gameState !== "playing"){
    return;
  }

  const anglePerMs = (Math.PI * 2) / rotationMs;

  totalAngle += anglePerMs * delta;
  handAngle = -Math.PI / 2 + totalAngle;

  const toleranceAngle = anglePerMs * CONFIG.allowedWindowMs;

  if(totalAngle > nextTopAngle + toleranceAngle && !jumpedThisCycle){
    registerMiss("MISSED BEAT");
    return;
  }

  if(totalAngle > nextTopAngle + toleranceAngle && jumpedThisCycle){
    nextTopAngle += Math.PI * 2;
    jumpedThisCycle = false;
  }
}

function updateBackground(){
  bgLines.forEach(line => {
    line.x -= line.speed;

    if(line.x + line.length < 0){
      line.x = WIDTH + Math.random() * 100;
      line.y = Math.random() * HEIGHT;
    }
  });
}

function updateParticles(){
  particles.forEach(particle => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life--;
    particle.size *= 0.985;
  });

  particles = particles.filter(particle => particle.life > 0);
}

function updateFxPopups(){
  fxPopups.forEach(fx => {
    fx.life--;
    fx.size += 2;
    fx.y -= 0.6;
  });

  fxPopups = fxPopups.filter(fx => fx.life > 0);
}

function spawnBurst(x, y, color, count){
  for(let i = 0; i < count; i++){
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 18 + 16,
      size: Math.random() * 5 + 2,
      color
    });
  }
}

function draw(){
  ctx.imageSmoothingEnabled = false;

  drawBackground();
  drawClockFace();
  drawGlitch();
  drawParticles();
  drawFxPopups();
  drawHud();

  if(gameState === "title"){
    drawTitleScreen();
  }

  if(gameState === "gameover"){
    drawGameOver();
  }

  requestAnimationFrame(loop);
}

function loop(timestamp){
  if(!lastTimestamp){
    lastTimestamp = timestamp;
  }

  update(timestamp);
  draw();
}

function drawBackground(){
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#05070d");
  gradient.addColorStop(0.45, "#0d1024");
  gradient.addColorStop(1, "#05070d");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();

  bgLines.forEach(line => {
    ctx.globalAlpha = line.alpha;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(line.x + line.length, line.y);
    ctx.stroke();
  });

  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = COLORS.magenta;

  for(let y = 40; y < HEIGHT; y += 58){
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  ctx.restore();

  if(missFlash > 0){
    ctx.save();
    ctx.globalAlpha = missFlash / 80;
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }
}

function drawClockFace(){
  const cx = CONFIG.centerX;
  const cy = CONFIG.centerY;

  drawGeneratedClockRing(cx, cy);
  drawTwelveMarker();
  drawClockHand();

  if(feedbackTimer > 0){
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "900 38px Orbitron, Arial";
    ctx.fillStyle = feedbackColor;
    ctx.shadowColor = feedbackColor;
    ctx.shadowBlur = 18;
    ctx.fillText(feedback, cx, cy - CONFIG.clockRadius - 52);
    ctx.restore();
  }
}

function drawGeneratedClockRing(cx, cy){
  const r = CONFIG.clockRadius;

  ctx.save();

  const faceGradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, r);
  faceGradient.addColorStop(0, "rgba(5,7,13,.10)");
  faceGradient.addColorStop(0.72, "rgba(5,7,13,.28)");
  faceGradient.addColorStop(1, "rgba(0,255,238,.07)");

  ctx.fillStyle = faceGradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,255,238,.52)";
  ctx.lineWidth = 5;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,32,255,.35)";
  ctx.lineWidth = 3;
  ctx.shadowColor = COLORS.magenta;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 24, 0, Math.PI * 2);
  ctx.stroke();

  for(let i = 0; i < 12; i++){
    const angle = (Math.PI * 2 / 12) * i - Math.PI / 2;
    const isMajor = i % 3 === 0;
    const isTop = i === 0;

    const inner = r - (isMajor ? 28 : 18);
    const outer = r + (isTop ? 10 : isMajor ? 4 : 0);

    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * outer;
    const y2 = cy + Math.sin(angle) * outer;

    ctx.strokeStyle = isTop ? COLORS.gold : isMajor ? COLORS.magenta : COLORS.cyan;
    ctx.lineWidth = isTop ? 7 : isMajor ? 5 : 3;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = isTop ? 18 : 10;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const topAngle = -Math.PI / 2;
  const arc = 0.25;

  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 13;
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, topAngle - arc, topAngle + arc);
  ctx.stroke();

  ctx.fillStyle = COLORS.black;
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 4;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawTwelveMarker(){
  const cx = CONFIG.centerX;
  const cy = CONFIG.centerY;
  const r = CONFIG.clockRadius;

  const markerX = cx;
  const markerY = cy - r - 20;

  if(assets.clock.marker && assets.clock.marker.complete){
    ctx.save();
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 16;
    ctx.drawImage(assets.clock.marker, markerX - 28, markerY - 28, 56, 56);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(markerX, markerY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClockHand(){
  const cx = CONFIG.centerX;
  const cy = CONFIG.centerY;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(handAngle + Math.PI / 2);

  if(assets.clock.hand && assets.clock.hand.complete){
    ctx.shadowColor = hitFlash > 0 ? feedbackColor : COLORS.cyan;
    ctx.shadowBlur = 16;

    ctx.drawImage(
      assets.clock.hand,
      -CONFIG.clockHandW / 2,
      -CONFIG.clockHandH + CONFIG.clockHandPivotOffsetY,
      CONFIG.clockHandW,
      CONFIG.clockHandH
    );
  }else{
    ctx.strokeStyle = hitFlash > 0 ? feedbackColor : COLORS.white;
    ctx.lineWidth = 7;
    ctx.shadowColor = hitFlash > 0 ? feedbackColor : COLORS.cyan;
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -CONFIG.clockRadius + 8);
    ctx.stroke();
  }

  ctx.restore();
}

function getGlitchFrame(){
  const elapsedJump = currentTime - jumpStartTime;
  const isJumping = elapsedJump >= 0 && elapsedJump <= CONFIG.jumpDurationMs;

  if(gameState === "gameover"){
    return getAnimatedFrame(assets.body.gameover, 14);
  }

  if(isJumping){
    const t = elapsedJump / CONFIG.jumpDurationMs;

    if(t < 0.25){
      return assets.body.jump[0];
    }

    if(t < 0.65){
      return assets.body.jump[1];
    }

    return assets.body.jump[2];
  }

  if(feedbackTimer > 0 && feedbackColor === COLORS.red){
    return getAnimatedFrame(assets.body.panic, 10);
  }

  if(feedbackTimer > 0){
    return getAnimatedFrame(assets.body.ready, 8);
  }

  return getAnimatedFrame(assets.body.idle, 18);
}

function getAnimatedFrame(list, speed){
  if(!list || list.length === 0){
    return null;
  }

  const index = Math.floor(performance.now() / (speed * 16)) % list.length;
  return list[index];
}

function drawGlitch(){
  const baseX = CONFIG.glitchBaseX;
  const baseY = CONFIG.glitchBaseY;

  const elapsedJump = currentTime - jumpStartTime;
  let jumpOffset = 0;

  if(elapsedJump >= 0 && elapsedJump <= CONFIG.jumpDurationMs){
    const t = elapsedJump / CONFIG.jumpDurationMs;
    jumpOffset = Math.sin(t * Math.PI) * CONFIG.jumpHeight;
  }

  const x = baseX;
  const y = baseY - jumpOffset;

  drawCharacterShadow(baseX, CONFIG.glitchBaseY + 62, jumpOffset);

  const frame = getGlitchFrame();

  if(frame && frame.complete){
    ctx.save();
    ctx.shadowColor = gameState === "gameover" ? COLORS.red : COLORS.cyan;
    ctx.shadowBlur = gameState === "gameover" ? 8 : 12;

    ctx.drawImage(
      frame,
      x - CONFIG.glitchW / 2,
      y - CONFIG.glitchH / 2,
      CONFIG.glitchW,
      CONFIG.glitchH
    );

    ctx.restore();
    return;
  }

  drawGlitchFallback(x, y);
}

function drawCharacterShadow(x, y, jumpOffset){
  const scale = Math.max(0.45, 1 - jumpOffset / 170);

  if(assets.fx.shadow && assets.fx.shadow.complete){
    ctx.save();
    ctx.globalAlpha = 0.55 * scale;
    ctx.drawImage(
      assets.fx.shadow,
      x - 56 * scale,
      y - 10 * scale,
      112 * scale,
      28 * scale
    );
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.32 * scale;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(x, y, 46 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlitchFallback(x, y){
  ctx.save();
  ctx.translate(x, y);
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "#090912";
  ctx.fillRect(-58, -58, 24, 58);
  ctx.fillRect(34, -58, 24, 58);

  ctx.fillStyle = "#241531";
  ctx.fillRect(-51, -47, 10, 36);
  ctx.fillRect(41, -47, 10, 36);

  ctx.fillStyle = "#07070d";
  ctx.fillRect(-45, -34, 90, 82);
  ctx.fillRect(-31, 38, 62, 38);

  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(-36, -42, 22, 7);
  ctx.fillRect(12, 54, 28, 7);

  ctx.fillStyle = COLORS.magenta;
  ctx.fillRect(18, -42, 22, 7);
  ctx.fillRect(-42, 54, 22, 7);

  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(-24, -8, 17, 17);

  ctx.fillStyle = COLORS.magenta;
  ctx.fillRect(8, -8, 17, 17);

  ctx.fillStyle = COLORS.white;
  ctx.fillRect(-13, 30, 26, 6);

  ctx.restore();
}

function drawParticles(){
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 34;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });

  ctx.globalAlpha = 1;
}

function drawFxPopups(){
  fxPopups.forEach(fx => {
    if(!fx.img || !fx.img.complete){
      return;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, fx.life / 32);
    ctx.drawImage(
      fx.img,
      fx.x - fx.size / 2,
      fx.y - fx.size / 2,
      fx.size,
      fx.size
    );
    ctx.restore();
  });
}

function drawHud(){
  ctx.save();

  ctx.font = "900 24px Orbitron, Arial";
  ctx.fillStyle = COLORS.cyan;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 10;
  ctx.fillText(`SCORE: ${score}`, 28, 42);

  ctx.fillStyle = COLORS.magenta;
  ctx.shadowColor = COLORS.magenta;
  ctx.fillText(`COMBO: ${combo}`, 28, 74);

  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = COLORS.gold;
  ctx.fillText(`BEST: ${bestScore}`, 28, 106);

  ctx.fillStyle = COLORS.white;
  ctx.shadowColor = COLORS.white;
  ctx.font = "900 15px Orbitron, Arial";
  ctx.fillText(`SPEED: ${speedMultiplier.toFixed(1)}x`, WIDTH - 190, 42);
  ctx.fillText(`JUMPS: ${successfulJumps}`, WIDTH - 190, 66);

  ctx.restore();
}

function drawTitleScreen(){
  drawOverlay();

  ctx.save();
  ctx.textAlign = "center";

  ctx.font = "900 56px Orbitron, Arial";
  ctx.fillStyle = COLORS.cyan;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 18;
  ctx.fillText("GLITCH GOT RHYTHM", WIDTH / 2, HEIGHT / 2 - 170);

  ctx.font = "900 22px Orbitron, Arial";
  ctx.fillStyle = COLORS.magenta;
  ctx.shadowColor = COLORS.magenta;
  ctx.fillText("JUMP THE CLOCK HAND AT 12 O'CLOCK", WIDTH / 2, HEIGHT / 2 - 132);

  ctx.font = "900 24px Orbitron, Arial";
  ctx.fillStyle = COLORS.white;
  ctx.shadowBlur = 0;
  ctx.fillText("CLICK / TAP / SPACE TO START", WIDTH / 2, HEIGHT / 2 + 174);

  ctx.font = "700 16px Orbitron, Arial";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("Speed increases by 0.1x every 10 jumps. No speed cap.", WIDTH / 2, HEIGHT / 2 + 204);

  ctx.restore();
}

function drawGameOver(){
  drawOverlay();

  ctx.save();
  ctx.textAlign = "center";

  ctx.font = "900 58px Orbitron, Arial";
  ctx.fillStyle = COLORS.magenta;
  ctx.shadowColor = COLORS.magenta;
  ctx.shadowBlur = 18;
  ctx.fillText("BROADCAST LOST", WIDTH / 2, HEIGHT / 2 - 118);

  ctx.font = "900 24px Orbitron, Arial";
  ctx.fillStyle = COLORS.cyan;
  ctx.shadowColor = COLORS.cyan;
  ctx.fillText(`FINAL SCORE: ${score}`, WIDTH / 2, HEIGHT / 2 - 66);

  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = COLORS.gold;
  ctx.fillText(`BEST COMBO: ${bestCombo}`, WIDTH / 2, HEIGHT / 2 - 32);

  ctx.font = "900 22px Orbitron, Arial";
  ctx.fillStyle = COLORS.white;
  ctx.shadowBlur = 0;
  ctx.fillText("CLICK / TAP / SPACE TO REBOOT RHYTHM", WIDTH / 2, HEIGHT / 2 + 180);

  ctx.restore();
}

function drawOverlay(){
  ctx.save();

  ctx.fillStyle = "rgba(5,7,13,.72)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(0,255,238,.28)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, WIDTH - 48, HEIGHT - 48);

  ctx.restore();
}

window.addEventListener("keydown", event => {
  if(event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW"){
    event.preventDefault();
    attemptJump();
  }

  if(event.code === "KeyR"){
    event.preventDefault();
    restartToTitle();
  }
});

canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  attemptJump();
});

loadAssets();
initBackground();
resetGame();
requestAnimationFrame(loop);
