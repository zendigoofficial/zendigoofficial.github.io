const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext(
  "2d",
  {
    alpha: false,
    desynchronized: true
  }
);

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FIXED_STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 100;
const MAX_UPDATE_STEPS = 6;

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
  obstacleSpeed: 2.6,
  obstacleSpacing: 390,

  floorHeight: 46,
  backgroundSpeed: 1.15,

  defaultMusicLevel: 2,
  defaultSfxLevel: 8,
  musicMaxVolume: 0.5,
  sfxMaxGain: 2.0,

  tacoEveryNGates: 5,
  tacoBonusPoints: 5,
  tacoWidth: 82,
  tacoHeight: 54,
  tacoCollisionRadius: 25,
  tacoBobAmount: 7,
  tacoBobSpeed: 0.075,

  waterScaleX: 1,
  waterScaleY: 1,
  waterY: 385,
  waterSpeed: 1.6,
  waterCropTop: 0,
  waterCropBottom: 0,
  waterCropLeft: 0,
  waterCropRight: 0,
  waterTileOverlap: 12,

  billboardScale: 0.56,
  billboardRight: 46,
  billboardY: 280,

  railingSourceStartRatio: 0.77
};

const backgroundGradient =
  ctx.createLinearGradient(
    0,
    0,
    WIDTH,
    HEIGHT
  );

backgroundGradient.addColorStop(
  0,
  "#05070d"
);

backgroundGradient.addColorStop(
  0.45,
  "#0b1020"
);

backgroundGradient.addColorStop(
  1,
  "#05070d"
);

function createFloorLayer(){
  const layer =
    document.createElement(
      "canvas"
    );

  layer.width = WIDTH;
  layer.height =
    CONFIG.floorHeight;

  const layerContext =
    layer.getContext(
      "2d",
      {
        alpha: true
      }
    );

  layerContext.fillStyle =
    "rgba(10,10,18,.95)";

  layerContext.fillRect(
    0,
    0,
    WIDTH,
    CONFIG.floorHeight
  );

  layerContext.strokeStyle =
    COLORS.cyan;

  layerContext.lineWidth = 2;
  layerContext.beginPath();
  layerContext.moveTo(0, 1);
  layerContext.lineTo(WIDTH, 1);
  layerContext.stroke();

  layerContext.globalAlpha =
    0.4;

  layerContext.fillStyle =
    COLORS.magenta;

  for(
    let x = 15;
    x < WIDTH;
    x += 55
  ){
    layerContext.fillRect(
      x,
      CONFIG.floorHeight - 22,
      28,
      3
    );
  }

  return layer;
}

const floorLayer =
  createFloorLayer();

function readStoredNumber(
  key,
  fallback
){
  try{
    const value =
      Number(
        localStorage.getItem(key)
      );

    return Number.isFinite(value)
      ? value
      : fallback;
  }catch(error){
    console.warn(
      "Stored settings are unavailable:",
      error
    );

    return fallback;
  }
}

function writeStoredValue(
  key,
  value
){
  try{
    localStorage.setItem(
      key,
      String(value)
    );
  }catch(error){
    console.warn(
      "Unable to save local game data:",
      error
    );
  }
}

let gameState = "title";
let frame = 0;
let score = 0;
let best = readStoredNumber(
  "flappyFaceBest",
  0
);
let tacosCollected = 0;
let bestTacos = readStoredNumber(
  "flappyFaceBestTacos",
  0
);
let gateSequence = 0;
let totalGatesPassed = 0;
let tacoMessage = "";
let tacoMessageTimer = 0;
let player;
let obstacles = [];
let particles = [];
let stars = [];
let musicStarted = false;
let soundPanelOpen = false;
let stateBeforeSoundPanel = null;
let soundPanelSelection = 0;
let lastFrameTime = 0;
let updateAccumulator = 0;
let activeGamepadIndex = null;
let previousGamepadButtons = [];
let previousGamepadAxes = {
  up: false,
  down: false,
  left: false,
  right: false
};
let controllerLabel = "";

function clampSoundLevel(value){
  if(!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, Math.round(value)));
}

let musicLevel = clampSoundLevel(
  readStoredNumber(
    "flappyFaceMusicLevel",
    CONFIG.defaultMusicLevel
  )
);

let sfxLevel = clampSoundLevel(
  readStoredNumber(
    "flappyFaceSfxLevel",
    CONFIG.defaultSfxLevel
  )
);

let previousMusicLevel = musicLevel > 0 ? musicLevel : CONFIG.defaultMusicLevel;

