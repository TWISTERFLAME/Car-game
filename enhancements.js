/* Traffic Drive — stability + realistic Traffic Racer presentation */
(() => {
  'use strict';
  const boot = () => {
    if (!window.game || !game.renderer) return requestAnimationFrame(boot);

    /* Load the realistic stylesheet even though the original index still loads style.css. */
    if (!document.getElementById('realistic-style')) {
      const link=document.createElement('link'); link.id='realistic-style'; link.rel='stylesheet'; link.href='realistic.css'; document.head.appendChild(link);
    }
    document.title='Traffic Drive 3D';
    const title=document.querySelector('.game-title'); if(title) title.textContent='TRAFFIC DRIVE';
    const sub=document.querySelector('.game-subtitle'); if(sub) sub.textContent='REALISTIC HIGHWAY RACER';
    document.querySelectorAll('.env-card h3').forEach(el=>{ if(el.textContent.includes('NEON CITY')) el.textContent='CITY HIGHWAY'; });
    document.querySelectorAll('*').forEach(el=>{ if(el.children.length) return; if(el.textContent.trim()==='Retro Synth Music') el.textContent='Music'; });

    // Independent keyboard state: P1=WASD, P2=ARROWS.
    const held=Object.create(null), map={
      KeyW:['p1','gas'],KeyS:['p1','brake'],KeyA:['p1','left'],KeyD:['p1','right'],Space:['p1','nitro'],KeyH:['p1','horn'],
      ArrowUp:['p2','gas'],ArrowDown:['p2','brake'],ArrowLeft:['p2','left'],ArrowRight:['p2','right'],ShiftRight:['p2','nitro'],Numpad0:['p2','horn']
    };
    const sync=()=>{
      if(game.gameMode!=='SPLIT'||!game.players)return;
      for(const id of ['p1','p2']) for(const k of ['gas','brake','left','right','nitro','horn']) game.players[id].keys[k]=false;
      for(const code in map) if(held[code]){const [id,k]=map[code];if(game.players[id])game.players[id].keys[k]=true;}
    };
    addEventListener('keydown',e=>{held[e.code]=true;sync();if(map[e.code])e.preventDefault()},{passive:false});
    addEventListener('keyup',e=>{held[e.code]=false;sync();if(map[e.code])e.preventDefault()},{passive:false});

    // Protected endless road. Neither local player can cause the other player's road to recycle.
    const protectRoad=()=>{
      if(!game.roadChunks?.length||!game.players?.p1)return;
      const p1=game.players.p1.pos.z;
      const p2=game.gameMode==='SPLIT'&&game.players.p2?.car?game.players.p2.pos.z:p1;
      const back=Math.max(p1,p2),len=game.roadLength||120;
      let farthest=Math.min(...game.roadChunks.map(c=>c.position.z));
      while(game.roadChunks.length<12){const c=game.roadChunks[0].clone(true);farthest-=len;c.position.z=farthest;game.scene.add(c);game.roadChunks.push(c);}
      for(const c of game.roadChunks) if(c.position.z>back+180){farthest-=len;c.position.z=farthest;}
    };

    // Keep cars grounded and stop vertical physics glitches from launching them.
    const ground=p=>{if(!p?.car||p.isCrashed)return;p.pos.y=.15;p.car.position.y=.15;if(p.velocity)p.velocity.y=0;};
    const oldPhysics=typeof game.updatePlayerPhysics==='function'?game.updatePlayerPhysics.bind(game):null;
    if(oldPhysics&&!game._trafficDrivePhysics){game.updatePlayerPhysics=(id,dt)=>{oldPhysics(id,dt);ground(game.players[id]);};game._trafficDrivePhysics=true;}

    // WebGL black-screen recovery.
    const canvas=game.renderer.domElement;
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();game._webglLost=true},false);
    canvas.addEventListener('webglcontextrestored',()=>{game._webglLost=false;game.scene.traverse(o=>{if(o.material){const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(x=>x.needsUpdate=true)}})},false);

    const low=/Android|iPhone|iPad|Windows Phone/i.test(navigator.userAgent)||(navigator.deviceMemory||8)<=4;
    game.renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1.25:1.5));

    // Remove the remaining neon material treatment from the 3D world.
    const realisticWorld=()=>{
      if(!game.scene)return;
      game.scene.traverse(o=>{
        if(!o.material)return;
        const mats=Array.isArray(o.material)?o.material:[o.material];
        mats.forEach(m=>{
          if(m.emissive)m.emissive.setHex(0x000000);
          if('emissiveIntensity' in m)m.emissiveIntensity=0;
          if('metalness' in m)m.metalness=Math.min(m.metalness,.35);
          if('roughness' in m)m.roughness=Math.max(m.roughness,.65);
        });
      });
      if(game.lights?.ambient){game.lights.ambient.color.setHex(0xfff7e8);game.lights.ambient.intensity=Math.max(game.lights.ambient.intensity||0,.45);}
      if(game.lights?.sun){game.lights.sun.color.setHex(0xfff0d8);game.lights.sun.intensity=Math.max(game.lights.sun.intensity||0,.8);}
      if(game.scene.fog){game.scene.fog.color.setHex(0xb9d1df);game.scene.fog.density=.006;}
      game.renderer.setClearColor(0xb9d1df);
    };
    realisticWorld();

    const tick=()=>{if(game.state==='PLAYING'){sync();protectRoad();ground(game.players?.p1);if(game.gameMode==='SPLIT')ground(game.players?.p2);}requestAnimationFrame(tick)};tick();
  };
  addEventListener('load',boot,{once:true});
})();
