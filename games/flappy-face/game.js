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
  gold: "#FFD84D",
  orange: "#FF9F1C",
  red: "#FF3B5C"
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

  defaultMusicLevel: 2,
  defaultSfxLevel: 8,

  // Music level 10 is half of the old browser maximum.
  musicMaxVolume: 0.5,

  // SFX level 5 equals the old maximum.
  // SFX level 10 is amplified to 2x.
  sfxMaxGain: 2.0,

  tacoEveryNGates: 5,
  tacoBonusPoints: 5,
  tacoWidth: 82,
  tacoHeight: 54,
  tacoCollisionRadius: 25,
  tacoBobAmount: 7,
  tacoBobSpeed: 0.075,

  billboardUnlockTacos: 10,
  billboardEveryGates: 10,
  billboardWidth: 250,
  billboardHeight: 200,
  billboardY: 205,
  billboardParallax: 0.62,

  // Bottom area of bg_neon_city.png containing the railing.
  railingSourceStartRatio: 0.77
};

let gameState = "title";
let frame = 0;

let score = 0;
let best = Number(
  localStorage.getItem("flappyFaceBest") || 0
);

let tacosCollected = 0;
let bestTacos = Number(
  localStorage.getItem("flappyFaceBestTacos") || 0
);

let gateSequence = 0;
let totalGatesPassed = 0;
let gatesSinceBillboardUnlock = 0;

let billboardUnlocked = false;
let billboardInstances = [];

let tacoMessage = "";
let tacoMessageTimer = 0;

let player;
let obstacles = [];
let particles = [];
let stars = [];

let musicStarted = false;
let soundPanelOpen = false;

function clampSoundLevel(value){
  if(!Number.isFinite(value)){
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      10,
      Math.round(value)
    )
  );
}

let musicLevel = clampSoundLevel(
  Number(
    localStorage.getItem(
      "flappyFaceMusicLevel"
    ) ??
    CONFIG.defaultMusicLevel
  )
);

let sfxLevel = clampSoundLevel(
  Number(
    localStorage.getItem(
      "flappyFaceSfxLevel"
    ) ??
    CONFIG.defaultSfxLevel
  )
);

let previousMusicLevel =
  musicLevel > 0
    ? musicLevel
    : CONFIG.defaultMusicLevel;

/* -------------------- ASSETS -------------------- */

function loadImage(
  src,
  onLoad,
  onError
){
  const image = new Image();

  image.onload = onLoad;
  image.onerror = onError;
  image.src = src;

  return image;
}

let faceLoaded = false;
let faceFailed = false;

let bgLoaded = false;
let bgFailed = false;

let pipeTopLoaded = false;
let pipeBottomLoaded = false;

let tacoLoaded = false;
let tacoFailed = false;

let billboardLoaded = false;
let billboardFailed = false;

const faceImage = loadImage(
  "assets/player_face.png",

  () => {
    faceLoaded = true;
  },

  () => {
    faceFailed = true;

    console.warn(
      "Face failed to load."
    );
  }
);

const bgImage = loadImage(
  "assets/bg_neon_city.png",

  () => {
    bgLoaded = true;
  },

  () => {
    bgFailed = true;

    console.warn(
      "Background failed to load."
    );
  }
);

const pipeTopImage = loadImage(
  "assets/pipe_top.png",

  () => {
    pipeTopLoaded = true;
  },

  () => {
    console.warn(
      "Top pipe failed to load."
    );
  }
);

const pipeBottomImage = loadImage(
  "assets/pipe_bottom.png",

  () => {
    pipeBottomLoaded = true;
  },

  () => {
    console.warn(
      "Bottom pipe failed to load."
    );
  }
);

const tacoImage = loadImage(
  "assets/taco_collectible.png",

  () => {
    tacoLoaded = true;
  },

  () => {
    tacoFailed = true;

    console.warn(
      "Taco failed to load."
    );
  }
);

const billboardImage = loadImage(
  "assets/sheetz_billboard.png",

  () => {
    billboardLoaded = true;
  },

  () => {
    billboardFailed = true;

    console.warn(
      "Billboard failed to load."
    );
  }
);