/* -------------------- ASSETS -------------------- */

const faceImage = new Image();
faceImage.src = "assets/player_face.webp";

const bgImage = new Image();
bgImage.src = "assets/bg_neon_city.webp";

const pipeTopImage = new Image();
pipeTopImage.src = "assets/pipe_top.webp";

const pipeBottomImage = new Image();
pipeBottomImage.src = "assets/pipe_bottom.webp";

const tacoImage = new Image();
tacoImage.src = "assets/taco_collectible.webp";

const billboardImage = new Image();
billboardImage.src = "assets/sheetz_billboard.webp";

const foregroundWallImage = new Image();
foregroundWallImage.src = "assets/foreground_wall_railing.webp";

const waterImage = new Image();
waterImage.src = "assets/water_asset_transparent.webp";

const music = new Audio("assets/flappy_face_theme.mp3");
music.loop = true;
music.preload = "none";

const tacoCrunch = new Audio("assets/audio/taco_crunch.wav");
tacoCrunch.preload = "auto";

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
let foregroundWallLoaded = false;
let foregroundWallFailed = false;
let waterLoaded = false;
let waterFailed = false;

faceImage.onload = () => {
  faceLoaded = true;
};

faceImage.onerror = () => {
  faceFailed = true;
  console.warn("Face failed to load:", faceImage.src);
};

bgImage.onload = () => {
  bgLoaded = true;
};

bgImage.onerror = () => {
  bgFailed = true;
  console.warn("Background failed to load:", bgImage.src);
};

pipeTopImage.onload = () => {
  pipeTopLoaded = true;
};

pipeTopImage.onerror = () => {
  console.warn("Top pipe failed to load:", pipeTopImage.src);
};

pipeBottomImage.onload = () => {
  pipeBottomLoaded = true;
};

pipeBottomImage.onerror = () => {
  console.warn("Bottom pipe failed to load:", pipeBottomImage.src);
};

tacoImage.onload = () => {
  tacoLoaded = true;
};

tacoImage.onerror = () => {
  tacoFailed = true;
  console.warn("Taco failed to load:", tacoImage.src);
};

billboardImage.onload = () => {
  billboardLoaded = true;
};

billboardImage.onerror = () => {
  billboardFailed = true;
  
  console.warn(
    "Billboard failed to load:", 
    billboardImage.src
  );
};

foregroundWallImage.onload = () => {
  foregroundWallLoaded = true;
};

foregroundWallImage.onerror = () => {
  foregroundWallFailed = true;

  console.warn(
    "Foreground wall failed to load:",
    foregroundWallImage.src
  );
};

waterImage.onload = () => {
  waterLoaded = true;
};

waterImage.onerror = () => {
  waterFailed = true;

  console.warn(
    "Water failed to load:",
    waterImage.src
  );
};

music.onerror = () => {
  console.warn("Music failed to load:", music.src);
};

tacoCrunch.onerror = () => {
  console.warn("Taco crunch failed to load:", tacoCrunch.src);
};

/* -------------------- SOUND -------------------- */

let sfxAudioContext = null;
let tacoCrunchSource = null;
let tacoCrunchGain = null;

function initializeSfxAudio(){
  if(sfxAudioContext) return;

  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if(!AudioContextClass){
    console.warn("Web Audio is not supported. Using normal SFX volume.");
    return;
  }

  sfxAudioContext = new AudioContextClass();

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
    (sfxLevel / 10) *
    CONFIG.sfxMaxGain;

  if(tacoCrunchGain){
    tacoCrunchGain.gain.value = gain;
  }else{
    tacoCrunch.volume =
      Math.min(1, gain);
  }
}

function applySoundLevels(){
  music.volume =
    (musicLevel / 10) *
    CONFIG.musicMaxVolume;

  updateSfxGain();
}

