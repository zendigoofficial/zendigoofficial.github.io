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
  black: "#05070d"
};

const CONFIG = {
  gravity: 0.34,
  flapPower: -7.2,
  playerX: 190,

  playerRadius: 24,
  playerSpriteW: 112,
  playerSpriteH: 112,

  obstacleWidth: 86,
  obstacleGap: 235,
  obstacleSpeed: 2.45,
  obstacleSpacing: 390,

  floorHeight: 46,

  backgroundSpeed: 1.15,

  musicVolume: 0.32
};

let gameState = "title";
let frame = 0;
let score = 0;
let best = Number(localStorage.getItem("flappyFaceBest") || 0);

let player;
let obstacles;
let particles;
let stars;

const faceImage = new Image();
faceImage.src = "assets/player_face.png";

const bgImage = new Image();
bgImage.src = "assets/bg_neon_city.png";

const pipeTopImage = new Image();
pipeTopImage.src = "assets/pipe_top.png";

const pipeBottomImage = new Image();
pipeBottomImage.src = "assets/pipe_bottom.png";

const music = new Audio("assets/flappy_face_theme.wav");
music.loop = true;
music.volume = CONFIG.musicVolume;
music.preload = "auto";

let musicStarted = false;
let musicEnabled = true;

let faceLoaded = false;
let faceFailed = false;

let bgLoaded = false;
let bgFailed = false;

let pipeTopLoaded = false;
let pipeBottomLoaded = false;

faceImage.onload = () => {
  faceLoaded = true;
};

faceImage.onerror = () => {
  faceFailed = true;
  console.log("Face failed to load:", faceImage.src);
};

bgImage.onload = () => {
  bgLoaded = true;
};

bgImage.onerror = () => {
  bgFailed = true;
  console.log("Background failed to load:", bgImage.src);
};

pipeTopImage.onload = () => {
  pipeTopLoaded = true;
};

pipeBottomImage.onload = () => {
  pipeBottomLoaded = true;
};

pipeTopImage.onerror = () => {
  console.log("Top pipe failed to load:", pipeTopImage.src);
};

pipeBottomImage.onerror = () => {
  console.log("Bottom pipe failed to load:", pipeBottomImage.src);
};

music.onerror = () => {
  console.log("Music failed to load:", music.src);
};

function startMusic(){
  if(!musicEnabled || musicStarted){
    return;
  }

  musicStarted = true;

  music.play().catch(error => {
    console.log("Music play blocked or failed:", error);
    musicStarted = false;
  });
}

function toggleMusic(){
  musicEnabled = !musicEnabled;

  if(!musicEnabled){
    music.pause();
    return;
  }

  if(gameState === "playing"){
    music.play().catch(error => {
      console.log("Music resume failed:", error);
    });
    musicStarted = true;
  }
}

function resetGame(){
  frame = 0;
  score = 0;

  player = {
    x: CONFIG.playerX,
    y: HEIGHT / 2,
    vy: 0,
    rotation: 0
  };

  obstacles = [];
  particles = [];
  stars = makeStars();

  spawnObstacle(WIDTH + 180);
}

function makeStars(){
  const list = [];

  for(let i = 0; i < 65; i++){
    list.push({
      x: Math.random() * WIDTH,
      y: Math.random() * (HEIGHT - CONFIG.floorHeight),
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.35 + 0.12,
      alpha: Math.random() * 0.45 + 0.18
    });
  }

  return list;
}

function spawnObstacle(x){
  const minTop = 70;
  const maxTop = HEIGHT - CONFIG.floorHeight - CONFIG.obstacleGap - 80;
  const gapY = minTop + Math.random() * (maxTop - minTop);

  obstacles.push({
    x,
    gapY,
    width: CONFIG.obstacleWidth,
    gap: CONFIG.obstacleGap,
    passed: false
  });
}

