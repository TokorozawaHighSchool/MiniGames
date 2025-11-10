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
		let steps = 20 + idx*8 + Math.floor(Math.random()*12); // 総ステップ数
		const final = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
		results[idx] = undefined;

		function step(){
			if(steps <= 0){
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
					const payout = evaluate(results);
					if(payout>0){ coins += payout; messageEl.textContent = `当たり! +${payout} コイン`; }
					else { messageEl.textContent = 'はずれ'; }
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
				steps--;
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

function evaluate(results){
	// シンプルな配当：3つ揃いは大当たり、2つ揃いは小当たり
	if(results[0] === results[1] && results[1] === results[2]){
		// 7は特別
		if(results[0] === '7️⃣') return bet * 100;
		return bet * 10;
	}
	// 2つ揃い
	if(results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) return bet * 2;
	return 0;
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