function saveSoundLevels(){
  writeStoredValue(
    "flappyFaceMusicLevel",
    musicLevel
  );

  writeStoredValue(
    "flappyFaceSfxLevel",
    sfxLevel
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

    music.play().catch(error => {
      console.warn(
        "Music resume failed:",
        error
      );

      musicStarted = false;
    });
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

  music.play().catch(error => {
    console.warn(
      "Music play blocked or failed:",
      error
    );

    musicStarted = false;
  });
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
    sfxAudioContext.state === "suspended"
  ){
    sfxAudioContext
      .resume()
      .catch(error => {
        console.warn(
          "Audio context resume failed:",
          error
        );
      });
  }

  tacoCrunch.pause();
  tacoCrunch.currentTime = 0;

  tacoCrunch.play().catch(error => {
    console.warn(
      "Taco crunch play failed:",
      error
    );
  });
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
      top:max(18px,env(safe-area-inset-top));
      right:max(18px,env(safe-area-inset-right));
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
      top:max(68px,calc(env(safe-area-inset-top) + 50px));
      right:max(18px,env(safe-area-inset-right));
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

    .ff-sound-button:focus-visible,
    .ff-sound-panel input:focus-visible,
    .ff-sound-close:focus-visible,
    .ff-sound-panel [data-controller-selected="true"]{
      outline:3px solid #FFD84D;
      outline-offset:4px;
    }

    .ff-sound-help{
      margin:14px 0 0;
      color:#A9AEC3;
      font-size:10px;
      line-height:1.45;
      text-align:center;
    }

    @media(max-width:640px){
      .ff-sound-button{
        padding:9px 11px;
        font-size:11px;
      }

      .ff-sound-panel{
        max-height:calc(100svh - 90px);
        overflow:auto;
      }
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
        <span id="ffMusicValue" class="ff-sound-value">
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
        <span id="ffSfxValue" class="ff-sound-value">
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

    <p class="ff-sound-help">
      CONTROLLER: D-PAD SELECTS · LEFT/RIGHT ADJUSTS · B CLOSES
    </p>
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
  if(soundPanelOpen){
    closeSoundPanel();
  }else{
    openSoundPanel();
  }
}

function openSoundPanel(){
  soundPanelOpen = true;

  const panel =
    document.getElementById(
      "ffSoundPanel"
    );

  if(!panel){
    return;
  }

  panel.classList.add(
    "open"
  );

  panel.setAttribute(
    "aria-hidden",
    "false"
  );

  if(gameState === "playing"){
    stateBeforeSoundPanel =
      "playing";

    gameState =
      "paused";

    music.pause();
  }else{
    stateBeforeSoundPanel =
      null;
  }

  soundPanelSelection = 0;
  focusSoundControl(
    soundPanelSelection
  );
}

function closeSoundPanel(
  resumeGame = true
){
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

  if(
    resumeGame &&
    stateBeforeSoundPanel ===
      "playing" &&
    gameState === "paused"
  ){
    gameState =
      "playing";

    if(
      musicLevel > 0 &&
      musicStarted
    ){
      music.play().catch(error => {
        console.warn(
          "Music resume after settings failed:",
          error
        );
      });
    }
  }

  stateBeforeSoundPanel =
    null;

  canvas.focus({
    preventScroll: true
  });
}

function getSoundControls(){
  return [
    document.getElementById(
      "ffMusicSlider"
    ),
    document.getElementById(
      "ffSfxSlider"
    ),
    document.getElementById(
      "ffSoundClose"
    )
  ].filter(Boolean);
}

function focusSoundControl(index){
  const controls =
    getSoundControls();

  if(!controls.length){
    return;
  }

  soundPanelSelection =
    (
      index +
      controls.length
    ) %
    controls.length;

  controls.forEach(
    (
      control,
      controlIndex
    ) => {
      control.dataset.controllerSelected =
        String(
          controlIndex ===
            soundPanelSelection
        );
    }
  );

  controls[
    soundPanelSelection
  ].focus({
    preventScroll: true
  });
}

function adjustSelectedSound(
  direction
){
  if(soundPanelSelection === 0){
    setMusicLevel(
      musicLevel + direction
    );
  }

  if(soundPanelSelection === 1){
    setSfxLevel(
      sfxLevel + direction
    );
  }
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
  if(gameState === "paused"){
    return;
  }

  frame++;

  updateStars();
  updateParticles();

  if(tacoMessageTimer > 0){
    tacoMessageTimer--;

    if(tacoMessageTimer <= 0){
      tacoMessage = "";
    }
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

      burst(
        player.x,
        player.y,
        COLORS.magenta,
        10
      );

      updateBestScore();
    }
  }

  for(
    let index =
      obstacles.length - 1;
    index >= 0;
    index--
  ){
    const obstacle =
      obstacles[index];

    if(
      obstacle.x +
      obstacle.width <=
      -120
    ){
      obstacles.splice(
        index,
        1
      );
    }
  }

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

  for(
    let index =
      particles.length - 1;
    index >= 0;
    index--
  ){
    if(
      particles[index].life <=
      0
    ){
      particles.splice(
        index,
        1
      );
    }
  }
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

    writeStoredValue(
      "flappyFaceBestTacos",
      bestTacos
    );
  }

  updateBestScore();
}

