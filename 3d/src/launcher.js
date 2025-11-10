const games = [
  { id: 'game-1', name: 'Game 1', path: './games/game-1/index.html' },
  { id: 'game-2', name: 'Game 2', path: './games/game-2/index.html' },
  { id: 'game-3', name: 'Game 3', path: './games/game-3/index.html' },
  { id: 'game-4', name: 'Game 4', path: './games/game-4/index.html' },
  { id: 'game-5', name: 'Game 5', path: './games/game-5/index.html' },
  { id: 'game-6', name: 'Game 6', path: './games/game-6/index.html' },
];

function buildLauncher() {
  const list = document.getElementById('game-list');
  if (!list) return; // launcher UI removed — nothing to build
  games.forEach(g => {
    const li = document.createElement('li');
    li.textContent = g.name;
    li.addEventListener('click', () => loadGame(g));
    list.appendChild(li);
  });
}

function loadGame(game) {
  const frame = document.getElementById('game-frame');
  // Use relative path; for file:// use srcdoc navigation fallback
  try {
    frame.src = game.path;
  } catch (e) {
    // fallback: open in same window
    window.location.href = game.path;
  }
}

window.addEventListener('DOMContentLoaded', buildLauncher);

// Listen for child -> parent navigation requests when opened via iframe
window.addEventListener('message', (ev) => {
  if (!ev.data) return;
  if (ev.data.type === 'tkk:navigate' && ev.data.target === 'launcher') {
    // reset iframe to blank
    const frame = document.getElementById('game-frame');
    if (frame) frame.src = 'about:blank';
  }
});

// --- Start screen builder ---
function buildStartScreen() {
  const grid = document.getElementById('start-grid');
  if (!grid) return;
  games.forEach(g => {
    const card = document.createElement('div');
    card.className = 'start-card';
    const title = document.createElement('h3');
    title.textContent = g.name;
  const desc = document.createElement('p');
  desc.textContent = 'START';
    card.appendChild(title);
    card.appendChild(desc);
    card.addEventListener('click', () => {
      // hide start screen then load
      hideStartScreen();
      loadGame(g);
    });
    grid.appendChild(card);
  });

  const openLauncher = document.getElementById('open-launcher');
  if (openLauncher) openLauncher.addEventListener('click', hideStartScreen);
}

function hideStartScreen(){
  const s = document.getElementById('start-screen');
  if (s) s.style.display = 'none';
}

// build start screen in DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  buildStartScreen();
});

// --- Title screen flow and keyboard handling ---
function showTitleScreen(){
  const t = document.getElementById('title-screen');
  const s = document.getElementById('start-screen');
  const frame = document.getElementById('game-frame');
  // if focused element is inside an element that will be hidden, move focus to body or first start button
  const active = document.activeElement;
  if (active) {
    if (s && s.contains(active)) {
      const fallback = document.getElementById('btn-start') || document.getElementById('open-launcher') || document.body;
      try { fallback.focus && fallback.focus(); } catch(e){}
    }
  }
  if (t) { t.style.display = 'flex'; t.setAttribute('aria-hidden','false'); }
  if (s) { s.style.display = 'none'; s.setAttribute('aria-hidden','true'); }
  if (frame) frame.src = 'about:blank';
}

function showStartScreen(){
  const t = document.getElementById('title-screen');
  const s = document.getElementById('start-screen');
  // avoid hiding a focused element: if focus is inside title screen, move it first
  const active = document.activeElement;
  if (active) {
    if (t && t.contains(active)) {
      const fallback = document.getElementById('open-launcher') || document.getElementById('btn-start') || document.body;
      try { fallback.focus && fallback.focus(); } catch(e){}
    }
  }
  if (t) { t.style.display = 'none'; t.setAttribute('aria-hidden','true'); }
  if (s) { s.style.display = 'flex'; s.setAttribute('aria-hidden','false'); }
}

window.addEventListener('DOMContentLoaded', () => {
  // wire up title buttons
  const btn = document.getElementById('btn-start');
  if (btn) btn.addEventListener('click', () => showStartScreen());
  const btnL = document.getElementById('btn-show-launcher');
  if (btnL) btnL.addEventListener('click', () => showStartScreen());

  // global key: 't' to go back to game selection
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 't' || ev.key === 'T') {
      showStartScreen();
    }
  });
});

// Listen for child -> parent navigation requests when opened via iframe
window.addEventListener('message', (ev) => {
  if (!ev.data) return;
  if (ev.data.type === 'tkk:navigate' && ev.data.target === 'launcher') {
    // show selection screen
    showStartScreen();
  }
});
