import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';

// Navigation/back button (keeps existing behaviour)
function goBack() {
	if (window.parent && window.parent !== window) {
		window.parent.postMessage({ type: 'tkk:navigate', target: 'launcher' }, '*');
		return;
	}
	window.location.href = './index.html';
}

const backBtns = document.querySelectorAll('.back-btn');
backBtns.forEach(b => b.addEventListener('click', goBack));

// --- Basic Three.js setup ---
const container = document.getElementById('root');
container.style.width = '100%';
container.style.height = '100%';
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe6f0ff);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
// first-person camera angles
let yaw = 0; // horizontal angle
let pitch = 0; // vertical angle
// initial camera position will be set to player head in animate
// gameplay state and sensitivity (configured via pre-game UI)
let gameStarted = false;
let MOUSE_SENS = 0.0025; // default; updated from settings overlay

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);
// hide cursor when over canvas
renderer.domElement.style.cursor = 'none';
// crosshair control (show only when pointer is locked)
const crosshairEl = document.getElementById('crosshair');
if (crosshairEl) crosshairEl.style.display = 'none';
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);

// --- Player ---
const PLAYER_SIZE = { x: 1, y: 2, z: 1 };
const playerGeo = new THREE.BoxGeometry(PLAYER_SIZE.x, PLAYER_SIZE.y, PLAYER_SIZE.z);
const playerMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
const playerMesh = new THREE.Mesh(playerGeo, playerMat);
scene.add(playerMesh);
// hide mesh in first-person so it doesn't occlude view
playerMesh.visible = false;

const player = {
	mesh: playerMesh,
	pos: new THREE.Vector3(0, 3, 0),
	vel: new THREE.Vector3(0, 0, 0),
	speed: 6,
	jumpSpeed: 12,
	onGround: false,
};
player.mesh.position.copy(player.pos);

// initialize camera at player's head
camera.position.copy(player.pos).add(new THREE.Vector3(0, PLAYER_SIZE.y * 0.9, 0));
camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

// --- Platforms ---
const platforms = [];
const PLATFORM_THICKNESS = 1.0; // platform height along Y (top stays at given y)
// vertical spacing tuning
const VERT_UP_SCALE = 1.8;   // scale for upward step size (>0)
const VERT_DOWN_SCALE = 0.7; // scale for downward step size (<0), keep small
const MAX_DY = 2.2;          // cap per-step vertical increase to remain reachable
// horizontal spacing & bounds
const MIN_STEP_DIST = 6.9;    // 50% increase from 4.6 to widen minimum spacing
const MAX_STEP_DIST = 7.5;    // previous ~3.4
const BOUNDS_X = 60;          // expand playable area
const BOUNDS_Z = 40;
// minimal gap between platform edges to avoid overlap/penetration (XY footprint)
const MIN_EDGE_GAP = 0.6;
function makePlatform(x, y, z, w = 4, d = 2, color = 0x7b8a8b) {
	const geo = new THREE.BoxGeometry(w, PLATFORM_THICKNESS, d);
	const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 });
	const m = new THREE.Mesh(geo, mat);
	// place so that the top face is at y
	m.position.set(x, y - PLATFORM_THICKNESS / 2, z);
	scene.add(m);
	platforms.push({ mesh: m, w: w, d: d, y: y });
}
// one-by-one generation state
let genState = null;
// shown once when the player reaches the highest platform
let congratsShown = false;
// --- Time Attack state ---
let taRunning = false;      // timer counting now
let taFinished = false;     // finished by reaching highest platform
let taStartTime = 0;        // performance.now()
let taElapsedMs = 0;        // last computed elapsed
let taBestMs = null;        // best record in ms
try {
	const saved = localStorage.getItem('game6_bestTimeMs');
	if (saved !== null) taBestMs = Number(saved);
} catch (_) {}
function initGenState() {
	genState = {
		x: 0,
		y: 1.2,
		z: 0,
		dir: Math.random() * Math.PI * 2,
		i: 0
	};
}
function generatePlatforms() {
	// clear existing
	platforms.forEach(p => scene.remove(p.mesh));
	platforms.length = 0;
	// starting ground (wider)
	makePlatform(0, 0, 0, 60, 60, 0xbcd7ff);
	// mark first platform as ground so it doesn't block overlap checks
	if (platforms[0]) platforms[0].isGround = true;
	// initialize generator; do not add course platforms yet
	initGenState();
	// generate a full course with variability
	bulkGenerate(140);
	// After generation, snap the lowest platform so its bottom touches the floor
	snapLowestPlatformToFloor();
	// reset congrats message state
	congratsShown = false;
	hideCongratsUI();
	// do not auto-start timer here; timer starts when game starts or on manual restart
}