function updateBestScore(){
  if(score <= best){
    return;
  }

  best = score;

  writeStoredValue(
    "flappyFaceBest",
    best
  );
}

/* -------------------- BILLBOARD LANDMARK -------------------- */

function drawBillboards(){
  if(
    !billboardLoaded ||
    billboardFailed
  ){
    return;
  }

  const drawWidth =
    billboardImage.width *
    CONFIG.billboardScale;

  const drawHeight =
    billboardImage.height *
    CONFIG.billboardScale;

  ctx.drawImage(
    billboardImage,
    WIDTH -
      CONFIG.billboardRight -
      drawWidth,
    CONFIG.billboardY,
    drawWidth,
    drawHeight
  );
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
  drawForegroundWall();
  drawWater();
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

  if(gameState === "paused"){
    drawPausedScreen();
  }
}

function loop(timestamp){
  if(!lastFrameTime){
    lastFrameTime =
      timestamp;
  }

  const elapsed =
    Math.min(
      MAX_FRAME_MS,
      timestamp -
      lastFrameTime
    );

  lastFrameTime =
    timestamp;

  updateAccumulator +=
    elapsed;

  pollGamepads();

  let updateSteps = 0;

  while(
    updateAccumulator >=
      FIXED_STEP_MS &&
    updateSteps <
      MAX_UPDATE_STEPS
  ){
    update();

    updateAccumulator -=
      FIXED_STEP_MS;

    updateSteps++;
  }

  if(
    updateSteps ===
    MAX_UPDATE_STEPS
  ){
    updateAccumulator = 0;
  }

  draw();

  requestAnimationFrame(
    loop
  );
}

