(() => {
  "use strict";
  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, TAU = Math.PI * 2;
  const POPULATION = 24, ELITES = 4, INPUTS = 10, HIDDEN = 14, OUTPUTS = 4;
  const SIM_HZ = 30, TICK_MS = 1000 / SIM_HZ;
  const MAX_STEPS = 1800, STORAGE_KEY = "zendigo-pixel-asteroids-brain-v2";
  const ui = Object.fromEntries(["generationValue","pilotValue","scoreValue","bestScoreValue","survivalValue","hitsValue","fitnessBar","fitnessText","decisionValue","actionDetail","modeValue","signalText","pilotNumber","screenScore"].map(id => [id, document.getElementById(id)]));

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
      this.w1=data?.w1?Float32Array.from(data.w1):Float32Array.from({length:n1},()=>rng.gaussian()*.48);
      this.b1=data?.b1?Float32Array.from(data.b1):new Float32Array(HIDDEN);
      this.w2=data?.w2?Float32Array.from(data.w2):Float32Array.from({length:n2},()=>rng.gaussian()*.42);
      this.b2=data?.b2?Float32Array.from(data.b2):new Float32Array(OUTPUTS);
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
      this.asteroids=[];this.bullets=[];this.score=0;this.hits=0;this.shots=0;this.steps=0;this.fitness=0;this.dead=false;this.decision="OBSERVING";this.spawnWave(5);
    }
    spawnWave(count){
      for(let i=0;i<count;i++){let x,y;do{x=this.rng.range(25,W-25);y=this.rng.range(25,H-25);}while(Math.hypot(x-W/2,y-H/2)<180);
        this.asteroids.push({x,y,vx:this.rng.range(-1.25,1.25),vy:this.rng.range(-1.25,1.25),r:this.rng.range(25,43),rot:this.rng.range(0,TAU),spin:this.rng.range(-.025,.025),shape:Array.from({length:10},()=>this.rng.range(.72,1.14))});
      }
    }
    nearest(){let best=null,bd=1e9,dx=0,dy=0;for(const a of this.asteroids){const x=torusDelta(this.ship.x,a.x,W),y=torusDelta(this.ship.y,a.y,H),d=Math.hypot(x,y)-a.r;if(d<bd){best=a;bd=d;dx=x;dy=y;}}return{a:best,d:bd,dx,dy};}
    inputs(){const n=this.nearest(),target=Math.atan2(n.dy,n.dx),diff=angleWrap(target-this.ship.a);return new Float32Array([Math.sin(diff),Math.cos(diff),clamp(n.d/560,0,1),this.ship.vx/6,this.ship.vy/6,Math.sin(this.ship.a),Math.cos(this.ship.a),clamp(this.cooldown/12,0,1),clamp(this.asteroids.length/12,0,1),1]);}
    fire(){if(this.cooldown>0||this.bullets.length>6)return;this.cooldown=6;this.shots++;this.bullets.push({x:this.ship.x+Math.cos(this.ship.a)*16,y:this.ship.y+Math.sin(this.ship.a)*16,vx:this.ship.vx+Math.cos(this.ship.a)*8,vy:this.ship.vy+Math.sin(this.ship.a)*8,life:36});}
    step(){
      if(this.dead)return;this.steps++;this.cooldown=Math.max(0,(this.cooldown||0)-1);this.ship.inv=Math.max(0,this.ship.inv-1);
      const out=this.brain.think(this.inputs());let turn=0;if(out[0]>.18)turn=1;else if(out[0]<-.18)turn=-1;const thrust=out[1]>.12,fire=out[2]>-.05;
      this.ship.a+=turn*.075;if(thrust){this.ship.vx+=Math.cos(this.ship.a)*.105;this.ship.vy+=Math.sin(this.ship.a)*.105;}const speed=Math.hypot(this.ship.vx,this.ship.vy);if(speed>6){this.ship.vx*=6/speed;this.ship.vy*=6/speed;}this.ship.vx*=.997;this.ship.vy*=.997;this.ship.x=wrap(this.ship.x+this.ship.vx,W);this.ship.y=wrap(this.ship.y+this.ship.vy,H);if(fire)this.fire();
      this.decision=fire&&thrust?"THRUST + FIRE":fire?"FIRE":thrust?"THRUST":turn<0?"TURN LEFT":turn>0?"TURN RIGHT":"OBSERVING";
      for(const b of this.bullets){b.x=wrap(b.x+b.vx,W);b.y=wrap(b.y+b.vy,H);b.life--;}this.bullets=this.bullets.filter(b=>b.life>0);
      for(const a of this.asteroids){a.x=wrap(a.x+a.vx,W);a.y=wrap(a.y+a.vy,H);a.rot+=a.spin;}
      outer:for(let bi=this.bullets.length-1;bi>=0;bi--){const b=this.bullets[bi];for(let ai=this.asteroids.length-1;ai>=0;ai--){const a=this.asteroids[ai],dx=torusDelta(b.x,a.x,W),dy=torusDelta(b.y,a.y,H);if(Math.hypot(dx,dy)<a.r){this.bullets.splice(bi,1);this.asteroids.splice(ai,1);this.hits++;const points=a.r>31?20:a.r>18?50:100;this.score+=points;this.fitness+=points*1.4+12;if(a.r>18){for(let k=0;k<2;k++){const ang=this.rng.range(0,TAU);this.asteroids.push({...a,r:a.r*.58,vx:a.vx+Math.cos(ang)*1.25,vy:a.vy+Math.sin(ang)*1.25,shape:Array.from({length:9},()=>this.rng.range(.72,1.14))});}}break outer;}}}
      if(this.ship.inv<=0){for(const a of this.asteroids){const dx=torusDelta(this.ship.x,a.x,W),dy=torusDelta(this.ship.y,a.y,H);if(Math.hypot(dx,dy)<a.r+this.ship.r){this.ship.lives--;this.fitness-=24;this.ship.x=W/2;this.ship.y=H/2;this.ship.vx=this.ship.vy=0;this.ship.inv=110;if(this.ship.lives<=0)this.dead=true;break;}}}
      const n=this.nearest(),alignment=Math.max(0,Math.cos(angleWrap(Math.atan2(n.dy,n.dx)-this.ship.a)));this.fitness+=.008+alignment*.004-(fire?.0015:0);
      if(!this.asteroids.length){this.fitness+=80;this.spawnWave(6);}
      if(this.steps>=MAX_STEPS)this.dead=true;
    }
  }

  let generation=1,speed=1,paused=false,bestScore=0,bestFitness=-Infinity,bestBrain=null,population=[],worlds=[],last=performance.now(),accumulator=0,displayPilotIndex=0;
  const rng=new RNG(82);
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(saved?.brain){bestBrain=new Brain(rng,saved.brain);bestScore=saved.bestScore||0;bestFitness=saved.bestFitness||0;generation=saved.generation||1;}}catch{}
  function seedPopulation(){population=[];if(bestBrain)population.push(new Brain(rng,bestBrain.toJSON()));while(population.length<POPULATION)population.push(bestBrain?bestBrain.child(rng,.18,.4):new Brain(rng));startGeneration();}
  function startGeneration(){worlds=population.map((brain,i)=>new World(brain,82+generation*997,i));displayPilotIndex=0;accumulator=0;}
  function finishGeneration(){
    worlds.sort((a,b)=>b.fitness-a.fitness);const champion=worlds[0];if(champion.fitness>bestFitness){bestFitness=champion.fitness;bestScore=Math.max(bestScore,champion.score);bestBrain=new Brain(rng,champion.brain.toJSON());localStorage.setItem(STORAGE_KEY,JSON.stringify({generation,bestScore,bestFitness,brain:bestBrain.toJSON()}));}
    const elites=worlds.slice(0,ELITES).map(w=>w.brain);population=elites.map(b=>new Brain(rng,b.toJSON()));while(population.length<POPULATION){const parent=elites[Math.floor(rng.next()*elites.length)];population.push(parent.child(rng,.1+Math.min(.12,generation*.001),.24));}generation++;startGeneration();
  }
  function drawRock(a){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);ctx.beginPath();a.shape.forEach((m,i)=>{const ang=i/a.shape.length*TAU,r=a.r*m,x=Math.cos(ang)*r,y=Math.sin(ang)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();ctx.restore();}
  function drawShip(s){if(s.inv>0&&Math.floor(s.inv/6)%2)return;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a);ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-11,-9);ctx.lineTo(-6,0);ctx.lineTo(-11,9);ctx.closePath();ctx.stroke();ctx.restore();}
  function render(w){ctx.clearRect(0,0,W,H);ctx.strokeStyle="#76f6cd";ctx.fillStyle="#76f6cd";ctx.lineWidth=1.6;ctx.shadowColor="#4ce7b7";ctx.shadowBlur=5;for(const a of w.asteroids)drawRock(a);for(const b of w.bullets){ctx.beginPath();ctx.arc(b.x,b.y,2.1,0,TAU);ctx.fill();}drawShip(w.ship);ctx.shadowBlur=0;ctx.fillStyle="#91d9c2";ctx.font="700 13px monospace";ctx.fillText(`LIVES ${w.ship.lives}`,20,28);ctx.textAlign="right";ctx.fillText(`WAVE ${w.asteroids.length?1:2}`,W-20,28);ctx.textAlign="left";}
  function updateUI(w){bestScore=Math.max(bestScore,w.score);ui.generationValue.textContent=String(generation).padStart(3,"0");ui.pilotValue.textContent=`${String(w.index+1).padStart(2,"0")} / ${POPULATION}`;ui.scoreValue.textContent=String(w.score).padStart(5,"0");ui.bestScoreValue.textContent=String(bestScore).padStart(5,"0");ui.survivalValue.textContent=`${(w.steps/SIM_HZ).toFixed(1).padStart(4,"0")} SEC`;ui.hitsValue.textContent=String(w.hits).padStart(3,"0");ui.decisionValue.textContent=w.decision;ui.actionDetail.textContent=w.decision==="OBSERVING"?"Scanning nearest threat":"Neural policy output";ui.pilotNumber.textContent=String(w.index+1).padStart(2,"0");ui.screenScore.textContent=`SCORE ${String(w.score).padStart(5,"0")}`;const pct=clamp((w.fitness/Math.max(1,bestFitness))*100,4,100);ui.fitnessBar.style.width=`${Number.isFinite(pct)?pct:4}%`;ui.fitnessText.textContent=bestFitness>0?`Best fitness ${bestFitness.toFixed(1)}`:"Establishing baseline…";ui.modeValue.textContent=paused?"PAUSED":"TRAINING";ui.signalText.textContent=paused?"SIGNAL HOLD":"SIGNAL ACTIVE";}
  function loop(now){
    const elapsed=Math.min(100,now-last);last=now;
    if(!paused){
      accumulator+=elapsed*speed;
      let ticks=0;
      while(accumulator>=TICK_MS&&ticks<48){
        for(const w of worlds)w.step();
        accumulator-=TICK_MS;ticks++;
        if(worlds.every(w=>w.dead)){finishGeneration();break;}
      }
    }
    let visible=worlds[displayPilotIndex];
    if(!visible||visible.dead){
      const next=worlds.findIndex((w,i)=>i>displayPilotIndex&&!w.dead);
      displayPilotIndex=next>=0?next:worlds.findIndex(w=>!w.dead);
      visible=displayPilotIndex>=0?worlds[displayPilotIndex]:worlds[0];
    }
    if(visible){render(visible);updateUI(visible);}requestAnimationFrame(loop);
  }
  document.getElementById("powerButton").addEventListener("click",e=>{paused=!paused;e.currentTarget.querySelector("span").textContent=paused?"▶":"Ⅱ";e.currentTarget.querySelector("b").textContent=paused?"RESUME":"PAUSE";});
  document.querySelectorAll("[data-speed]").forEach(button=>button.addEventListener("click",()=>{speed=Number(button.dataset.speed);accumulator=0;document.querySelectorAll("[data-speed]").forEach(b=>b.classList.toggle("active",b===button));}));
  document.getElementById("resetButton").addEventListener("click",()=>{if(!confirm("Reset PiXeL's locally saved training progress?"))return;localStorage.removeItem(STORAGE_KEY);generation=1;bestScore=0;bestFitness=-Infinity;bestBrain=null;seedPopulation();});
  seedPopulation();requestAnimationFrame(loop);
})();