const music = new Audio(
  "assets/flappy_face_theme.wav"
);

music.loop = true;
music.preload = "auto";

const tacoCrunch = new Audio(
  "assets/audio/taco_crunch.wav"
);

tacoCrunch.preload = "auto";

music.onerror = () => {
  console.warn(
    "Music failed to load."
  );
};

tacoCrunch.onerror = () => {
  console.warn(
    "Taco crunch failed to load."
  );
};

/* -------------------- SOUND -------------------- */

let sfxAudioContext = null;
let tacoCrunchSource = null;
let tacoCrunchGain = null;

function initializeSfxAudio(){
  if(sfxAudioContext){
    return;
  }

  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if(!AudioContextClass){
    console.warn(
      "Web Audio is not supported; using normal SFX volume."
    );

    return;
  }

  sfxAudioContext =
    new AudioContextClass();

  tacoCrunchSource =
    sfxAudioContext.createMediaElementSource(
      tacoCrunch
    );

  tacoCrunchGain =
    sfxAudioContext.createGain();

  tacoCrunchSource.connect(
    tacoCrunchGain
  );

  tacoCrunchGain.connect(
    sfxAudioContext.destination
  );

  updateSfxGain();
}

function updateSfxGain(){
  const gain =
    (
      sfxLevel /
      10
    ) *
    CONFIG.sfxMaxGain;

  if(tacoCrunchGain){
    tacoCrunchGain.gain.value =
      gain;
  }else{
    tacoCrunch.volume =
      Math.min(
        1,
        gain
      );
  }
}

function applySoundLevels(){
  music.volume =
    (
      musicLevel /
      10
    ) *
    CONFIG.musicMaxVolume;

  updateSfxGain();
}

function saveSoundLevels(){
  localStorage.setItem(
    "flappyFaceMusicLevel",
    String(musicLevel)
  );

  localStorage.setItem(
    "flappyFaceSfxLevel",
    String(sfxLevel)
  );
}

function setMusicLevel(value){
  musicLevel =
    clampSoundLevel(
      Number(value)
    );

  if(musicLevel > 0){
    previousMusicLevel =
      musicLevel;
  }

  applySoundLevels();
  saveSoundLevels();
  updateSoundSettingsDisplay();

  if(musicLevel === 0){
    music.pause();
    return;
  }

  if(gameState === "playing"){
    musicStarted = true;

    music.play().catch(
      error => {
        console.warn(
          "Music resume failed:",
          error
        );

        musicStarted = false;
      }
    );
  }
}

function setSfxLevel(value){
  sfxLevel =
    clampSoundLevel(
      Number(value)
    );

  applySoundLevels();
  saveSoundLevels();
  updateSoundSettingsDisplay();
}

function startMusic(){
  if(
    musicLevel === 0 ||
    musicStarted
  ){
    return;
  }

  musicStarted = true;

  music.play().catch(
    error => {
      console.warn(
        "Music play failed:",
        error
      );

      musicStarted = false;
    }
  );
}

function toggleMusic(){
  if(musicLevel > 0){
    previousMusicLevel =
      musicLevel;

    setMusicLevel(0);
  }else{
    setMusicLevel(
      previousMusicLevel ||
      CONFIG.defaultMusicLevel
    );
  }
}

function playTacoCrunch(){
  if(sfxLevel === 0){
    return;
  }

  initializeSfxAudio();
  updateSfxGain();

  if(
    sfxAudioContext &&
    sfxAudioContext.state ===
      "suspended"
  ){
    sfxAudioContext
      .resume()
      .catch(
        error => {
          console.warn(
            "Audio context resume failed:",
            error
          );
        }
      );
  }

  tacoCrunch.pause();
  tacoCrunch.currentTime = 0;

  tacoCrunch.play().catch(
    error => {
      console.warn(
        "Taco crunch play failed:",
        error
      );
    }
  );
}

/* -------------------- SOUND PANEL -------------------- */

