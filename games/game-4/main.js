// シンボル定義：assets 内の SVG パス
const SYMBOLS = [
	'assets/plum.svg',
	'assets/bar.svg',
	'assets/orange.svg',
	'assets/seven.svg',
	'assets/watermelon.svg',
	'assets/bell.svg',
	'assets/cherry.svg'
];

const coinCountEl = document.getElementById('coin-count');
const messageEl = document.getElementById('message');
const spinBtn = document.getElementById('spin');
const betBtn = document.getElementById('bet-1');
const autoBtn = document.getElementById('auto');

let coins = 100;
let bet = 1;
let spinning = false;

const reels = [document.getElementById('strip-0'), document.getElementById('strip-1'), document.getElementById('strip-2')];

// リールごとのコントローラ（外部から stop() を呼べる）
const reelControllers = [null, null, null];

function initReels(){
	reels.forEach((strip)=>{
		strip.innerHTML = '';
		// 10個分のシンボルを上下に並べる
			for(let i=0;i<12;i++){
				const s = document.createElement('div');
				s.className = 'symbol';
				const img = document.createElement('img');
				img.src = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
				img.alt = '';
				s.appendChild(img);
				strip.appendChild(s);
			}
	});
}

function updateCoins(){ coinCountEl.textContent = coins; }

function spin(){
	if(spinning) return;
	if(coins < bet){ messageEl.textContent = 'コインが足りません'; return; }
	coins -= bet; updateCoins(); messageEl.textContent = '';
	spinning = true;

	const results = [];
	// 各リールをステップ単位でスクロールするアニメーションにする
	reels.forEach((strip, idx)=>{
			const symbolEl = strip.querySelector('.symbol');
			const symbolHeight = symbolEl ? symbolEl.offsetHeight : 46;
			// controller を使って外部から停止できるようにする
			const controller = {};
			controller.steps = 20 + idx*8 + Math.floor(Math.random()*12); // 総ステップ数
			controller.stop = ()=>{ controller.steps = 0; };
			reelControllers[idx] = controller;
			const final = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
			results[idx] = undefined;

			function step(){
				if(controller.steps <= 0){
				// 最後に中央の位置に最終絵柄をセットして終了フローを呼ぶ
				// 中央インデックス
				const centerIdx = Math.floor(strip.children.length/2);
				const centerChild = strip.children[centerIdx];
				if(centerChild){
					const img = centerChild.querySelector('img');
					if(img) img.src = final; else { const nimg = document.createElement('img'); nimg.src = final; centerChild.appendChild(nimg); }
				}
				results[idx] = final;
				// 判定チェック
				if(results.filter(x=>x!==undefined).length === reels.length){
					spinning = false;
					const outcome = evaluate(results);
							if(outcome.payout>0){
								coins += outcome.payout;
								// 表示用にシンボル名を整形
								const name = outcome.name || '当たり';
								// ビッグウィン演出: 大当たり（3つ揃い）なら body に .big-win を付与
								if(outcome.bigWin){
									document.body.classList.add('big-win');
									// 3秒後に演出を解除
									setTimeout(()=> document.body.classList.remove('big-win'), 3000);
								}
								messageEl.textContent = `${name}！ +${outcome.payout} コイン`;
							} else {
								messageEl.textContent = 'はずれ';
							}
					updateCoins();
				}
				return;
			}
			// 1ステップ分上に移動
			strip.style.transition = 'transform 120ms linear';
			strip.style.transform = `translateY(-${symbolHeight}px)`;

			// 1ステップ移動後に先頭要素を末尾へ移動して transform をリセット
			const onTransEnd = ()=>{
				strip.removeEventListener('transitionend', onTransEnd);
				// move first child to end
				const first = strip.children[0];
				strip.appendChild(first);
				// リセット
				strip.style.transition = 'none';
				strip.style.transform = 'translateY(0)';
				// 次のステップへ
				controller.steps--;
				// ランダムに次の新しいシンボルを末尾に反映して見た目を変える
				const img = strip.children[strip.children.length-1].querySelector('img');
				if(img) img.src = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
				setTimeout(step, 20);
			};
			strip.addEventListener('transitionend', onTransEnd);
		};

		// kick off
		step();
	});
}



