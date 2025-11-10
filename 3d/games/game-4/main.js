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
					const outcome = evaluate(results);
					if(outcome.payout>0){
						coins += outcome.payout;
						// 表示用にシンボル名を整形
						const name = outcome.name || '当たり';
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
	// results は各リールの最終的な img.src (パス) を含む想定
	// シンプルルール：
	// - 横3つ揃い: ベース配当 = bet * 20
	//   - 'seven.svg' の3つ揃いは特別で bet * 200
	// - 2つ揃い: bet * 3
	// 戻り値は { payout: number, name: string }

	const r0 = results[0];
	const r1 = results[1];
	const r2 = results[2];

	const filename = (p)=> p ? p.split('/').pop() : '';

	// 3つ揃い
	if(r0 === r1 && r1 === r2){
		const file = filename(r0);
		if(file === 'seven.svg') return { payout: bet * 200, name: '大当たり(7!)' };
		// 一般的な3つ揃い
		return { payout: bet * 20, name: `${file.replace('.svg','')} 揃い` };
	}

	// 2つ揃い
	if(r0 === r1 || r1 === r2 || r0 === r2){
		// どのシンボルが揃ったかを名前にする（優先順位: r1, r0, r2）
		const file = filename(r1) || filename(r0) || filename(r2);
		return { payout: bet * 3, name: `${file.replace('.svg','')} ダブル` };
	}

	return { payout: 0 };
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

