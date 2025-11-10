// main.js - Forest FPS MVP (Three.js ESM)
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";

const { Scene, PerspectiveCamera, WebGLRenderer, Color, FogExp2, DirectionalLight, AmbientLight, PlaneGeometry, MeshLambertMaterial, Mesh, CylinderGeometry, MeshBasicMaterial, Matrix4, Vector3, InstancedMesh, Object3D, ShaderMaterial, DoubleSide, SphereGeometry, MeshStandardMaterial, Box3 } = THREE;

  // シーンとレンダラー
  const scene = new Scene();
  scene.background = new Color(0x87ceeb);
  scene.fog = new FogExp2(0x87ceeb, 0.0025);

  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 2, 10);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // ライト
  const dir = new DirectionalLight(0xffffff, 1.0);
  dir.position.set(50, 100, 50);
  dir.castShadow = true;
  dir.shadow.camera.left = -200; dir.shadow.camera.right = 200; dir.shadow.camera.top = 200; dir.shadow.camera.bottom = -200;
  dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 500;
  dir.shadow.mapSize.width = 2048; dir.shadow.mapSize.height = 2048;
  scene.add(dir);

  const amb = new AmbientLight(0xffffff, 0.4);
  scene.add(amb);

  // 簡易地形生成（平面をノイズで変形）
  const terrainSize = 400;
  const segments = 200;
  const planeGeo = new PlaneGeometry(terrainSize, terrainSize, segments, segments);
  planeGeo.rotateX(-Math.PI/2);

  // シード付き疑似ノイズ
  function pseudoNoise(x,y){
    const s = Math.sin(x*127.1 + y*311.7)*43758.5453;
    return (s - Math.floor(s));
  }
  function smoothNoise(x,y){
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = pseudoNoise(ix,iy), b = pseudoNoise(ix+1,iy), c = pseudoNoise(ix,iy+1), d = pseudoNoise(ix+1,iy+1);
    const ux = fx*fx*(3-2*fx);
    const uy = fy*fy*(3-2*fy);
    const v1 = a*(1-ux)+b*ux;
    const v2 = c*(1-ux)+d*ux;
    return v1*(1-uy)+v2*uy;
  }
  function fractalNoise(x,y,octaves,scale){
    let v=0, amp=1, freq=1, max=0;
    for(let i=0;i<octaves;i++){
      v += smoothNoise(x*freq/scale, y*freq/scale)*amp;
      max += amp; amp*=0.5; freq*=2;
    }
    return v/max;
  }

  const pos = planeGeo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const vx = pos.getX(i), vz = pos.getZ(i);
    const h = fractalNoise(vx*0.03, vz*0.03, 5, 1)*12; // 高さ調整
    pos.setY(i, h - 2); // ベースを少し下に
  }
  planeGeo.computeVertexNormals();
  const terrainMat = new MeshLambertMaterial({ color:0x556b2f });
  const terrain = new Mesh(planeGeo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // 地面用バウンディング
  const terrainBox = new Box3().setFromObject(terrain);

  // 木の生成パラメータ
  const treeCount = 120;
  const leavesPerTree = 30;

  // 幹のインスタンス
  const trunkGeo = new CylinderGeometry(0.15, 0.4, 4, 8);
  trunkGeo.translate(0,2,0);
  const trunkMat = new MeshStandardMaterial({ color: 0x6b4b3b });
  const trunkInst = new InstancedMesh(trunkGeo, trunkMat, treeCount);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;
  scene.add(trunkInst);

  // 葉のインスタンス（平面）
  const leafGeo = new PlaneGeometry(0.8,0.6);
  // カスタムシェーダで簡易トランスルーセント+揺れを実装
  const leafMat = new ShaderMaterial({
    uniforms: { time:{value:0}, lightDir:{value:dir.position.clone().normalize()} },
    vertexShader: `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main(){
        vNormal = normal;
        vPos = position;
        // 錯覚的な揺れ
        vec3 pos = position;
        float sway = sin(time*1.2 + position.x*3.0 + position.y*0.5) * 0.06;
        pos.x += sway * (1.0 - position.y*0.2);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 lightDir;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main(){
        float NdotL = dot(normalize(vNormal), normalize(lightDir));
        float back = clamp(1.0 - NdotL, 0.0, 1.0);
        vec3 col = mix(vec3(0.06,0.3,0.04), vec3(0.2,0.6,0.2), 0.6);
        // 擬似SSS: 背面光をわずかに乗せる
        col += back * 0.35 * vec3(0.9,0.6,0.35);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide
  });
  const leafInst = new InstancedMesh(leafGeo, leafMat, treeCount * leavesPerTree);
  leafInst.frustumCulled = true;
  leafInst.castShadow = false;
  scene.add(leafInst);

  // 木配置 - 地形の高さに合わせてランダム配置
  const dummy = new Object3D();
  let leafIndex = 0;
  for(let i=0;i<treeCount;i++){
    const tx = (Math.random()-0.5) * (terrainSize*0.9);
    const tz = (Math.random()-0.5) * (terrainSize*0.9);
    // 地形から高さをサンプリング（単純近傍探索）
    const localX = tx + terrainSize/2; const localZ = tz + terrainSize/2;
    // planeGeo のグリッドから近い頂点の高さを取得
    const ix = Math.floor(localX / terrainSize * segments);
    const iz = Math.floor(localZ / terrainSize * segments);
    const vi = Math.max(0, Math.min(segments, ix + iz*(segments+1)));
    const y = planeGeo.attributes.position.getY(vi) || 0;

    dummy.position.set(tx, y, tz);
    const s = 0.6 + Math.random()*0.8;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    // 葉をツリー頂上付近に配置
    const top = new Vector3(tx, y + 3.2 * s, tz);
    for(let l=0;l<leavesPerTree;l++){
      const ang = Math.random()*Math.PI*2;
      const radius = 0.2 + Math.random()*1.4;
      const lx = top.x + Math.cos(ang)*radius;
      const ly = top.y - (Math.random()*1.2);
      const lz = top.z + Math.sin(ang)*radius;
      const scale = 0.6 + Math.random()*0.9;
      dummy.position.set(lx, ly, lz);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      dummy.updateMatrix();
      leafInst.setMatrixAt(leafIndex++, dummy.matrix);
    }
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  leafInst.instanceMatrix.needsUpdate = true;

  // 簡易プレイヤー（カメラ操作） - PointerLock と WASD
  let pitch = 0, yaw = 0;
  const velocity = new Vector3(0,0,0);
  const move = { forward:false, back:false, left:false, right:false };
  const speed = 8.0; // m/s

  function onMouseMove(e){
    if(document.pointerLockElement !== document.body) return;
    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;
    yaw -= movementX * 0.002;
    pitch -= movementY * 0.002;
    pitch = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
  function onKey(e, down){
    const k = e.key.toLowerCase();
    if(k==='w') move.forward = down;
    if(k==='s') move.back = down;
    if(k==='a') move.left = down;
    if(k==='d') move.right = down;
  }
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', (e)=>onKey(e,true));
  window.addEventListener('keyup', (e)=>onKey(e,false));

  // ショット（レイキャスト）
  const raycaster = new THREE.Raycaster();
  window.addEventListener('click', (e)=>{
    if(document.pointerLockElement !== document.body) return;
    // レイをカメラから前方へ
    raycaster.setFromCamera(new Vector3(0,0), camera);
    const hits = raycaster.intersectObject(trunkInst, true);
    if(hits.length>0){
      const p = hits[0].point;
      const s = new SphereGeometry(0.06, 8, 8);
      const m = new Mesh(s, new MeshBasicMaterial({color:0xff0000}));
      m.position.copy(p);
      setTimeout(()=>{ scene.remove(m); }, 600);
      scene.add(m);
    }
  });

  // PointerLock ボタン
  const startBtn = document.getElementById('startBtn');
  startBtn.addEventListener('click', ()=>{
    document.body.requestPointerLock();
    startAudio();
    document.getElementById('overlay').style.display = 'none';
  });

  // オーディオ（風のノイズ合成と鳥の断続音）
  let audioStarted = false;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function createNoiseBuffer(duration){
    const rate = audioCtx.sampleRate;
    const buf = audioCtx.createBuffer(1, rate*duration, rate);
    const data = buf.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*0.4;
    return buf;
  }
  function startAudio(){
    if(audioStarted) return; audioStarted = true;
    // 風音
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(2.0);
    noise.loop = true;
    const lp = audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=600;
    const gain = audioCtx.createGain(); gain.gain.value = 0.12;
    noise.connect(lp); lp.connect(gain); gain.connect(audioCtx.destination);
    noise.start();
    // 鳥（単純な断続トーン群）
    function birdChirp(){
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type='triangle'; o.frequency.value = 1000 + Math.random()*1000;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      g.gain.linearRampToValueAtTime(0.08, t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.45+Math.random()*0.6);
      o.start(); o.stop(t+0.6+Math.random()*0.6);
    }
    setInterval(()=>{ if(Math.random()<0.6) birdChirp(); }, 800 + Math.random()*1600);
  }

  // アニメーションループ
  const clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    // 移動
    const forward = new Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new Vector3().crossVectors(new Vector3(0,1,0), forward).normalize();
    velocity.set(0,0,0);
    if(move.forward) velocity.add(forward);
    if(move.back) velocity.sub(forward);
    if(move.left) velocity.add(right);
    if(move.right) velocity.sub(right);
    if(velocity.length()>0) velocity.normalize().multiplyScalar(speed*dt);
    camera.position.add(velocity);
    // 地形に触れているかチェックしてYを補正
    const cx = camera.position.x, cz = camera.position.z;
    const lx = cx + terrainSize/2, lz = cz + terrainSize/2;
    const ix = Math.floor(lx / terrainSize * segments);
    const iz = Math.floor(lz / terrainSize * segments);
    const vi = Math.max(0, Math.min(segments, ix + iz*(segments+1)));
    const groundY = planeGeo.attributes.position.getY(vi) || -2;
    camera.position.y = Math.max(camera.position.y, groundY + 1.6);

    // 葉の時間更新
    leafMat.uniforms.time.value += dt;
    leafMat.uniforms.lightDir.value = dir.position.clone().normalize();

    renderer.render(scene, camera);
  }
  animate();

  // リサイズ
  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

