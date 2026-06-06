const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

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
  centerX: WIDTH / 2,
  centerY: HEIGHT / 2 + 48,

  clockRadius: 145,
  handLength: 138,

  // One full rotation timing.
  // Lower number = faster/harder.
  rotationMsStart: 1450,
  rotationMsMin: 820,
  speedUpPerJump: 10,

  // Timing leeway around 12 o'clock.
  perfectWindowMs: 45,
  goodWindowMs: 95,
  allowedWindowMs: 145,

  // Glitch position at 12 o'clock.
  glitchBaseX: WIDTH / 2,
  glitchBaseY: HEIGHT / 2 - 122,

  jumpHeight: 92,
  jumpDurationMs: 330
};

let gameState = "title";

let score = 0;
let combo = 0;
let bestCombo = 0;
let bestScore = Number(localStorage.getItem("glitchGotRhythmBestScore") || 0);

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
}

function startGame(){
  resetGame();
  gameState = "playing";
}

function restartToTitle(){
  resetGame();
  gameState = "title";
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
    registerJump("PERFECT JUMP", COLORS.gold, 125);
  }else if(diffMs <= CONFIG.goodWindowMs){
    registerJump("GOOD JUMP", COLORS.green, 75);
  }else if(diffMs <= CONFIG.allowedWindowMs){
    registerJump("BARELY", COLORS.magenta, 35);
  }else{
    registerMiss("BAD JUMP");
  }
}

function registerJump(label, color, points){
  if(jumpedThisCycle){
    return;
  }

  jumpedThisCycle = true;
  jumpStartTime = performance.now();

  combo++;
  bestCombo = Math.max(bestCombo, combo);
  score += points + Math.min(combo * 5, 250);

  if(score > bestScore){
    bestScore = score;
    localStorage.setItem("glitchGotRhythmBestScore", String(bestScore));
  }

  feedback = label;
  feedbackColor = color;
  feedbackTimer = 34;
  hitFlash = 18;

  rotationMs = Math.max(CONFIG.rotationMsMin, rotationMs - CONFIG.speedUpPerJump);

  spawnBurst(CONFIG.glitchBaseX, CONFIG.glitchBaseY, color, 18);
}

function registerMiss(label){
  combo = 0;
  feedback = label;
  feedbackColor = COLORS.red;
  feedbackTimer = 45;
  missFlash = 32;

  spawnBurst(CONFIG.glitchBaseX, CONFIG.glitchBaseY, COLORS.red, 26);
  endGame();
}

function endGame(){
  gameState = "gameover";

  if(score > bestScore){
    bestScore = score;
    localStorage.setItem("glitchGotRhythmBestScore", String(bestScore));
  }
}

