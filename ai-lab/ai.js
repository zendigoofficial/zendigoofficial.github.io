(() => {
  "use strict";
  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, TAU = Math.PI * 2;
  const POPULATION = 24, ELITES = 4, INPUTS = 15, HIDDEN = 18, OUTPUTS = 4;
  const SIM_HZ = 30, TICK_MS = 1000 / SIM_HZ, FITNESS_VERSION = 3;
  const MAX_RUN_SECONDS = 600, MAX_STEPS = MAX_RUN_SECONDS * SIM_HZ;
  const STORAGE_KEY = "zendigo-pixel-asteroids-brain-v4", LEGACY_STORAGE_KEYS = ["zendigo-pixel-asteroids-brain-v3","zendigo-pixel-asteroids-brain-v2"];
  const MAX_OFFLINE_SECONDS = 21600, CATCHUP_CHUNK_STEPS = 450;
  const ui = Object.fromEntries(["generationValue","pilotValue","remainingValue","scoreValue","generationScoreValue","survivalValue","hitsValue","fitnessBar","fitnessText","decisionValue","actionDetail","modeValue","signalText","pilotNumber","screenScore"].map(id => [id, document.getElementById(id)]));

  class RNG {
    constructor(seed = 82) { this.s = seed >>> 0; }
    next() { let t = this.s += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    range(a,b) { return a + (b-a)*this.next(); }
    gaussian() { const u=Math.max(this.next(),1e-9),v=this.next(); return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v); }
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const wrap=(v,max)=>v<0?v+max:v>=max?v-max:v;
  const angleWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const torusDelta=(a,b,size)=>{let d=b-a;if(d>size/2)d-=size;if(d<-size/2)d+=size;return d;};

  class Brain {
    constructor(rng, data) {
      const n1=INPUTS*HIDDEN,n2=HIDDEN*OUTPUTS;
      this.w1=data?.w1?.length===n1?Float32Array.from(data.w1):Float32Array.from({length:n1},()=>rng.gaussian()*.48);
      this.b1=data?.b1?.length===HIDDEN?Float32Array.from(data.b1):new Float32Array(HIDDEN);
      this.w2=data?.w2?.length===n2?Float32Array.from(data.w2):Float32Array.from({length:n2},()=>rng.gaussian()*.42);
      this.b2=data?.b2?.length===OUTPUTS?Float32Array.from(data.b2):new Float32Array(OUTPUTS);
    }
    think(input) {
      const hidden=new Float32Array(HIDDEN),out=new Float32Array(OUTPUTS);
      for(let h=0;h<HIDDEN;h++){let s=this.b1[h];for(let i=0;i<INPUTS;i++)s+=input[i]*this.w1[i*HIDDEN+h];hidden[h]=Math.tanh(s);}
      for(let o=0;o<OUTPUTS;o++){let s=this.b2[o];for(let h=0;h<HIDDEN;h++)s+=hidden[h]*this.w2[h*OUTPUTS+o];out[o]=Math.tanh(s);}
      return out;
    }
    child(rng, rate=.11, strength=.28) {
      const c=new Brain(rng,this.toJSON());
      for(const arr of [c.w1,c.b1,c.w2,c.b2])for(let i=0;i<arr.length;i++)if(rng.next()<rate)arr[i]+=rng.gaussian()*strength;
      return c;
    }
    toJSON(){return{w1:[...this.w1],b1:[...this.b1],w2:[...this.w2],b2:[...this.b2]};}
  }

  class World {
    constructor(brain, seed, index) { this.brain=brain;this.rng=new RNG(seed);this.index=index;this.reset(); }
    reset(){
      this.ship={x:W/2,y:H/2,vx:0,vy:0,a:-Math.PI/2,r:11,lives:1,inv:50};
      this.asteroids=[];this.bullets=[];this.score=0;this.hits=0;this.shots=0;this.steps=0;this.fitness=0;this.dead=false;this.decision="OBSERVING";this.lastTurn=0;this.turnStreak=0;this.thrustStreak=0;this.coastStreak=0;this.lastAimError=Math.PI;this.missedShots=0;this.spawnWave(5);
    }
    spawnWave(count){
      for(let i=0;i<count;i++){let x,y;do{x=this.rng.range(25,W-25);y=this.rng.range(25,H-25);}while(Math.hypot(x-W/2,y-H/2)<180);
        this.asteroids.push({x,y,vx:this.rng.range(-1.25,1.25),vy:this.rng.range(-1.25,1.25),r:this.rng.range(25,43),rot:this.rng.range(0,TAU),spin:this.rng.range(-.025,.025),shape:Array.from({length:10},()=>this.rng.range(.72,1.14))});
      }
    }
    nearest(){let best=null,bd=1e9,dx=0,dy=0;for(const a of this.asteroids){const x=torusDelta(this.ship.x,a.x,W),y=torusDelta(this.ship.y,a.y,H),d=Math.hypot(x,y)-a.r;if(d<bd){best=a;bd=d;dx=x;dy=y;}}return{a:best,d:bd,dx,dy};}
    inputs(){const n=this.nearest(),target=Math.atan2(n.dy,n.dx),diff=angleWrap(target-this.ship.a),speed=Math.hypot(this.ship.vx,this.ship.vy),forward=(this.ship.vx*Math.cos(this.ship.a)+this.ship.vy*Math.sin(this.ship.a))/6,lateral=(-this.ship.vx*Math.sin(this.ship.a)+this.ship.vy*Math.cos(this.ship.a))/6,closing=n.a?((n.a.vx-this.ship.vx)*n.dx+(n.a.vy-this.ship.vy)*n.dy)/Math.max(1,Math.hypot(n.dx,n.dy))/6:0;return new Float32Array([Math.sin(diff),Math.cos(diff),clamp(n.d/560,0,1),clamp(n.dx/W,-1,1),clamp(n.dy/H,-1,1),this.ship.vx/6,this.ship.vy/6,forward,lateral,clamp(speed/6,0,1),clamp(closing,-1,1),clamp(this.cooldown/12,0,1),clamp(this.asteroids.length/14,0,1),clamp(this.turnStreak/90,0,1),1]);}
    fire(){if(this.cooldown>0||this.bullets.length>6)return;this.cooldown=6;this.shots++;this.bullets.push({x:this.ship.x+Math.cos(this.ship.a)*16,y:this.ship.y+Math.sin(this.ship.a)*16,vx:this.ship.vx+Math.cos(this.ship.a)*8,vy:this.ship.vy+Math.sin(this.ship.a)*8,life:36});}
    step(){
      if(this.dead)return;this.steps++;this.cooldown=Math.max(0,(this.cooldown||0)-1);this.ship.inv=Math.max(0,this.ship.inv-1);
      const before=this.nearest(),beforeError=Math.abs(angleWrap(Math.atan2(before.dy,before.dx)-this.ship.a)),out=this.brain.think(this.inputs());let turn=0;const left=out[0]>.18,right=out[1]>.18;if(left!==right)turn=left?-1:1;else if(left&&right)turn=out[0]>out[1]?-1:1;const thrust=out[2]>.16,fire=out[3]>.08;
      if(turn&&turn===this.lastTurn)this.turnStreak++;else this.turnStreak=turn?1:0;this.lastTurn=turn;this.thrustStreak=thrust?this.thrustStreak+1:0;this.coastStreak=thrust?0:this.coastStreak+1;
      this.ship.a+=turn*.075;if(thrust){this.ship.vx+=Math.cos(this.ship.a)*.105;this.ship.vy+=Math.sin(this.ship.a)*.105;}const speed=Math.hypot(this.ship.vx,this.ship.vy);if(speed>6){this.ship.vx*=6/speed;this.ship.vy*=6/speed;}this.ship.vx*=.997;this.ship.vy*=.997;this.ship.x=wrap(this.ship.x+this.ship.vx,W);this.ship.y=wrap(this.ship.y+this.ship.vy,H);if(fire)this.fire();
      this.decision=fire&&thrust?"THRUST + FIRE":fire?"FIRE":thrust&&turn<0?"LEFT + THRUST":thrust&&turn>0?"RIGHT + THRUST":thrust?"THRUST":turn<0?"TURN LEFT":turn>0?"TURN RIGHT":"COAST";
      for(const b of this.bullets){b.x=wrap(b.x+b.vx,W);b.y=wrap(b.y+b.vy,H);b.life--;if(b.life===0){this.missedShots++;this.fitness-=.22;}}this.bullets=this.bullets.filter(b=>b.life>0);
      for(const a of this.asteroids){a.x=wrap(a.x+a.vx,W);a.y=wrap(a.y+a.vy,H);a.rot+=a.spin;}
      outer:for(let bi=this.bullets.length-1;bi>=0;bi--){const b=this.bullets[bi];for(let ai=this.asteroids.length-1;ai>=0;ai--){const a=this.asteroids[ai],dx=torusDelta(b.x,a.x,W),dy=torusDelta(b.y,a.y,H);if(Math.hypot(dx,dy)<a.r){this.bullets.splice(bi,1);this.asteroids.splice(ai,1);this.hits++;const points=a.r>31?20:a.r>18?50:100;this.score+=points;this.fitness+=points*2+20;if(a.r>18){for(let k=0;k<2;k++){const ang=this.rng.range(0,TAU);this.asteroids.push({...a,r:a.r*.58,vx:a.vx+Math.cos(ang)*1.25,vy:a.vy+Math.sin(ang)*1.25,shape:Array.from({length:9},()=>this.rng.range(.72,1.14))});}}break outer;}}}
      if(this.ship.inv<=0){for(const a of this.asteroids){const dx=torusDelta(this.ship.x,a.x,W),dy=torusDelta(this.ship.y,a.y,H);if(Math.hypot(dx,dy)<a.r+this.ship.r){this.ship.lives--;this.fitness-=20;if(this.ship.lives<=0){this.dead=true;this.decision="GAME OVER";}break;}}}
      const n=this.nearest(),aimError=Math.abs(angleWrap(Math.atan2(n.dy,n.dx)-this.ship.a)),alignment=Math.max(0,Math.cos(aimError)),motion=clamp(Math.hypot(this.ship.vx,this.ship.vy)/3,0,1),danger=1-clamp(n.d/300,0,1),aimGain=clamp(beforeError-aimError,-.2,.2),spinPenalty=this.turnStreak>45?(this.turnStreak-45)*.00022:0,thrustControl=thrust?(danger>.35&&motion<.8?.008:.001):motion>.15?.001:0,stalledPenalty=this.coastStreak>120&&motion<.12?.008:0;this.fitness+=.018+alignment*.003+Math.max(0,aimGain)*.035+motion*.003+motion*danger*.006+thrustControl-spinPenalty-stalledPenalty;
      this.lastAimError=aimError;
      if(!this.asteroids.length){this.fitness+=175;this.spawnWave(6);}
      if(this.steps>=MAX_STEPS){this.dead=true;this.decision="RUN COMPLETE";}
    }
  }

  let generation=1,holdPilot=false,generationHighScore=0,generationHighPilot=1,bestScore=0,bestScorePilot=0,bestScoreGeneration=0,bestFitness=-Infinity,bestBrain=null,generationHistory=[],population=[],worlds=[],lastWall=Date.now(),accumulator=0,displayPilotIndex=0,displayDeathAt=0,generationRecap=null,recapUntil=0,savedActiveRun=null,activeSnapshot=null,lastAutosaveAt=0,savedAt=Date.now(),catchingUp=false;
  const rng=new RNG(82);
  let archiveReset=false;
  try{let saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(!saved){for(const key of LEGACY_STORAGE_KEYS){saved=JSON.parse(localStorage.getItem(key)||"null");if(saved){archiveReset=true;break;}}}if(saved){bestScore=saved.bestScore||0;bestScorePilot=saved.bestScorePilot||0;bestScoreGeneration=saved.bestScoreGeneration||0;bestFitness=saved.fitnessVersion===FITNESS_VERSION&&Number.isFinite(saved.bestFitness)?saved.bestFitness:-Infinity;generation=saved.generation||1;generationHistory=Array.isArray(saved.history)?saved.history:[];savedActiveRun=saved.activeRun||null;savedAt=Number(saved.savedAt)||Date.now();if(!bestScorePilot&&generationHistory.length){const record=generationHistory.reduce((best,item)=>item.score>best.score?item:best,generationHistory[0]);bestScorePilot=record.pilot||0;bestScoreGeneration=record.generation||0;}if(saved.fitnessVersion===FITNESS_VERSION&&saved.brain)bestBrain=new Brain(rng,saved.brain);}}catch{}
  function snapshotActiveRun(){if(!worlds.length||generationRecap)return null;return{generation,generationHighScore,generationHighPilot,displayPilotIndex,holdPilot,worlds:worlds.map(w=>({brain:w.brain.toJSON(),rngState:w.rng.s,index:w.index,ship:{...w.ship},asteroids:w.asteroids.map(a=>({...a,shape:[...a.shape]})),bullets:w.bullets.map(b=>({...b})),score:w.score,hits:w.hits,shots:w.shots,steps:w.steps,fitness:w.fitness,dead:w.dead,decision:w.decision,cooldown:w.cooldown||0,lastTurn:w.lastTurn||0,turnStreak:w.turnStreak||0,thrustStreak:w.thrustStreak||0,coastStreak:w.coastStreak||0,lastAimError:Number(w.lastAimError)||Math.PI,missedShots:w.missedShots||0}))};}
  function saveProgress(captureRun=false){if(captureRun)activeSnapshot=snapshotActiveRun();localStorage.setItem(STORAGE_KEY,JSON.stringify({generation,bestScore,bestScorePilot,bestScoreGeneration,bestFitness:Number.isFinite(bestFitness)?bestFitness:0,fitnessVersion:FITNESS_VERSION,brain:bestBrain?.toJSON()||null,history:generationHistory.slice(-120),activeRun:activeSnapshot,savedAt:Date.now()}));}
  function restoreActiveRun(snapshot){if(!snapshot||snapshot.generation!==generation||!Array.isArray(snapshot.worlds)||snapshot.worlds.length!==POPULATION||snapshot.worlds.some(data=>data.brain?.w1?.length!==INPUTS*HIDDEN))return false;try{worlds=snapshot.worlds.map(data=>{const brain=new Brain(rng,data.brain),world=new World(brain,82,data.index);world.rng.s=Number.isFinite(data.rngState)?data.rngState:world.rng.s;world.ship={...data.ship};world.asteroids=(data.asteroids||[]).map(a=>({...a,shape:[...(a.shape||[])]}));world.bullets=(data.bullets||[]).map(b=>({...b}));world.score=data.score||0;world.hits=data.hits||0;world.shots=data.shots||0;world.steps=data.steps||0;world.fitness=Number(data.fitness)||0;world.dead=Boolean(data.dead);world.decision=data.decision||"OBSERVING";world.cooldown=data.cooldown||0;world.lastTurn=data.lastTurn||0;world.turnStreak=data.turnStreak||0;world.thrustStreak=data.thrustStreak||0;world.coastStreak=data.coastStreak||0;world.lastAimError=Number(data.lastAimError)||Math.PI;world.missedShots=data.missedShots||0;return world;});population=worlds.map(w=>w.brain);generationHighScore=snapshot.generationHighScore||0;generationHighPilot=snapshot.generationHighPilot||1;displayPilotIndex=clamp(snapshot.displayPilotIndex||0,0,POPULATION-1);holdPilot=Boolean(snapshot.holdPilot);displayDeathAt=0;generationRecap=null;recapUntil=0;accumulator=0;activeSnapshot=snapshot;updatePilotControls();renderGenerationLog();return true;}catch{return false;}}
  function syncScores(){const currentLeader=worlds.reduce((best,w)=>w.score>best.score?w:best,worlds[0]);if(currentLeader.score>generationHighScore){generationHighScore=currentLeader.score;generationHighPilot=currentLeader.index+1;}if(generationHighScore>bestScore){bestScore=generationHighScore;bestScorePilot=generationHighPilot;bestScoreGeneration=generation;saveProgress();}}
  function seedPopulation(){population=[];if(bestBrain)population.push(new Brain(rng,bestBrain.toJSON()));while(population.length<POPULATION)population.push(bestBrain?bestBrain.child(rng,.18,.4):new Brain(rng));startGeneration();}
  function startGeneration(silent=false){worlds=population.map((brain,i)=>new World(brain,82+generation*997,i));generationHighScore=0;generationHighPilot=1;displayDeathAt=0;generationRecap=null;recapUntil=0;activeSnapshot=null;if(!holdPilot)displayPilotIndex=0;displayPilotIndex=clamp(displayPilotIndex,0,POPULATION-1);if(!silent){updatePilotControls();renderGenerationLog();}}
  function finishGeneration(now,skipRecap=false){
    syncScores();const completedGeneration=generation,scoreLeader=worlds.reduce((best,w)=>w.score>best.score?w:best,worlds[0]),hitsLeader=worlds.reduce((best,w)=>w.hits>best.hits?w:best,worlds[0]),survivalLeader=worlds.reduce((best,w)=>w.steps>best.steps?w:best,worlds[0]),longest=survivalLeader.steps/SIM_HZ,totalHits=worlds.reduce((total,w)=>total+w.hits,0),pilots=worlds.map(w=>({pilot:w.index+1,score:w.score,hits:w.hits,survival:Number((w.steps/SIM_HZ).toFixed(1))})).sort((a,b)=>b.score-a.score||b.hits-a.hits||b.survival-a.survival).map((pilot,index)=>({...pilot,rank:index+1}));const record={generation:completedGeneration,pilot:scoreLeader.index+1,score:generationHighScore,hits:hitsLeader.hits,hitsPilot:hitsLeader.index+1,totalHits,survival:Number(longest.toFixed(1)),survivalPilot:survivalLeader.index+1,pilots};generationHistory.push(record);worlds.sort((a,b)=>b.fitness-a.fitness);const champion=worlds[0];if(champion.fitness>bestFitness){bestFitness=champion.fitness;bestBrain=new Brain(rng,champion.brain.toJSON());}
    if(generationHistory.length>120)generationHistory=generationHistory.slice(-120);const elites=worlds.slice(0,ELITES).map(w=>w.brain);population=elites.map(b=>new Brain(rng,b.toJSON()));while(population.length<POPULATION){const parent=elites[Math.floor(rng.next()*elites.length)];population.push(parent.child(rng,.1+Math.min(.12,generation*.001),.24));}generation++;generationRecap=skipRecap?null:record;recapUntil=skipRecap?0:now+6000;activeSnapshot=null;saveProgress();if(skipRecap)startGeneration(true);else renderGenerationLog();
  }
  function drawRock(a){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);ctx.beginPath();a.shape.forEach((m,i)=>{const ang=i/a.shape.length*TAU,r=a.r*m,x=Math.cos(ang)*r,y=Math.sin(ang)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();ctx.restore();}
  function drawShip(s){if(s.inv>0&&Math.floor(s.inv/6)%2)return;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a);ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-11,-9);ctx.lineTo(-6,0);ctx.lineTo(-11,9);ctx.closePath();ctx.stroke();ctx.restore();}
  function render(w){ctx.clearRect(0,0,W,H);ctx.strokeStyle="#76f6cd";ctx.fillStyle="#76f6cd";ctx.lineWidth=1.6;ctx.shadowColor="#4ce7b7";ctx.shadowBlur=5;for(const a of w.asteroids)drawRock(a);for(const b of w.bullets){ctx.beginPath();ctx.arc(b.x,b.y,2.1,0,TAU);ctx.fill();}if(!w.dead)drawShip(w.ship);ctx.shadowBlur=0;ctx.fillStyle="#91d9c2";ctx.font="700 13px monospace";ctx.fillText(`LIVES ${w.ship.lives}`,20,28);ctx.textAlign="right";ctx.fillText(`WAVE ${w.asteroids.length?1:2}`,W-20,28);ctx.textAlign="left";if(w.dead){const remaining=worlds.filter(pilot=>!pilot.dead).length;ctx.fillStyle="#010504e6";ctx.fillRect(0,0,W,H);ctx.textAlign="center";ctx.fillStyle="#ec1932";ctx.shadowColor="#ec1932";ctx.shadowBlur=10;ctx.font="900 58px monospace";ctx.fillText("GAME OVER",W/2,H/2-28);ctx.shadowBlur=0;ctx.fillStyle="#d7d2cc";ctx.font="700 15px monospace";ctx.fillText(`PILOT ${String(w.index+1).padStart(2,"0")}  //  FINAL SCORE ${String(w.score).padStart(5,"0")}`,W/2,H/2+18);ctx.fillStyle="#76f6cd";ctx.font="700 12px monospace";ctx.fillText(`${String(remaining).padStart(2,"0")} PILOTS STILL RUNNING`,W/2,H/2+52);ctx.textAlign="left";}}
  function renderRecap(record){ctx.clearRect(0,0,W,H);ctx.fillStyle="#010504";ctx.fillRect(0,0,W,H);ctx.textAlign="center";ctx.fillStyle="#76f6cd";ctx.shadowColor="#39c799";ctx.shadowBlur=10;ctx.font="900 40px monospace";ctx.fillText(`GENERATION ${String(record.generation).padStart(3,"0")} COMPLETE`,W/2,140);ctx.shadowBlur=0;ctx.fillStyle="#f0e7dc";ctx.font="700 17px monospace";ctx.fillText(`HIGH SCORE ${String(record.score).padStart(5,"0")}  //  PILOT ${String(record.pilot).padStart(2,"0")}`,W/2,215);ctx.fillStyle="#b3ada8";ctx.font="700 14px monospace";ctx.fillText(`MOST HITS ${String(record.hits).padStart(3,"0")} // P${String(record.hitsPilot||record.pilot).padStart(2,"0")}  ·  LONGEST ${Number(record.survival).toFixed(1)}s // P${String(record.survivalPilot||record.pilot).padStart(2,"0")}`,W/2,263);ctx.fillText(`TOTAL GENERATION HITS ${String(record.totalHits).padStart(3,"0")}`,W/2,300);ctx.fillStyle="#ec1932";ctx.font="700 12px monospace";ctx.fillText("NEXT GENERATION PREPARING",W/2,365);ctx.textAlign="left";}
  function updatePilotControls(){const button=document.getElementById("pilotHold");button.classList.toggle("active",holdPilot);button.setAttribute("aria-pressed",String(holdPilot));button.querySelector("b").textContent=holdPilot?"AUTO":"HOLD";}
  function selectPilot(delta){displayPilotIndex=(displayPilotIndex+delta+POPULATION)%POPULATION;displayDeathAt=0;holdPilot=true;updatePilotControls();}
  function renderGenerationLog(){const log=document.getElementById("generationLog"),status=document.getElementById("generationLogStatus");status.textContent=generationRecap?`GEN ${String(generationRecap.generation).padStart(3,"0")} COMPLETE`:`GEN ${String(generation).padStart(3,"0")} RUNNING`;log.replaceChildren();if(!generationHistory.length){const empty=document.createElement("p");empty.className="generation-empty";empty.textContent="The first record will appear when this generation finishes.";log.append(empty);return;}const records=[...generationHistory].reverse();records.forEach((record,recordIndex)=>{const group=document.createElement("details"),summary=document.createElement("summary"),row=document.createElement("div");group.className="generation-group";group.open=recordIndex===0;row.className="generation-entry";const gen=document.createElement("strong");gen.textContent=`GEN ${String(record.generation).padStart(3,"0")}`;row.append(gen);for(const [label,value,className] of [["High score",`${String(record.score).padStart(5,"0")} / P${String(record.pilot).padStart(2,"0")}`,"record-score"],["Most hits",`${String(record.hits).padStart(3,"0")} / P${String(record.hitsPilot||record.pilot).padStart(2,"0")}`,""],["Longest run",`${Number(record.survival).toFixed(1)}s / P${String(record.survivalPilot||record.pilot).padStart(2,"0")}`,""],["Total hits",String(record.totalHits??record.hits).padStart(3,"0"),""]]){const cell=document.createElement("div"),name=document.createElement("span"),data=document.createElement("b");cell.className=className;name.textContent=label;data.textContent=value;cell.append(name,data);row.append(cell);}summary.append(row);group.append(summary);const pilotRecords=document.createElement("div");pilotRecords.className="pilot-records";const header=document.createElement("div");header.className="pilot-record-row header";for(const label of ["Rank","Pilot","Score","Hits","Survival"]){const cell=document.createElement("span");cell.textContent=label;header.append(cell);}pilotRecords.append(header);for(const pilot of record.pilots||[]){const pilotRow=document.createElement("div");pilotRow.className="pilot-record-row";for(const [value,className] of [[`#${String(pilot.rank).padStart(2,"0")}`,"rank"],[String(pilot.pilot).padStart(2,"0"),""],[String(pilot.score).padStart(5,"0"),"pilot-score"],[String(pilot.hits).padStart(3,"0"),""],[`${Number(pilot.survival).toFixed(1)}s`,""]]){const cell=document.createElement("span");cell.className=className;cell.textContent=value;pilotRow.append(cell);}pilotRecords.append(pilotRow);}group.append(pilotRecords);log.append(group);});}
  function updateUI(w){const remaining=worlds.filter(pilot=>!pilot.dead).length;ui.generationValue.textContent=String(generationRecap?generationRecap.generation:generation).padStart(3,"0");ui.pilotValue.textContent=`${String(w.index+1).padStart(2,"0")} / ${POPULATION}`;ui.remainingValue.textContent=String(remaining).padStart(2,"0");ui.scoreValue.textContent=String(w.score).padStart(5,"0");ui.generationScoreValue.textContent=`${String(generationHighScore).padStart(5,"0")} · P${String(generationHighPilot).padStart(2,"0")}`;ui.survivalValue.textContent=`${(w.steps/SIM_HZ).toFixed(1).padStart(4,"0")} SEC`;ui.hitsValue.textContent=String(w.hits).padStart(3,"0");ui.decisionValue.textContent=w.dead?"GAME OVER":w.decision;ui.actionDetail.textContent=w.dead?"Waiting five seconds before next feed":w.decision==="OBSERVING"?"Scanning nearest threat":"Neural policy output";ui.pilotNumber.textContent=String(w.index+1).padStart(2,"0");ui.screenScore.textContent=`SCORE ${String(w.score).padStart(5,"0")}`;const pct=clamp((w.fitness/Math.max(1,bestFitness))*100,4,100);ui.fitnessBar.style.width=`${Number.isFinite(pct)?pct:4}%`;ui.fitnessText.textContent=bestFitness>0?`Best fitness ${bestFitness.toFixed(1)}`:"Establishing baseline…";ui.modeValue.textContent="TRAINING";ui.signalText.textContent="SIGNAL ACTIVE";}
  function advanceTraining(now,background=false){
    const wallNow=Date.now(),elapsed=Math.max(0,wallNow-lastWall);lastWall=wallNow;accumulator+=Math.min(elapsed,MAX_OFFLINE_SECONDS*1000);catchingUp=background||accumulator>750;
    let ticks=0,budget=catchingUp?CATCHUP_CHUNK_STEPS:48;
    while(accumulator>=TICK_MS&&ticks<budget){
      if(generationRecap){if(catchingUp)startGeneration(true);else break;}
      for(const w of worlds)w.step();
      accumulator-=TICK_MS;ticks++;
      if(ticks%15===0)syncScores();
      if(worlds.every(w=>w.dead)){finishGeneration(now,catchingUp);if(!catchingUp)break;}
    }
    syncScores();
    if(accumulator<TICK_MS*2)catchingUp=false;
  }
  function loop(now){
    if(generationRecap){
      lastWall=Date.now();accumulator=0;renderRecap(generationRecap);ui.modeValue.textContent="GEN COMPLETE";ui.signalText.textContent="RECAP";ui.remainingValue.textContent="00";
      if(now>=recapUntil)startGeneration();
      requestAnimationFrame(loop);return;
    }
    if(!document.hidden)advanceTraining(now,false);
    let visible=worlds[displayPilotIndex]||worlds[0];
    if(visible?.dead){
      if(!displayDeathAt)displayDeathAt=now;
      if(now-displayDeathAt>=5000){
        const nextAlive=worlds.findIndex(w=>!w.dead);
        if(nextAlive>=0){displayPilotIndex=nextAlive;displayDeathAt=0;visible=worlds[nextAlive];updatePilotControls();}
        else{finishGeneration(now);renderRecap(generationRecap);requestAnimationFrame(loop);return;}
      }
    }else displayDeathAt=0;
    if(visible){render(visible);updateUI(visible);if(catchingUp){ui.modeValue.textContent="CATCHING UP";ui.signalText.textContent="TRAINING CONTINUES";}}if(Date.now()-lastAutosaveAt>=5000){lastAutosaveAt=Date.now();saveProgress(true);}requestAnimationFrame(loop);
  }
  document.getElementById("pilotPrev").addEventListener("click",()=>selectPilot(-1));
  document.getElementById("pilotNext").addEventListener("click",()=>selectPilot(1));
  document.getElementById("pilotHold").addEventListener("click",()=>{holdPilot=!holdPilot;updatePilotControls();});
  addEventListener("pagehide",()=>saveProgress(true));document.addEventListener("visibilitychange",()=>{lastWall=Date.now();if(document.hidden)saveProgress(true);});
  if(archiveReset)saveProgress();if(!restoreActiveRun(savedActiveRun))seedPopulation();lastWall=Math.max(Date.now()-MAX_OFFLINE_SECONDS*1000,savedAt);setInterval(()=>{if(document.hidden){advanceTraining(performance.now(),true);if(Date.now()-lastAutosaveAt>=5000){lastAutosaveAt=Date.now();saveProgress(true);}}},1000);requestAnimationFrame(loop);
})();