function flap(){
  startMusic();

  if(gameState === "title"){
    resetGame();
    gameState = "playing";
  }

  if(gameState === "playing"){
    player.vy = CONFIG.flapPower;
    burst(player.x - 22, player.y + 10, COLORS.cyan, 8);
  }

  if(gameState === "gameover"){
    resetGame();
    gameState = "playing";
  }
}

function burst(x, y, color, amount){
  for(let i = 0; i < amount; i++){
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 24,
      color
    });
  }
}

function update(){
  frame++;

  updateStars();
  updateParticles();

  if(gameState !== "playing"){
    return;
  }

  player.vy += CONFIG.gravity;
  player.y += player.vy;
  player.rotation = Math.max(-0.38, Math.min(0.62, player.vy / 13));

  const spawnRate = Math.floor(CONFIG.obstacleSpacing / CONFIG.obstacleSpeed);

  if(frame % spawnRate === 0){
    spawnObstacle(WIDTH + 80);
  }

  obstacles.forEach(obstacle => {
    obstacle.x -= CONFIG.obstacleSpeed;

    if(!obstacle.passed && obstacle.x + obstacle.width < player.x){
      obstacle.passed = true;
      score++;
      burst(player.x, player.y, COLORS.magenta, 10);

      if(score > best){
        best = score;
        localStorage.setItem("flappyFaceBest", String(best));
      }
    }
  });

  obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > -120);

  if(player.y - CONFIG.playerRadius < 0 || player.y + CONFIG.playerRadius > HEIGHT - CONFIG.floorHeight){
    endGame();
  }

  for(const obstacle of obstacles){
    if(playerHitsObstacle(player, obstacle)){
      endGame();
      break;
    }
  }
}

function updateStars(){
  stars.forEach(star => {
    star.x -= star.speed;

    if(star.x < -4){
      star.x = WIDTH + Math.random() * 40;
      star.y = Math.random() * (HEIGHT - CONFIG.floorHeight);
    }
  });
}

function updateParticles(){
  particles.forEach(particle => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life--;
  });

  particles = particles.filter(particle => particle.life > 0);
}

function playerHitsObstacle(p, obstacle){
  const r = CONFIG.playerRadius;
  const withinX = p.x + r > obstacle.x && p.x - r < obstacle.x + obstacle.width;

  if(!withinX){
    return false;
  }

  return !(p.y - r > obstacle.gapY && p.y + r < obstacle.gapY + obstacle.gap);
}

function endGame(){
  if(gameState !== "playing"){
    return;
  }

  gameState = "gameover";
  burst(player.x, player.y, COLORS.magenta, 26);
}

