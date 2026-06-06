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
  bpm: 90,
  songLengthSeconds: 60,

  perfectWindow: 55,
  goodWindow: 115,
  okayWindow: 185,

  signalStart: 100,
  signalMissLoss: 16,
  signalOkayLoss: 5,
  signalPerfectGain: 2,

  targetX: WIDTH / 2,
  targetY: HEIGHT - 120,

  glitchX: WIDTH / 2,
  glitchY: 225
};

let gameState = "title";
let startedAt = 0;
let lastTimestamp = 0;
let currentTime = 0;
let beatInterval = 60000 / CONFIG.bpm;
let nextBeatTime = 0;
let beatIndex = 0;

let score = 0;
let combo = 0;
let bestCombo = 0;
let signal = CONFIG.signalStart;
let feedback = "";
let feedbackColor = COLORS.cyan;
let feedbackTimer = 0;
let hitFlash = 0;
let missFlash = 0;
let musicEnabled = true;

let particles = [];
let bgLines = [];
let glitchMood = "idle";
let glitchMoodTimer = 0;

const savedBestScore = Number(localStorage.getItem("glitchGotRhythmBestScore") || 0);
let bestScore = savedBestScore;

function initBackground(){
  bgLines = [];

  for(let i = 0; i < 70; i++){
    bgLines.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      speed: Math.random() * 0.45 + 0.12,
      length: Math.random() * 80 + 35,
      alpha: Math.random() * 0.4 + 0.1
    });
  }
}

function resetGame(){
  score = 0;
  combo = 0;
  bestCombo = 0;
  signal = CONFIG.signalStart;
  feedback = "";
  feedbackTimer = 0;
  hitFlash = 0;
  missFlash = 0;
  particles = [];
  glitchMood = "idle";
  glitchMoodTimer = 0;
  beatIndex = 0;
  currentTime = 0;
  nextBeatTime = beatInterval;
  startedAt = performance.now();
  lastTimestamp = startedAt;
}

function startGame(){
  resetGame();
  gameState = "playing";
}

function restartToTitle(){
  resetGame();
  gameState = "title";
}

function hitBeat(){
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

  const distanceToBeat = currentTime - nextBeatTime;
  const absDistance = Math.abs(distanceToBeat);

  if(absDistance <= CONFIG.perfectWindow){
    registerHit("PERFECT", COLORS.gold, 100, 1.0);
  }else if(absDistance <= CONFIG.goodWindow){
    registerHit("GOOD", COLORS.green, 60, 0.7);
  }else if(absDistance <= CONFIG.okayWindow){
    if(distanceToBeat < 0){
      registerOkay("EARLY", COLORS.magenta);
    }else{
      registerOkay("LATE", COLORS.purple);
    }
  }else{
    registerMiss("DESYNC", COLORS.red);
  }
}

function registerHit(label, color, points, pulsePower){
  combo++;
  bestCombo = Math.max(bestCombo, combo);

  const comboBonus = Math.min(combo * 3, 150);
  score += points + comboBonus;

  signal = Math.min(100, signal + CONFIG.signalPerfectGain);

  feedback = label;
  feedbackColor = color;
  feedbackTimer = 36;
  hitFlash = 22;

  glitchMood = "hit";
  glitchMoodTimer = 24;

  addPulseParticles(CONFIG.targetX, CONFIG.targetY, color, Math.floor(12 * pulsePower));
}

function registerOkay(label, color){
  combo = 0;
  score += 25;
  signal = Math.max(0, signal - CONFIG.signalOkayLoss);

  feedback = label;
  feedbackColor = color;
  feedbackTimer = 34;
  hitFlash = 10;

  glitchMood = "okay";
  glitchMoodTimer = 18;

  addPulseParticles(CONFIG.targetX, CONFIG.targetY, color, 6);

  if(signal <= 0){
    endGame();
  }
}

function registerMiss(label, color){
  combo = 0;
  signal = Math.max(0, signal - CONFIG.signalMissLoss);

  feedback = label;
  feedbackColor = color;
  feedbackTimer = 42;
  missFlash = 28;

  glitchMood = "miss";
  glitchMoodTimer = 28;

  addPulseParticles(CONFIG.targetX, CONFIG.targetY, color, 12);

  if(signal <= 0){
    endGame();
  }
}

function endGame(){
  gameState = "gameover";
  glitchMood = "gameover";

  if(score > bestScore){
    bestScore = score;
    localStorage.setItem("glitchGotRhythmBestScore", String(bestScore));
  }
}