betBtn.addEventListener('click', ()=>{
	bet = Math.min(coins, bet+1);
	betBtn.textContent = `${bet} ベット`;
});

spinBtn.addEventListener('click', ()=>{ spin(); });

let autoCount = 0;
autoBtn.addEventListener('click', ()=>{
	if(spinning) return;
	autoCount = 5;
	autoBtn.disabled = true;
	const autoInterval = setInterval(()=>{
		if(autoCount<=0 || coins<bet){ clearInterval(autoInterval); autoBtn.disabled=false; return; }
		if(!spinning){ spin(); autoCount--; }
	}, 400);
});

// 初期化
updateCoins(); initReels();

function evaluate(results){
	// 新ルール:
	// - 判定対象は画面に見えている3x3（各リールの top/center/bottom のみ）
	// - 横方向の3つ（上段／中段／下段）のいずれかが同一であれば配当を与える
	// - 縦揃い、全9揃い、中央のみ以外の部分は無視する

	// normalize filename: remove query/hash and lowercase to avoid mismatches
	const filename = (p)=> {
		if(!p) return null;
		const base = p.split('/').pop();
		// strip query/hash
		const qIdx = base.indexOf('?');
		const hIdx = base.indexOf('#');
		let end = base.length;
		if(qIdx!==-1) end = Math.min(end, qIdx);
		if(hIdx!==-1) end = Math.min(end, hIdx);
		return base.slice(0,end).toLowerCase();
	};
	const DEBUG_EVAL = false; // true にすると visibleBasenames を console.debug 出力します

	// visibleGrid[col][row] = src (row: 0=top,1=center,2=bottom)
	const visibleGrid = [];
	for(let col=0; col<3; col++){
		const strip = document.getElementById(`strip-${col}`);
		if(!strip){ visibleGrid.push([null,null,null]); continue; }
		const children = Array.from(strip.children);
		const centerIdx = Math.floor(children.length/2);
		const top = children[centerIdx-1] ? (children[centerIdx-1].querySelector('img') || {}).src : null;
		const center = children[centerIdx] ? (children[centerIdx].querySelector('img') || {}).src : null;
		const bottom = children[centerIdx+1] ? (children[centerIdx+1].querySelector('img') || {}).src : null;
		visibleGrid.push([top, center, bottom]);
	}

	// 横の3行をそれぞれチェック（rowIndex 0..2）
	// 比較は src の文字列全体ではなくファイル名（basename）で行う
	const visibleBasenames = visibleGrid.map(col => col.map(src => src ? filename(src) : null));
	// デバッグ出力（ローカルでの確認用）
	if(DEBUG_EVAL) console.debug('visibleBasenames:', visibleBasenames);
	for(let row=0; row<3; row++){
		const a = visibleBasenames[0][row];
		const b = visibleBasenames[1][row];
		const c = visibleBasenames[2][row];
		if(a && b && c && a === b && b === c){
			// 七の横3揃いは大当たり
			if(a === 'seven.svg') return { payout: bet * 200, name: `横${row+1}段 大当たり(7!)`, bigWin: true };
			// 一般の横3揃い
			return { payout: bet * 30, name: `横${row+1}段 ${a.replace('.svg','')} 揃い`, bigWin: true };
		}
	}

	// 2つ揃いや縦揃いは無視する（仕様により）。
	return { payout: 0 };
}