function addNextPlatform() {
	if (!genState) initGenState();
	const s = genState;
	// helper to check overlap against existing platforms
	const overlapsCandidate = (cx, cz, w, d) => {
		const halfX = w / 2, halfZ = d / 2;
		for (const plat of platforms) {
			// ignore ground plane for overlap purposes
			if (plat.isGround) continue;
			// use top-down AABB with margin
			const px = plat.mesh.position.x;
			const pz = plat.mesh.position.z;
			const pHalfX = plat.w / 2;
			const pHalfZ = plat.d / 2;
			const gapX = Math.abs(cx - px) - (halfX + pHalfX);
			const gapZ = Math.abs(cz - pz) - (halfZ + pHalfZ);
			if (gapX < MIN_EDGE_GAP && gapZ < MIN_EDGE_GAP) return true;
		}
		return false;
	};

	// propose up to N candidates to avoid overlaps
	let placed = false;
	const MAX_TRIES = 48;
	let candX = s.x, candZ = s.z, candY = s.y, candW = 3, candD = 2;
	let dir = s.dir;
	for (let attempt = 0; attempt < MAX_TRIES && !placed; attempt++) {
		// occasionally turn more, otherwise small jitter
		const turn = (Math.random() < 0.25) ? (Math.random() * 1.2 - 0.6) : (Math.random() * 0.6 - 0.3);
		dir += turn;
		let step = MIN_STEP_DIST + Math.random() * (MAX_STEP_DIST - MIN_STEP_DIST);
		let dx = Math.cos(dir) * step;
		let dz = Math.sin(dir) * step;
		// vertical
		let rawDy = -0.4 + Math.random() * 1.6;
		if (Math.random() < 0.15) rawDy = -0.3 + Math.random() * 0.2;
		let dy = rawDy >= 0 ? rawDy * VERT_UP_SCALE : rawDy * VERT_DOWN_SCALE;
		if (dy > MAX_DY) dy = MAX_DY;
		if (dy > 1.6) { step *= 0.85; dx = Math.cos(dir) * step; dz = Math.sin(dir) * step; }
		candX = Math.max(-BOUNDS_X, Math.min(BOUNDS_X, s.x + dx));
		candZ = Math.max(-BOUNDS_Z, Math.min(BOUNDS_Z, s.z + dz));
		candY = s.y + dy;
		// size
		if ((s.i + 1) % 7 === 0) {
			candW = 8 + Math.random() * 6;
			candD = 4 + Math.random() * 4;
		} else {
			candW = 2.6 + Math.random() * 4.2;
			candD = 1.8 + Math.random() * 3.2;
		}
		if (!overlapsCandidate(candX, candZ, candW, candD)) {
			placed = true;
			s.dir = dir;
			break;
		}
		// slight extra turn for next try
		dir += (Math.random() * 0.8 - 0.4);
	}
	// fallback: perform radial search for a non-overlapping spot; if none, skip adding
	if (!placed) {
		const baseStep = MIN_STEP_DIST + (MAX_STEP_DIST - MIN_STEP_DIST) * 0.5;
		const radii = [1.0, 1.2, 1.5, 1.8, 2.2];
		for (let r of radii) {
			const stepsAng = 16;
			for (let k = 0; k < stepsAng && !placed; k++) {
				const ang = dir + (k * (Math.PI * 2 / stepsAng));
				const rx = Math.cos(ang) * baseStep * r;
				const rz = Math.sin(ang) * baseStep * r;
				const tx = Math.max(-BOUNDS_X, Math.min(BOUNDS_X, s.x + rx));
				const tz = Math.max(-BOUNDS_Z, Math.min(BOUNDS_Z, s.z + rz));
				if (!overlapsCandidate(tx, tz, candW, candD)) {
					candX = tx; candZ = tz; placed = true; break;
				}
			}
			if (placed) break;
		}
		if (!placed) return; // give up this step to guarantee no overlap
	}
	// color palette for variety
	const PAL = [0x8b5cf6, 0x10b981, 0xf59e0b, 0x3b82f6, 0xef4444, 0x22c55e, 0x14b8a6, 0xf97316, 0x64748b, 0x4ade80];
	const color = PAL[s.i % PAL.length];
	makePlatform(candX, candY, candZ, candW, candD, color);
	s.x = candX; s.y = candY; s.z = candZ; s.i++;
}

