// Improved Tetris implementation for better visibility
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const cols = 10;
const rows = 20;
const scale = Math.floor(canvas.width / cols);
canvas.width = cols * scale;
canvas.height = rows * scale;
ctx.imageSmoothingEnabled = false;

const nextCanvas = document.getElementById('next');
const nctx = nextCanvas.getContext('2d');
const nScale = Math.floor(nextCanvas.width / 4);

function createMatrix(w, h) {
	const m = [];
	while (h--) m.push(new Array(w).fill(0));
	return m;
}

const arena = createMatrix(cols, rows);

const pieces = {
	I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
	J: [[2,0,0],[2,2,2],[0,0,0]],
	L: [[0,0,3],[3,3,3],[0,0,0]],
	O: [[4,4],[4,4]],
	S: [[0,5,5],[5,5,0],[0,0,0]],
	T: [[0,6,0],[6,6,6],[0,0,0]],
	Z: [[7,7,0],[0,7,7],[0,0,0]],
};

const colors = [null,'#06b6d4','#1e40af','#fb923c','#f59e0b','#ef4444','#7c3aed','#06b6d4'];

function drawMatrix(matrix, offset) {
	matrix.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value) {
				ctx.fillStyle = colors[value];
				ctx.fillRect((x + offset.x) * scale, (y + offset.y) * scale, scale, scale);
				ctx.strokeStyle = '#07121a'; ctx.lineWidth = 2; ctx.strokeRect((x + offset.x) * scale + 1, (y + offset.y) * scale + 1, scale - 2, scale - 2);
			}
		});
	});
}

function merge(arena, player) {
	player.matrix.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value) arena[y + player.pos.y][x + player.pos.x] = value;
		});
	});
}

function collide(arena, player) {
	const m = player.matrix;
	for (let y = 0; y < m.length; ++y) {
		for (let x = 0; x < m[y].length; ++x) {
			if (m[y][x] && (arena[y + player.pos.y] && arena[y + player.pos.y][x + player.pos.x]) !== 0) {
				return true;
			}
		}
	}
	return false;
}

function rotate(matrix, dir) {
	for (let y = 0; y < matrix.length; ++y) for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
	if (dir > 0) matrix.forEach(row => row.reverse()); else matrix.reverse();
}

function hexToRgba(hex, alpha){
	const r = parseInt(hex.slice(1,3),16); const g = parseInt(hex.slice(3,5),16); const b = parseInt(hex.slice(5,7),16);
	return `rgba(${r},${g},${b},${alpha})`;
}

function drawGhost(){
	let ghostY = player.pos.y;
	while (!collide(arena, { pos:{x:player.pos.x,y:ghostY+1}, matrix: player.matrix })) ghostY++;
	player.matrix.forEach((row,y) => row.forEach((val,x) => {
		if (val) {
			ctx.fillStyle = hexToRgba(colors[val], 0.18);
			ctx.fillRect((player.pos.x + x) * scale, (ghostY + y) * scale, scale, scale);
		}
	}));
}

function drawNext(){
	nctx.fillStyle = '#071018'; nctx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
	nctx.imageSmoothingEnabled = false;
	if (!nextPiece) return;
	const matrix = pieces[nextPiece];
	const offsetX = Math.floor((nextCanvas.width / nScale - matrix[0].length) / 2);
	const offsetY = Math.floor((nextCanvas.height / nScale - matrix.length) / 2);
	matrix.forEach((row,y) => row.forEach((val,x) => {
		if (val) {
			nctx.fillStyle = colors[val];
			nctx.fillRect((x + offsetX) * nScale, (y + offsetY) * nScale, nScale, nScale);
			nctx.strokeStyle = '#07121a'; nctx.lineWidth = 2; nctx.strokeRect((x + offsetX) * nScale + 1, (y + offsetY) * nScale + 1, nScale-2, nScale-2);
		}
	}));
}

