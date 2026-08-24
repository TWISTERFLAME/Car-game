/* Traffic Drive stability + multiplayer fixes */
(() => {
  'use strict';
  const boot = () => {
    if (!window.game || !game.renderer) return requestAnimationFrame(boot);

    // Independent keyboard state: P1=WASD, P2=ARROWS.
    const held = Object.create(null);
    const map = {
      KeyW:['p1','gas'], KeyS:['p1','brake'], KeyA:['p1','left'], KeyD:['p1','right'], Space:['p1','nitro'], KeyH:['p1','horn'],
      ArrowUp:['p2','gas'], ArrowDown:['p2','brake'], ArrowLeft:['p2','left'], ArrowRight:['p2','right'], ShiftRight:['p2','nitro'], Numpad0:['p2','horn']
    };
    const sync = () => {
      if (game.gameMode !== 'SPLIT' || !game.players) return;
      for (const id of ['p1','p2']) for (const k of ['gas','brake','left','right','nitro','horn']) game.players[id].keys[k] = false;
      for (const code in map) if (held[code]) {
        const [id,k] = map[code];
        if (game.players[id]) game.players[id].keys[k] = true;
      }
    };
    addEventListener('keydown', e => { held[e.code]=true; sync(); if (map[e.code]) e.preventDefault(); }, {passive:false});
    addEventListener('keyup', e => { held[e.code]=false; sync(); if (map[e.code]) e.preventDefault(); }, {passive:false});

    // Keep enough road ahead and protect both cars from recycling.
    const protectRoad = () => {
      if (!game.roadChunks?.length || !game.players?.p1) return;
      const p1 = game.players.p1.pos.z;
      const p2 = game.gameMode === 'SPLIT' && game.players.p2?.car ? game.players.p2.pos.z : p1;
      const front = Math.min(p1,p2);
      const back = Math.max(p1,p2);
      const length = game.roadLength || 120;
      let farthest = Math.min(...game.roadChunks.map(c=>c.position.z));
      // Always maintain at least 12 chunks in front of the leading car.
      while (game.roadChunks.length < 12) {
        const c = game.roadChunks[0].clone(true);
        farthest -= length; c.position.z=farthest; game.scene.add(c); game.roadChunks.push(c);
      }
      for (const c of game.roadChunks) {
        if (c.position.z > back + 140) {
          farthest -= length; c.position.z=farthest;
        }
      }
    };

    // Prevent physics/position glitches from launching cars into the sky.
    const groundCar = p => {
      if (!p?.car || p.isCrashed) return;
      const y = 0.15;
      p.pos.y = y; p.car.position.y = y;
      if (p.velocity) { p.velocity.y=0; }
    };
    const oldPhysics = typeof game.updatePlayerPhysics === 'function' ? game.updatePlayerPhysics.bind(game) : null;
    if (oldPhysics && !game._trafficDrivePhysics) {
      game.updatePlayerPhysics = (id,dt) => { oldPhysics(id,dt); groundCar(game.players[id]); };
      game._trafficDrivePhysics=true;
    }

    // WebGL recovery for black-screen/context-loss cases.
    const canvas=game.renderer.domElement;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); game._webglLost=true; }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      game._webglLost=false;
      game.scene.traverse(o => { if(o.material){ const m=Array.isArray(o.material)?o.material:[o.material]; m.forEach(x=>x.needsUpdate=true); }});
    }, false);

    // Performance-safe pixel ratio.
    const low = /Android|iPhone|iPad|Windows Phone/i.test(navigator.userAgent) || (navigator.deviceMemory||8)<=4;
    game.renderer.setPixelRatio(Math.min(devicePixelRatio||1, low?1.25:1.5));

    const tick = () => { if(game.state==='PLAYING') { sync(); protectRoad(); groundCar(game.players?.p1); if(game.gameMode==='SPLIT') groundCar(game.players?.p2); } requestAnimationFrame(tick); };
    tick();
  };
  addEventListener('load', boot, {once:true});
})();