// bulk generation helper
function bulkGenerate(count = 95) { // fewer platforms to avoid crowding now that spacing is larger
	for (let i = 0; i < count; i++) addNextPlatform();
}

generatePlatforms();
// prepare timer UI (best time display)
ensureTimerUI();

// Ensure the lowest non-floor platform touches the floor with its bottom face
function snapLowestPlatformToFloor() {
	if (platforms.length <= 1) return; // only ground exists
	const groundY = 0; // floor top
	// ignore index 0 (it's the floor we created first)
	const list = platforms.slice(1);
	// Prefer the lowest above-floor platform; otherwise pick the closest from below
	let above = list.filter(p => p.y >= groundY + 1e-3);
	let target;
	if (above.length > 0) {
		above.sort((a, b) => a.y - b.y);
		target = above[0];
	} else {
		list.sort((a, b) => b.y - a.y);
		target = list[0];
	}
	if (!target) return;
	// Place target so that its bottom sits on the floor: bottom = 0 => top = PLATFORM_THICKNESS
	target.y = PLATFORM_THICKNESS;
	// mesh is positioned by center; we store top as y, so set center = top - thickness/2
	target.mesh.position.y = target.y - PLATFORM_THICKNESS / 2;
}

// --- Controls ---
const keys = {};
let dashHeld = false; // Left Shift for dash
window.addEventListener('keydown', (e) => {
	const k = e.key.toLowerCase();
	keys[k] = true;
	if (e.code === 'ShiftLeft') dashHeld = true;
	// On movement keys, try to acquire pointer lock so rotation is always relative
	if (gameStarted && !isPointerLocked) {
		const moveKeys = ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
		if (moveKeys.includes(k)) {
			try { renderer.domElement.requestPointerLock(); } catch (_) {}
		}
	}
});
window.addEventListener('keyup', (e) => {
	keys[e.key.toLowerCase()] = false;
	if (e.code === 'ShiftLeft') dashHeld = false;
});
// Jump on space or up arrow
window.addEventListener('keydown', (e) => {
	if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp') {
		if (player.onGround) {
			player.vel.y = player.jumpSpeed;
			player.onGround = false;
		}
	}
	if (e.key === 't' || e.key === 'T') goBack();
	// add next platform (shortcut)
	if (e.key === 'n' || e.key === 'N') {
		addNextPlatform();
	}
	// reset course and player (shortcut)
	if (e.key === 'r' || e.key === 'R') {
		generatePlatforms();
		respawn();
		resetTimeAttack(true);
	}
});

// NOTE: click-to-jump is handled together with orbit controls below (click vs drag distinction)

// --- Pointer-lock based first-person look ---
let isPointerDown = false;
let isDragging = false;
let lastPointer = { x: 0, y: 0 };
let pointerDownTime = 0;
const DRAG_THRESHOLD = 6; // pixels
let isPointerLocked = false;

