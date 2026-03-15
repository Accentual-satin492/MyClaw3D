import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

const AGENTS = [
  { id: "alpha", name: "Alpha", role: "Trader", color: 0x14f195, status: "working", tasks: 47, balance: 12.4 },
  { id: "bravo", name: "Bravo", role: "DeFi Strategist", color: 0x9945ff, status: "working", tasks: 32, balance: 8.7 },
  { id: "cipher", name: "Charlie", role: "Data Analyst", color: 0x00d1ff, status: "idle", tasks: 28, balance: 5.2 },
  { id: "delta", name: "Delta", role: "NFT Scout", color: 0xff6b6b, status: "idle", tasks: 19, balance: 3.1 },
  { id: "echo", name: "Echo", role: "Tx Executor", color: 0xffaa22, status: "working", tasks: 55, balance: 21.8 },
  { id: "flux", name: "Foxtrot", role: "Market Monitor", color: 0xff44aa, status: "idle", tasks: 41, balance: 6.9 },
];

const CHAT_RESPONSES = [
  "Copy that. Executing now.",
  "On it. Checking the orderbook...",
  "Roger. I'll have results in ~30s.",
  "Confirmed. Transaction submitted.",
  "Analyzing the data. Stand by.",
  "Market conditions look volatile. Proceeding with caution.",
  "Found 3 opportunities. Sending report.",
  "Done. TX hash: 5xK7m...9pQ2",
];

const ACTIVITY_TEMPLATES = [
  (a) => ({ hl: a.name, text: `scanned 12 new token launches` }),
  (a) => ({ hl: a.name, text: `executed swap: 0.5 SOL → USDC` }),
  (a) => ({ hl: a.name, text: `detected price anomaly on RAY/SOL` }),
  (a) => ({ hl: a.name, text: `updated portfolio allocation` }),
  (a) => ({ hl: a.name, text: `monitoring 3 active positions` }),
  (a) => ({ hl: a.name, text: `synced wallet: ${a.balance.toFixed(1)} SOL` }),
  (a) => ({ hl: a.name, text: `flagged suspicious on-chain transfer` }),
  (a) => ({ hl: a.name, text: `completed DCA order #${Math.floor(Math.random() * 100) + 1}` }),
];

