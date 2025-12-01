export function saveScore(key, score) {
  try {
    const existing = JSON.parse(localStorage.getItem('tkk_scores') || '{}');
    existing[key] = Math.max(existing[key] || 0, score);
    localStorage.setItem('tkk_scores', JSON.stringify(existing));
  } catch (e) {
    console.warn('saveScore failed', e);
  }
}

export function loadScores() {
  try {
    return JSON.parse(localStorage.getItem('tkk_scores') || '{}');
  } catch (e) {
    return {};
  }
}