// pointer lock change handlers
document.addEventListener('pointerlockchange', () => {
	isPointerLocked = (document.pointerLockElement === renderer.domElement);
	if (crosshairEl) crosshairEl.style.display = isPointerLocked ? 'block' : 'none';
});
document.addEventListener('pointerlockerror', () => { isPointerLocked = false; });

renderer.domElement.addEventListener('pointerdown', (e) => {
	// ignore clicks before game start (overlay should block anyway)
	if (!gameStarted) return;
	// if not locked, request pointer lock on user gesture
	if (!isPointerLocked) {
		try { renderer.domElement.requestPointerLock(); } catch (err) {}
		return;
	}
	// when locked, use click for jump (space also works)
	isPointerDown = true;
	isDragging = false;
	pointerDownTime = performance.now();
});

renderer.domElement.addEventListener('pointerup', (e) => {
	// if it was a click (not a drag), treat as jump
	const clickDuration = performance.now() - pointerDownTime;
	if (!isDragging && clickDuration < 400) {
		if (player.onGround) {
			player.vel.y = player.jumpSpeed;
			player.onGround = false;
		}
	}
	isPointerDown = false;
	isDragging = false;
	// if pointer was locked, do not try to release pointer capture
});

// wheel unused in first-person; prevent default to avoid page scroll
renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });

// Note: all rotation is driven by pointer-lock relative movement below

// When pointer is locked, use movementX/movementY on document for relative look
document.addEventListener('mousemove', (e) => {
	if (!gameStarted || !isPointerLocked) return;
	// inverted controls preserved
	yaw -= e.movementX * MOUSE_SENS;
	pitch = Math.min(Math.max(-Math.PI / 2 + 0.05, pitch - e.movementY * MOUSE_SENS), Math.PI / 2 - 0.05);
});

// --- Game state ---
let maxHeight = player.pos.y;
player.ground = null; // current ground contact reference { plat, yTop }