function draw(){
  drawBackground();
  drawStars();
  drawObstacles();
  drawFloor();
  drawPlayer();
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

function loop(){
  update();
  draw();
}

function drawBackground(){
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#05070d");
  gradient.addColorStop(0.45, "#0b1020");
  gradient.addColorStop(1, "#05070d");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if(bgLoaded){
    const bgDrawHeight = HEIGHT - CONFIG.floorHeight;
    const scale = bgDrawHeight / bgImage.height;
    const bgDrawWidth = bgImage.width * scale;
    const offset = (frame * CONFIG.backgroundSpeed) % bgDrawWidth;

    for(let x = -offset; x < WIDTH + bgDrawWidth; x += bgDrawWidth){
      ctx.drawImage(
        bgImage,
        x,
        0,
        bgDrawWidth,
        bgDrawHeight
      );
    }

    ctx.save();
    ctx.fillStyle = "rgba(5,7,13,.18)";
    ctx.fillRect(0, 0, WIDTH, bgDrawHeight);
    ctx.restore();
  }

  if(bgFailed){
    drawFallbackGrid();
  }
}

function drawFallbackGrid(){
  ctx.save();

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 1;

  for(let x = -80; x < WIDTH + 80; x += 80){
    ctx.beginPath();
    ctx.moveTo(x - (frame % 80), 0);
    ctx.lineTo(x + 140 - (frame % 80), HEIGHT);
    ctx.stroke();
  }

  ctx.strokeStyle = COLORS.magenta;

  for(let y = 40; y < HEIGHT; y += 80){
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(frame / 50) * 6);
    ctx.lineTo(WIDTH, y + Math.sin(frame / 50) * 6);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStars(){
  if(bgLoaded){
    return;
  }

  stars.forEach(star => {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });

  ctx.globalAlpha = 1;
}

function drawObstacles(){
  obstacles.forEach(obstacle => {
    drawPipeTop(obstacle.x, 0, obstacle.width, obstacle.gapY);

    drawPipeBottom(
      obstacle.x,
      obstacle.gapY + obstacle.gap,
      obstacle.width,
      HEIGHT - CONFIG.floorHeight - (obstacle.gapY + obstacle.gap)
    );
  });
}

function drawPipeTop(x, y, width, height){
  if(height <= 0){
    return;
  }

  if(pipeTopLoaded){
    ctx.drawImage(pipeTopImage, x, y, width, height);
  }else{
    drawGate(x, y, width, height, true);
  }
}

function drawPipeBottom(x, y, width, height){
  if(height <= 0){
    return;
  }

  if(pipeBottomLoaded){
    ctx.drawImage(pipeBottomImage, x, y, width, height);
  }else{
    drawGate(x, y, width, height, false);
  }
}

function drawGate(x, y, width, height, top){
  if(height <= 0){
    return;
  }

  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, "rgba(0,255,238,.95)");
  gradient.addColorStop(0.5, "rgba(162,48,240,.92)");
  gradient.addColorStop(1, "rgba(255,32,255,.95)");

  ctx.save();

  ctx.shadowColor = COLORS.magenta;
  ctx.shadowBlur = 18;
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(5,7,13,.68)";
  ctx.fillRect(x + 10, y + 10, width - 20, Math.max(0, height - 20));

  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4, y + 4, width - 8, height - 8);

  ctx.fillStyle = "rgba(255,255,255,.08)";

  for(let i = 0; i < height; i += 28){
    ctx.fillRect(x + 12, y + i, width - 24, 3);
  }

  ctx.fillStyle = top ? COLORS.magenta : COLORS.cyan;

  if(top){
    ctx.fillRect(x - 8, y + height - 20, width + 16, 20);
  }else{
    ctx.fillRect(x - 8, y, width + 16, 20);
  }

  ctx.restore();
}

function drawFloor(){
  ctx.save();

  ctx.fillStyle = "rgba(10,10,18,.95)";
  ctx.fillRect(0, HEIGHT - CONFIG.floorHeight, WIDTH, CONFIG.floorHeight);

  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT - CONFIG.floorHeight);
  ctx.lineTo(WIDTH, HEIGHT - CONFIG.floorHeight);
  ctx.stroke();

  ctx.globalAlpha = 0.4;
  ctx.fillStyle = COLORS.magenta;

  for(let x = -40; x < WIDTH + 40; x += 55){
    ctx.fillRect(x - ((frame * 2) % 55), HEIGHT - 22, 28, 3);
  }

  ctx.restore();
}

function drawPlayer(){
  ctx.save();

  ctx.translate(player.x, player.y);
  ctx.rotate(player.rotation);

  ctx.save();
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 18;

  if(faceLoaded){
    ctx.drawImage(
      faceImage,
      -CONFIG.playerSpriteW / 2,
      -CONFIG.playerSpriteH / 2,
      CONFIG.playerSpriteW,
      CONFIG.playerSpriteH
    );
  }else{
    drawPlaceholderFace();
  }

  ctx.restore();

  if(faceFailed){
    ctx.save();
    ctx.fillStyle = COLORS.magenta;
    ctx.font = "700 9px Orbitron, Arial";
    ctx.textAlign = "center";
    ctx.fillText("NO FACE", 0, 46);
    ctx.restore();
  }

  ctx.restore();
}