function update(timestamp){
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

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

  if(glitchMoodTimer > 0){
    glitchMoodTimer--;
  }else if(gameState === "playing"){
    glitchMood = "idle";
  }

  if(gameState !== "playing"){
    return;
  }

  currentTime = timestamp - startedAt;

  while(currentTime > nextBeatTime + CONFIG.okayWindow){
    registerMiss("MISS", COLORS.red);
    beatIndex++;
    nextBeatTime += beatInterval;

    if(gameState !== "playing"){
      break;
    }
  }

  if(currentTime >= CONFIG.songLengthSeconds * 1000){
    endGame();
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

function addPulseParticles(x, y, color, count){
  for(let i = 0; i < count; i++){
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 20 + 18,
      size: Math.random() * 5 + 2,
      color
    });
  }
}

function draw(){
  drawBackground();
  drawRhythmStage();
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

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = COLORS.magenta;

  for(let y = 40; y < HEIGHT; y += 60){
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin((performance.now() / 500) + y) * 3);
    ctx.lineTo(WIDTH, y + Math.sin((performance.now() / 500) + y) * 3);
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

function drawRhythmStage(){
  const targetX = CONFIG.targetX;
  const targetY = CONFIG.targetY;

  let beatProgress = 0;

  if(gameState === "playing"){
    beatProgress = 1 - Math.min(1, Math.abs(nextBeatTime - currentTime) / beatInterval);
  }

  const ringRadius = 160 - beatProgress * 105;
  const ringAlpha = gameState === "playing" ? 0.35 + beatProgress * 0.55 : 0.35;

  ctx.save();

  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 68, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 4;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 48, 0, Math.PI * 2);
  ctx.stroke();

  if(gameState === "playing"){
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = feedbackTimer > 0 ? feedbackColor : COLORS.magenta;
    ctx.shadowColor = feedbackTimer > 0 ? feedbackColor : COLORS.magenta;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(targetX, targetY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if(hitFlash > 0){
    ctx.globalAlpha = hitFlash / 22;
    ctx.fillStyle = feedbackColor;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 58 + (22 - hitFlash) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  if(feedbackTimer > 0){
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "900 42px Orbitron, Arial";
    ctx.fillStyle = feedbackColor;
    ctx.shadowColor = feedbackColor;
    ctx.shadowBlur = 18;
    ctx.fillText(feedback, targetX, targetY - 90);
    ctx.restore();
  }
}

function drawGlitch(){
  const x = CONFIG.glitchX;
  const y = CONFIG.glitchY;

  const bop = Math.sin(performance.now() / 120) * 5;
  const moodOffset = glitchMood === "hit" ? -14 : glitchMood === "miss" ? 10 : 0;
  const scale = glitchMood === "hit" ? 1.12 : glitchMood === "miss" ? 0.95 : 1;
  const bodyY = y + bop + moodOffset;

  ctx.save();
  ctx.translate(x, bodyY);
  ctx.scale(scale, scale);

  ctx.imageSmoothingEnabled = false;

  // Pixel Glitch shadow
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(-54, 72, 108, 14);

  // Ears
  ctx.fillStyle = "#101018";
  ctx.fillRect(-70, -58, 34, 72);
  ctx.fillRect(36, -58, 34, 72);

  ctx.fillStyle = "#251833";
  ctx.fillRect(-60, -45, 16, 44);
  ctx.fillRect(44, -45, 16, 44);

  // Head/body
  ctx.fillStyle = "#08080d";
  ctx.fillRect(-52, -38, 104, 96);
  ctx.fillRect(-38, 50, 76, 54);

  // Glitch edge pixels
  ctx.fillStyle = COLORS.purple;
  ctx.fillRect(-58, -18, 8, 24);
  ctx.fillRect(50, 12, 8, 24);

  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(-44, -44, 24, 8);
  ctx.fillRect(20, 64, 28, 8);

  ctx.fillStyle = COLORS.magenta;
  ctx.fillRect(28, -44, 20, 8);
  ctx.fillRect(-48, 72, 24, 8);

  // Eyes
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(-26, -8, 18, 18);

  ctx.fillStyle = COLORS.magenta;
  ctx.fillRect(10, -8, 18, 18);

  if(glitchMood === "miss" || glitchMood === "gameover"){
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(-26, -8, 18, 6);
    ctx.fillRect(10, -8, 18, 6);
  }

  // Mouth
  ctx.fillStyle = COLORS.white;

  if(glitchMood === "miss"){
    ctx.fillRect(-10, 30, 20, 20);
  }else if(glitchMood === "hit"){
    ctx.fillRect(-20, 30, 40, 8);
  }else{
    ctx.fillRect(-14, 32, 28, 6);
  }

  // Arms
  ctx.fillStyle = "#090912";
  ctx.fillRect(-76, 24, 28, 14);
  ctx.fillRect(48, 24, 28, 14);

  if(glitchMood === "hit"){
    ctx.fillRect(-86, 4, 14, 34);
    ctx.fillRect(72, 4, 14, 34);
  }

  ctx.restore();
}

function drawParticles(){
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 38;
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
  ctx.fillText(`SCORE: ${score}`, 26, 42);

  ctx.fillStyle = COLORS.magenta;
  ctx.shadowColor = COLORS.magenta;
  ctx.fillText(`COMBO: ${combo}`, 26, 74);

  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = COLORS.gold;
  ctx.fillText(`BEST: ${bestScore}`, 26, 106);

  drawSignalMeter();

  ctx.restore();
}

function drawSignalMeter(){
  const x = WIDTH - 250;
  const y = 34;
  const w = 210;
  const h = 22;

  ctx.save();

  ctx.font = "900 14px Orbitron, Arial";
  ctx.fillStyle = COLORS.white;
  ctx.shadowBlur = 0;
  ctx.fillText("SIGNAL", x, y - 8);

  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  const fillW = Math.max(0, (signal / 100) * w);

  let fillColor = COLORS.green;
  if(signal < 55){
    fillColor = COLORS.gold;
  }
  if(signal < 28){
    fillColor = COLORS.red;
  }

  ctx.fillStyle = fillColor;
  ctx.shadowColor = fillColor;
  ctx.shadowBlur = 12;
  ctx.fillRect(x, y, fillW, h);

  ctx.restore();
}

function drawTitleScreen(){
  drawOverlay();

  ctx.save();
  ctx.textAlign = "center";

  ctx.font = "900 62px Orbitron, Arial";
  ctx.fillStyle = COLORS.cyan;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 18;
  ctx.fillText("GLITCH GOT RHYTHM", WIDTH / 2, HEIGHT / 2 - 98);

  ctx.font = "900 22px Orbitron, Arial";
  ctx.fillStyle = COLORS.magenta;
  ctx.shadowColor = COLORS.magenta;
  ctx.fillText("KEEP THE SIGNAL SYNCED", WIDTH / 2, HEIGHT / 2 - 48);

  ctx.font = "900 24px Orbitron, Arial";
  ctx.fillStyle = COLORS.white;
  ctx.shadowBlur = 0;
  ctx.fillText("CLICK / TAP / SPACE ON THE BEAT", WIDTH / 2, HEIGHT / 2 + 18);

  ctx.font = "700 16px Orbitron, Arial";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("Perfect timing builds combo. Misses break the broadcast.", WIDTH / 2, HEIGHT / 2 + 54);
  ctx.fillText("R = Restart | M = Music Placeholder", WIDTH / 2, HEIGHT / 2 + 82);

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
  ctx.fillText("BROADCAST LOST", WIDTH / 2, HEIGHT / 2 - 78);

  ctx.font = "900 24px Orbitron, Arial";
  ctx.fillStyle = COLORS.cyan;
  ctx.shadowColor = COLORS.cyan;
  ctx.fillText(`FINAL SCORE: ${score}`, WIDTH / 2, HEIGHT / 2 - 28);

  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = COLORS.gold;
  ctx.fillText(`BEST COMBO: ${bestCombo}`, WIDTH / 2, HEIGHT / 2 + 4);

  ctx.font = "900 22px Orbitron, Arial";
  ctx.fillStyle = COLORS.white;
  ctx.shadowBlur = 0;
  ctx.fillText("CLICK / TAP / SPACE TO REBOOT RHYTHM", WIDTH / 2, HEIGHT / 2 + 58);

  ctx.restore();
}

function drawOverlay(){
  ctx.save();

  ctx.fillStyle = "rgba(5,7,13,.74)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(0,255,238,.28)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, WIDTH - 48, HEIGHT - 48);

  ctx.restore();
}

window.addEventListener("keydown", event => {
  if(event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW"){
    event.preventDefault();
    hitBeat();
  }

  if(event.code === "KeyR"){
    event.preventDefault();
    restartToTitle();
  }

  if(event.code === "KeyM"){
    event.preventDefault();
    musicEnabled = !musicEnabled;
  }
});

canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  hitBeat();
});

initBackground();
resetGame();
requestAnimationFrame(loop);