// 開発者判定ヘルパー（最上段から3行: 0,1,2）
function devComputeRowsSnapshot(){
    const strips = Array.from(document.querySelectorAll('.strip'));
    const rows = { top: [], mid: [], bottom: [] };
    const getId = (sym) => {
        if(!sym) return '';
        const img = sym.querySelector('img');
        return img ? img.src.split('/').pop() : sym.textContent.trim();
    };
    strips.forEach((strip, reelIndex) => {
        const symbols = Array.from(strip.querySelectorAll('.symbol'));
        if(symbols.length < 3){
            rows.top[reelIndex] = { idx: 0, id: '' };
            rows.mid[reelIndex] = { idx: 1, id: '' };
            rows.bottom[reelIndex] = { idx: 2, id: '' };
            return;
        }
        rows.top[reelIndex] = { idx: 0, id: getId(symbols[0]) };
        rows.mid[reelIndex] = { idx: 1, id: getId(symbols[1]) };
        rows.bottom[reelIndex] = { idx: 2, id: getId(symbols[2]) };
    });
    return rows;
}
function devComputeWinnersFromRows(rows){
    const idsTop = rows.top.map(r => r.id);
    const idsMid = rows.mid.map(r => r.id);
    const idsBottom = rows.bottom.map(r => r.id);
    const allSame = (ids) => ids.length && ids.every(x => x && x === ids[0]);
    const winners = [];
    if(allSame(idsTop)) winners.push({ row: 'top', id: idsTop[0] });
    if(allSame(idsMid)) winners.push({ row: 'mid', id: idsMid[0] });
    if(allSame(idsBottom)) winners.push({ row: 'bottom', id: idsBottom[0] });
    return winners;
}
function devOutcomeFromWinners(winners, bet){
    if(!winners || winners.length === 0) return { payout: 0 };
    // 優先: 中段 > 上段 > 下段（任意の定義）。複数同時は最初のみ配当。
    const priority = { mid: 1, top: 2, bottom: 3 };
    winners.sort((a,b)=> priority[a.row]-priority[b.row]);
    const w = winners[0];
    const label = { top: '上', mid: '中', bottom: '下' }[w.row];
    const isSeven = w.id && w.id.toLowerCase() === 'seven.svg';
    if(isSeven) return { payout: bet * 200, name: `${label}段 大当たり(7!)`, bigWin: true };
    return { payout: bet * 30, name: `${label}段 ${String(w.id).replace('.svg','')} 揃い`, bigWin: true };
}

(function(){
	// 次に止めるリールの0ベースインデックス（左が0）
	let nextStopIndex = 0;

	function stopReelByIndex(i){
		// 1) reelControllers があればそれを使って停止
		if (reelControllers[i] && typeof reelControllers[i].stop === 'function'){
			reelControllers[i].stop();
			return true;
		}
		// 2) グローバルな stopReel(index) があれば呼ぶ
		if (typeof window.stopReel === 'function'){
			window.stopReel(i);
			return true;
		}
		// 3) reels 配列オブジェクト（.stop() を持つ）を想定
		if (window.reels && window.reels[i] && typeof window.reels[i].stop === 'function'){
			window.reels[i].stop();
			return true;
		}
		// 4) DOM の .reel / .slot-reel 要素を一時停止する（CSS アニメーション対応）
		const domReels = document.querySelectorAll('.reel, .slot-reel');
		if (domReels[i]){
			const el = domReels[i];
			// CSS アニメーションを一時停止
			el.style.animationPlayState = 'paused';
			// transform で回転している場合は現在値で固定
			const st = getComputedStyle(el);
			if (st && st.transform && st.transform !== 'none'){
				el.style.transform = st.transform;
			}
			el.dataset.stopped = 'true';
			return true;
		}
		return false;
	}

	window.addEventListener('keydown', (e) => {
		if (e.code === 'Space' || e.keyCode === 32){
			e.preventDefault();
			if (nextStopIndex >= 3) return; // 3 リール想定
			const ok = stopReelByIndex(nextStopIndex);
			if (ok) nextStopIndex++;
		}
	});

	// 新しいスピン開始時に nextStopIndex をリセットする試み
	if (typeof window.spin === 'function'){
		const originalSpin = window.spin;
		window.spin = function(...args){
			nextStopIndex = 0;
			// spin 開始時に既存の controllers をクリア
			for(let i=0;i<reelControllers.length;i++) reelControllers[i] = null;
			return originalSpin.apply(this, args);
		};
	} else {
		const startBtn = document.querySelector('#spin, .spin-button, #start');
		if (startBtn) startBtn.addEventListener('click', ()=> nextStopIndex = 0);
	}
})();

