document.getElementById('back').addEventListener('click', () => {
  // If embedded in an iframe, message parent to show launcher.
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'tkk:navigate', target: 'launcher' }, '*');
    return;
  }
  // If opened directly, navigate to index.html relative
  window.location.href = './index.html';
});

// Simple interactive demo
let count = 0;
const root = document.getElementById('root');
const btn = document.createElement('button');
btn.textContent = 'Click me';
root.appendChild(document.createElement('br'));
root.appendChild(btn);
btn.addEventListener('click', () => {
  count++;
  btn.textContent = `Clicked ${count}`;
});

(() => {
  const body = document.body;
  const intro = document.getElementById('intro-overlay');
  const introPanel = intro && intro.querySelector('.panel');
  let introVisible = !!intro;
  function hideIntro() {
    if (!intro || !introVisible) return;
    intro.style.display = 'none';
    introVisible = false;
  }
  if (introPanel) {
    introPanel.addEventListener('click', () => hideIntro());
    // allow focusing and keyboard closing
    introPanel.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') {
        e.preventDefault();
        hideIntro();
      }
    });
  }
  // 現在の背景色を保存しておく（ラウンド終了時に戻すため）
  const originalBg = getComputedStyle(body).backgroundColor || '';
  const statusEl = document.getElementById('status');
  const p1scoreEl = document.getElementById('p1score');
  const p2scoreEl = document.getElementById('p2score');
  const p1timeEl = document.getElementById('p1time');
  const p2timeEl = document.getElementById('p2time');
  const restartBtn = document.getElementById('restart');

  let p1Score = 0;
  let p2Score = 0;

  let state = 'idle'; // 'idle' | 'armed' | 'go' | 'finished'
  let armTimeout = null;
  let finalizeTimeout = null;
  let startTime = 0;

  let p1Time = null;
  let p2Time = null;
  let foul = null; // 'p1'|'p2' or null

  function resetRoundUI() {
    p1timeEl.textContent = '反応: —';
    p2timeEl.textContent = '反応: —';
    p1Time = null;
    p2Time = null;
    foul = null;
  }

  function updateScores() {
    p1scoreEl.textContent = 'Score: ' + p1Score;
    p2scoreEl.textContent = 'Score: ' + p2Score;
  }

  function startRound() {
    if (state === 'armed' || state === 'go') return;
    clearTimers();
    resetRoundUI();
    state = 'armed';
    statusEl.textContent = '準備中… ランダムで合図が出ます';
    const delay = 2000 + Math.floor(Math.random() * 4000); // 2〜6秒
    armTimeout = setTimeout(signalGo, delay);
  }

  function signalGo() {
    startTime = performance.now();
    state = 'go';
    statusEl.textContent = '見切り！ 反応して下さい (P1: A / P2: L)';
  // 合図が表示されたら背景を緑にする
  try { body.style.backgroundColor = '#083'; } catch (e) { /* noop */ }
    // 最大待機時間（両者の入力を待つ）
    finalizeTimeout = setTimeout(finalizeRound, 3000);
  }

  function onFoul(player) {
    // player が反則をした（合図前に押した）
    foul = player;
    state = 'finished';
    clearTimers();
    if (player === 'p1') {
      p1timeEl.textContent = '反応: 反則';
      p2Score++;
      statusEl.textContent = '反則 — Player1 が先に押しました。Player2 の勝ち';
    } else {
      p2timeEl.textContent = '反応: 反則';
      p1Score++;
      statusEl.textContent = '反則 — Player2 が先に押しました。Player1 の勝ち';
    }
    updateScores();
  // 反則でラウンドが終わったら背景を元に戻す
  try { body.style.backgroundColor = originalBg; } catch (e) { /* noop */ }
  }

  function recordReaction(player) {
    if (state !== 'go') return;
    const now = performance.now();
    const ms = Math.max(0, now - startTime);
    const text = '反応: ' + Math.round(ms) + ' ms';
    if (player === 'p1') {
      if (p1Time != null) return;
      p1Time = ms;
      p1timeEl.textContent = text;
    } else {
      if (p2Time != null) return;
      p2Time = ms;
      p2timeEl.textContent = text;
    }
    // 両者が揃ったら確定
    if (p1Time != null && p2Time != null) {
      finalizeRound();
    }
  }

  function finalizeRound() {
    if (state === 'finished') return;
    clearTimers();
    state = 'finished';

    if (foul) {
      // 既に foul 処理でスコア更新済み
      updateScores();
      return;
    }

    // 判定
    if (p1Time == null && p2Time == null) {
      statusEl.textContent = '誰も押しませんでした。もう一度 Space で再開';
      return;
    }

    if (p1Time != null && p2Time != null) {
      // 両者反応あり
      if (p1Time < p2Time) {
        p1Score++;
        statusEl.textContent = `Player1 の勝ち — ${Math.round(p1Time)} ms vs ${Math.round(p2Time)} ms`;
      } else if (p2Time < p1Time) {
        p2Score++;
        statusEl.textContent = `Player2 の勝ち — ${Math.round(p2Time)} ms vs ${Math.round(p1Time)} ms`;
      } else {
        statusEl.textContent = `同タイム — ${Math.round(p1Time)} ms`;
      }
    } else if (p1Time != null) {
      // Player1 のみ反応
      p1Score++;
      statusEl.textContent = `Player1 の勝ち — ${Math.round(p1Time)} ms (Player2: 未反応)`;
    } else {
      // Player2 のみ反応
      p2Score++;
      statusEl.textContent = `Player2 の勝ち — ${Math.round(p2Time)} ms (Player1: 未反応)`;
    }

    updateScores();
  // 結果が出たら背景を元に戻す
  try { body.style.backgroundColor = originalBg; } catch (e) { /* noop */ }
  }

  function clearTimers() {
    if (armTimeout) {
      clearTimeout(armTimeout);
      armTimeout = null;
    }
    if (finalizeTimeout) {
      clearTimeout(finalizeTimeout);
      finalizeTimeout = null;
    }
  }

  // キーハンドラ
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') {
      // If intro is visible, hide it first
      if (introVisible) {
        hideIntro();
        e.preventDefault();
        return;
      }
      // Space: ラウンド開始（idle または finished のとき）
      if (state === 'idle' || state === 'finished') {
        startRound();
      }
      e.preventDefault();
      return;
    }
    if (k === 'a') {
      // Player1
      if (state === 'armed') {
        onFoul('p1');
      } else {
        recordReaction('p1');
      }
    } else if (k === 'l') {
      // Player2
      if (state === 'armed') {
        onFoul('p2');
      } else {
        recordReaction('p2');
      }
    }
  });

  restartBtn.addEventListener('click', () => {
    p1Score = 0;
    p2Score = 0;
    updateScores();
    clearTimers();
    state = 'idle';
    resetRoundUI();
    statusEl.textContent = 'スコアをリセットしました。Spaceでスタート';
  // リセット時も背景を元に戻す
  try { body.style.backgroundColor = originalBg; } catch (e) { /* noop */ }
  });

  // 初期表示
  updateScores();
  resetRoundUI();
  statusEl.textContent = 'Spaceでスタート — Player1: A ／ Player2: L';
})();
