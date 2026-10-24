import * as THREE from 'three';

// Generate procedural brushed metal canvas texture for micro-relief
function createBrushedMetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);

  // Fine linear machining striations
  for (let y = 0; y < 512; y++) {
    const val = 128 + Math.floor((Math.random() - 0.5) * 40);
    ctx.strokeStyle = `rgb(${val}, ${val}, ${val})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Cross micro-speckle
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

// Generate procedural cast iron texture
function createCastIronTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#666666';
  ctx.fillRect(0, 0, 256, 256);

  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 36;
    const v = Math.max(0, Math.min(255, 100 + noise));
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export interface EngineMaterialPalette {
  aluminumBlock: THREE.MeshStandardMaterial;
  aluminumCutawayEdge: THREE.MeshStandardMaterial;
  cylinderSleeveHoned: THREE.MeshStandardMaterial;
  castIronCrank: THREE.MeshStandardMaterial;
  polishedSteelJournal: THREE.MeshStandardMaterial;
  forgedSteelRod: THREE.MeshStandardMaterial;
  forgedPistonCrown: THREE.MeshStandardMaterial;
  pistonSkirt: THREE.MeshStandardMaterial;
  pistonRing: THREE.MeshStandardMaterial;
  wristPin: THREE.MeshStandardMaterial;
  bronzeBushing: THREE.MeshStandardMaterial;
  camshaftSteel: THREE.MeshStandardMaterial;
  camLobePolished: THREE.MeshStandardMaterial;
  valveStemChrome: THREE.MeshStandardMaterial;
  valveSpringSteel: THREE.MeshStandardMaterial;
  timingSprocket: THREE.MeshStandardMaterial;
  timingChainOuter: THREE.MeshStandardMaterial;
  timingChainPin: THREE.MeshStandardMaterial;
  chainGuidePlastic: THREE.MeshStandardMaterial;
  sparkPlugCeramic: THREE.MeshStandardMaterial;
  sparkPlugHex: THREE.MeshStandardMaterial;
  sparkPlugElectrode: THREE.MeshStandardMaterial;
  flywheelDuctile: THREE.MeshStandardMaterial;
  ringGearTeeth: THREE.MeshStandardMaterial;
  combustionFlame: THREE.MeshStandardMaterial;
  sparkGlow: THREE.MeshBasicMaterial;
  selectionHighlight: THREE.MeshStandardMaterial;
}

export function createEngineMaterials(): EngineMaterialPalette {
  const brushedBump = createBrushedMetalTexture();
  const castBump = createCastIronTexture();

  return {
    // Engine Block: Sleek satin cast aluminum
    aluminumBlock: new THREE.MeshStandardMaterial({
      color: 0x98a1a8,
      metalness: 0.82,
      roughness: 0.32,
      bumpMap: brushedBump,
      bumpScale: 0.002,
    }),

    // Bright machine-cut cross-section edge
    aluminumCutawayEdge: new THREE.MeshStandardMaterial({
      color: 0xc4cbd0,
      metalness: 0.90,
      roughness: 0.20,
    }),

    // Cylinder Sleeve: precision-honed cross-hatched steel
    cylinderSleeveHoned: new THREE.MeshStandardMaterial({
      color: 0x6e7882,
      metalness: 0.92,
      roughness: 0.18,
      bumpMap: brushedBump,
      bumpScale: 0.003,
    }),

    // Crankshaft Web: Dark forged steel
    castIronCrank: new THREE.MeshStandardMaterial({
      color: 0x3e4348,
      metalness: 0.88,
      roughness: 0.42,
      bumpMap: castBump,
      bumpScale: 0.006,
    }),

    // Polished Crank Journals (mirror finish for hydrodynamic bearings)
    polishedSteelJournal: new THREE.MeshStandardMaterial({
      color: 0xd8e0e6,
      metalness: 0.98,
      roughness: 0.08,
    }),

    // Connecting Rod: Shot-peened forged 4340 chromoly
    forgedSteelRod: new THREE.MeshStandardMaterial({
      color: 0x4d535a,
      metalness: 0.85,
      roughness: 0.38,
      bumpMap: castBump,
      bumpScale: 0.004,
    }),

    // Piston Crown: Machined aluminum crown with valve relief pockets
    forgedPistonCrown: new THREE.MeshStandardMaterial({
      color: 0xb5bec6,
      metalness: 0.88,
      roughness: 0.22,
      bumpMap: brushedBump,
      bumpScale: 0.002,
    }),

    // Piston Skirt: Anti-friction coated skirt
    pistonSkirt: new THREE.MeshStandardMaterial({
      color: 0x7c858e,
      metalness: 0.75,
      roughness: 0.35,
    }),

    // Piston Rings: Dark tempered ductile iron
    pistonRing: new THREE.MeshStandardMaterial({
      color: 0x2b2e32,
      metalness: 0.90,
      roughness: 0.25,
    }),

    // Wrist Pin: Mirror ground case-hardened steel
    wristPin: new THREE.MeshStandardMaterial({
      color: 0xdde4ec,
      metalness: 0.96,
      roughness: 0.10,
    }),

    // Bronze wrist pin bushings & bearings
    bronzeBushing: new THREE.MeshStandardMaterial({
      color: 0xc89858,
      metalness: 0.80,
      roughness: 0.28,
    }),

    // Camshaft Shaft: Gunmetal precision steel
    camshaftSteel: new THREE.MeshStandardMaterial({
      color: 0x586068,
      metalness: 0.90,
      roughness: 0.30,
    }),

    // Cam Lobes: Induction-hardened polished lobes
    camLobePolished: new THREE.MeshStandardMaterial({
      color: 0xd5dfe8,
      metalness: 0.96,
      roughness: 0.12,
    }),

    // Valve Stems & Heads: Polished stainless/Inconel
    valveStemChrome: new THREE.MeshStandardMaterial({
      color: 0xcfd6dc,
      metalness: 0.94,
      roughness: 0.15,
    }),

    // Valve Springs: Shot-peened tempered spring steel with dark bronze tint
    valveSpringSteel: new THREE.MeshStandardMaterial({
      color: 0x6e7680,
      metalness: 0.92,
      roughness: 0.24,
    }),

    // Timing Sprockets: CNC machined steel gear
    timingSprocket: new THREE.MeshStandardMaterial({
      color: 0x7a838c,
      metalness: 0.88,
      roughness: 0.28,
    }),

    // Timing Chain Plates: Dark blackened alloy links
    timingChainOuter: new THREE.MeshStandardMaterial({
      color: 0x22262a,
      metalness: 0.92,
      roughness: 0.30,
    }),

    // Timing Chain Rollers/Pins: Polished silver pins
    timingChainPin: new THREE.MeshStandardMaterial({
      color: 0xa8b2bc,
      metalness: 0.96,
      roughness: 0.15,
    }),

    // Timing Chain Guides: Synthetic low-friction polyamide
    chainGuidePlastic: new THREE.MeshStandardMaterial({
      color: 0x1f2327,
      metalness: 0.15,
      roughness: 0.65,
    }),

    // Spark Plug Ceramic: Glazed white porcelain
    sparkPlugCeramic: new THREE.MeshStandardMaterial({
      color: 0xf2f4f8,
      metalness: 0.05,
      roughness: 0.15,
    }),

    // Spark Plug Hex Shell: Zinc-plated steel
    sparkPlugHex: new THREE.MeshStandardMaterial({
      color: 0x8a929b,
      metalness: 0.85,
      roughness: 0.30,
    }),

    // Spark Plug Electrode: Copper / Nickel
    sparkPlugElectrode: new THREE.MeshStandardMaterial({
      color: 0xd49b6a,
      metalness: 0.90,
      roughness: 0.20,
    }),

    // Flywheel: Heavy cast ductile iron with machined friction face
    flywheelDuctile: new THREE.MeshStandardMaterial({
      color: 0x484e55,
      metalness: 0.86,
      roughness: 0.35,
    }),

    // Ring Gear: Hardened gear teeth
    ringGearTeeth: new THREE.MeshStandardMaterial({
      color: 0x363a3f,
      metalness: 0.92,
      roughness: 0.26,
    }),

    // Combustion Flame: Volumetric emissive plasma
    combustionFlame: new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff3300,
      emissiveIntensity: 2.2,
      roughness: 0.5,
      metalness: 0.1,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),

    // Spark Glow: Intense electric blue/white spark
    sparkGlow: new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),

    // Selection highlight material: Cyan engineering highlight
    selectionHighlight: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    }),
  };
}