/* --- 開発者モードの追加 --- */
(function(){
    const KEY = 'k';
    const devPanel = document.getElementById('dev-panel');
    const devReels = document.getElementById('dev-reels');
    const devMessage = document.getElementById('dev-message');
    const playerMessageEl = document.getElementById('message');

    let devVisible = false;
    let updateTimer = null;

    function renderDevVisualization(rows){
        // 可視化は devVisible のときのみ
        if(!devVisible){
            devReels.innerHTML = '';
            devMessage.textContent = '';
            return;
        }
        devReels.innerHTML = '';
        devMessage.textContent = '';
        const strips = Array.from(document.querySelectorAll('.strip'));
        strips.forEach((strip, reelIndex) => {
            const symbols = Array.from(strip.querySelectorAll('.symbol'));
            const devStrip = document.createElement('div');
            devStrip.className = 'dev-strip';
            symbols.forEach((sym, idx) => {
                const ds = document.createElement('div');
                ds.className = 'dev-symbol';
                if(idx === 0 || idx === 1 || idx === 2){
                    ds.classList.add('highlight');
                    if(idx === 1){ ds.style.boxShadow = 'inset 0 0 0 2px rgba(255,255,255,0.16)'; }
                    const badge = document.createElement('span');
                    badge.style.display = 'inline-block';
                    badge.style.marginLeft = '6px';
                    badge.style.fontSize = '10px';
                    badge.style.color = '#bfeecd';
                    badge.textContent = idx === 0 ? '上' : (idx === 1 ? '中' : '下');
                    ds.appendChild(badge);
                }
                const img = sym.querySelector('img');
                if(img){
                    const im = document.createElement('img');
                    im.src = img.src; im.alt = img.alt || '';
                    ds.appendChild(im);
                } else {
                    ds.textContent = sym.textContent.trim();
                }
                devStrip.appendChild(ds);
            });
            const wrapper = document.createElement('div');
            wrapper.style.textAlign = 'center';
            wrapper.style.fontSize = '11px';
            wrapper.style.marginBottom = '6px';
            wrapper.style.color = '#bfeecd';
            wrapper.textContent = `Reel ${reelIndex + 1}`;
            devStrip.insertBefore(wrapper, devStrip.firstChild);
            devReels.appendChild(devStrip);
        });
        const winners = devComputeWinnersFromRows(rows);
        if(winners.length){
            const rowLabel = { top: '上', mid: '中', bottom: '下' };
            const text = winners.map(w => `${rowLabel[w.row]}段 そろった: ${w.id}`).join(' / ');
            devMessage.textContent = text;
        }
    }

    function updateDevLogic(){
        // 常時スナップショットを取り、判定はここで算出
        const rows = devComputeRowsSnapshot();
        renderDevVisualization(rows);
        return devComputeWinnersFromRows(rows);
    }

    function startAutoUpdate(){
        if(updateTimer) return;
        updateTimer = setInterval(() => { updateDevLogic(); }, 200);
    }

    function stopAutoUpdate(){
        if(updateTimer){ clearInterval(updateTimer); updateTimer = null; }
    }

    function toggleDev(){
        devVisible = !devVisible;
        devPanel.classList.toggle('visible', devVisible);
        devPanel.setAttribute('aria-hidden', (!devVisible).toString());
        // ロジックは常時稼働、可視化のみ切り替え
        renderDevVisualization(devComputeRowsSnapshot());
    }

    window.addEventListener('keydown', (e) => {
        const tag = document.activeElement && document.activeElement.tagName.toLowerCase();
        if(tag === 'input' || tag === 'textarea' || document.activeElement && document.activeElement.isContentEditable) return;
        if(e.key && e.key.toLowerCase() === KEY){ toggleDev(); }
    });

    document.querySelectorAll('.strip').forEach(s => {
        s.addEventListener('transitionend', () => { updateDevLogic(); });
    });

    // 常時開始
    startAutoUpdate();

    // スピン終了時に開発者判定を使って配当とプレイヤー表示へ反映
    const originalEvaluate = typeof evaluate === 'function' ? evaluate : null;
    // フック: spin 完了部で呼ばれる evaluate の代わりに dev 判定を適用するヘルパー
    window.devApplyOutcome = function(currentBet){
        const winners = updateDevLogic();
        const outcome = devOutcomeFromWinners(winners, currentBet);
        if(outcome.payout > 0){
            // 既存演出を尊重
            if(outcome.bigWin){ document.body.classList.add('big-win'); setTimeout(()=> document.body.classList.remove('big-win'), 3000); }
            const name = outcome.name || '当たり';
            playerMessageEl.textContent = `${name}！ +${outcome.payout} コイン`;
        } else {
            playerMessageEl.textContent = 'はずれ';
        }
        return outcome;
    };
})();