function createSoundSettings(){
  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    .ff-sound-button{
      position:fixed;
      top:18px;
      right:18px;
      z-index:9998;
      padding:10px 14px;
      border:1px solid #00FFEE;
      border-radius:10px;
      background:rgba(5,7,13,.94);
      color:#00FFEE;
      font:900 13px Orbitron,Arial,sans-serif;
      letter-spacing:.7px;
      cursor:pointer;
      box-shadow:0 0 14px rgba(0,255,238,.25);
    }

    .ff-sound-button:hover{
      color:#FF20FF;
      border-color:#FF20FF;
    }

    .ff-sound-panel{
      position:fixed;
      top:68px;
      right:18px;
      z-index:9999;
      width:min(320px,calc(100vw - 36px));
      padding:18px;
      border:1px solid #FF20FF;
      border-radius:14px;
      background:rgba(5,7,13,.98);
      color:#EEEEEE;
      box-shadow:0 0 24px rgba(255,32,255,.28);
      font-family:Orbitron,Arial,sans-serif;
      display:none;
    }

    .ff-sound-panel.open{
      display:block;
    }

    .ff-sound-panel h2{
      margin:0 0 18px;
      color:#00FFEE;
      font-size:18px;
      text-align:center;
    }

    .ff-sound-row{
      margin-bottom:18px;
    }

    .ff-sound-label{
      display:flex;
      justify-content:space-between;
      margin-bottom:8px;
      font-size:13px;
      font-weight:900;
    }

    .ff-sound-value{
      color:#FFD84D;
    }

    .ff-sound-panel input[type="range"]{
      width:100%;
      cursor:pointer;
      accent-color:#00FFEE;
    }

    .ff-sound-scale{
      display:flex;
      justify-content:space-between;
      margin-top:5px;
      color:#A9AEC3;
      font-size:10px;
    }

    .ff-sound-close{
      width:100%;
      padding:10px 12px;
      border:1px solid #FF20FF;
      border-radius:9px;
      background:rgba(255,32,255,.08);
      color:#EEEEEE;
      font:900 12px Orbitron,Arial,sans-serif;
      cursor:pointer;
    }
  `;

  document.head.appendChild(
    style
  );

  const button =
    document.createElement(
      "button"
    );

  button.id =
    "ffSoundButton";

  button.type =
    "button";

  button.className =
    "ff-sound-button";

  button.textContent =
    "SOUND";

  const panel =
    document.createElement(
      "section"
    );

  panel.id =
    "ffSoundPanel";

  panel.className =
    "ff-sound-panel";

  panel.setAttribute(
    "aria-hidden",
    "true"
  );

  panel.innerHTML = `
    <h2>SOUND SETTINGS</h2>

    <div class="ff-sound-row">
      <div class="ff-sound-label">
        <span>MUSIC</span>

        <span
          id="ffMusicValue"
          class="ff-sound-value"
        >
          ${musicLevel}
        </span>
      </div>

      <input
        id="ffMusicSlider"
        type="range"
        min="0"
        max="10"
        step="1"
        value="${musicLevel}"
        aria-label="Music volume"
      >

      <div class="ff-sound-scale">
        <span>0 OFF</span>
        <span>10 MAX</span>
      </div>
    </div>

    <div class="ff-sound-row">
      <div class="ff-sound-label">
        <span>SFX</span>

        <span
          id="ffSfxValue"
          class="ff-sound-value"
        >
          ${sfxLevel}
        </span>
      </div>

      <input
        id="ffSfxSlider"
        type="range"
        min="0"
        max="10"
        step="1"
        value="${sfxLevel}"
        aria-label="Sound effects volume"
      >

      <div class="ff-sound-scale">
        <span>0 OFF</span>
        <span>10 MAX</span>
      </div>
    </div>

    <button
      id="ffSoundClose"
      class="ff-sound-close"
      type="button"
    >
      CLOSE
    </button>
  `;

  document.body.append(
    button,
    panel
  );

  button.addEventListener(
    "click",
    event => {
      event.stopPropagation();
      toggleSoundPanel();
    }
  );

  panel.addEventListener(
    "pointerdown",
    event => {
      event.stopPropagation();
    }
  );

  document
    .getElementById(
      "ffSoundClose"
    )
    .addEventListener(
      "click",
      event => {
        event.stopPropagation();
        closeSoundPanel();
      }
    );

  document
    .getElementById(
      "ffMusicSlider"
    )
    .addEventListener(
      "input",
      event => {
        setMusicLevel(
          event.target.value
        );
      }
    );

  document
    .getElementById(
      "ffSfxSlider"
    )
    .addEventListener(
      "input",
      event => {
        setSfxLevel(
          event.target.value
        );
      }
    );
}

function toggleSoundPanel(){
  soundPanelOpen =
    !soundPanelOpen;

  const panel =
    document.getElementById(
      "ffSoundPanel"
    );

  if(!panel){
    return;
  }

  panel.classList.toggle(
    "open",
    soundPanelOpen
  );

  panel.setAttribute(
    "aria-hidden",
    String(!soundPanelOpen)
  );
}

function closeSoundPanel(){
  soundPanelOpen = false;

  const panel =
    document.getElementById(
      "ffSoundPanel"
    );

  if(!panel){
    return;
  }

  panel.classList.remove(
    "open"
  );

  panel.setAttribute(
    "aria-hidden",
    "true"
  );
}

function updateSoundSettingsDisplay(){
  const musicSlider =
    document.getElementById(
      "ffMusicSlider"
    );

  const sfxSlider =
    document.getElementById(
      "ffSfxSlider"
    );

  const musicValue =
    document.getElementById(
      "ffMusicValue"
    );

  const sfxValue =
    document.getElementById(
      "ffSfxValue"
    );

  if(musicSlider){
    musicSlider.value =
      String(musicLevel);
  }

  if(sfxSlider){
    sfxSlider.value =
      String(sfxLevel);
  }

  if(musicValue){
    musicValue.textContent =
      String(musicLevel);
  }

  if(sfxValue){
    sfxValue.textContent =
      String(sfxLevel);
  }
}

/* -------------------- GAME -------------------- */

function resetGame(){
  frame = 0;
  score = 0;
  tacosCollected = 0;
  gateSequence = 0;

  totalGatesPassed = 0;
  gatesSinceBillboardUnlock = 0;
  billboardUnlocked = false;
  billboardInstances = [];

  tacoMessage = "";
  tacoMessageTimer = 0;

  player = {
    x: CONFIG.playerX,
    y: HEIGHT / 2,
    vy: 0,
    rotation: 0
  };

  obstacles = [];
  particles = [];
  stars = makeStars();

  spawnObstacle(
    WIDTH + 180
  );
}

function makeStars(){
  return Array.from(
    {
      length: 65
    },

    () => ({
      x:
        Math.random() *
        WIDTH,

      y:
        Math.random() *
        (
          HEIGHT -
          CONFIG.floorHeight
        ),

      size:
        Math.random() *
        2 +
        0.5,

      speed:
        Math.random() *
        0.35 +
        0.12,

      alpha:
        Math.random() *
        0.45 +
        0.18
    })
  );
}

function spawnObstacle(x){
  const minTop = 70;

  const maxTop =
    HEIGHT -
    CONFIG.floorHeight -
    CONFIG.obstacleGap -
    80;

  const gapY =
    minTop +
    Math.random() *
    (
      maxTop -
      minTop
    );

  gateSequence++;

  obstacles.push({
    x,
    gapY,

    width:
      CONFIG.obstacleWidth,

    gap:
      CONFIG.obstacleGap,

    passed: false,

    gateNumber:
      gateSequence,

    hasTaco:
      gateSequence %
      CONFIG.tacoEveryNGates ===
      0,

    tacoCollected: false,

    tacoPhase:
      Math.random() *
      Math.PI *
      2
  });
}

function flap(){
  initializeSfxAudio();
  startMusic();

  if(
    gameState === "title" ||
    gameState === "gameover"
  ){
    resetGame();
    gameState = "playing";
  }

  if(gameState === "playing"){
    player.vy =
      CONFIG.flapPower;

    burst(
      player.x - 22,
      player.y + 10,
      COLORS.cyan,
      8
    );
  }
}

function burst(
  x,
  y,
  color,
  amount
){
  for(
    let i = 0;
    i < amount;
    i++
  ){
    particles.push({
      x,
      y,

      vx:
        (
          Math.random() -
          0.5
        ) *
        4,

      vy:
        (
          Math.random() -
          0.5
        ) *
        4,

      life: 24,

      size:
        Math.random() *
        3 +
        3,

      color
    });
  }
}

function tacoBurst(x, y){
  const colors = [
    COLORS.gold,
    COLORS.orange,
    COLORS.cyan,
    COLORS.magenta,
    COLORS.white
  ];

  for(
    let i = 0;
    i < 24;
    i++
  ){
    particles.push({
      x,
      y,

      vx:
        (
          Math.random() -
          0.5
        ) *
        7,

      vy:
        (
          Math.random() -
          0.5
        ) *
        7,

      life:
        Math.random() *
        14 +
        20,

      size:
        Math.random() *
        5 +
        3,

      color:
        colors[
          Math.floor(
            Math.random() *
            colors.length
          )
        ]
    });
  }
}

function update(){
  frame++;

  updateStars();
  updateParticles();

  if(
    tacoMessageTimer > 0 &&
    --tacoMessageTimer <= 0
  ){
    tacoMessage = "";
  }

  if(gameState !== "playing"){
    return;
  }

  player.vy +=
    CONFIG.gravity;

  player.y +=
    player.vy;

  player.rotation =
    Math.max(
      -0.38,

      Math.min(
        0.62,
        player.vy / 13
      )
    );

  const spawnRate =
    Math.floor(
      CONFIG.obstacleSpacing /
      CONFIG.obstacleSpeed
    );

  if(
    frame %
    spawnRate ===
    0
  ){
    spawnObstacle(
      WIDTH + 80
    );
  }

  for(
    const obstacle
    of obstacles
  ){
    obstacle.x -=
      CONFIG.obstacleSpeed;

    checkTacoCollection(
      obstacle
    );

    if(
      !obstacle.passed &&
      obstacle.x +
      obstacle.width <
      player.x
    ){
      obstacle.passed = true;
      score++;
      totalGatesPassed++;

      if(billboardUnlocked){
        gatesSinceBillboardUnlock++;

        if(
          gatesSinceBillboardUnlock %
          CONFIG.billboardEveryGates ===
          0
        ){
          spawnBillboard();
        }
      }

      burst(
        player.x,
        player.y,
        COLORS.magenta,
        10
      );

      updateBestScore();
    }
  }

  obstacles =
    obstacles.filter(
      obstacle =>
        obstacle.x +
        obstacle.width >
        -120
    );

  updateBillboards();

  if(
    player.y -
    CONFIG.playerRadius <
    0 ||

    player.y +
    CONFIG.playerRadius >
    HEIGHT -
    CONFIG.floorHeight
  ){
    endGame();
  }

  for(
    const obstacle
    of obstacles
  ){
    if(
      playerHitsObstacle(
        player,
        obstacle
      )
    ){
      endGame();
      break;
    }
  }
}

function updateStars(){
  for(
    const star
    of stars
  ){
    star.x -=
      star.speed;

    if(star.x < -4){
      star.x =
        WIDTH +
        Math.random() *
        40;

      star.y =
        Math.random() *
        (
          HEIGHT -
          CONFIG.floorHeight
        );
    }
  }
}

function updateParticles(){
  for(
    const particle
    of particles
  ){
    particle.x +=
      particle.vx;

    particle.y +=
      particle.vy;

    particle.vy +=
      0.045;

    particle.life--;
  }

  particles =
    particles.filter(
      particle =>
        particle.life > 0
    );
}

/* -------------------- TACOS -------------------- */

function getTacoPosition(
  obstacle
){
  const bob =
    Math.sin(
      frame *
      CONFIG.tacoBobSpeed +
      obstacle.tacoPhase
    ) *
    CONFIG.tacoBobAmount;

  return {
    x:
      obstacle.x +
      obstacle.width / 2,

    y:
      obstacle.gapY +
      obstacle.gap / 2 +
      bob
  };
}

function checkTacoCollection(
  obstacle
){
  if(
    !obstacle.hasTaco ||
    obstacle.tacoCollected
  ){
    return;
  }

  const position =
    getTacoPosition(
      obstacle
    );

  const dx =
    player.x -
    position.x;

  const dy =
    player.y -
    position.y;

  const combinedRadius =
    CONFIG.playerRadius +
    CONFIG.tacoCollisionRadius;

  if(
    dx * dx +
    dy * dy <=
    combinedRadius *
    combinedRadius
  ){
    collectTaco(
      obstacle,
      position.x,
      position.y
    );
  }
}

function collectTaco(
  obstacle,
  x,
  y
){
  obstacle.tacoCollected =
    true;

  tacosCollected++;

  if(
    !billboardUnlocked &&
    tacosCollected >=
    CONFIG.billboardUnlockTacos
  ){
    billboardUnlocked = true;
    gatesSinceBillboardUnlock = 0;
  }

  score +=
    CONFIG.tacoBonusPoints;

  tacoMessage =
    `TACO CRUNCHED! +${CONFIG.tacoBonusPoints}`;

  tacoMessageTimer = 72;

  tacoBurst(x, y);
  playTacoCrunch();

  if(
    tacosCollected >
    bestTacos
  ){
    bestTacos =
      tacosCollected;

    localStorage.setItem(
      "flappyFaceBestTacos",
      String(bestTacos)
    );
  }

  updateBestScore();
}

function updateBestScore(){
  if(score <= best){
    return;
  }

  best = score;

  localStorage.setItem(
    "flappyFaceBest",
    String(best)
  );
}

/* -------------------- BILLBOARD -------------------- */

function spawnBillboard(){
  if(!billboardUnlocked){
    return;
  }

  billboardInstances.push({
    x: WIDTH + 120,
    y: CONFIG.billboardY,
    width: CONFIG.billboardWidth,
    height: CONFIG.billboardHeight
  });
}

function updateBillboards(){
  const speed =
    CONFIG.obstacleSpeed *
    CONFIG.billboardParallax;

  for(
    const billboard
    of billboardInstances
  ){
    billboard.x -=
      speed;
  }

  billboardInstances =
    billboardInstances.filter(
      billboard =>
        billboard.x +
        billboard.width >
        -80
    );
}

function drawBillboards(){
  if(
    !billboardLoaded ||
    billboardFailed
  ){
    return;
  }

  for(
    const billboard
    of billboardInstances
  ){
    ctx.drawImage(
      billboardImage,
      billboard.x,
      billboard.y,
      billboard.width,
      billboard.height
    );
  }
}

/* -------------------- COLLISION -------------------- */

function playerHitsObstacle(
  p,
  obstacle
){
  const r =
    CONFIG.playerRadius;

  const withinX =
    p.x + r >
    obstacle.x &&

    p.x - r <
    obstacle.x +
    obstacle.width;

  if(!withinX){
    return false;
  }

  return !(
    p.y - r >
    obstacle.gapY &&

    p.y + r <
    obstacle.gapY +
    obstacle.gap
  );
}

function endGame(){
  if(gameState !== "playing"){
    return;
  }

  gameState =
    "gameover";

  burst(
    player.x,
    player.y,
    COLORS.magenta,
    26
  );
}

/* -------------------- DRAW -------------------- */

function draw(){
  drawBackground();
  drawBillboards();
  drawForegroundRailings();
  drawStars();
  drawObstacles();
  drawTacos();
  drawFloor();
  drawPlayer();
  drawParticles();
  drawHud();
  drawTacoMessage();

  if(gameState === "title"){
    drawTitleScreen();
  }

  if(gameState === "gameover"){
    drawGameOver();
  }

  requestAnimationFrame(
    loop
  );
}

function loop(){
  update();
  draw();
}

function drawBackground(){
  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      WIDTH,
      HEIGHT
    );

  gradient.addColorStop(
    0,
    "#05070d"
  );

  gradient.addColorStop(
    0.45,
    "#0b1020"
  );

  gradient.addColorStop(
    1,
    "#05070d"
  );

  ctx.fillStyle =
    gradient;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  if(bgLoaded){
    const bgDrawHeight =
      HEIGHT -
      CONFIG.floorHeight;

    const scale =
      bgDrawHeight /
      bgImage.height;

    const bgDrawWidth =
      bgImage.width *
      scale;

    const offset =
      (
        frame *
        CONFIG.backgroundSpeed
      ) %
      bgDrawWidth;

    for(
      let x = -offset;
      x <
      WIDTH +
      bgDrawWidth;
      x += bgDrawWidth
    ){
      ctx.drawImage(
        bgImage,
        x,
        0,
        bgDrawWidth,
        bgDrawHeight
      );
    }

    ctx.fillStyle =
      "rgba(5,7,13,.18)";

    ctx.fillRect(
      0,
      0,
      WIDTH,
      bgDrawHeight
    );
  }else if(bgFailed){
    drawFallbackGrid();
  }
}

function drawForegroundRailings(){
  if(!bgLoaded){
    return;
  }

  const bgDrawHeight =
    HEIGHT -
    CONFIG.floorHeight;

  const scale =
    bgDrawHeight /
    bgImage.height;

  const bgDrawWidth =
    bgImage.width *
    scale;

  const offset =
    (
      frame *
      CONFIG.backgroundSpeed
    ) %
    bgDrawWidth;

  const sourceY =
    Math.floor(
      bgImage.height *
      CONFIG.railingSourceStartRatio
    );

  const sourceHeight =
    bgImage.height -
    sourceY;

  const destinationY =
    sourceY *
    scale;

  const destinationHeight =
    sourceHeight *
    scale;

  for(
    let x = -offset;
    x <
    WIDTH +
    bgDrawWidth;
    x += bgDrawWidth
  ){
    ctx.drawImage(
      bgImage,

      0,
      sourceY,
      bgImage.width,
      sourceHeight,

      x,
      destinationY,
      bgDrawWidth,
      destinationHeight
    );
  }
}

function drawFallbackGrid(){
  ctx.save();

  ctx.globalAlpha =
    0.12;

  ctx.strokeStyle =
    COLORS.cyan;

  ctx.lineWidth = 1;

  for(
    let x = -80;
    x <
    WIDTH + 80;
    x += 80
  ){
    ctx.beginPath();

    ctx.moveTo(
      x -
      (
        frame %
        80
      ),
      0
    );

    ctx.lineTo(
      x +
      140 -
      (
        frame %
        80
      ),
      HEIGHT
    );

    ctx.stroke();
  }

  ctx.strokeStyle =
    COLORS.magenta;

  for(
    let y = 40;
    y < HEIGHT;
    y += 80
  ){
    const wave =
      Math.sin(
        frame / 50
      ) *
      6;

    ctx.beginPath();

    ctx.moveTo(
      0,
      y + wave
    );

    ctx.lineTo(
      WIDTH,
      y + wave
    );

    ctx.stroke();
  }

  ctx.restore();
}

function drawStars(){
  if(bgLoaded){
    return;
  }

  for(
    const star
    of stars
  ){
    ctx.globalAlpha =
      star.alpha;

    ctx.fillStyle =
      COLORS.white;

    ctx.fillRect(
      star.x,
      star.y,
      star.size,
      star.size
    );
  }

  ctx.globalAlpha = 1;
}

function drawObstacles(){
  for(
    const obstacle
    of obstacles
  ){
    drawPipeTop(
      obstacle.x,
      0,
      obstacle.width,
      obstacle.gapY
    );

    drawPipeBottom(
      obstacle.x,

      obstacle.gapY +
      obstacle.gap,

      obstacle.width,

      HEIGHT -
      CONFIG.floorHeight -
      (
        obstacle.gapY +
        obstacle.gap
      )
    );
  }
}

function drawPipeTop(
  x,
  y,
  width,
  height
){
  if(height <= 0){
    return;
  }

  if(pipeTopLoaded){
    ctx.drawImage(
      pipeTopImage,
      x,
      y,
      width,
      height
    );
  }else{
    drawGate(
      x,
      y,
      width,
      height,
      true
    );
  }
}

function drawPipeBottom(
  x,
  y,
  width,
  height
){
  if(height <= 0){
    return;
  }

  if(pipeBottomLoaded){
    ctx.drawImage(
      pipeBottomImage,
      x,
      y,
      width,
      height
    );
  }else{
    drawGate(
      x,
      y,
      width,