function showCongratsUI(message) {
	let el = document.getElementById('congrats-msg');
	if (!el) {
		el = document.createElement('div');
		el.id = 'congrats-msg';
		el.style.position = 'fixed';
		el.style.inset = '0';
		el.style.display = 'flex';
		el.style.alignItems = 'center';
		el.style.justifyContent = 'center';
		el.style.pointerEvents = 'none';
		el.style.fontSize = '64px';
		el.style.fontWeight = '900';
		el.style.color = '#ffffff';
		el.style.textShadow = '0 2px 8px rgba(0,0,0,0.6)';
		el.style.opacity = '0';
		el.style.transition = 'opacity 400ms ease';
		el.style.whiteSpace = 'pre-line';
		document.body.appendChild(el);
	}
	el.textContent = message || 'おめでとう！';
	// fade in then out
	requestAnimationFrame(() => { el.style.opacity = '1'; });
	setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

function hideCongratsUI() {
	const el = document.getElementById('congrats-msg');
	if (el) el.style.opacity = '0';
}

function ensureTimerUI() {
	let wrap = document.getElementById('timer');
	if (!wrap) {
		wrap = document.createElement('div');
		wrap.id = 'timer';
		wrap.style.position = 'fixed';
		wrap.style.top = '10px';
		wrap.style.left = '10px';
		wrap.style.padding = '6px 10px';
		wrap.style.background = 'rgba(0,0,0,0.35)';
		wrap.style.borderRadius = '6px';
		wrap.style.color = '#fff';
		wrap.style.fontFamily = 'system-ui, sans-serif';
		wrap.style.fontWeight = '700';
		wrap.style.fontSize = '16px';
		wrap.style.pointerEvents = 'none';
		wrap.innerHTML = '<div>Time: <span id="timer-current">0.00</span>s</div><div style="opacity:.9">Best: <span id="timer-best">--</span>s</div>';
		document.body.appendChild(wrap);
	}
	// update best display once
	const bestEl = document.getElementById('timer-best');
	if (bestEl) bestEl.textContent = (taBestMs == null ? '--' : (taBestMs/1000).toFixed(2));
}

function resetTimeAttack(startNow) {
	ensureTimerUI();
	taFinished = false;
	taElapsedMs = 0;
	if (startNow) {
		taRunning = true;
		taStartTime = performance.now();
	} else {
		taRunning = false;
	}
	const curEl = document.getElementById('timer-current');
	if (curEl) curEl.textContent = '0.00';
}

function updateTimeAttackUI() {
	if (!taRunning || taFinished) return;
	const now = performance.now();
	taElapsedMs = now - taStartTime;
	const curEl = document.getElementById('timer-current');
	if (curEl) curEl.textContent = (taElapsedMs/1000).toFixed(2);
}

function finishTimeAttack() {
	if (!taRunning || taFinished) return null;
	taFinished = true;
	const now = performance.now();
	taElapsedMs = now - taStartTime;
	// best
	if (taBestMs == null || taElapsedMs < taBestMs) {
		taBestMs = taElapsedMs;
		try { localStorage.setItem('game6_bestTimeMs', String(taBestMs)); } catch (_) {}
		const bestEl = document.getElementById('timer-best');
		if (bestEl) bestEl.textContent = (taBestMs/1000).toFixed(2);
	}
	return taElapsedMs / 1000;
}

// We'll do a simple collision test manually each frame using previous-frame Y
function checkCollisions() {
	const pHalfX = PLAYER_SIZE.x / 2;
	const pHalfZ = PLAYER_SIZE.z / 2;
	let bestPlat = null;
	let bestTop = -Infinity;
	const playerBottom = player.pos.y - PLAYER_SIZE.y / 2;
	const prevY = (typeof player.prevY === 'number' ? player.prevY : player.pos.y);
	const prevBottom = prevY - PLAYER_SIZE.y / 2;
	const prevX = player.prevPos ? player.prevPos.x : player.pos.x;
	const prevZ = player.prevPos ? player.prevPos.z : player.pos.z;
	const EPS = 0.25; // generous tolerance to avoid tunneling

	for (let plat of platforms) {
		const p = plat.mesh.position;
		const halfPlatX = plat.w / 2;
		const halfPlatZ = plat.d / 2;
		const platTop = plat.y; // stored as top (y of top surface)

		// downward crossing check with interpolation along y
		const denom = (prevBottom - playerBottom);
		let crossed = false;
		let ix = player.pos.x;
		let iz = player.pos.z;
		if (denom > 1e-6 && prevBottom >= platTop - EPS && playerBottom <= platTop + EPS) {
			const t = (prevBottom - platTop) / denom; // 0..1
			const clampedT = Math.min(1, Math.max(0, t));
			ix = prevX + (player.pos.x - prevX) * clampedT;
			iz = prevZ + (player.pos.z - prevZ) * clampedT;
			crossed = true;
		}

		// also allow gentle near-top landings (low fall speed)
		const nearTop = (playerBottom <= platTop + EPS && playerBottom >= platTop - 0.35 && player.vel.y <= 8 && prevBottom > platTop - 0.25);

		// horizontal overlap at the intersection (or current if nearTop)
		const cx = nearTop ? player.pos.x : ix;
		const cz = nearTop ? player.pos.z : iz;
	const withinX = Math.abs(cx - p.x) <= (pHalfX + halfPlatX + 0.05);
	const withinZ = Math.abs(cz - p.z) <= (pHalfZ + halfPlatZ + 0.05);

		if ((crossed || nearTop) && withinX && withinZ) {
			if (platTop > bestTop) { bestTop = platTop; bestPlat = plat; }
		}
	}

	if (bestPlat) {
		player.pos.y = bestTop + PLAYER_SIZE.y / 2;
		player.vel.y = 0;
		player.onGround = true;
		player.ground = { plat: bestPlat, yTop: bestTop };
		// Show congrats if we landed on the highest non-ground platform
		if (!congratsShown && bestPlat && !bestPlat.isGround) {
			let highestY = -Infinity;
			for (const p of platforms) {
				if (p.isGround) continue;
				if (p.y > highestY) highestY = p.y;
			}
			if (bestPlat.y >= highestY - 1e-6) {
				congratsShown = true;
				showCongratsUI();
			}
		}
	} else {
		// sticky ground: if we were grounded and still very near the same top, keep contact
		if (player.ground && player.vel.y <= 2) {
			const gp = player.ground.plat.mesh.position;
			const gy = player.ground.yTop;
			const halfPlatX = player.ground.plat.w / 2;
			const halfPlatZ = player.ground.plat.d / 2;
			const withinX = Math.abs(player.pos.x - gp.x) <= (pHalfX + halfPlatX + 0.05);
			const withinZ = Math.abs(player.pos.z - gp.z) <= (pHalfZ + halfPlatZ + 0.05);
			const bottom = player.pos.y - PLAYER_SIZE.y / 2;
			if (withinX && withinZ && bottom <= gy + 0.08 && bottom >= gy - 0.25) {
				player.pos.y = gy + PLAYER_SIZE.y / 2;
				player.vel.y = 0;
				player.onGround = true;
				return;
			}
		}
		player.onGround = false;
		if (!player.onGround) player.ground = null;

		// Virtual infinite ground at y=0 so you can jump even off the visible gray floor
		const playerBottomNow = player.pos.y - PLAYER_SIZE.y / 2;
		const prevBottomNow = prevY - PLAYER_SIZE.y / 2;
		const groundY = 0;
		if (prevBottomNow >= groundY - 0.05 && playerBottomNow <= groundY + 0.05 && player.vel.y <= 0) {
			player.pos.y = groundY + PLAYER_SIZE.y / 2;
			player.vel.y = 0;
			player.onGround = true;
			player.ground = { plat: null, yTop: groundY };
		}
	}
}

// --- Game loop ---
let last = performance.now();
function animate(t) {
	const dt = Math.min((t - last) / 1000, 0.05);
	last = t;
	// Pause simulation until the game starts (showing background scene/menu)
	if (!gameStarted) {
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
		return;
	}
	// previous position will be updated inside physics sub-steps
	// input
	let moveX = 0;
	let moveZ = 0;
	if (keys['a'] || keys['arrowleft']) moveX -= 1;
	if (keys['d'] || keys['arrowright']) moveX += 1;
	if (keys['w'] || keys['arrowup']) moveZ -= 1;
	if (keys['s'] || keys['arrowdown']) moveZ += 1;

	// apply horizontal movement relative to view (first-person)
	const localMove = new THREE.Vector3(moveX, 0, moveZ); // note: moveZ is -1 when forward
	if (localMove.lengthSq() > 0) localMove.normalize();
	// rotate local move by yaw around Y
	localMove.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
	const dashMul = dashHeld ? 1.8 : 1.0;
	const targetVelX = localMove.x * player.speed * dashMul;
	const targetVelZ = localMove.z * player.speed * dashMul;
	// lerp for smoothness
	player.vel.x += (targetVelX - player.vel.x) * Math.min(10 * dt, 1);
	player.vel.z += (targetVelZ - player.vel.z) * Math.min(10 * dt, 1);

	// physics sub-stepping for robust collisions
	physicsStep(dt);

	// simple floor: if fall too low, reset to start
	if (player.pos.y < -20) {
		respawn();
	}
	// update meshes
	player.mesh.position.copy(player.pos);

	// first-person camera: position at player's head and orient by yaw/pitch
	const headOffset = new THREE.Vector3(0, PLAYER_SIZE.y * 0.9, 0);
	const headPos = new THREE.Vector3().copy(player.pos).add(headOffset);
	// smooth position to avoid jitter
	camera.position.x += (headPos.x - camera.position.x) * 0.4;
	camera.position.y += (headPos.y - camera.position.y) * 0.4;
	camera.position.z += (headPos.z - camera.position.z) * 0.4;
	// apply rotation from pitch (x) and yaw (y)
	const e = new THREE.Euler(pitch, yaw, 0, 'YXZ');
	camera.quaternion.setFromEuler(e);

	// update UI height (max height achieved)
	if (player.pos.y > maxHeight) maxHeight = player.pos.y;
	const heightEl = document.getElementById('height');
	if (heightEl) heightEl.textContent = 'Height: ' + Math.max(0, Math.floor(maxHeight));
	// update time attack UI
	updateTimeAttackUI();
	renderer.render(scene, camera);
	requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// --- Helpers ---
function physicsStep(dt) {
	const GRAV = -30;
	const MAX_FALL = -40;
	// dynamic substeps based on vertical speed and dt
	const estTravel = Math.abs(player.vel.y) * dt;
	const stepSize = 0.3; // keep vertical travel per substep smaller
	const byTravel = Math.ceil(estTravel / stepSize);
	const byTime = Math.ceil(dt / 0.012); // ensure small time steps (~83Hz)
	const steps = Math.max(1, Math.min(10, Math.max(byTravel, byTime)));
	for (let i = 0; i < steps; i++) {
		const h = dt / steps;
		// gravity per substep
		player.vel.y += GRAV * h;
		if (player.vel.y < MAX_FALL) player.vel.y = MAX_FALL;
		// store previous for swept test
		player.prevY = player.pos.y;
		player.prevPos = player.prevPos || new THREE.Vector3();
		player.prevPos.copy(player.pos);
		// integrate
		player.pos.addScaledVector(player.vel, h);
		// collide
		checkCollisions();
	}
}
function respawn() {
	player.pos.set(0, 3, 0);
	player.vel.set(0, 0, 0);
	maxHeight = player.pos.y;
	player.prevY = player.pos.y;
	player.prevPos = new THREE.Vector3().copy(player.pos);
}

// Restart button
const restartBtn = document.getElementById('restart');
if (restartBtn) restartBtn.addEventListener('click', () => {
	generatePlatforms();
	respawn();
	resetTimeAttack(true);
});

// Next platform button
const nextBtn = document.getElementById('next-platform');
if (nextBtn) nextBtn.addEventListener('click', () => {
	addNextPlatform();
});

// resize handling
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// fullscreen toggle (keeps existing behaviour if present)
const fsBtns = document.querySelectorAll('.fullscreen-toggle');
fsBtns.forEach(btn => {
	btn.addEventListener('click', () => {
		const target = container || document.body;
		if (!document.fullscreenElement) {
			(target.requestFullscreen || target.webkitRequestFullscreen).call(target);
		} else {
			(document.exitFullscreen || document.webkitExitFullscreen).call(document);
		}
	});
});

// expose for debugging
window.__TKK_game = { player, platforms, scene };

// --- Settings overlay wiring ---
const overlay = document.getElementById('settings-overlay');
const sensRange = document.getElementById('sens-range');
const sensValue = document.getElementById('sens-value');
const startBtn = document.getElementById('start-game');
const cancelBtn = document.getElementById('cancel-to-launcher');
if (sensRange && sensValue) {
	const v = Number(sensRange.value);
	if (!Number.isNaN(v)) {
		MOUSE_SENS = v;
		sensValue.textContent = v.toFixed(4);
	}
	sensRange.addEventListener('input', () => {
		const nv = Number(sensRange.value);
		if (!Number.isNaN(nv)) {
			MOUSE_SENS = nv;
			sensValue.textContent = nv.toFixed(4);
		}
	});
}

if (startBtn && overlay) {
	startBtn.addEventListener('click', () => {
		gameStarted = true;
		overlay.style.display = 'none';
		// Request pointer lock immediately for smoother start
		try { renderer.domElement.requestPointerLock(); } catch (_) {}
		renderer.domElement.focus?.();
		resetTimeAttack(true);
	});
}
if (cancelBtn) {
	cancelBtn.addEventListener('click', goBack);
}