function update(timestamp){
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  currentTime = timestamp;

  updateBackground();
  updateParticles();

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

  // If the hand passed 12 o'clock and the player did not jump in time, game over.
  if(totalAngle > nextTopAngle + toleranceAngle && !jumpedThisCycle){
    registerMiss("MISSED BEAT");
    return;
  }

  // Once the timing window fully passes, move to the next 12 o'clock crossing.
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
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.size *= 0.985;
  });

  particles = particles.filter(p => p.life > 0);
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
  drawBackground();
  drawClockFace();
  drawGlitch();
  drawParticles();
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
  const r = CONFIG.clockRadius;

  ctx.save();

  // Clock outer glow
  ctx.strokeStyle = "rgba(0,255,238,.32)";
  ctx.lineWidth = 5;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = "rgba(255,32,255,.20)";
  ctx.lineWidth = 2;
  ctx.shadowColor = COLORS.magenta;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 26, 0, Math.PI * 2);
  ctx.stroke();

  // Tick marks
  for(let i = 0; i < 12; i++){
    const a = (Math.PI * 2 / 12) * i - Math.PI / 2;
    const isMain = i % 3 === 0;

    const x1 = cx + Math.cos(a) * (r - (isMain ? 18 : 12));
    const y1 = cy + Math.sin(a) * (r - (isMain ? 18 : 12));
    const x2 = cx + Math.cos(a) * (r + (isMain ? 12 : 6));
    const y2 = cy + Math.sin(a) * (r + (isMain ? 12 : 6));

    ctx.strokeStyle = i === 0 ? COLORS.gold : isMain ? COLORS.magenta : COLORS.cyan;
    ctx.lineWidth = i === 0 ? 6 : isMain ? 4 : 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = i === 0 ? 18 : 8;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // 12 o'clock danger/target zone
  const topAngle = -Math.PI / 2;
  const arc = 0.22;

  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 12;
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, topAngle - arc, topAngle + arc);
  ctx.stroke();

  // Hand
  const handX = cx + Math.cos(handAngle) * CONFIG.handLength;
  const handY = cy + Math.sin(handAngle) * CONFIG.handLength;

  ctx.strokeStyle = hitFlash > 0 ? feedbackColor : COLORS.white;
  ctx.lineWidth = 7;
  ctx.shadowColor = hitFlash > 0 ? feedbackColor : COLORS.cyan;
  ctx.shadowBlur = 18;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  ctx.fillStyle = hitFlash > 0 ? feedbackColor : COLORS.cyan;
  ctx.beginPath();
  ctx.arc(handX, handY, 9, 0, Math.PI * 2);
  ctx.fill();

  // Center hub
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

  if(feedbackTimer > 0){
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "900 38px Orbitron, Arial";
    ctx.fillStyle = feedbackColor;
    ctx.shadowColor = feedbackColor;
    ctx.shadowBlur = 18;
    ctx.fillText(feedback, cx, cy - r - 52);
    ctx.restore();
  }
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
  const mood = jumpOffset > 5 ? "jump" : gameState === "gameover" ? "dead" : "idle";

  ctx.save();
  ctx.translate(x, y);
  ctx.imageSmoothingEnabled = false;

  // Shadow on 12 o'clock platform
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(-48, 63 + jumpOffset, 96, 10);

  // Ears
  ctx.fillStyle = "#090912";
  ctx.fillRect(-58, -58, 24, 58);
  ctx.fillRect(34, -58, 24, 58);

  ctx.fillStyle = "#241531";
  ctx.fillRect(-51, -47, 10, 36);
  ctx.fillRect(41, -47, 10, 36);

  // Body/head
  ctx.fillStyle = "#07070d";
  ctx.fillRect(-45, -34, 90, 82);
  ctx.fillRect(-31, 38, 62, 38);

  // Pixel accents
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(-36, -42, 22, 7);
  ctx.fillRect(12, 54, 28, 7);

  ctx.fillStyle = COLORS.magenta;
  ctx.fillRect(18, -42, 22, 7);
  ctx.fillRect(-42, 54, 22, 7);

  ctx.fillStyle = COLORS.purple;
  ctx.fillRect(-51, -10, 7, 22);
  ctx.fillRect(44, 5, 7, 22);

  // Eyes
  if(mood === "dead"){
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(-24, -6, 18, 6);
    ctx.fillRect(8, -6, 18, 6);
  }else{
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(-24, -8, 17, 17);

    ctx.fillStyle = COLORS.magenta;
    ctx.fillRect(8, -8, 17, 17);
  }

  // Mouth
  ctx.fillStyle = COLORS.white;

  if(mood === "jump"){
    ctx.fillRect(-18, 28, 36, 8);
  }else if(mood === "dead"){
    ctx.fillRect(-10, 26, 20, 20);
  }else{
    ctx.fillRect(-13, 30, 26, 6);
  }

  // Arms
  ctx.fillStyle = "#090912";

  if(mood === "jump"){
    ctx.fillRect(-67, -4, 16, 38);
    ctx.fillRect(51, -4, 16, 38);
  }else{
    ctx.fillRect(-68, 20, 24, 13);
    ctx.fillRect(44, 20, 24, 13);
  }

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
  ctx.fillText(`SPEED: ${(CONFIG.rotationMsStart / rotationMs).toFixed(2)}x`, WIDTH - 190, 42);

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
  ctx.fillText("Miss the beat and the broadcast dies.", WIDTH / 2, HEIGHT / 2 + 204);

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

initBackground();
resetGame();
requestAnimationFrame(loop);