function drawBackground(){
  ctx.fillStyle =
    backgroundGradient;

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

function drawForegroundWall(){
  if(
    !foregroundWallLoaded ||
    foregroundWallFailed
  ){
    return;
  }

  const sourceCropTop = 18;
  const sourceCropBottom = 8;

  const sourceWidth =
    foregroundWallImage.width;

  const sourceHeight =
    foregroundWallImage.height -
    sourceCropTop -
    sourceCropBottom;

  const scale = 0.19;

  const tileWidth =
    sourceWidth *
    scale;

  const tileHeight =
    sourceHeight *
    scale;

  const wallLift = -19;

  const drawY =
    HEIGHT -
    CONFIG.floorHeight -
    tileHeight +
    wallLift;

  for(
    let x = 0;
    x < WIDTH + tileWidth;
    x += tileWidth
  ){
    ctx.drawImage(
      foregroundWallImage,

      0,
      sourceCropTop,
      sourceWidth,
      sourceHeight,

      x,
      drawY,
      tileWidth,
      tileHeight
    );
  }
}
function drawWater(){
  if(
    !waterLoaded ||
    waterFailed
  ){
    return;
  }

  const sourceCropTop =
    CONFIG.waterCropTop;

  const sourceCropBottom =
    CONFIG.waterCropBottom;

  const sourceCropLeft =
    CONFIG.waterCropLeft;

  const sourceCropRight =
    CONFIG.waterCropRight;

  const sourceWidth =
    waterImage.width -
    sourceCropLeft -
    sourceCropRight;

  const sourceHeight =
    waterImage.height -
    sourceCropTop -
    sourceCropBottom;

  const tileWidth =
    sourceWidth *
    CONFIG.waterScaleX;

  const tileHeight =
    sourceHeight *
    CONFIG.waterScaleY;

  const tileStep =
    tileWidth -
    CONFIG.waterTileOverlap;

  const offset =
    (
      frame *
      CONFIG.waterSpeed
    ) %
    tileStep;

  for(
    let x = -offset;
    x < WIDTH + tileWidth;
    x += tileStep
  ){
    ctx.drawImage(
      waterImage,

      sourceCropLeft,
      sourceCropTop,
      sourceWidth,
      sourceHeight,

      x,
      CONFIG.waterY,
      tileWidth,
      tileHeight
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
      height,
      false
    );
  }
}

function drawGate(
  x,
  y,
  width,
  height,
  top
){
  if(height <= 0){
    return;
  }

  const gradient =
    ctx.createLinearGradient(
      x,
      y,
      x + width,
      y
    );

  gradient.addColorStop(
    0,
    "rgba(0,255,238,.95)"
  );

  gradient.addColorStop(
    0.5,
    "rgba(162,48,240,.92)"
  );

  gradient.addColorStop(
    1,
    "rgba(255,32,255,.95)"
  );

  ctx.save();

  ctx.shadowColor =
    COLORS.magenta;

  ctx.shadowBlur = 18;

  ctx.fillStyle =
    gradient;

  ctx.fillRect(
    x,
    y,
    width,
    height
  );

  ctx.shadowBlur = 0;

  ctx.fillStyle =
    "rgba(5,7,13,.68)";

  ctx.fillRect(
    x + 10,
    y + 10,
    width - 20,
    Math.max(
      0,
      height - 20
    )
  );

  ctx.strokeStyle =
    COLORS.cyan;

  ctx.lineWidth = 3;

  ctx.strokeRect(
    x + 4,
    y + 4,
    width - 8,
    height - 8
  );

  ctx.fillStyle =
    "rgba(255,255,255,.08)";

  for(
    let i = 0;
    i < height;
    i += 28
  ){
    ctx.fillRect(
      x + 12,
      y + i,
      width - 24,
      3
    );
  }

  ctx.fillStyle =
    top
      ? COLORS.magenta
      : COLORS.cyan;

  if(top){
    ctx.fillRect(
      x - 8,
      y +
      height -
      20,
      width + 16,
      20
    );
  }else{
    ctx.fillRect(
      x - 8,
      y,
      width + 16,
      20
    );
  }

  ctx.restore();
}

function drawTacos(){
  for(
    const obstacle
    of obstacles
  ){
    if(
      !obstacle.hasTaco ||
      obstacle.tacoCollected
    ){
      continue;
    }

    const position =
      getTacoPosition(
        obstacle
      );

    ctx.save();

    ctx.translate(
      position.x,
      position.y
    );

    ctx.rotate(
      Math.sin(
        frame *
        0.045 +
        obstacle.tacoPhase
      ) *
      0.08
    );

    const pulse =
      1 +
      Math.sin(
        frame *
        0.085 +
        obstacle.tacoPhase
      ) *
      0.055;

    const width =
      CONFIG.tacoWidth *
      pulse;

    const height =
      CONFIG.tacoHeight *
      pulse;

    ctx.shadowColor =
      COLORS.gold;

    ctx.shadowBlur = 20;

    if(tacoLoaded){
      ctx.drawImage(
        tacoImage,
        -width / 2,
        -height / 2,
        width,
        height
      );
    }else{
      drawFallbackTaco(
        width,
        height
      );
    }

    ctx.restore();
  }
}

function drawFallbackTaco(
  width,
  height
){
  ctx.save();

  ctx.fillStyle =
    COLORS.gold;

  ctx.strokeStyle =
    COLORS.black;

  ctx.lineWidth = 4;

  ctx.beginPath();

  ctx.ellipse(
    0,
    4,
    width / 2,
    height / 2,
    0,
    Math.PI,
    Math.PI * 2
  );

  ctx.lineTo(
    width / 2,
    6
  );

  ctx.quadraticCurveTo(
    0,
    height / 2,
    -width / 2,
    6
  );

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle =
    "#61D836";

  ctx.fillRect(
    -width * 0.28,
    -2,
    width * 0.56,
    8
  );

  ctx.fillStyle =
    COLORS.red;

  ctx.fillRect(
    -width * 0.18,
    -7,
    width * 0.36,
    7
  );

  ctx.restore();
}

function drawFloor(){
  ctx.drawImage(
    floorLayer,
    0,
    HEIGHT -
      CONFIG.floorHeight
  );
}

function drawPlayer(){
  ctx.save();

  ctx.translate(
    player.x,
    player.y
  );

  ctx.rotate(
    player.rotation
  );

  ctx.shadowColor =
    COLORS.cyan;

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

  if(faceFailed){
    ctx.fillStyle =
      COLORS.magenta;

    ctx.font =
      "700 9px Orbitron, Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      "NO FACE",
      0,
      46
    );
  }

  ctx.restore();
}

