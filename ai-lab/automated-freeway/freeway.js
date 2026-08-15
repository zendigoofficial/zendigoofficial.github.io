(() => {
  "use strict";
  const canvas = document.getElementById("arena"), ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, POPULATION = 24, ELITES = 4;
  const INPUTS = 12, HIDDEN = 16, OUTPUTS = 3, SIM_HZ = 30;
  const MATCH_SECONDS = 136, MATCH_STEPS = MATCH_SECONDS * SIM_HZ, TICK_MS = 1000 / SIM_HZ;
  const STORAGE_KEY = "zendigo-pixel-freeway-brain-v2", MAX_OFFLINE_SECONDS = 21600, CATCHUP_STEPS = 500;
  const ROAD_TOP = 55, ROAD_BOTTOM = 545, START_Y = 568, FINISH_Y = 32, CHICKEN_X = W / 2;
  const ui = Object.fromEntries(["generationValue","chickenValue","remainingValue","scoreValue","generationScoreValue","clockValue","collisionValue","fastestValue","fitnessBar","fitnessText","decisionValue","actionDetail","modeValue","signalText","chickenNumber","screenScore"].map(id => [id, document.getElementById(id)]));
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const wrap = (v,max) => ((v % max) + max) % max;

  class RNG {
    constructor(seed=82){this.s=seed>>>0;}
    next(){let t=this.s+=0x6d2b79f5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
    gaussian(){const u=Math.max(this.next(),1e-9),v=this.next();return Math.sqrt(-2*Math.log(u))*Math.cos(Math.PI*2*v);}
  }

  class Brain {
    constructor(rng,data){
      const n1=INPUTS*HIDDEN,n2=HIDDEN*OUTPUTS;
      this.w1=data?.w1?.length===n1?Float32Array.from(data.w1):Float32Array.from({length:n1},()=>rng.gaussian()*.5);
      this.b1=data?.b1?.length===HIDDEN?Float32Array.from(data.b1):new Float32Array(HIDDEN);
      this.w2=data?.w2?.length===n2?Float32Array.from(data.w2):Float32Array.from({length:n2},()=>rng.gaussian()*.42);
      this.b2=data?.b2?.length===OUTPUTS?Float32Array.from(data.b2):Float32Array.from([-.05,.24,-.14]);
    }
    think(input){const h=new Float32Array(HIDDEN),out=new Float32Array(OUTPUTS);for(let j=0;j<HIDDEN;j++){let s=this.b1[j];for(let i=0;i<INPUTS;i++)s+=input[i]*this.w1[i*HIDDEN+j];h[j]=Math.tanh(s);}for(let o=0;o<OUTPUTS;o++){let s=this.b2[o];for(let j=0;j<HIDDEN;j++)s+=h[j]*this.w2[j*OUTPUTS+o];out[o]=Math.tanh(s);}return out;}
    child(rng,rate=.12,strength=.28){const child=new Brain(rng,this.toJSON());for(const a of [child.w1,child.b1,child.w2,child.b2])for(let i=0;i<a.length;i++)if(rng.next()<rate)a[i]+=rng.gaussian()*strength;return child;}
    toJSON(){return{w1:[...this.w1],b1:[...this.b1],w2:[...this.w2],b2:[...this.b2]};}
  }

  function laneConfig(lane,seed){
    const direction=lane%2?1:-1, speed=(1.45+(lane%4)*.24)*(lane>5?1.08:1), count=lane%3===0?2:3, spacing=W/count;
    return{direction,speed,count,spacing,width:66+(lane%2)*16,phase:wrap(seed*37+lane*113,spacing)};
  }
  function laneCenter(lane){return ROAD_BOTTOM-(lane+.5)*((ROAD_BOTTOM-ROAD_TOP)/10);}
  function laneForY(y){return clamp(Math.floor((ROAD_BOTTOM-y)/((ROAD_BOTTOM-ROAD_TOP)/10)),0,9);}
  function carPositions(lane,step,seed){const c=laneConfig(lane,seed),lead=wrap(c.phase+step*c.speed*c.direction,c.spacing),cars=[];for(let i=-1;i<c.count;i++){const x=lead+i*c.spacing;if(x>-c.width&&x<W)cars.push({x,y:laneCenter(lane),width:c.width,direction:c.direction,speed:c.speed});}return cars;}
  function nearestCarInfo(lane,step,seed){let best=null,dist=Infinity;for(const car of carPositions(clamp(lane,0,9),step,seed)){const dx=(car.x+car.width/2)-CHICKEN_X;if(Math.abs(dx)<dist){dist=Math.abs(dx);best={dx,speed:car.speed*car.direction,width:car.width};}}return best||{dx:W,speed:0,width:70};}

  class World {
    constructor(brain,seed,index){this.brain=brain;this.seed=seed;this.index=index;this.reset();}
    reset(){this.y=START_Y;this.score=0;this.collisions=0;this.steps=0;this.fitness=0;this.completed=false;this.freeze=0;this.decision="OBSERVING";this.lastAction=0;this.actionStreak=0;this.bestY=START_Y;this.crossingStarted=0;this.crossingTimes=[];this.upSteps=0;this.downSteps=0;this.waitSteps=0;this.recoverySteps=0;}
    inputs(){
      const lane=laneForY(this.y),next=nearestCarInfo(lane,this.steps,this.seed),ahead=nearestCarInfo(clamp(lane+1,0,9),this.steps,this.seed);
      return new Float32Array([1-this.y/H,lane/9,next.dx/W,next.speed/3.5,ahead.dx/W,ahead.speed/3.5,this.freeze/18,(MATCH_STEPS-this.steps)/MATCH_STEPS,(this.steps-this.crossingStarted)/MATCH_STEPS,this.actionStreak/90,(this.upSteps-this.downSteps)/Math.max(1,this.steps),1]);
    }
    step(){
      if(this.completed)return;this.steps++;
      if(this.freeze>0){this.freeze--;this.recoverySteps++;this.decision="RECOVER";this.fitness+=.001;if(this.steps>=MATCH_STEPS)this.completed=true;return;}
      const out=this.brain.think(this.inputs());let action=0;if(out[1]>out[action])action=1;if(out[2]>out[action])action=2;
      if(this.y>=ROAD_BOTTOM+8&&action!==1)action=1;
      if(action===this.lastAction)this.actionStreak++;else this.actionStreak=1;this.lastAction=action;
      const oldY=this.y;
      if(action===0){this.waitSteps++;this.decision="WAIT";}
      else if(action===1){this.upSteps++;this.y-=3.05;this.decision="MOVE UP";}
      else{this.downSteps++;this.y+=2.55;this.decision="MOVE DOWN";}
      this.y=clamp(this.y,FINISH_Y,START_Y);
      const lane=laneForY(this.y),laneY=laneCenter(lane);
      if(this.y<ROAD_BOTTOM&&this.y>ROAD_TOP&&Math.abs(this.y-laneY)<18){
        for(const car of carPositions(lane,this.steps,this.seed)){
          if(CHICKEN_X+12>car.x&&CHICKEN_X-12<car.x+car.width){this.collisions++;this.freeze=16;this.y=clamp(this.y+42,ROAD_TOP,START_Y);this.fitness-=18;this.decision="COLLISION";break;}
        }
      }
      if(this.y<oldY)this.fitness+=(oldY-this.y)*.035;
      else if(this.y>oldY)this.fitness-=(this.y-oldY)*.012;
      this.bestY=Math.min(this.bestY,this.y);
      if(this.y<=FINISH_Y){const seconds=(this.steps-this.crossingStarted)/SIM_HZ;this.crossingTimes.push(seconds);this.score++;this.fitness+=1000+Math.max(0,170-seconds)*1.5;this.y=START_Y;this.bestY=START_Y;this.crossingStarted=this.steps;this.freeze=10;this.decision="CROSSING";}
      if(this.actionStreak>180)this.fitness-=(this.actionStreak-180)*.0006;
      if(this.steps>=MATCH_STEPS){this.completed=true;this.decision="MATCH COMPLETE";this.fitness+=Math.max(0,(START_Y-this.bestY))*.18;}
    }
    get fastest(){return this.crossingTimes.length?Math.min(...this.crossingTimes):Infinity;}
    get average(){return this.crossingTimes.length?this.crossingTimes.reduce((a,b)=>a+b,0)/this.crossingTimes.length:Infinity;}
  }

  let generation=1,bestFitness=-Infinity,bestBrain=null,generationHistory=[],population=[],worlds=[],displayChickenIndex=0,holdChicken=false,generationHigh=0,generationHighChicken=1,generationRecap=null,recapUntil=0,accumulator=0,lastWall=Date.now(),lastAutosave=0,activeSnapshot=null,savedAt=Date.now(),catchingUp=false;
  const rng=new RNG(826);
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(saved){generation=saved.generation||1;bestFitness=Number.isFinite(saved.bestFitness)?saved.bestFitness:-Infinity;generationHistory=Array.isArray(saved.history)?saved.history:[];if(saved.brain)bestBrain=new Brain(rng,saved.brain);activeSnapshot=saved.activeRun||null;savedAt=Number(saved.savedAt)||Date.now();}}catch{}

  function snapshot(){if(!worlds.length||generationRecap)return null;return{generation,displayChickenIndex,holdChicken,generationHigh,generationHighChicken,worlds:worlds.map(w=>({brain:w.brain.toJSON(),seed:w.seed,index:w.index,y:w.y,score:w.score,collisions:w.collisions,steps:w.steps,fitness:w.fitness,completed:w.completed,freeze:w.freeze,decision:w.decision,lastAction:w.lastAction,actionStreak:w.actionStreak,bestY:w.bestY,crossingStarted:w.crossingStarted,crossingTimes:w.crossingTimes,upSteps:w.upSteps,downSteps:w.downSteps,waitSteps:w.waitSteps,recoverySteps:w.recoverySteps}))};}
  function save(capture=false){if(capture)activeSnapshot=snapshot();localStorage.setItem(STORAGE_KEY,JSON.stringify({generation,bestFitness:Number.isFinite(bestFitness)?bestFitness:0,brain:bestBrain?.toJSON()||null,history:generationHistory.slice(-120),activeRun:activeSnapshot,savedAt:Date.now()}));}
  function restore(s){if(!s||s.generation!==generation||!Array.isArray(s.worlds)||s.worlds.length!==POPULATION)return false;try{worlds=s.worlds.map(d=>{const{brain:brainData,...state}=d,w=new World(new Brain(rng,brainData),d.seed,d.index);Object.assign(w,state);w.crossingTimes=[...(d.crossingTimes||[])];return w;});population=worlds.map(w=>w.brain);displayChickenIndex=clamp(s.displayChickenIndex||0,0,POPULATION-1);holdChicken=Boolean(s.holdChicken);generationHigh=s.generationHigh||0;generationHighChicken=s.generationHighChicken||1;updateControls();renderGenerationLog();return true;}catch{return false;}}
  function syncHigh(){const lead=worlds.reduce((a,b)=>b.score>a.score?b:a,worlds[0]);if(lead.score>generationHigh){generationHigh=lead.score;generationHighChicken=lead.index+1;}}
  function seedPopulation(){population=[];if(bestBrain)population.push(new Brain(rng,bestBrain.toJSON()));while(population.length<POPULATION)population.push(bestBrain?bestBrain.child(rng,.18,.4):new Brain(rng));startGeneration();}
  function startGeneration(silent=false){const seed=826+generation*991;worlds=population.map((brain,i)=>new World(brain,seed,i));generationHigh=0;generationHighChicken=1;generationRecap=null;recapUntil=0;activeSnapshot=null;if(!holdChicken)displayChickenIndex=0;if(!silent){updateControls();renderGenerationLog();}}
  function finishGeneration(now,skipRecap=false){
    syncHigh();const completed=generation;
    const scoreLeader=worlds.reduce((a,b)=>b.score>a.score||b.score===a.score&&b.fitness>a.fitness?b:a,worlds[0]);
    const fastestCandidates=worlds.filter(w=>Number.isFinite(w.fastest)),fastest=fastestCandidates.length?fastestCandidates.reduce((a,b)=>b.fastest<a.fastest?b:a):scoreLeader;
    const collisionLeader=worlds.reduce((a,b)=>b.collisions<a.collisions?b:a,worlds[0]);
    const chickens=worlds.map(w=>({chicken:w.index+1,score:w.score,fastest:Number.isFinite(w.fastest)?Number(w.fastest.toFixed(1)):null,collisions:w.collisions,average:Number.isFinite(w.average)?Number(w.average.toFixed(1)):null,fitness:Number(w.fitness.toFixed(1))})).sort((a,b)=>b.score-a.score||(a.fastest??9999)-(b.fastest??9999)||a.collisions-b.collisions).map((chicken,i)=>({...chicken,rank:i+1}));
    const record={generation:completed,chicken:scoreLeader.index+1,score:scoreLeader.score,fastest:Number.isFinite(fastest.fastest)?Number(fastest.fastest.toFixed(1)):null,fastestChicken:fastest.index+1,fewestCollisions:collisionLeader.collisions,collisionChicken:collisionLeader.index+1,totalCollisions:worlds.reduce((n,w)=>n+w.collisions,0),chickens};
    generationHistory.push(record);worlds.sort((a,b)=>b.fitness-a.fitness);const champion=worlds[0];if(champion.fitness>bestFitness){bestFitness=champion.fitness;bestBrain=new Brain(rng,champion.brain.toJSON());}if(generationHistory.length>120)generationHistory=generationHistory.slice(-120);
    const elites=worlds.slice(0,ELITES).map(w=>w.brain);population=elites.map(b=>new Brain(rng,b.toJSON()));while(population.length<POPULATION)population.push(elites[Math.floor(rng.next()*elites.length)].child(rng,.11+Math.min(.1,generation*.001),.25));
    generation++;generationRecap=skipRecap?null:record;recapUntil=skipRecap?0:now+6000;activeSnapshot=null;save();if(skipRecap)startGeneration(true);else renderGenerationLog();
  }

  function drawChicken(x,y,step){ctx.save();ctx.translate(x,y);const bob=Math.sin(step*.3)*1.5;ctx.translate(0,bob);ctx.fillStyle="#f3ecdb";ctx.fillRect(-8,-9,16,18);ctx.fillRect(-3,-15,9,9);ctx.fillStyle="#e9c243";ctx.fillRect(6,-11,8,5);ctx.fillStyle="#ec1932";ctx.fillRect(-2,-19,4,5);ctx.fillStyle="#13110f";ctx.fillRect(3,-13,2,2);ctx.fillStyle="#d79b2f";ctx.fillRect(-8,9,4,5);ctx.fillRect(4,9,4,5);ctx.restore();}
  function drawCar(car,lane){const palette=["#e62938","#e8c247","#f1eee9","#172331","#8ec2d8"],color=palette[lane%palette.length];ctx.fillStyle=color;ctx.fillRect(car.x,car.y-12,car.width,24);ctx.fillStyle="#14181c";ctx.fillRect(car.x+(car.direction>0?car.width-22:8),car.y-8,14,10);ctx.fillRect(car.x+10,car.y-15,15,5);ctx.fillRect(car.x+car.width-25,car.y-15,15,5);ctx.fillStyle="#090909";ctx.fillRect(car.x+8,car.y+10,15,5);ctx.fillRect(car.x+car.width-23,car.y+10,15,5);}
  function drawRoad(w){
    ctx.fillStyle="#cfaa3d";ctx.fillRect(0,0,W,ROAD_TOP);ctx.fillRect(0,ROAD_BOTTOM,W,H-ROAD_BOTTOM);ctx.fillStyle="#376d9f";ctx.fillRect(0,ROAD_TOP,W,ROAD_BOTTOM-ROAD_TOP);
    ctx.strokeStyle="#dce6ed";ctx.lineWidth=2;ctx.setLineDash([30,24]);for(let lane=1;lane<10;lane++){const y=ROAD_BOTTOM-lane*((ROAD_BOTTOM-ROAD_TOP)/10);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.setLineDash([]);
    ctx.fillStyle="#f0e7b9";ctx.fillRect(0,ROAD_TOP-5,W,5);ctx.fillRect(0,ROAD_BOTTOM,W,5);
    for(let lane=0;lane<10;lane++)for(const car of carPositions(lane,w.steps,w.seed))drawCar(car,lane);
    if(w.freeze>0&&Math.floor(w.freeze/3)%2===0)ctx.globalAlpha=.35;drawChicken(CHICKEN_X,w.y,w.steps);ctx.globalAlpha=1;
    ctx.fillStyle="#1b1712";ctx.font="700 14px monospace";ctx.fillText(`TIME ${formatClock(Math.max(0,MATCH_SECONDS-w.steps/SIM_HZ))}`,18,33);ctx.textAlign="right";ctx.fillText(`CROSSINGS ${String(w.score).padStart(2,"0")}`,W-18,33);ctx.textAlign="left";
  }
  function render(w){ctx.clearRect(0,0,W,H);drawRoad(w);}
  function renderRecap(r){ctx.clearRect(0,0,W,H);ctx.fillStyle="#07121d";ctx.fillRect(0,0,W,H);ctx.textAlign="center";ctx.fillStyle="#76f6cd";ctx.shadowColor="#39c799";ctx.shadowBlur=10;ctx.font="900 40px monospace";ctx.fillText(`GENERATION ${String(r.generation).padStart(3,"0")} COMPLETE`,W/2,140);ctx.shadowBlur=0;ctx.fillStyle="#f0e7dc";ctx.font="700 17px monospace";ctx.fillText(`MOST CROSSINGS ${String(r.score).padStart(2,"0")}  //  CHICKEN ${String(r.chicken).padStart(2,"0")}`,W/2,215);ctx.fillStyle="#b3ada8";ctx.font="700 14px monospace";ctx.fillText(`FASTEST ${r.fastest==null?"--.-":r.fastest.toFixed(1)}s // C${String(r.fastestChicken).padStart(2,"0")}  ·  FEWEST HITS ${String(r.fewestCollisions).padStart(3,"0")} // C${String(r.collisionChicken).padStart(2,"0")}`,W/2,263);ctx.fillText(`TOTAL GENERATION COLLISIONS ${String(r.totalCollisions).padStart(3,"0")}`,W/2,300);ctx.fillStyle="#ec1932";ctx.font="700 12px monospace";ctx.fillText("NEXT GENERATION PREPARING",W/2,365);ctx.textAlign="left";}
  function formatClock(seconds){const s=Math.max(0,Math.ceil(seconds));return`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;}
  function updateControls(){const b=document.getElementById("chickenHold");b.classList.toggle("active",holdChicken);b.setAttribute("aria-pressed",String(holdChicken));b.querySelector("b").textContent=holdChicken?"AUTO":"HOLD";}
  function selectChicken(delta){displayChickenIndex=(displayChickenIndex+delta+POPULATION)%POPULATION;holdChicken=true;updateControls();}
  function renderGenerationLog(){
    const log=document.getElementById("generationLog"),status=document.getElementById("generationLogStatus");status.textContent=generationRecap?`GEN ${String(generationRecap.generation).padStart(3,"0")} COMPLETE`:`GEN ${String(generation).padStart(3,"0")} RUNNING`;log.replaceChildren();
    if(!generationHistory.length){const empty=document.createElement("p");empty.className="generation-empty";empty.textContent="The first record will appear when this generation finishes.";log.append(empty);return;}
    [...generationHistory].reverse().forEach((record,i)=>{const group=document.createElement("details"),summary=document.createElement("summary"),row=document.createElement("div");group.className="generation-group";group.open=i===0;row.className="generation-entry";const gen=document.createElement("strong");gen.textContent=`GEN ${String(record.generation).padStart(3,"0")}`;row.append(gen);for(const [label,value,cls] of [["Most crossings",`${String(record.score).padStart(2,"0")} / C${String(record.chicken).padStart(2,"0")}`,"record-score"],["Fastest crossing",`${record.fastest==null?"--.-":record.fastest.toFixed(1)+"s"} / C${String(record.fastestChicken).padStart(2,"0")}`,""],["Fewest hits",`${String(record.fewestCollisions).padStart(3,"0")} / C${String(record.collisionChicken).padStart(2,"0")}`,""],["Total hits",String(record.totalCollisions).padStart(3,"0"),""]]){const cell=document.createElement("div"),name=document.createElement("span"),data=document.createElement("b");cell.className=cls;name.textContent=label;data.textContent=value;cell.append(name,data);row.append(cell);}summary.append(row);group.append(summary);const records=document.createElement("div");records.className="chicken-records";const header=document.createElement("div");header.className="chicken-record-row header";for(const label of ["Rank","Chicken","Crossings","Fastest","Hits","Fitness"]){const cell=document.createElement("span");cell.textContent=label;header.append(cell);}records.append(header);for(const chicken of record.chickens||[]){const line=document.createElement("div");line.className="chicken-record-row";for(const [value,cls] of [[`#${String(chicken.rank).padStart(2,"0")}`,"rank"],[String(chicken.chicken).padStart(2,"0"),""],[String(chicken.score).padStart(2,"0"),"chicken-score"],[chicken.fastest==null?"--.-":`${Number(chicken.fastest).toFixed(1)}s`,""],[String(chicken.collisions).padStart(3,"0"),""],[Number(chicken.fitness).toFixed(1),""]]){const cell=document.createElement("span");cell.className=cls;cell.textContent=value;line.append(cell);}records.append(line);}group.append(records);log.append(group);});
  }
  function updateUI(w){const remaining=worlds.filter(chicken=>!chicken.completed).length;ui.generationValue.textContent=String(generationRecap?generationRecap.generation:generation).padStart(3,"0");ui.chickenValue.textContent=`${String(w.index+1).padStart(2,"0")} / ${POPULATION}`;ui.remainingValue.textContent=String(remaining).padStart(2,"0");ui.scoreValue.textContent=String(w.score).padStart(2,"0");ui.generationScoreValue.textContent=`${String(generationHigh).padStart(2,"0")} · C${String(generationHighChicken).padStart(2,"0")}`;ui.clockValue.textContent=formatClock(MATCH_SECONDS-w.steps/SIM_HZ);ui.collisionValue.textContent=String(w.collisions).padStart(3,"0");ui.fastestValue.textContent=Number.isFinite(w.fastest)?`${w.fastest.toFixed(1)} SEC`:`--.- SEC`;ui.decisionValue.textContent=w.decision;ui.actionDetail.textContent=w.decision==="COLLISION"?"Recovering and reading traffic":w.decision==="WAIT"?"Holding for a safer gap":"Neural policy output";ui.chickenNumber.textContent=String(w.index+1).padStart(2,"0");ui.screenScore.textContent=`CROSSINGS ${String(w.score).padStart(2,"0")}`;const pct=clamp((w.fitness/Math.max(1,bestFitness))*100,4,100);ui.fitnessBar.style.width=`${Number.isFinite(pct)?pct:4}%`;ui.fitnessText.textContent=bestFitness>0?`Best fitness ${bestFitness.toFixed(1)}`:"Establishing baseline…";ui.modeValue.textContent="TRAINING";ui.signalText.textContent="SIGNAL ACTIVE";}
  function advance(now,background=false){const wall=Date.now(),elapsed=Math.max(0,wall-lastWall);lastWall=wall;accumulator+=Math.min(elapsed,MAX_OFFLINE_SECONDS*1000);catchingUp=background||accumulator>750;let ticks=0,budget=catchingUp?CATCHUP_STEPS:48;while(accumulator>=TICK_MS&&ticks<budget){if(generationRecap){if(catchingUp)startGeneration(true);else break;}for(const w of worlds)w.step();accumulator-=TICK_MS;ticks++;if(ticks%15===0)syncHigh();if(worlds.every(w=>w.completed)){finishGeneration(now,catchingUp);if(!catchingUp)break;}}syncHigh();if(accumulator<TICK_MS*2)catchingUp=false;}
  function loop(now){if(generationRecap){lastWall=Date.now();accumulator=0;renderRecap(generationRecap);ui.modeValue.textContent="GEN COMPLETE";ui.signalText.textContent="RECAP";ui.remainingValue.textContent="00";if(now>=recapUntil)startGeneration();requestAnimationFrame(loop);return;}if(!document.hidden)advance(now,false);const visible=worlds[displayChickenIndex]||worlds[0];if(visible){render(visible);updateUI(visible);if(catchingUp){ui.modeValue.textContent="CATCHING UP";ui.signalText.textContent="TRAINING CONTINUES";}}if(Date.now()-lastAutosave>=5000){lastAutosave=Date.now();save(true);}requestAnimationFrame(loop);}
  document.getElementById("chickenPrev").addEventListener("click",()=>selectChicken(-1));document.getElementById("chickenNext").addEventListener("click",()=>selectChicken(1));document.getElementById("chickenHold").addEventListener("click",()=>{holdChicken=!holdChicken;updateControls();});
  addEventListener("pagehide",()=>save(true));document.addEventListener("visibilitychange",()=>{lastWall=Date.now();if(document.hidden)save(true);});
  if(!restore(activeSnapshot))seedPopulation();lastWall=Math.max(Date.now()-MAX_OFFLINE_SECONDS*1000,savedAt);setInterval(()=>{if(document.hidden){advance(performance.now(),true);if(Date.now()-lastAutosave>=5000){lastAutosave=Date.now();save(true);}}},1000);requestAnimationFrame(loop);
})();