function hexToCSS(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgb(${r},${g},${b})`;
}

function timeStr() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export default function ClawHQ() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const agentMeshesRef = useRef({});
  const agentTargetsRef = useRef({});
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const clockRef = useRef(null);
  const cameraStateRef = useRef({ angle: Math.PI / 4, pitch: 0.6, distance: 25, target: new THREE.Vector3(0, 0, 0) });
  const dragRef = useRef({ dragging: false, button: 0, prevX: 0, prevY: 0 });
  const frameRef = useRef(null);
  const labelContainerRef = useRef(null);
  const labelElemsRef = useRef({});
  const followAgentRef = useRef(null);

  const [activePanel, setActivePanel] = useState("tasks");
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agents, setAgents] = useState(AGENTS.map(a => ({ ...a })));
  const [tasks, setTasks] = useState([]);
  const [chatLog, setChatLog] = useState([
    { from: "Alpha", text: "All systems nominal. Jupiter routes loaded.", color: hexToCSS(0x14f195) },
    { from: "Echo", text: "Mainnet connection stable. Ready to execute.", color: hexToCSS(0xffaa22) },
    { from: "Cipher", text: "Market data feed active. Monitoring 47 pairs.", color: hexToCSS(0x00d1ff) },
  ]);
  const [activityLog, setActivityLog] = useState([
    { time: timeStr(), hl: "CLAW HQ", text: "initialized. 6 agents online." },
    { time: timeStr(), hl: "Echo", text: "connected to Solana mainnet-beta" },
    { time: timeStr(), hl: "Alpha", text: "loaded Jupiter aggregator routes" },
  ]);
  const [taskInput, setTaskInput] = useState("");
  const [taskAgent, setTaskAgent] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState("alpha");
  const [hqPanelOpen, setHqPanelOpen] = useState(false);
  const [hqTab, setHqTab] = useState("playbooks");
  const [chatHistories, setChatHistories] = useState(() => {
    const h = {};
    AGENTS.forEach(a => { h[a.id] = []; });
    return h;
  });

  const chatEndRef = useRef(null);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  // ===== THREE.JS SCENE SETUP =====
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);
    sceneRef.current = scene;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    const frustum = 12;

    const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, -100, 100);
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    scene.add(new THREE.AmbientLight(0x556677, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
    scene.add(new THREE.DirectionalLight(0x9945ff, 0.15).translateX(-10).translateY(10).translateZ(-10));

    const mat = (c, em = 0, ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: em, emissiveIntensity: ei });

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 14), mat(0xd4c5a0));
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const gm = mat(0xc4b590);
    for (let i = -8; i <= 8; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 14), gm); l.position.set(i, 0.01, 0); scene.add(l); }
    for (let i = -6; i <= 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(18, 0.01, 0.02), gm); l.position.set(0, 0.01, i); scene.add(l); }

    // Walls
    const wm = mat(0x888888);
    const wallH = 1.5;
    const bw = new THREE.Mesh(new THREE.BoxGeometry(18, wallH, 0.15), wm); bw.position.set(0, wallH / 2, -7); bw.castShadow = true; scene.add(bw);
    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm); lw.position.set(-9, wallH / 2, 0); lw.castShadow = true; scene.add(lw);
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm); rw.position.set(9, wallH / 2, 0); rw.castShadow = true; scene.add(rw);
    const fwl = new THREE.Mesh(new THREE.BoxGeometry(6, wallH, 0.15), wm); fwl.position.set(-6, wallH / 2, 7); scene.add(fwl);
    const fwr = new THREE.Mesh(new THREE.BoxGeometry(6, wallH, 0.15), wm); fwr.position.set(6, wallH / 2, 7); scene.add(fwr);

    // Desks
    function mkDesk(x, z, rot = 0) {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.7), mat(0x3a3020)); top.position.y = 0.7; top.castShadow = true; g.add(top);
      const lgeo = new THREE.BoxGeometry(0.06, 0.7, 0.06); const lm = mat(0x2a2a30);
      [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([lx, lz]) => { const l = new THREE.Mesh(lgeo, lm); l.position.set(lx, 0.35, lz); g.add(l); });
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.04), mat(0x111118, 0x14f195, 0.3)); mon.position.set(0, 1.05, -0.2); mon.castShadow = true; g.add(mon);
      const scr = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.01), mat(0x0a1a15, 0x14f195, 0.6)); scr.position.set(0, 1.05, -0.17); g.add(scr);

      // Office chair (positioned in front of desk)
      const chairColor = 0x333345;
      // Seat cushion
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), mat(chairColor));
      seat.position.set(0, 0.45, 0.55); seat.castShadow = true; g.add(seat);
      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.05), mat(chairColor));
      back.position.set(0, 0.65, 0.73); back.castShadow = true; g.add(back);
      // Center pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), mat(0x555555));
      pole.position.set(0, 0.27, 0.55); g.add(pole);
      // Base star (5 legs)
      for (let j = 0; j < 5; j++) {
        const angle = (j / 5) * Math.PI * 2;
        const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), mat(0x555555));
        legMesh.position.set(Math.sin(angle) * 0.1, 0.1, 0.55 + Math.cos(angle) * 0.1);
        legMesh.rotation.y = angle;
        g.add(legMesh);
        // Wheel at end
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), mat(0x222222));
        wheel.position.set(Math.sin(angle) * 0.2, 0.04, 0.55 + Math.cos(angle) * 0.2);
        wheel.rotation.x = Math.PI / 2;
        g.add(wheel);
      }

      g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    }
    [[-5,-3,0],[-3,-3,0],[-1,-3,0],
     [-5,-1,Math.PI],[-3,-1,Math.PI],[-1,-1,Math.PI]].forEach(([x,z,r]) => mkDesk(x,z,r));

    // Meeting table
    const mt = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.08, 32), mat(0x3a3020)); mt.position.set(-5, 0.72, 4); mt.castShadow = true; scene.add(mt);
    const mtl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.72, 8), mat(0x2a2a30)); mtl.position.set(-5, 0.36, 4); scene.add(mtl);

    // Meeting chairs
    const tableCenter = { x: -5, z: 4 };
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const cx = tableCenter.x + Math.cos(angle) * 2.2;
      const cz = tableCenter.z + Math.sin(angle) * 2.2;
      
      // Compute angle FROM chair TO table center
      const toTableAngle = Math.atan2(tableCenter.x - cx, tableCenter.z - cz);
      
      const cg = new THREE.Group();
      // Seat
      const mSeat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.36), mat(0x444460));
      mSeat.position.y = 0.42; cg.add(mSeat);
      // Backrest — at +z in local space (will face AWAY from table after rotation)
      const mBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.04), mat(0x444460));
      mBack.position.set(0, 0.6, 0.18); cg.add(mBack);
      // Pole
      const mPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), mat(0x666666));
      mPole.position.y = 0.25; cg.add(mPole);
      // Base legs
      for (let j = 0; j < 5; j++) {
        const la = (j / 5) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.18), mat(0x666666));
        leg.position.set(Math.sin(la) * 0.09, 0.09, Math.cos(la) * 0.09);
        leg.rotation.y = la;
        cg.add(leg);
      }
      cg.position.set(cx, 0, cz);
      // rotation.y in Three.js rotates around Y axis; -z local axis faces direction of rotation.y
      // We want -z (open/front) to face the table, so set rotation.y = toTableAngle
      cg.rotation.y = toTableAngle + Math.PI;
      scene.add(cg);
    }

    // Couches
    function mkCouch(x, z, rot = 0, c = 0x2a2a55) {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 0.8), mat(c)); s.position.y = 0.35; s.castShadow = true; g.add(s);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.2), mat(c)); b.position.set(0, 0.6, -0.3); b.castShadow = true; g.add(b);
      const al = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.8), mat(c)); al.position.set(-0.92, 0.52, 0); g.add(al);
      const ar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.8), mat(c)); ar.position.set(0.92, 0.52, 0); g.add(ar);
      g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    }
    mkCouch(5, 3, 0, 0x2a2a55);
    mkCouch(5, 5.5, Math.PI, 0x352a40);
    mkCouch(7.5, 4.2, -Math.PI / 2, 0x2a3545);

    // Coffee table
    const ct = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), mat(0x3a3020)); ct.position.set(5, 0.4, 4.25); scene.add(ct);

    // Ping pong
    const pp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 1.2), mat(0x1a5533)); pp.position.set(1, 0.75, 5.5); pp.castShadow = true; scene.add(pp);
    const ppn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 1.2), mat(0xcccccc)); ppn.position.set(1, 0.85, 5.5); scene.add(ppn);
    [[-0.9,-0.4],[0.9,-0.4],[-0.9,0.4],[0.9,0.4]].forEach(([lx,lz]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), mat(0x555555)); l.position.set(1+lx, 0.375, 5.5+lz); scene.add(l); });

    // Server racks
    function mkRack(x, z) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 0.5), mat(0x1a1a22)); r.position.set(x, 1, z); r.castShadow = true; scene.add(r);
      for (let i = 0; i < 5; i++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), mat(0, [0x14f195, 0x9945ff, 0x00d1ff][i % 3], 2));
        led.position.set(x - 0.2, 0.4 + i * 0.35, z - 0.26); scene.add(led);
      }
    }
    mkRack(8.2, -6); mkRack(8.2, -5); mkRack(8.2, -4);

    // Wall screens
    function mkScreen(x, y, z) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.06), mat(0x111118)); f.position.set(x, y, z); scene.add(f);
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.01), mat(0x050a08, 0x14f195, 0.4)); s.position.set(x, y, z + 0.04); scene.add(s);
    }
    mkScreen(0, 2, -6.9); mkScreen(4, 2, -6.9); mkScreen(-4, 2, -6.9);

    // Plants
    function mkPlant(x, z) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), mat(0x553322)); p.position.set(x, 0.15, z); scene.add(p);
      const lv = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.35, 0.6, 6), mat(0x226633, 0x14f195, 0.1)); lv.position.set(x, 0.6, z); scene.add(lv);
    }
    mkPlant(-8.3, -6); mkPlant(-8.3, 0); mkPlant(-8.3, 5); mkPlant(8.3, 0); mkPlant(8.3, 5);

    // ===== COLLISION OBSTACLES (AABB: { minX, maxX, minZ, maxZ }) =====
    const obstacles = [];
    // Walls
    obstacles.push({ minX: -9.1, maxX: 9.1, minZ: -7.15, maxZ: -6.85 }); // back wall
    obstacles.push({ minX: -9.15, maxX: -8.85, minZ: -7, maxZ: 7 }); // left wall
    obstacles.push({ minX: 8.85, maxX: 9.15, minZ: -7, maxZ: 7 }); // right wall
    obstacles.push({ minX: -9, maxX: -3, minZ: 6.85, maxZ: 7.15 }); // front wall left
    obstacles.push({ minX: 3, maxX: 9, minZ: 6.85, maxZ: 7.15 }); // front wall right
    // Desks (each desk ~1.2 x 0.7 centered at position)
    [[-5,-3],[-3,-3],[-1,-3],[-5,-1],[-3,-1],[-1,-1]].forEach(([x,z]) => {
      obstacles.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.5, maxZ: z + 0.5 });
    });
    // Meeting table (circular r=1.5 approximated as box)
    obstacles.push({ minX: -6.8, maxX: -3.2, minZ: 2.2, maxZ: 5.8 });
    // Couches
    obstacles.push({ minX: 3.8, maxX: 6.2, minZ: 2.4, maxZ: 3.6 }); // couch 1
    obstacles.push({ minX: 3.8, maxX: 6.2, minZ: 4.9, maxZ: 6.1 }); // couch 2
    obstacles.push({ minX: 6.9, maxX: 7.7, minZ: 3.0, maxZ: 5.4 }); // couch 3 (rotated)
    // Coffee table
    obstacles.push({ minX: 4.2, maxX: 5.8, minZ: 3.8, maxZ: 4.7 });
    // Ping pong table
    obstacles.push({ minX: -0.3, maxX: 2.3, minZ: 4.7, maxZ: 6.3 });
    // Server racks
    obstacles.push({ minX: 7.7, maxX: 8.7, minZ: -6.5, maxZ: -3.5 });
    // Plants
    [[-8.3,-6],[-8.3,0],[-8.3,5],[8.3,0],[8.3,5]].forEach(([x,z]) => {
      obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    });

    const agentRadius = 0.35;

    function isBlocked(x, z) {
      for (const ob of obstacles) {
        if (x + agentRadius > ob.minX && x - agentRadius < ob.maxX &&
            z + agentRadius > ob.minZ && z - agentRadius < ob.maxZ) {
          return true;
        }
      }
      return false;
    }

    function pickValidTarget() {
      for (let attempts = 0; attempts < 30; attempts++) {
        const x = (Math.random() - 0.5) * 14;
        const z = (Math.random() - 0.5) * 10;
        if (!isBlocked(x, z)) return { x, z };
      }
      return { x: 0, z: 0 }; // fallback to center
    }

    // ===== AGENTS =====
    // Spawn at valid non-colliding positions
    const startPositions = [];
    for (let i = 0; i < 6; i++) {
      startPositions.push(pickValidTarget());
    }

    // Hair styles and skin tones per agent for variety
    const agentStyles = [
      { skin: 0xddb88c, hair: 0x222222, hairStyle: "flat" },
      { skin: 0xc68c53, hair: 0x111111, hairStyle: "tall" },
      { skin: 0xf5d0a9, hair: 0x8b4513, hairStyle: "side" },
      { skin: 0xd4a373, hair: 0xcc3333, hairStyle: "mohawk" },
      { skin: 0xe8c49a, hair: 0xf0e68c, hairStyle: "flat" },
      { skin: 0xbf8b60, hair: 0x1a1a2e, hairStyle: "tall" },
    ];

    AGENTS.forEach((a, i) => {
      const g = new THREE.Group();
      const style = agentStyles[i];

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.3), mat(a.color));
      body.position.y = 0.7; body.castShadow = true; g.add(body);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.3), mat(style.skin));
      head.position.y = 1.2; head.castShadow = true; g.add(head);

      // === FACE (all on front face z=0.16) ===

      // Eyes — white sclera + dark pupil
      const scleraGeo = new THREE.BoxGeometry(0.08, 0.06, 0.01);
      const scleraMat = mat(0xffffff);
      const pupilGeo = new THREE.BoxGeometry(0.04, 0.05, 0.01);
      const pupilMat = mat(0x111111);

      const eyeLSclera = new THREE.Mesh(scleraGeo, scleraMat);
      eyeLSclera.position.set(-0.08, 1.22, 0.16); g.add(eyeLSclera);
      const eyeLPupil = new THREE.Mesh(pupilGeo, pupilMat);
      eyeLPupil.position.set(-0.08, 1.22, 0.17); g.add(eyeLPupil);

      const eyeRSclera = new THREE.Mesh(scleraGeo, scleraMat);
      eyeRSclera.position.set(0.08, 1.22, 0.16); g.add(eyeRSclera);
      const eyeRPupil = new THREE.Mesh(pupilGeo, pupilMat);
      eyeRPupil.position.set(0.08, 1.22, 0.17); g.add(eyeRPupil);

      // Eyebrows
      const browGeo = new THREE.BoxGeometry(0.1, 0.025, 0.01);
      const browMat = mat(style.hair);
      const browL = new THREE.Mesh(browGeo, browMat);
      browL.position.set(-0.08, 1.28, 0.16); browL.rotation.z = -0.1; g.add(browL);
      const browR = new THREE.Mesh(browGeo, browMat);
      browR.position.set(0.08, 1.28, 0.16); browR.rotation.z = 0.1; g.add(browR);

      // Nose
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), mat(style.skin * 0.9 | 0));
      nose.position.set(0, 1.17, 0.17); g.add(nose);

      // Mouth
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.01), mat(0x993333));
      mouth.position.set(0, 1.1, 0.16); g.add(mouth);

      // === HAIR ===
      const hairMat = mat(style.hair);

      if (style.hairStyle === "flat") {
        // Flat top hair
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.08, 0.32), hairMat);
        hairTop.position.set(0, 1.42, -0.01); hairTop.castShadow = true; g.add(hairTop);
        // Side hair
        const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.32), hairMat);
        hairL.position.set(-0.19, 1.3, -0.01); g.add(hairL);
        const hairR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.32), hairMat);
        hairR.position.set(0.19, 1.3, -0.01); g.add(hairR);
        // Back hair
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.25, 0.04), hairMat);
        hairBack.position.set(0, 1.32, -0.17); g.add(hairBack);
      } else if (style.hairStyle === "tall") {
        // Tall/afro style
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.34), hairMat);
        hairTop.position.set(0, 1.46, -0.01); hairTop.castShadow = true; g.add(hairTop);
        const hairMid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.36), hairMat);
        hairMid.position.set(0, 1.38, -0.01); g.add(hairMid);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.3, 0.05), hairMat);
        hairBack.position.set(0, 1.32, -0.18); g.add(hairBack);
      } else if (style.hairStyle === "side") {
        // Side swept
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.32), hairMat);
        hairTop.position.set(0.03, 1.42, -0.01); hairTop.castShadow = true; g.add(hairTop);
        // Swept fringe
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.04), hairMat);
        fringe.position.set(-0.1, 1.38, 0.15); fringe.rotation.z = 0.2; g.add(fringe);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.28, 0.04), hairMat);
        hairBack.position.set(0, 1.32, -0.17); g.add(hairBack);
        const hairR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.32), hairMat);
        hairR.position.set(0.19, 1.3, -0.01); g.add(hairR);
      } else if (style.hairStyle === "mohawk") {
        // Mohawk
        const spike1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.06), hairMat);
        spike1.position.set(0, 1.48, 0.05); g.add(spike1);
        const spike2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.06), hairMat);
        spike2.position.set(0, 1.47, -0.04); g.add(spike2);
        const spike3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.06), hairMat);
        spike3.position.set(0, 1.45, -0.12); g.add(spike3);
        // Shaved sides (slightly darker skin)
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.28), mat(style.skin * 0.85 | 0));
        sideL.position.set(-0.18, 1.35, -0.01); g.add(sideL);
        const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.28), mat(style.skin * 0.85 | 0));
        sideR.position.set(0.18, 1.35, -0.01); g.add(sideR);
      }

      // Legs with pivot at hip
      const legGeo = new THREE.BoxGeometry(0.16, 0.4, 0.2);
      const legM = mat(0x222233);

      const legLPivot = new THREE.Group();
      legLPivot.position.set(-0.12, 0.42, 0);
      const legLMesh = new THREE.Mesh(legGeo, legM);
      legLMesh.position.y = -0.2;
      legLPivot.add(legLMesh);
      g.add(legLPivot);

      const legRPivot = new THREE.Group();
      legRPivot.position.set(0.12, 0.42, 0);
      const legRMesh = new THREE.Mesh(legGeo, legM);
      legRMesh.position.y = -0.2;
      legRPivot.add(legRMesh);
      g.add(legRPivot);

      // Arms with pivot at shoulder
      const armGeo = new THREE.BoxGeometry(0.12, 0.45, 0.18);

      const armLPivot = new THREE.Group();
      armLPivot.position.set(-0.32, 0.92, 0);
      const armLMesh = new THREE.Mesh(armGeo, mat(a.color));
      armLMesh.position.y = -0.22;
      armLPivot.add(armLMesh);
      g.add(armLPivot);

      const armRPivot = new THREE.Group();
      armRPivot.position.set(0.32, 0.92, 0);
      const armRMesh = new THREE.Mesh(armGeo, mat(a.color));
      armRMesh.position.y = -0.22;
      armRPivot.add(armRMesh);
      g.add(armRPivot);

      // Status ring
      const ringGeo = new THREE.RingGeometry(0.3, 0.38, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: a.status === "working" ? 0x14f195 : 0xffaa22, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);

      g.userData = { ring, agentId: a.id, legLPivot, legRPivot, armLPivot, armRPivot, walkPhase: Math.random() * Math.PI * 2 };

      const sp = startPositions[i];
      g.position.set(sp.x, 0, sp.z);
      scene.add(g);
      agentMeshesRef.current[a.id] = g;
      agentTargetsRef.current[a.id] = { x: sp.x, z: sp.z, timer: Math.random() * 3 + 2 };
    });

    // Camera update
    function updateCam() {
      const cs = cameraStateRef.current;
      const cam = cameraRef.current;
      const ren = rendererRef.current;
      if (!cam || !ren) return;
      const w = ren.domElement.clientWidth;
      const h = ren.domElement.clientHeight;
      const asp = w / h;
      cam.position.x = cs.target.x + Math.cos(cs.angle) * cs.distance * Math.cos(cs.pitch);
      cam.position.z = cs.target.z + Math.sin(cs.angle) * cs.distance * Math.cos(cs.pitch);
      cam.position.y = cs.distance * Math.sin(cs.pitch);
      cam.lookAt(cs.target);
      const d = cs.distance * 0.55;
      cam.left = -d * asp; cam.right = d * asp; cam.top = d; cam.bottom = -d;
      cam.updateProjectionMatrix();
    }

    updateCam();

    // Animate
    const clock = new THREE.Clock();
    clockRef.current = clock;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);

      // Move agents with collision
      Object.entries(agentTargetsRef.current).forEach(([id, target], agentIdx) => {
        const mesh = agentMeshesRef.current[id];
        if (!mesh) return;
        target.timer -= dt;
        if (target.timer <= 0) {
          const valid = pickValidTarget();
          target.x = valid.x;
          target.z = valid.z;
          target.timer = Math.random() * 5 + 3;
        }
        const dx = target.x - mesh.position.x;
        const dz = target.z - mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.15) {
          const speed = 1.2 * dt;
          const nx = mesh.position.x + (dx / dist) * speed;
          const nz = mesh.position.z + (dz / dist) * speed;
          const prevX = mesh.position.x;
          const prevZ = mesh.position.z;

          // Check agent-agent collision
          const agentMinDist = 0.7;
          let agentBlocked = false;
          for (const [otherId, otherMesh] of Object.entries(agentMeshesRef.current)) {
            if (otherId === id || !otherMesh) continue;
            const adx = nx - otherMesh.position.x;
            const adz = nz - otherMesh.position.z;
            if (Math.sqrt(adx * adx + adz * adz) < agentMinDist) {
              agentBlocked = true;
              break;
            }
          }

          if (agentBlocked) {
            const perpX = mesh.position.x + (-dz / dist) * speed;
            const perpZ = mesh.position.z + (dx / dist) * speed;
            let perpBlocked = false;
            for (const [otherId, otherMesh] of Object.entries(agentMeshesRef.current)) {
              if (otherId === id || !otherMesh) continue;
              const adx = perpX - otherMesh.position.x;
              const adz = perpZ - otherMesh.position.z;
              if (Math.sqrt(adx * adx + adz * adz) < agentMinDist) {
                perpBlocked = true;
                break;
              }
            }
            if (!perpBlocked && !isBlocked(perpX, perpZ)) {
              mesh.position.x = perpX;
              mesh.position.z = perpZ;
            }
          } else if (!isBlocked(nx, nz)) {
            mesh.position.x = nx;
            mesh.position.z = nz;
          } else {
            if (!isBlocked(nx, mesh.position.z)) {
              mesh.position.x = nx;
            } else if (!isBlocked(mesh.position.x, nz)) {
              mesh.position.z = nz;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 3 + 2;
            }
          }

          // Check if agent actually moved
          const moved = Math.abs(mesh.position.x - prevX) > 0.001 || Math.abs(mesh.position.z - prevZ) > 0.001;
          const ud = mesh.userData;

          if (moved) {
            mesh.rotation.y = Math.atan2(dx, dz);

            // Walk animation
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) ud.armLPivot.rotation.x = -swing * 0.7;
            if (ud.armRPivot) ud.armRPivot.rotation.x = swing * 0.7;
          } else {
            // Blocked — ease limbs to rest
            if (ud.legLPivot) ud.legLPivot.rotation.x *= 0.85;
            if (ud.legRPivot) ud.legRPivot.rotation.x *= 0.85;
            if (ud.armLPivot) ud.armLPivot.rotation.x *= 0.85;
            if (ud.armRPivot) ud.armRPivot.rotation.x *= 0.85;
          }
          mesh.position.y = 0;
        } else {
          // Idle
          const ud = mesh.userData;
          if (ud.legLPivot) ud.legLPivot.rotation.x *= 0.85;
          if (ud.legRPivot) ud.legRPivot.rotation.x *= 0.85;
          if (ud.armLPivot) ud.armLPivot.rotation.x *= 0.85;
          if (ud.armRPivot) ud.armRPivot.rotation.x *= 0.85;
          const breathe = Math.sin(Date.now() * 0.002 + agentIdx * 1.5) * 0.015;
          mesh.position.y = 0;
          if (ud.armLPivot) ud.armLPivot.rotation.z = breathe;
          if (ud.armRPivot) ud.armRPivot.rotation.z = -breathe;
        }
        const ring = mesh.userData.ring;
        if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
      });

      // Follow agent — smoothly track their position
      if (followAgentRef.current) {
        const followMesh = agentMeshesRef.current[followAgentRef.current];
        if (followMesh) {
          const cs = cameraStateRef.current;
          // Smoothly lerp camera target to agent position + mid-body height
          cs.target.x += (followMesh.position.x - cs.target.x) * 0.08;
          cs.target.y += (0.7 - cs.target.y) * 0.08;
          cs.target.z += (followMesh.position.z - cs.target.z) * 0.08;
        }
      } else {
        // When not following, ease target Y back to ground
        const cs = cameraStateRef.current;
        cs.target.y += (0 - cs.target.y) * 0.05;
      }

      updateCam();

      // Update label positions via direct DOM manipulation
      AGENTS.forEach(a => {
        const mesh = agentMeshesRef.current[a.id];
        if (!mesh) return;
        let el = labelElemsRef.current[a.id];
        if (!el && labelContainerRef.current) {
          el = document.createElement("div");
          el.style.cssText = `position:absolute;pointer-events:none;padding:3px 8px;background:rgba(10,10,15,0.85);border:1px solid ${hexToCSS(a.color)}40;border-radius:4px;font-family:'Courier New',monospace;font-size:10px;font-weight:600;color:#e0e0e8;display:flex;align-items:center;gap:4px;white-space:nowrap;transform:translate(-50%,-100%);will-change:left,top;`;
          const dot = document.createElement("span");
          dot.className = "status-dot";
          dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${a.status === "working" ? "#14f195" : "#ffaa22"};flex-shrink:0;`;
          el.appendChild(dot);
          el.appendChild(document.createTextNode(a.name));
          labelContainerRef.current.appendChild(el);
          labelElemsRef.current[a.id] = el;
        }
        if (el) {
          const pos = new THREE.Vector3(mesh.position.x, 1.7, mesh.position.z);
          pos.project(camera);
          const x = (pos.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
          const y = (-pos.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
          el.style.left = x + "px";
          el.style.top = y + "px";
          // Update status dot color
          const dot = el.querySelector(".status-dot");
          const status = agentsRef.current.find(ag => ag.id === a.id)?.status || "idle";
          if (dot) dot.style.background = status === "working" ? "#14f195" : "#ffaa22";
        }
      });

      renderer.render(scene, camera);
    }

    animate();

    // Mouse handlers — left drag = pan, right drag = rotate, scroll = zoom
    const el = renderer.domElement;
    const onDown = (e) => {
      dragRef.current = { dragging: true, button: e.button, prevX: e.clientX, prevY: e.clientY };
    };
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.prevX;
      const dy = e.clientY - dragRef.current.prevY;
      const cs = cameraStateRef.current;

      if (dragRef.current.button === 0) {
        // Left drag = pan (move target) — also breaks follow
        followAgentRef.current = null;
        const panSpeed = cs.distance * 0.0008;
        const angle = cs.angle;
        // Pan relative to camera orientation
        cs.target.x -= (Math.sin(angle) * dx + Math.cos(angle) * dy) * panSpeed;
        cs.target.z += (Math.cos(angle) * dx - Math.sin(angle) * dy) * panSpeed;
      } else if (dragRef.current.button === 2) {
        // Right drag = rotate horizontal + vertical
        cs.angle += dx * 0.002;
        cs.pitch = Math.max(0.1, Math.min(1.2, cs.pitch - dy * 0.002));
      }

      dragRef.current.prevX = e.clientX;
      dragRef.current.prevY = e.clientY;
    };
    const onUp = () => { dragRef.current.dragging = false; };
    const onWheel = (e) => {
      cameraStateRef.current.distance += e.deltaY * 0.02;
      cameraStateRef.current.distance = Math.max(3, Math.min(50, cameraStateRef.current.distance));
    };
    const onContext = (e) => { e.preventDefault(); }; // prevent right-click menu
    const onClick = (e) => {
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      let closest = null, closestDist = Infinity;
      AGENTS.forEach(a => {
        const mesh = agentMeshesRef.current[a.id];
        if (!mesh) return;
        const ints = raycaster.intersectObjects(mesh.children, true);
        if (ints.length > 0 && ints[0].distance < closestDist) {
          closestDist = ints[0].distance;
          closest = a;
        }
      });
      if (closest) {
        // Toggle follow: click same agent to unfollow, different to switch
        if (followAgentRef.current === closest.id) {
          followAgentRef.current = null;
          setSelectedAgent(null);
        } else {
          followAgentRef.current = closest.id;
          setSelectedAgent(closest.id);
          // Zoom in closer for follow mode
          cameraStateRef.current.distance = 3;
        }
      } else {
        // Clicked empty space — unfollow
        followAgentRef.current = null;
        setSelectedAgent(null);
      }
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("wheel", onWheel);
    el.addEventListener("click", onClick);
    el.addEventListener("contextmenu", onContext);

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", onClick);
      el.removeEventListener("contextmenu", onContext);
      window.removeEventListener("resize", onResize);
      Object.values(labelElemsRef.current).forEach(e => e.remove());
      labelElemsRef.current = {};
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // Resize renderer when panel opens/closes
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = canvasRef.current;
      const renderer = rendererRef.current;
      if (container && renderer) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
      }
    }, 320); // wait for CSS transition to finish
    return () => clearTimeout(timer);
  }, [panelOpen]);

  // Simulated agent activity
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => {
        const updated = [...prev];
        const idx = Math.floor(Math.random() * updated.length);
        if (Math.random() > 0.6) {
          updated[idx] = { ...updated[idx], status: updated[idx].status === "working" ? "idle" : "working" };
          const mesh = agentMeshesRef.current[updated[idx].id];
          if (mesh?.userData.ring) {
            mesh.userData.ring.material.color.set(updated[idx].status === "working" ? 0x14f195 : 0xffaa22);
          }
        }
        return updated;
      });
      const a = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const tmpl = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
      setActivityLog(prev => [{ time: timeStr(), ...tmpl(a) }, ...prev].slice(0, 50));
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatLog]);

  const assignTask = useCallback(() => {
    if (!taskInput.trim()) return;
    const agentId = taskAgent || AGENTS[Math.floor(Math.random() * AGENTS.length)].id;
    const agent = agents.find(a => a.id === agentId) || agents[0];
    const task = { id: Date.now(), agent: agent.name, agentId, desc: taskInput, status: "pending" };
    setTasks(prev => [task, ...prev]);
    setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: `assigned: ${taskInput}` }, ...prev]);
    setTaskInput("");

    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "running" } : t));
      setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: "started executing task" }, ...prev]);
    }, 1000);

    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "done" } : t));
      setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: `completed: ${taskInput}` }, ...prev]);
    }, 4000 + Math.random() * 3000);
  }, [taskInput, taskAgent, agents]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatLog(prev => [...prev, { from: "You", text: chatInput, color: "#e0e0e8" }]);
    const msg = chatInput;
    setChatInput("");
    setTimeout(() => {
      const a = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const resp = CHAT_RESPONSES[Math.floor(Math.random() * CHAT_RESPONSES.length)];
      setChatLog(prev => [...prev, { from: a.name, text: resp, color: hexToCSS(a.color) }]);
    }, 800 + Math.random() * 1200);
  }, [chatInput]);

  const chatMsgEndRef = useRef(null);
  useEffect(() => { chatMsgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistories, chatAgent]);

  const sendAgentChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput("");
    setChatHistories(prev => ({
      ...prev,
      [chatAgent]: [...(prev[chatAgent] || []), { from: "You", text: msg, time: timeStr() }]
    }));
    // Simulated agent response
    const agent = AGENTS.find(a => a.id === chatAgent);
    setTimeout(() => {
      const resp = CHAT_RESPONSES[Math.floor(Math.random() * CHAT_RESPONSES.length)];
      setChatHistories(prev => ({
        ...prev,
        [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: resp, time: timeStr() }]
      }));
    }, 800 + Math.random() * 1500);
  }, [chatInput, chatAgent]);


  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a0f", overflow: "hidden", position: "relative" }}>
      <div ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
      <div ref={labelContainerRef} style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }} />

      {/* TOP LEFT CAMERA CONTROLS */}
      <div style={{
        position: "fixed", top: 0, left: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 16px 0", border: "1px solid #2a2520", borderTop: "none", borderLeft: "none",
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px"
      }}>
        {/* Reset/overview angle */}
        <div onClick={() => { followAgentRef.current = null; setSelectedAgent(null); cameraStateRef.current.angle = Math.PI / 4; cameraStateRef.current.distance = 25; cameraStateRef.current.target.set(0, 0, 0); }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </div>
        {/* Front view */}
        <div onClick={() => { cameraStateRef.current.angle = Math.PI / 2; }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        {/* Isometric/3D view */}
        <div onClick={() => { cameraStateRef.current.angle = Math.PI / 4; }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      </div>

      {/* TOP BAR */}
      <div style={{
        position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 16px 16px", border: "1px solid #2a2520", borderTop: "none",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 28px 12px", gap: 8, minWidth: 500
      }}>
        {/* Title with decorative lines */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, #c8a050)" }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 600, fontSize: 13, letterSpacing: 6, color: "#c8a050" }}>
            0xMerl HEADQUARTERS
          </span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, #c8a050)" }} />
        </div>

        {/* Agent chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {agents.map(a => (
            <div key={a.id} onClick={() => {
              if (followAgentRef.current === a.id) {
                followAgentRef.current = null;
                setSelectedAgent(null);
              } else {
                followAgentRef.current = a.id;
                setSelectedAgent(a.id);
                cameraStateRef.current.distance = 3;
              }
            }} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "5px 12px",
              background: selectedAgent === a.id ? "rgba(200,160,80,0.15)" : "rgba(30,28,24,0.8)",
              border: `1px solid ${selectedAgent === a.id ? "#c8a050" : "#3a3530"}`,
              borderRadius: 20, cursor: "pointer", transition: "all 0.2s"
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: hexToCSS(a.color), flexShrink: 0,
                boxShadow: `0 0 6px ${hexToCSS(a.color)}60`
              }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "#d4c5a0", fontFamily: "'Courier New', monospace" }}>{a.name}</span>
              <div style={{ display: "flex", gap: 5, marginLeft: 2 }}>
                <span style={{ fontSize: 9, color: "#5a5545", cursor: "pointer" }}>👁</span>
                <span style={{ fontSize: 9, color: "#5a5545", cursor: "pointer" }}>💬</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TOP RIGHT ICONS */}
      <div style={{
        position: "fixed", top: 0, right: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 0 16px", border: "1px solid #2a2520", borderTop: "none", borderRight: "none",
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px"
      }}>
        {/* Map/book icon */}
        <div style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer", background: "rgba(200,160,80,0.08)"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        {/* Edit/pencil icon */}
        <div style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6a6055" strokeWidth="1.8">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        {/* Volume/mute icon */}
        <div style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6a6055" strokeWidth="1.8">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        </div>
      </div>

      {/* RIGHT SIDE VERTICAL TABS */}
      <div style={{
        position: "fixed", top: "50%", right: 0, transform: "translateY(-50%)", zIndex: 106,
        display: "flex", flexDirection: "column", gap: 6
      }}>
        <div onClick={() => { setHqPanelOpen(p => !p); setChatPanelOpen(false); }} style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace",
          color: hqPanelOpen ? "#0a0a0f" : "#c8a050",
          background: hqPanelOpen ? "#c8a050" : "rgba(10,10,15,0.88)",
          backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          transform: hqPanelOpen ? "translateX(-380px)" : "translateX(0)",
          opacity: chatPanelOpen ? 0 : 1, pointerEvents: chatPanelOpen ? "none" : "auto",
        }}>OPEN HQ</div>
        <div style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace", color: "#9945ff",
          background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          opacity: (hqPanelOpen || chatPanelOpen) ? 0 : 1, pointerEvents: (hqPanelOpen || chatPanelOpen) ? "none" : "auto",
        }}>MARKETPLACE</div>
        <div style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace", color: "#00d1ff",
          background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          opacity: (hqPanelOpen || chatPanelOpen) ? 0 : 1, pointerEvents: (hqPanelOpen || chatPanelOpen) ? "none" : "auto",
        }}>ANALYTICS</div>
      </div>

      {/* OPEN HQ PANEL */}
      <div style={{
        position: "fixed", top: 80, right: hqPanelOpen ? 0 : -380, bottom: 40, width: 380, zIndex: 105,
        background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid #2a2520", borderRight: "none",
        borderRadius: "16px 0 0 16px",
        display: "flex", flexDirection: "column", transition: "right 0.3s ease",
        fontFamily: "'Courier New', monospace", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#14f195", letterSpacing: 2, marginBottom: 4 }}>HEADQUARTERS</div>
          <div style={{ fontSize: 10, color: "#6a6055" }}>Monitor outputs, runs, and schedules.</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #2a2520", padding: "0 20px" }}>
          {["inbox", "history", "playbooks"].map(tab => (
            <div key={tab} onClick={() => setHqTab(tab)} style={{
              padding: "10px 16px", fontSize: 10, letterSpacing: 1.5, fontWeight: 600,
              textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s",
              color: hqTab === tab ? "#e0e0e8" : "#6a6055",
              background: hqTab === tab ? "rgba(0,209,255,0.1)" : "transparent",
              borderRadius: hqTab === tab ? "6px 6px 0 0" : 0,
              borderBottom: hqTab === tab ? "2px solid #00d1ff" : "2px solid transparent",
            }}>{tab}</div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {hqTab === "inbox" && (
            <div>
              <div style={{ fontSize: 10, color: "#6a6055", textAlign: "center", padding: "40px 0" }}>No new messages in inbox.</div>
            </div>
          )}

          {hqTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { agent: "Alpha", action: "Swapped 2 SOL → USDC on Jupiter", time: "2 min ago", status: "success" },
                { agent: "Echo", action: "Executed DCA buy order #47", time: "5 min ago", status: "success" },
                { agent: "Charlie", action: "Scanned 12 new token launches", time: "8 min ago", status: "success" },
                { agent: "Bravo", action: "Rebalanced portfolio allocation", time: "12 min ago", status: "success" },
                { agent: "Delta", action: "NFT floor price check — Tensor", time: "15 min ago", status: "success" },
                { agent: "Foxtrot", action: "Flagged suspicious transfer", time: "20 min ago", status: "warning" },
              ].map((h, i) => (
                <div key={i} style={{
                  padding: "10px 14px", background: "rgba(30,28,24,0.6)", border: "1px solid #2a2520",
                  borderRadius: 8, borderLeft: `3px solid ${h.status === "warning" ? "#ffaa22" : "#14f195"}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#c8a050" }}>{h.agent}</span>
                    <span style={{ fontSize: 9, color: "#4a4540" }}>{h.time}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#9a9590", lineHeight: 1.4 }}>{h.action}</div>
                </div>
              ))}
            </div>
          )}

          {hqTab === "playbooks" && (
            <div>
              {/* Playbooks header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 4 }}>PLAYBOOKS</div>
                  <div style={{ fontSize: 10, color: "#4a4540" }}>Launch reusable schedules for the whole headquarters.</div>
                </div>
                <button style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 9, fontWeight: 700,
                  background: "transparent", color: "#00d1ff", border: "1px solid #00d1ff",
                  cursor: "pointer", fontFamily: "inherit", letterSpacing: 1
                }}>REFRESH</button>
              </div>

              {/* Active jobs */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 8 }}>ACTIVE JOBS</div>
                <div style={{ fontSize: 10, color: "#4a4540", padding: "8px 0" }}>No active playbooks yet.</div>
              </div>

              {/* Separator */}
              <div style={{ height: 1, background: "#2a2520", marginBottom: 16 }} />

              {/* Templates */}
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 12 }}>TEMPLATES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { title: "DAILY MORNING BRIEFING", desc: "Every day at 9am. Summarize priorities, blockers, and what changed overnight.", color: "#c8a050" },
                  { title: "NIGHTLY CODE REVIEW DIGEST", desc: "Every night at midnight. Review the day and summarize risky changes or regressions.", color: "#c8a050" },
                  { title: "HOURLY HEALTH CHECK", desc: "Every 60 minutes. Report runtime health, failures, and anything that needs intervention.", color: "#00d1ff" },
                  { title: "WEEKLY PROGRESS REPORT", desc: "Every Monday at 8am. Roll up wins, unfinished work, and next steps.", color: "#14f195" },
                  { title: "CONTINUOUS MONITOR", desc: "Every 15 minutes. Watch for drift, silent failures, or anything unusual.", color: "#9945ff" },
                ].map((t, i) => (
                  <div key={i} style={{
                    padding: "14px 16px", background: "rgba(30,28,24,0.6)",
                    border: "1px solid #2a2520", borderRadius: 10,
                    borderLeft: `3px solid ${t.color}`, cursor: "pointer",
                    transition: "all 0.2s"
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e0e0e8", letterSpacing: 1, marginBottom: 6 }}>{t.title}</div>
                    <div style={{ fontSize: 10, color: "#6a6055", lineHeight: 1.5 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM LEFT STATUS BAR */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 16px 0 0", border: "1px solid #2a2520", borderBottom: "none", borderLeft: "none",
        display: "flex", alignItems: "center", padding: "10px 24px", gap: 12,
        fontFamily: "'Courier New', monospace", fontSize: 10, color: "#6a6055"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#14f195" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#14f195", boxShadow: "0 0 6px #14f195" }} />
          CONNECTED
        </span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{agents.filter(a => a.status === "working").length} working</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{agents.filter(a => a.status === "idle").length} idle</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#c8a050" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/></svg>
          quiet
        </span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>drag · scroll · space+drag · dbl-click</span>
      </div>

      {/* BOTTOM RIGHT CHAT BUTTON */}
      <button onClick={() => { setChatPanelOpen(p => !p); setHqPanelOpen(false); }} style={{
        position: "fixed", bottom: chatPanelOpen ? 460 : 0, right: 0, zIndex: 110,
        background: chatPanelOpen ? "#c8a050" : "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: chatPanelOpen ? "10px 10px 0 0" : "16px 0 0 0",
        border: `1px solid ${chatPanelOpen ? "#c8a050" : "#2a2520"}`, borderBottom: "none", borderRight: "none",
        display: "flex", alignItems: "center", gap: 8, padding: "10px 24px",
        fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 600,
        color: chatPanelOpen ? "#0a0a0f" : "#c8a050", cursor: "pointer", letterSpacing: 1,
        transition: "all 0.3s ease"
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chatPanelOpen ? "#0a0a0f" : "#c8a050"} strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        CHAT
      </button>

      {/* CHAT PANEL */}
      <div style={{
        position: "fixed", bottom: chatPanelOpen ? 0 : -460, right: 0, zIndex: 105,
        width: 520, height: 460,
        background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid #2a2520", borderBottom: "none", borderRight: "none",
        borderRadius: "16px 0 0 0",
        display: "flex", transition: "bottom 0.3s ease",
        fontFamily: "'Courier New', monospace"
      }}>
        {/* Agent list sidebar */}
        <div style={{
          width: 140, borderRight: "1px solid #2a2520", display: "flex", flexDirection: "column",
          padding: "14px 0", overflowY: "auto"
        }}>
          <div style={{ padding: "0 14px 10px", fontSize: 10, color: "#6a6055", fontWeight: 600, letterSpacing: 2 }}>
            AGENTS <span style={{ color: "#4a4540", marginLeft: 6 }}>{AGENTS.length}</span>
          </div>
          {AGENTS.map(a => (
            <div key={a.id} onClick={() => setChatAgent(a.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              cursor: "pointer", transition: "all 0.15s",
              background: chatAgent === a.id ? "rgba(200,160,80,0.1)" : "transparent",
              borderLeft: chatAgent === a.id ? "2px solid #c8a050" : "2px solid transparent",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: a.status === "working" ? "#14f195" : "#6a6055", flexShrink: 0
              }} />
              <span style={{ fontSize: 11, color: chatAgent === a.id ? "#e0e0e8" : "#6a6055" }}>{a.name}</span>
            </div>
          ))}
        </div>

        {/* Chat conversation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Chat header */}
          {(() => {
            const agent = AGENTS.find(a => a.id === chatAgent);
            return (
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid #2a2520",
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: agent ? hexToCSS(agent.color) : "#555",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "#0a0a0f", fontWeight: 700
                }}>{agent?.name?.[0]}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e8" }}>{agent?.name}</div>
                  <div style={{ fontSize: 9, color: "#6a6055" }}>{agent?.role}</div>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => setChatHistories(prev => ({ ...prev, [chatAgent]: [] }))} style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                  background: "#c8a050", color: "#0a0a0f", border: "none", cursor: "pointer",
                  fontFamily: "inherit", letterSpacing: 0.5
                }}>New session</button>
                <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid #2a2520", cursor: "pointer" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6a6055" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </div>
              </div>
            );
          })()}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {(chatHistories[chatAgent] || []).length === 0 && (
              <div style={{ textAlign: "center", color: "#4a4540", fontSize: 10, padding: "40px 0" }}>
                Start a conversation with this agent
              </div>
            )}
            {(chatHistories[chatAgent] || []).map((m, i) => {
              const isYou = m.from === "You";
              const agent = AGENTS.find(a => a.id === chatAgent);
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isYou ? "flex-end" : "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    {!isYou && <span style={{ fontSize: 9, fontWeight: 600, color: agent ? hexToCSS(agent.color) : "#c8a050" }}>{m.from}</span>}
                    {isYou && <span style={{ fontSize: 9, fontWeight: 600, color: "#6a6055" }}>You</span>}
                    <span style={{ fontSize: 8, color: "#4a4540" }}>{m.time}</span>
                  </div>
                  <div style={{
                    padding: "8px 12px", maxWidth: "80%", fontSize: 11, lineHeight: 1.5,
                    borderRadius: isYou ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    background: isYou ? "rgba(200,160,80,0.15)" : "rgba(40,38,34,0.8)",
                    border: `1px solid ${isYou ? "#3a3520" : "#2a2520"}`,
                    color: "#d4d0c8"
                  }}>{m.text}</div>
                </div>
              );
            })}
            <div ref={chatMsgEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 16px 6px", borderTop: "1px solid #2a2520", display: "flex", gap: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendAgentChat()}
              placeholder="type a message"
              style={{
                flex: 1, background: "rgba(30,28,24,0.8)", border: "1px solid #2a2520", borderRadius: 8,
                padding: "10px 14px", color: "#e0e0e8", fontFamily: "inherit", fontSize: 11, outline: "none"
              }} />
            <button onClick={sendAgentChat} style={{
              background: "#c8a050", color: "#0a0a0f", border: "none", borderRadius: 8,
              padding: "10px 18px", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer"
            }}>Send</button>
          </div>
          {/* Model selector row */}
          <div style={{ padding: "4px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <select style={{
              background: "rgba(30,28,24,0.8)", border: "1px solid #2a2520", borderRadius: 6,
              padding: "5px 10px", color: "#c8a050", fontFamily: "inherit", fontSize: 10, outline: "none", cursor: "pointer"
            }}>
              <option>GPT-4.1 mini</option>
              <option>GPT-4o</option>
              <option>Claude Sonnet</option>
              <option>Llama 3</option>
              <option>DeepSeek</option>
            </select>
            <span style={{ fontSize: 9, color: "#4a4540", cursor: "pointer" }}>Show</span>
            <span style={{ fontSize: 9, color: "#4a4540", cursor: "pointer" }}>Tools</span>
          </div>
        </div>
      </div>
    </div>
  );
}