function drawPlaceholderFace(){
  const gradient =
    ctx.createRadialGradient(
      -8,
      -8,
      5,
      0,
      0,
      CONFIG.playerRadius
    );

  gradient.addColorStop(
    0,
    "#ffffff"
  );

  gradient.addColorStop(
    0.4,
    COLORS.cyan
  );

  gradient.addColorStop(
    1,
    COLORS.purple
  );

  ctx.fillStyle =
    gradient;

  ctx.beginPath();

  ctx.arc(
    0,
    0,
    CONFIG.playerRadius,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle =
    COLORS.black;

  ctx.beginPath();

  ctx.arc(
    -9,
    -5,
    4,
    0,
    Math.PI * 2
  );

  ctx.arc(
    9,
    -5,
    4,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.strokeStyle =
    COLORS.black;

  ctx.lineWidth = 3;

  ctx.beginPath();

  ctx.arc(
    0,
    5,
    9,
    0.1,
    Math.PI - 0.1
  );

  ctx.stroke();
}

function drawParticles(){
  for(
    const particle
    of particles
  ){
    ctx.globalAlpha =
      Math.max(
        0,
        particle.life / 24
      );

    ctx.fillStyle =
      particle.color;

    const size =
      particle.size || 4;

    ctx.fillRect(
      particle.x,
      particle.y,
      size,
      size
    );
  }

  ctx.globalAlpha = 1;
}

function drawHud(){
  ctx.save();

  ctx.font =
    "900 26px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.cyan;

  ctx.shadowColor =
    COLORS.cyan;

  ctx.shadowBlur = 12;

  ctx.fillText(
    `SIGNAL SCORE: ${score}`,
    26,
    42
  );

  ctx.fillStyle =
    COLORS.magenta;

  ctx.shadowColor =
    COLORS.magenta;

  ctx.fillText(
    `BEST BROADCAST: ${best}`,
    26,
    76
  );

  ctx.font =
    "900 19px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.gold;

  ctx.shadowColor =
    COLORS.gold;

  ctx.fillText(
    `TACOS: ${tacosCollected}`,
    26,
    108
  );

  ctx.font =
    "700 14px Orbitron, Arial";

  ctx.shadowBlur = 0;

  ctx.fillStyle =
    musicLevel > 0
      ? COLORS.cyan
      : COLORS.muted;

  ctx.fillText(
    `MUSIC: ${musicLevel}/10`,
    WIDTH - 170,
    42
  );

  ctx.fillStyle =
    sfxLevel > 0
      ? COLORS.gold
      : COLORS.muted;

  ctx.fillText(
    `SFX: ${sfxLevel}/10`,
    WIDTH - 170,
    65
  );

  ctx.restore();
}

function drawTacoMessage(){
  if(
    tacoMessageTimer <= 0 ||
    !tacoMessage
  ){
    return;
  }

  const alpha =
    Math.min(
      1,
      tacoMessageTimer / 18
    );

  const lift =
    (
      72 -
      tacoMessageTimer
    ) *
    0.35;

  ctx.save();

  ctx.globalAlpha =
    alpha;

  ctx.textAlign =
    "center";

  ctx.font =
    "900 28px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.gold;

  ctx.shadowColor =
    COLORS.orange;

  ctx.shadowBlur = 18;

  ctx.fillText(
    tacoMessage,
    WIDTH / 2,
    HEIGHT / 2 -
    120 -
    lift
  );

  ctx.restore();
}

function drawTitleScreen(){
  drawOverlay();

  ctx.save();

  ctx.textAlign =
    "center";

  ctx.font =
    "900 64px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.cyan;

  ctx.shadowColor =
    COLORS.cyan;

  ctx.shadowBlur = 18;

  ctx.fillText(
    "FLAPPY FACE",
    WIDTH / 2,
    HEIGHT / 2 - 112
  );

  ctx.font =
    "900 22px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.magenta;

  ctx.shadowColor =
    COLORS.magenta;

  ctx.fillText(
    "UNAUTHORIZED BROADCAST MINI-GAME",
    WIDTH / 2,
    HEIGHT / 2 - 66
  );

  ctx.font =
    "900 24px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.white;

  ctx.shadowBlur = 0;

  ctx.fillText(
    "CLICK / TAP / SPACE / A TO GO LIVE",
    WIDTH / 2,
    HEIGHT / 2 + 6
  );

  ctx.font =
    "700 16px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.muted;

  ctx.fillText(
    "Avoid the signal gates. Protect the broadcast.",
    WIDTH / 2,
    HEIGHT / 2 + 44
  );

  ctx.fillStyle =
    COLORS.gold;

  ctx.fillText(
    "Crunch the taco in every fifth gate for +5 points.",
    WIDTH / 2,
    HEIGHT / 2 + 72
  );

  ctx.fillStyle =
    COLORS.muted;

  ctx.fillText(
    "KEYBOARD, TOUCH AND CONTROLLER READY",
    WIDTH / 2,
    HEIGHT / 2 + 100
  );

  ctx.restore();
}

function drawGameOver(){
  drawOverlay();

  ctx.save();

  ctx.textAlign =
    "center";

  ctx.font =
    "900 58px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.magenta;

  ctx.shadowColor =
    COLORS.magenta;

  ctx.shadowBlur = 18;

  ctx.fillText(
    "SIGNAL LOST",
    WIDTH / 2,
    HEIGHT / 2 - 94
  );

  ctx.font =
    "900 24px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.cyan;

  ctx.shadowColor =
    COLORS.cyan;

  ctx.fillText(
    `FINAL SIGNAL SCORE: ${score}`,
    WIDTH / 2,
    HEIGHT / 2 - 42
  );

  ctx.fillStyle =
    COLORS.gold;

  ctx.shadowColor =
    COLORS.gold;

  ctx.fillText(
    `TACOS CRUNCHED: ${tacosCollected}`,
    WIDTH / 2,
    HEIGHT / 2 - 6
  );

  ctx.font =
    "900 22px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.white;

  ctx.shadowBlur = 0;

  ctx.fillText(
    "CLICK / TAP / SPACE / A TO REBOOT",
    WIDTH / 2,
    HEIGHT / 2 + 58
  );

  ctx.font =
    "700 15px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.muted;

  ctx.fillText(
    "B / VIEW RESETS · Y MUTES · START OPENS SOUND",
    WIDTH / 2,
    HEIGHT / 2 + 90
  );

  ctx.restore();
}

function drawPausedScreen(){
  drawOverlay();

  ctx.save();

  ctx.textAlign =
    "center";

  ctx.font =
    "900 48px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.cyan;

  ctx.shadowColor =
    COLORS.cyan;

  ctx.shadowBlur = 18;

  ctx.fillText(
    "BROADCAST PAUSED",
    WIDTH / 2,
    HEIGHT / 2 - 18
  );

  ctx.font =
    "700 17px Orbitron, Arial";

  ctx.fillStyle =
    COLORS.white;

  ctx.shadowBlur = 0;

  ctx.fillText(
    "CLOSE SOUND SETTINGS TO RESUME",
    WIDTH / 2,
    HEIGHT / 2 + 28
  );

  ctx.restore();
}

function drawOverlay(){
  ctx.save();

  ctx.fillStyle =
    "rgba(5,7,13,.72)";

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  ctx.strokeStyle =
    "rgba(0,255,238,.28)";

  ctx.lineWidth = 3;

  ctx.strokeRect(
    24,
    24,
    WIDTH - 48,
    HEIGHT - 48
  );

  ctx.restore();
}

/* -------------------- CONTROLLER -------------------- */

function updateControllerStatus(
  gamepad
){
  const status =
    document.getElementById(
      "controllerStatus"
    );

  const nextLabel =
    gamepad
      ? gamepad.id ||
        "Game controller"
      : "";

  if(
    nextLabel ===
    controllerLabel
  ){
    return;
  }

  controllerLabel =
    nextLabel;

  if(!status){
    return;
  }

  status.classList.toggle(
    "is-ready",
    Boolean(gamepad)
  );

  status.textContent =
    gamepad
      ? `Controller ready: ${nextLabel}`
      : "Controller: connect and press a button";
}

function resetGamepadInputState(){
  previousGamepadButtons = [];

  previousGamepadAxes = {
    up: false,
    down: false,
    left: false,
    right: false
  };
}

function getActiveGamepad(){
  if(
    typeof navigator.getGamepads !==
    "function"
  ){
    return null;
  }

  const gamepads =
    navigator.getGamepads();

  if(
    activeGamepadIndex !== null
  ){
    const activeGamepad =
      gamepads[
        activeGamepadIndex
      ];

    if(
      activeGamepad &&
      activeGamepad.connected
    ){
      return activeGamepad;
    }
  }

  for(
    const gamepad
    of gamepads
  ){
    if(
      gamepad &&
      gamepad.connected
    ){
      activeGamepadIndex =
        gamepad.index;

      resetGamepadInputState();
      updateControllerStatus(
        gamepad
      );

      return gamepad;
    }
  }

  activeGamepadIndex =
    null;

  updateControllerStatus(
    null
  );

  return null;
}

function restartToTitle(){
  if(soundPanelOpen){
    closeSoundPanel(false);
  }

  stateBeforeSoundPanel =
    null;

  resetGame();

  gameState =
    "title";
}

function pollGamepads(){
  const gamepad =
    getActiveGamepad();

  if(!gamepad){
    return;
  }

  updateControllerStatus(
    gamepad
  );

  const currentButtons =
    gamepad.buttons.map(
      button =>
        button.pressed ||
        button.value > 0.55
    );

  const justPressed =
    buttonIndex =>
      Boolean(
        currentButtons[
          buttonIndex
        ]
      ) &&
      !Boolean(
        previousGamepadButtons[
          buttonIndex
        ]
      );

  const horizontalAxis =
    gamepad.axes[0] || 0;

  const verticalAxis =
    gamepad.axes[1] || 0;

  const currentAxes = {
    up:
      verticalAxis <
      -0.58,
    down:
      verticalAxis >
      0.58,
    left:
      horizontalAxis <
      -0.58,
    right:
      horizontalAxis >
      0.58
  };

  const axisPressed =
    direction =>
      currentAxes[direction] &&
      !previousGamepadAxes[
        direction
      ];

  const menuUp =
    justPressed(12) ||
    axisPressed("up");

  const menuDown =
    justPressed(13) ||
    axisPressed("down");

  const menuLeft =
    justPressed(14) ||
    axisPressed("left");

  const menuRight =
    justPressed(15) ||
    axisPressed("right");

  if(soundPanelOpen){
    if(
      justPressed(1) ||
      justPressed(8) ||
      justPressed(9)
    ){
      closeSoundPanel();
    }else if(menuUp){
      focusSoundControl(
        soundPanelSelection - 1
      );
    }else if(menuDown){
      focusSoundControl(
        soundPanelSelection + 1
      );
    }else if(menuLeft){
      adjustSelectedSound(-1);
    }else if(menuRight){
      adjustSelectedSound(1);
    }else if(
      justPressed(0) &&
      soundPanelSelection === 2
    ){
      closeSoundPanel();
    }

    previousGamepadButtons =
      currentButtons;

    previousGamepadAxes =
      currentAxes;

    return;
  }

  if(justPressed(9)){
    openSoundPanel();
  }else if(justPressed(3)){
    toggleMusic();
  }else if(
    justPressed(1) ||
    justPressed(8)
  ){
    restartToTitle();
  }else if(
    justPressed(0) ||
    justPressed(2) ||
    justPressed(4) ||
    justPressed(5) ||
    justPressed(6) ||
    justPressed(7) ||
    justPressed(12) ||
    axisPressed("up")
  ){
    flap();
  }

  previousGamepadButtons =
    currentButtons;

  previousGamepadAxes =
    currentAxes;
}

/* -------------------- EVENTS -------------------- */

window.addEventListener(
  "keydown",
  event => {
    if(event.repeat){
      return;
    }

    if(soundPanelOpen){
      if(event.code === "Escape"){
        event.preventDefault();
        closeSoundPanel();
      }

      return;
    }

    if(
      event.code === "Space" ||
      event.code === "ArrowUp" ||
      event.code === "KeyW" ||
      event.code === "Enter"
    ){
      event.preventDefault();
      flap();
    }

    if(event.code === "KeyR"){
      event.preventDefault();
      restartToTitle();
    }

    if(event.code === "KeyM"){
      event.preventDefault();
      toggleMusic();
    }

    if(event.code === "KeyS"){
      event.preventDefault();
      openSoundPanel();
    }
  }
);

canvas.addEventListener(
  "pointerdown",
  event => {
    event.preventDefault();

    if(
      event.pointerType ===
        "mouse" &&
      event.button !== 0
    ){
      return;
    }

    canvas.focus({
      preventScroll: true
    });

    if(!soundPanelOpen){
      flap();
    }
  }
);

window.addEventListener(
  "gamepadconnected",
  event => {
    activeGamepadIndex =
      event.gamepad.index;

    resetGamepadInputState();

    updateControllerStatus(
      event.gamepad
    );
  }
);

window.addEventListener(
  "gamepaddisconnected",
  event => {
    if(
      activeGamepadIndex ===
      event.gamepad.index
    ){
      activeGamepadIndex =
        null;

      resetGamepadInputState();
      updateControllerStatus(
        null
      );
    }
  }
);

document.addEventListener(
  "visibilitychange",
  () => {
    lastFrameTime = 0;
    updateAccumulator = 0;

    if(document.hidden){
      music.pause();
      tacoCrunch.pause();
      return;
    }

    if(
      musicLevel > 0 &&
      musicStarted &&
      gameState === "playing"
    ){
      music.play().catch(error => {
        console.warn(
          "Music resume after visibility change failed:",
          error
        );
      });
    }
  }
);

/* -------------------- START -------------------- */

applySoundLevels();
createSoundSettings();
resetGame();
updateControllerStatus(null);
requestAnimationFrame(loop);