function draw() {
	ctx.fillStyle = '#071018'; ctx.fillRect(0,0,canvas.width,canvas.height);
	// grid
	ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
	for (let x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x * scale, 0); ctx.lineTo(x * scale, canvas.height); ctx.stroke(); }
	for (let y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * scale); ctx.lineTo(canvas.width, y * scale); ctx.stroke(); }
	drawMatrix(arena, {x:0,y:0});
	drawGhost();
	drawMatrix(player.matrix, player.pos);
	drawNext();
}

let lastTime = 0;
let dropCounter = 0;
let dropInterval = 1000;
let running = true;

function update(time = 0) {
	const deltaTime = time - lastTime;
	lastTime = time;
	if (!running) return;
	dropCounter += deltaTime;
	if (dropCounter > dropInterval) {
		player.pos.y++;
		if (collide(arena, player)) {
			player.pos.y--;
			merge(arena, player);
			arenaSweep();
			playerReset();
		}
		dropCounter = 0;
	}
	draw();
	document.getElementById('score').textContent = player.score;
	document.getElementById('level').textContent = Math.floor(player.score/100)+1;
	requestId = requestAnimationFrame(update);
}

function arenaSweep() {
	let rowCount = 1;
	outer: for (let y = arena.length - 1; y >= 0; --y) {
		for (let x = 0; x < arena[y].length; ++x) {
			if (!arena[y][x]) {
				continue outer;
			}
		}
		const row = arena.splice(y, 1)[0].fill(0);
		arena.unshift(row);
		++y;
		player.score += rowCount * 10;
		rowCount *= 2;
	}
}

const player = { pos: {x:0,y:0}, matrix: null, score:0 };
let nextPiece = null;

function playerReset() {
	const types = 'IJLOSTZ';
	if (!nextPiece) nextPiece = types[Math.floor(Math.random() * types.length)];
	const type = nextPiece;
	nextPiece = types[Math.floor(Math.random() * types.length)];
	player.matrix = pieces[type];
	player.pos.y = 0;
	player.pos.x = Math.floor((cols - player.matrix[0].length) / 2);
	document.getElementById('game-over').style.display = 'none';
	if (collide(arena, player)) {
		arena.forEach(row => row.fill(0));
		player.score = 0;
		document.getElementById('game-over').style.display = 'block';
		running = false;
	}
}

playerReset();

document.addEventListener('keydown', event => {
	if (!running) return;

	// allow player to press 't' to return to launcher (send message to parent)
	if (event.key === 't' || event.key === 'T') {
		if (window.parent && window.parent !== window) {
			window.parent.postMessage({ type: 'tkk:navigate', target: 'launcher' }, '*');
			return;
		}
		// fallback: navigate to index.html when opened standalone
		window.location.href = './index.html';
	}
	if (event.key === 'ArrowLeft') { player.pos.x--; if (collide(arena, player)) player.pos.x++; }
	else if (event.key === 'ArrowRight') { player.pos.x++; if (collide(arena, player)) player.pos.x--; }
	else if (event.key === 'ArrowDown') { player.pos.y++; if (collide(arena, player)) { player.pos.y--; merge(arena, player); arenaSweep(); playerReset(); } dropCounter = 0; }
	else if (event.key === 'x' || event.key === 'X') { rotate(player.matrix, 1); if (collide(arena, player)) rotate(player.matrix, -1); }
	else if (event.key === 'z' || event.key === 'Z') { rotate(player.matrix, -1); if (collide(arena, player)) rotate(player.matrix, 1); }
	else if (event.code === 'Space') { while(!collide(arena, player)) player.pos.y++; player.pos.y--; merge(arena, player); arenaSweep(); playerReset(); dropCounter = 0; }
});

document.getElementById('pause').addEventListener('click', () => { running = !running; const btn = document.getElementById('pause'); btn.textContent = running ? 'Pause' : 'Resume'; if (running) { lastTime = performance.now(); requestId = requestAnimationFrame(update); } });

document.getElementById('back').addEventListener('click', () => {
	if (window.parent && window.parent !== window) {
		window.parent.postMessage({ type: 'tkk:navigate', target: 'launcher' }, '*');
		return;
	}
	window.location.href = './index.html';
});

let requestId = requestAnimationFrame(update);