function drawPlaceholderFace(){
  const gradient = ctx.createRadialGradient(-8, -8, 5, 0, 0, CONFIG.playerRadius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.4, COLORS.cyan);
  gradient.addColorStop(1, COLORS.purple);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, CONFIG.playerRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.arc(-9, -5, 4, 0, Math.PI * 2);
  ctx.arc(9, -5, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLORS.black;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 5, 9, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

function drawParticles(){
  particles.forEach(particle => {
    ctx.globalAlpha = particle.life / 24;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 4, 4);
  });

  ctx.globalAlpha = 1;
}

function drawHud(){
  ctx.save();

  ctx.font = "900 26px Orbitron, Arial";
  ctx.fillStyle = COLORS.cyan;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 12;
  ctx.fillText(`SIGNAL SCORE: ${score}`, 26, 42);

  ctx.fillStyle = COLORS.magenta;
  ctx.shadowColor = COLORS.magenta;
  ctx.fillText(`BEST BROADCAST: ${best}`, 26, 76);

  ctx.font = "700 14px Orbitron, Arial";
  ctx.shadowBlur = 0;
  ctx.fillStyle = musicEnabled ? COLORS.cyan : COLORS.muted;
  ctx.fillText(musicEnabled ? "MUSIC: ON" : "MUSIC: OFF", WIDTH - 150, 42);

  ctx.restore();
}

function drawTitleScreen(){
  drawOverlay();

  ctx.save();
  ctx.textAlign = "center";

  ctx.font = "900 64px Orbitron, Arial";
  ctx.fillStyle = COLORS.cyan;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 18;
  ctx.fillText("FLAPPY FACE", WIDTH / 2, HEIGHT / 2 - 92);

  ctx.font = "900 22px Orbitron, Arial";
  ctx.fillStyle = COLORS.magenta;
  ctx.shadowColor = COLORS.magenta;
  ctx.fillText("UNAUTHORIZED BROADCAST MINI-GAME", WIDTH / 2, HEIGHT / 2 - 46);

  ctx.font = "900 24px Orbitron, Arial";
  ctx.fillStyle = COLORS.white;
  ctx.shadowBlur = 0;
  ctx.fillText("CLICK / TAP / SPACE TO GO LIVE", WIDTH / 2, HEIGHT / 2 + 18);

  ctx.font = "700 16px Orbitron, Arial";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("Avoid the signal gates. Protect the broadcast.", WIDTH / 2, HEIGHT / 2 + 54);
  ctx.fillText("Press M to toggle music.", WIDTH / 2, HEIGHT / 2 + 80);

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
  ctx.fillText("SIGNAL LOST", WIDTH / 2, HEIGHT / 2 - 64);

  ctx.font = "900 24px Orbitron, Arial";
  ctx.fillStyle = COLORS.cyan;
  ctx.shadowColor = COLORS.cyan;
  ctx.fillText(`FINAL SIGNAL SCORE: ${score}`, WIDTH / 2, HEIGHT / 2 - 14);

  ctx.font = "900 22px Orbitron, Arial";
  ctx.fillStyle = COLORS.white;
  ctx.shadowBlur = 0;
  ctx.fillText("CLICK / TAP / SPACE TO REBOOT BROADCAST", WIDTH / 2, HEIGHT / 2 + 44);

  ctx.font = "700 15px Orbitron, Arial";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("Press M to toggle music.", WIDTH / 2, HEIGHT / 2 + 76);

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
    flap();
  }

  if(event.code === "KeyR"){
    event.preventDefault();
    resetGame();
    gameState = "title";
  }

  if(event.code === "KeyM"){
    event.preventDefault();
    toggleMusic();
  }
});

canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  flap();
});

document.addEventListener("visibilitychange", () => {
  if(document.hidden){
    music.pause();
  }else if(musicEnabled && musicStarted){
    music.play().catch(error => {
      console.log("Music resume after visibility change failed:", error);
    });
  }
});

resetGame();
loop();
