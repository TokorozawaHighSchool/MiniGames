// Overwritten with a clean script. Minimal, readable, reliable.
(function(){
  const playarea = document.getElementById('playarea');
  const crosshair = document.getElementById('crosshair');
  const startBtn = document.getElementById('start');
  const resetBtn = document.getElementById('reset');
  const scoreEl = document.getElementById('score');
  const hitsEl = document.getElementById('hits');
  const missesEl = document.getElementById('misses');
  const timeEl = document.getElementById('time');
  const durationSelect = document.getElementById('duration');
  const difficultySelect = document.getElementById('difficulty');
  const sensitivityInput = document.getElementById('sensitivity');
  const sensVal = document.getElementById('sensVal');
  const backBtn = document.getElementById('back');

  if (!playarea || !crosshair || !startBtn) return;

  let score = 0, hits = 0, misses = 0;
  let running = false, timer = null, remaining = 0;
  let spawnInterval = 900;
  let sensitivity = 1.0;

  function setDifficulty(d){ if(d==='easy') spawnInterval=1000; if(d==='normal') spawnInterval=700; if(d==='hard') spawnInterval=450; }
  function updateHUD(){ if(scoreEl) scoreEl.textContent=`Score: ${score}`; if(hitsEl) hitsEl.textContent=`Hits: ${hits}`; if(missesEl) missesEl.textContent=`Misses: ${misses}`; }
  function resetStats(){ score=0; hits=0; misses=0; updateHUD(); }

  function spawnTarget(){
    if(!running) return;
    const t = document.createElement('div'); t.className='target';
    const scale = difficultySelect && difficultySelect.value==='hard' ? (0.8+Math.random()*0.4) : (0.9+Math.random()*0.3);
    const baseW = 48*scale, baseH = 90*scale;
    t.style.width = `${baseW}px`; t.style.height = `${baseH}px`; t.style.transform = `scale(${scale})`;
    const rect = playarea.getBoundingClientRect();
    const x = Math.random()*Math.max(0, rect.width - baseW);
    const y = Math.random()*Math.max(0, rect.height - baseH);
    t.style.left = `${x}px`; t.style.top = `${y}px`;
    const head = document.createElement('div'); head.className='head';
    const body = document.createElement('div'); body.className='body';
    const limbL = document.createElement('div'); limbL.className='limb left';
    const limbR = document.createElement('div'); limbR.className='limb right';
    const legL = document.createElement('div'); legL.className='limb legL';
    const legR = document.createElement('div'); legR.className='limb legR';
    t.appendChild(head); t.appendChild(body); t.appendChild(limbL); t.appendChild(limbR); t.appendChild(legL); t.appendChild(legR);
    const life = difficultySelect && difficultySelect.value==='hard' ? 1200 : 2000;
    const disappear = setTimeout(()=>{ if(t.parentElement){ t.remove(); misses++; updateHUD(); } }, life);
    t.addEventListener('click', (e)=>{
      e.stopPropagation(); clearTimeout(disappear); if(!running) return;
      const basePts = Math.floor((100/(baseW))*100*((difficultySelect&&difficultySelect.value==='hard')?2:1)/10);
      let pts = basePts;
      const clickedHead = e.target.classList && e.target.classList.contains('head');
      if(clickedHead){ pts = Math.floor(basePts*1.2); head.classList.add('head-hit'); setTimeout(()=>head.classList.remove('head-hit'),250); }
      score += pts; hits++; updateHUD(); t.classList.add('hit'); setTimeout(()=>t.remove(),120);
    });
    playarea.appendChild(t);
    setTimeout(spawnTarget, spawnInterval * (0.8 + Math.random()*0.6));
  }

  function startGame(){ if(running) return; resetStats(); setDifficulty(difficultySelect?difficultySelect.value:'normal'); remaining = parseFloat(durationSelect?durationSelect.value:30)||30; timeEl && (timeEl.textContent = remaining.toFixed(1)); running = true; playarea.focus(); spawnTarget(); timer = setInterval(()=>{ remaining -= 0.1; if(remaining<=0){ endGame(); return; } timeEl && (timeEl.textContent = remaining.toFixed(1)); }, 100); }
  function endGame(){ running = false; clearInterval(timer); document.querySelectorAll('#playarea .target').forEach(t=>t.remove()); alert(`Time up! Score: ${score}  Hits: ${hits}  Misses: ${misses}`); }
  function resetGame(){ running = false; clearInterval(timer); document.querySelectorAll('#playarea .target').forEach(t=>t.remove()); resetStats(); timeEl && (timeEl.textContent='0.0'); }

  function loadSensitivity(){ try{ const v=parseFloat(localStorage.getItem('tkk_sensitivity')); if(!isNaN(v)) sensitivity=v; }catch(e){} if(sensitivityInput) sensitivityInput.value = String(sensitivity); if(sensVal) sensVal.textContent = sensitivity.toFixed(1); }
  let lastMouse = null;
  playarea.addEventListener('mousemove', (e)=>{ const rect = playarea.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; if(lastMouse){ const dx = x - lastMouse.x; const dy = y - lastMouse.y; const currentLeft = parseFloat(crosshair.style.left) || rect.width/2; const currentTop = parseFloat(crosshair.style.top) || rect.height/2; const newLeft = currentLeft + dx * sensitivity; const newTop = currentTop + dy * sensitivity; crosshair.style.left = `${Math.max(0, Math.min(rect.width, newLeft))}px`; crosshair.style.top = `${Math.max(0, Math.min(rect.height, newTop))}px`; } else { crosshair.style.left = `${x}px`; crosshair.style.top = `${y}px`; } lastMouse = { x, y }; });
  playarea.addEventListener('mouseleave', ()=>{ lastMouse = null; }); playarea.addEventListener('mouseenter', ()=>{ lastMouse = null; });
  if(sensitivityInput){ sensitivityInput.addEventListener('input', (e)=>{ sensitivity = parseFloat(e.target.value) || 1.0; if(sensVal) sensVal.textContent = sensitivity.toFixed(1); }); sensitivityInput.addEventListener('change', ()=>{ try{ localStorage.setItem('tkk_sensitivity', String(sensitivity)); }catch(e){} }); }
  loadSensitivity();

  playarea.addEventListener('click', (e)=>{ if(!running) return; if(!e.target.classList.contains('target')){ misses++; updateHUD(); } });
  startBtn.addEventListener('click', startGame);
  resetBtn && resetBtn.addEventListener('click', resetGame);
  playarea.addEventListener('keydown', (e)=>{ if(e.code === 'Space') startGame(); if(e.key.toLowerCase() === 'r') resetGame(); });

  updateHUD();
  document.addEventListener('keydown', (e)=>{ if(e.key === 't' || e.key === 'T'){ if(window.parent && window.parent !== window){ window.parent.postMessage({ type:'tkk:navigate', target:'launcher' }, '*'); return; } window.location.href = '../index.html'; } });
  playarea.setAttribute('tabindex','0');
  if(backBtn) backBtn.addEventListener('click', ()=>{ if(window.parent && window.parent !== window){ window.parent.postMessage({ type:'tkk:navigate', target:'launcher' }, '*'); return; } window.location.href = '../index.html'; });
})();
