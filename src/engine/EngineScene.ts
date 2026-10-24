import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  KINEMATICS,
  CRANK_PIN_ANGLES,
  calculateSliderCrank,
  getCylinderState,
  ENGINE_COMPONENTS,
} from './kinematics';
import { createEngineMaterials, EngineMaterialPalette } from './materials';
import {
  createPistonGeometry,
  createConnectingRodGeometry,
  createCrankCounterweightGeometry,
  createCamLobeGeometry,
  createValveGeometry,
  createHelicalSpringGeometry,
  createTimingSprocketGeometry,
  createChainLinkGeometry,
  createSparkPlugModel,
} from './geometries';
import { EngineComponentInfo, EngineSimState } from './types';
import { engineAudio } from './sound';

export class EngineScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private materials: EngineMaterialPalette;

  // Animation frame & pacing
  private frameId: number = 0;
  private lastTime: number = 0;
  private isSoftwareGl: boolean = false;
  private isDisposed: boolean = false;

  // Simulation state
  public simState: EngineSimState;
  private onStateChange: (state: EngineSimState) => void;

  // 3D Assembly Groups
  private engineRootGroup = new THREE.Group();
  private blockGroup = new THREE.Group();
  private crankGroup = new THREE.Group();
  private headGroup = new THREE.Group();
  private valvetrainGroup = new THREE.Group();
  private intakeCamGroup = new THREE.Group();
  private exhaustCamGroup = new THREE.Group();
  private timingGroup = new THREE.Group();

  // Dynamic moving meshes
  private pistons: THREE.Group[] = [];
  private connectingRods: THREE.Group[] = [];
  private wristPins: THREE.Mesh[] = [];
  private combustionFlashes: THREE.Mesh[] = [];
  private sparkGlows: THREE.Mesh[] = [];

  // Valves: array of 4 cylinders, each having 4 valves [intake1, intake2, exhaust1, exhaust2]
  private valveMeshes: {
    mesh: THREE.Mesh;
    springMesh: THREE.Mesh;
    baseY: number;
    baseZ: number;
    angleZ: number; // slight splay angle
    isExhaust: boolean;
    cylinderIndex: number;
  }[] = [];

  // Timing sprockets & chain
  private crankSprocket!: THREE.Mesh;
  private intakeCamSprocket!: THREE.Mesh;
  private exhaustCamSprocket!: THREE.Mesh;
  private timingChainMesh!: THREE.InstancedMesh;
  private chainSpline!: THREE.CatmullRomCurve3;
  private chainLinkCount = 84;
  private chainLinearProgress = 0;

  // Camera animation
  private targetCameraPos = new THREE.Vector3(3.8, 3.0, 4.6);
  private targetControlsTarget = new THREE.Vector3(0, 1.6, 0);
  private isCameraTransitioning = false;

  // Exploded animation current value (smoothed)
  private currentExplodedAmount = 0;

  // Raycasting & Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private interactableMeshes: { mesh: THREE.Object3D; componentId: string }[] = [];
  private hoveredMesh: THREE.Object3D | null = null;
  private selectedMesh: THREE.Object3D | null = null;
  private originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  constructor(container: HTMLElement, onStateChange: (state: EngineSimState) => void) {
    this.container = container;
    this.onStateChange = onStateChange;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // Initialize Sim State
    this.simState = {
      isRunning: true,
      rpm: 1200,
      crankAngle: 0,
      camAngle: 0,
      simSpeed: 0.45, // default to pleasant observable speed
      explodedAmount: 0.0,
      audioEnabled: false,
      audioVolume: 0.5,
      selectedComponent: ENGINE_COMPONENTS.piston,
      cylinders: [0, 1, 2, 3].map((i) => getCylinderState(i, 0)),
      visibility: {
        block: true,
        pistons: true,
        valvetrain: true,
        timingChain: true,
        combustion: true,
        labels: true,
      },
      cameraPreset: 'threeQuarter',
    };

    // 1. Setup Three.js Renderer
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 2. Setup Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x131519);
    this.scene.fog = new THREE.FogExp2(0x131519, 0.045);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    this.camera.position.copy(this.targetCameraPos);

    // 3. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.targetControlsTarget);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = Math.PI * 0.52; // prevent dipping under floor

    this.controls.addEventListener('start', () => {
      this.isCameraTransitioning = false;
      this.simState.cameraPreset = 'free';
    });

    // 4. Studio Environment & Lighting
    this.setupEnvironmentAndLighting();

    // 5. Build Engine Materials & Geometries
    this.materials = createEngineMaterials();
    this.buildEngineAssembly();

    // 6. Interaction Listeners
    this.setupInteraction();

    // 7. Start Loop
    this.lastTime = performance.now();
    this.animate();

    // Notify initial state
    this.onStateChange(this.simState);
  }

  private setupEnvironmentAndLighting() {
    // Studio Environment map using PMREMGenerator
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {
      // Fallback
    }

    // Directional Key Light (warm metallic highlight)
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.6);
    keyLight.position.set(5, 8, 6);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 25;
      const d = 4.5;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Cool Rim Light (accents back edges & silhouettes)
    const rimLight = new THREE.DirectionalLight(0x70a5d8, 1.8);
    rimLight.position.set(-6, 5, -6);
    this.scene.add(rimLight);

    // Under-Engine Fill Light (highlights crankshaft & lower bearings)
    const underLight = new THREE.DirectionalLight(0x507090, 0.9);
    underLight.position.set(0, -3, 2);
    this.scene.add(underLight);

    // Hemisphere light for natural ambient fill
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x181c22, 1.0);
    this.scene.add(hemiLight);

    // Radial Contact Shadow Plane on the ground
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    });
    const shadowDisc = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = -1.15;
    this.scene.add(shadowDisc);

    // Precision engineering grid floor
    const grid = new THREE.GridHelper(16, 32, 0x303842, 0x1c2128);
    grid.position.y = -1.16;
    this.scene.add(grid);
  }

  private registerInteractable(mesh: THREE.Object3D, componentId: string) {
    this.interactableMeshes.push({ mesh, componentId });
    mesh.userData.componentId = componentId;
    if (mesh instanceof THREE.Mesh) {
      this.originalMaterials.set(mesh, mesh.material);
    }
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.originalMaterials.set(child, child.material);
        child.userData.componentId = componentId;
      }
    });
  }

  private buildEngineAssembly() {
    this.scene.add(this.engineRootGroup);
    this.engineRootGroup.position.set(0, 0, 0);

    // Assemble groups into engine hierarchy
    this.engineRootGroup.add(this.blockGroup);
    this.engineRootGroup.add(this.crankGroup);
    this.engineRootGroup.add(this.headGroup);
    this.engineRootGroup.add(this.valvetrainGroup);
    this.engineRootGroup.add(this.timingGroup);

    this.valvetrainGroup.add(this.intakeCamGroup);
    this.valvetrainGroup.add(this.exhaustCamGroup);

    const numCylinders = 4;
    const spacing = KINEMATICS.cylinderSpacing;
    const totalLength = spacing * (numCylinders - 1);
    const startX = -totalLength * 0.5;

    // ==========================================
    // 1. ENGINE BLOCK CUTAWAY & CYLINDER SLEEVES
    // ==========================================
    this.buildEngineBlock(startX, numCylinders, spacing);

    // ==========================================
    // 2. CRANKSHAFT WITH COUNTERWEIGHTS & FLYWHEEL
    // ==========================================
    this.buildCrankshaft(startX, numCylinders, spacing);

    // ==========================================
    // 3. PISTONS, CONNECTING RODS & COMBUSTION
    // ==========================================
    this.buildPistonsAndRods(startX, numCylinders, spacing);

    // ==========================================
    // 4. CYLINDER HEAD & DOHC VALVETRAIN
    // ==========================================
    this.buildValvetrain(startX, numCylinders, spacing);

    // ==========================================
    // 5. TIMING SPROCKETS & MULTI-LINK CHAIN
    // ==========================================
    this.buildTimingSystem(startX);
  }

  private buildEngineBlock(startX: number, numCylinders: number, spacing: number) {
    const blockWidth = spacing * numCylinders + 0.6;
    const blockDepth = 1.5;

    // 1. Lower Engine Bedplate / Oil Pan Flange (Grounded at bottom)
    const panGeom = new THREE.BoxGeometry(blockWidth, 0.18, blockDepth);
    const panMesh = new THREE.Mesh(panGeom, this.materials.aluminumBlock);
    panMesh.position.set(0, -0.75, 0);
    this.blockGroup.add(panMesh);
    this.registerInteractable(panMesh, 'engineBlock');

    // 2. Rear Block Stiffening Wall (gives solid background to internal mechanics)
    const backWallGeom = new THREE.BoxGeometry(blockWidth, 2.2, 0.16);
    const backWallMesh = new THREE.Mesh(backWallGeom, this.materials.aluminumBlock);
    backWallMesh.position.set(0, 0.75, -blockDepth * 0.45);
    this.blockGroup.add(backWallMesh);
    this.registerInteractable(backWallMesh, 'engineBlock');

    // 3. Front Lower Cross-Member (structural brace beneath crankshaft)
    const frontBraceGeom = new THREE.BoxGeometry(blockWidth, 0.22, 0.22);
    const frontBraceMesh = new THREE.Mesh(frontBraceGeom, this.materials.aluminumBlock);
    frontBraceMesh.position.set(0, -0.65, blockDepth * 0.45);
    this.blockGroup.add(frontBraceMesh);

    // 4. 4 Cast Iron Cylinder Sleeves (exposed via wide 200° cutaway window)
    for (let i = 0; i < numCylinders; i++) {
      const x = startX + i * spacing;

      // Outer cylinder barrel casting (cutaway opening on front side)
      const barrelGeom = new THREE.CylinderGeometry(
        KINEMATICS.cylinderBore * 0.58,
        KINEMATICS.cylinderBore * 0.58,
        1.70,
        32,
        1,
        true,
        Math.PI * 0.25, // Front window
        Math.PI * 1.5
      );
      const barrelMesh = new THREE.Mesh(barrelGeom, this.materials.aluminumBlock);
      barrelMesh.position.set(x, 1.48, 0);
      this.blockGroup.add(barrelMesh);

      // Inner precision honed cast-iron sleeve liner with cross-hatch hone
      const sleeveGeom = new THREE.CylinderGeometry(
        KINEMATICS.cylinderBore * 0.505,
        KINEMATICS.cylinderBore * 0.505,
        1.68,
        32,
        1,
        true,
        Math.PI * 0.25,
        Math.PI * 1.5
      );
      const sleeveMesh = new THREE.Mesh(sleeveGeom, this.materials.cylinderSleeveHoned);
      sleeveMesh.position.set(x, 1.48, 0);
      this.blockGroup.add(sleeveMesh);
      this.registerInteractable(sleeveMesh, 'engineBlock');

      // Top cylinder deck plate ring with machine chamfer
      const deckRing = new THREE.RingGeometry(KINEMATICS.cylinderBore * 0.49, KINEMATICS.cylinderBore * 0.62, 32);
      const deckMesh = new THREE.Mesh(deckRing, this.materials.aluminumCutawayEdge);
      deckMesh.rotation.x = -Math.PI / 2;
      deckMesh.position.set(x, 2.33, 0);
      this.blockGroup.add(deckMesh);
    }

    // 5. 5 Main Bearing Saddles & Removable Bearing Caps under the Crankshaft
    for (let m = 0; m <= numCylinders; m++) {
      const mx = startX - spacing * 0.5 + m * spacing;

      // Upper saddle in block
      const saddleGeom = new THREE.BoxGeometry(0.16, 0.45, 1.15);
      const saddleMesh = new THREE.Mesh(saddleGeom, this.materials.aluminumBlock);
      saddleMesh.position.set(mx, 0.28, 0);
      this.blockGroup.add(saddleMesh);

      // Lower removable main bearing cap (under journal at Y = -0.15)
      const capGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 20, 1, false, Math.PI, Math.PI);
      capGeom.rotateZ(Math.PI / 2);
      const capMesh = new THREE.Mesh(capGeom, this.materials.castIronCrank);
      capMesh.position.set(mx, 0, 0);
      this.blockGroup.add(capMesh);
      this.registerInteractable(capMesh, 'crankshaft');

      // 2 Main Cap High-Tensile Studs
      for (const studZ of [-0.26, 0.26]) {
        const studGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 10);
        const studMesh = new THREE.Mesh(studGeom, this.materials.timingChainPin);
        studMesh.position.set(mx, -0.18, studZ);
        this.blockGroup.add(studMesh);
      }
    }
  }

  private buildCrankshaft(startX: number, numCylinders: number, spacing: number) {
    const R = KINEMATICS.crankRadius;

    // 5 Main Bearing Journals along axis (X axis, Y=0, Z=0)
    for (let m = 0; m <= numCylinders; m++) {
      const mx = startX - spacing * 0.5 + m * spacing;
      const journalGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.22, 24);
      journalGeom.rotateZ(Math.PI / 2);
      const journalMesh = new THREE.Mesh(journalGeom, this.materials.polishedSteelJournal);
      journalMesh.position.set(mx, 0, 0);
      this.crankGroup.add(journalMesh);
      this.registerInteractable(journalMesh, 'crankshaft');
    }

    // 4 Crankpin Throws and Counterweight Webs
    for (let i = 0; i < numCylinders; i++) {
      const cx = startX + i * spacing;
      const pinAngleDeg = CRANK_PIN_ANGLES[i];
      const pinAngleRad = (pinAngleDeg * Math.PI) / 180;

      // Crank throw sub-group
      const throwGroup = new THREE.Group();
      throwGroup.position.set(cx, 0, 0);
      throwGroup.rotation.x = pinAngleRad;
      this.crankGroup.add(throwGroup);

      // Rod Journal (crank pin)
      const pinGeom = new THREE.CylinderGeometry(0.20, 0.20, 0.28, 24);
      pinGeom.rotateZ(Math.PI / 2);
      const pinMesh = new THREE.Mesh(pinGeom, this.materials.polishedSteelJournal);
      pinMesh.position.set(0, R, 0);
      throwGroup.add(pinMesh);
      this.registerInteractable(pinMesh, 'crankshaft');

      // Front & Rear Counterweight Cheeks for this cylinder
      const cwGeom = createCrankCounterweightGeometry();
      const cwFront = new THREE.Mesh(cwGeom, this.materials.castIronCrank);
      cwFront.position.set(-0.20, 0, 0);
      cwFront.rotation.y = Math.PI / 2;
      throwGroup.add(cwFront);
      this.registerInteractable(cwFront, 'crankshaft');

      const cwRear = new THREE.Mesh(cwGeom, this.materials.castIronCrank);
      cwRear.position.set(0.20, 0, 0);
      cwRear.rotation.y = Math.PI / 2;
      throwGroup.add(cwRear);
      this.registerInteractable(cwRear, 'crankshaft');
    }

    // Rear Flywheel with Starter Ring Gear
    const rearX = startX + (numCylinders - 0.5) * spacing + 0.35;
    const flywheelGroup = new THREE.Group();
    flywheelGroup.position.set(rearX, 0, 0);
    this.crankGroup.add(flywheelGroup);

    const flywheelGeom = new THREE.CylinderGeometry(0.95, 0.95, 0.22, 36);
    flywheelGeom.rotateZ(Math.PI / 2);
    const flywheelMesh = new THREE.Mesh(flywheelGeom, this.materials.flywheelDuctile);
    flywheelGroup.add(flywheelMesh);
    this.registerInteractable(flywheelMesh, 'flywheel');

    // Ring Gear Outer Teeth
    const ringTeethGeom = new THREE.CylinderGeometry(1.02, 1.02, 0.16, 48);
    ringTeethGeom.rotateZ(Math.PI / 2);
    const ringTeethMesh = new THREE.Mesh(ringTeethGeom, this.materials.ringGearTeeth);
    flywheelGroup.add(ringTeethMesh);
    this.registerInteractable(ringTeethMesh, 'flywheel');

    // Front Harmonic Damper / Crank Pulley
    const frontX = startX - 0.5 * spacing - 0.30;
    const damperGeom = new THREE.CylinderGeometry(0.60, 0.60, 0.20, 32);
    damperGeom.rotateZ(Math.PI / 2);
    const damperMesh = new THREE.Mesh(damperGeom, this.materials.timingSprocket);
    damperMesh.position.set(frontX, 0, 0);
    this.crankGroup.add(damperMesh);
    this.registerInteractable(damperMesh, 'crankshaft');
  }

  private buildPistonsAndRods(startX: number, numCylinders: number, spacing: number) {
    const pistonGeom = createPistonGeometry();
    const rodGeom = createConnectingRodGeometry();

    for (let i = 0; i < numCylinders; i++) {
      const cx = startX + i * spacing;

      // Piston Assembly Group
      const pGroup = new THREE.Group();
      pGroup.position.x = cx;
      this.engineRootGroup.add(pGroup);
      this.pistons.push(pGroup);

      // Piston Mesh
      const pMesh = new THREE.Mesh(pistonGeom, this.materials.forgedPistonCrown);
      pGroup.add(pMesh);
      this.registerInteractable(pMesh, 'piston');

      // Hollow Wrist Pin inside piston
      const wristPinGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.55, 18);
      wristPinGeom.rotateZ(Math.PI / 2);
      const wristPin = new THREE.Mesh(wristPinGeom, this.materials.wristPin);
      pGroup.add(wristPin);
      this.wristPins.push(wristPin);
      this.registerInteractable(wristPin, 'piston');

      // 3 Piston Rings on upper lands
      for (let r = 0; r < 3; r++) {
        const ringGeom = new THREE.TorusGeometry(KINEMATICS.cylinderBore * 0.49, 0.015, 8, 32);
        ringGeom.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeom, this.materials.pistonRing);
        ringMesh.position.y = 0.28 - r * 0.09;
        pGroup.add(ringMesh);
      }

      // Connecting Rod Assembly Group
      const rGroup = new THREE.Group();
      rGroup.position.set(cx, 0, 0);
      this.engineRootGroup.add(rGroup);
      this.connectingRods.push(rGroup);

      // Connecting Rod Mesh
      const rMesh = new THREE.Mesh(rodGeom, this.materials.forgedSteelRod);
      rMesh.rotation.y = Math.PI / 2;
      rGroup.add(rMesh);
      this.registerInteractable(rMesh, 'connectingRod');

      // Big end rod cap & bolts
      const capGeom = new THREE.CylinderGeometry(0.26, 0.26, 0.16, 16, 1, false, 0, Math.PI);
      capGeom.rotateZ(Math.PI / 2);
      const capMesh = new THREE.Mesh(capGeom, this.materials.forgedSteelRod);
      rGroup.add(capMesh);

      // Combustion Fireball inside combustion dome
      const fireGeom = new THREE.SphereGeometry(0.38, 16, 12);
      fireGeom.scale(1, 0.5, 1);
      const fireMesh = new THREE.Mesh(fireGeom, this.materials.combustionFlame.clone());
      fireMesh.position.set(cx, KINEMATICS.cylinderDeckY + 0.15, 0);
      fireMesh.visible = false;
      this.engineRootGroup.add(fireMesh);
      this.combustionFlashes.push(fireMesh);

      // Spark Plug
      const sparkPlug = createSparkPlugModel();
      sparkPlug.position.set(cx, KINEMATICS.cylinderDeckY + 0.65, 0);
      this.headGroup.add(sparkPlug);
      this.registerInteractable(sparkPlug, 'sparkPlug');

      // Spark Glow
      const sparkGlowGeom = new THREE.SphereGeometry(0.06, 8, 8);
      const sparkGlowMesh = new THREE.Mesh(sparkGlowGeom, this.materials.sparkGlow);
      sparkGlowMesh.position.set(cx, KINEMATICS.cylinderDeckY + 0.45, 0);
      sparkGlowMesh.visible = false;
      this.headGroup.add(sparkGlowMesh);
      this.sparkGlows.push(sparkGlowMesh);
    }
  }

  private buildValvetrain(startX: number, numCylinders: number, spacing: number) {
    const totalLength = spacing * (numCylinders - 1) + 1.2;

    // 1. Cutaway Cylinder Head Deck Base Plate
    const headDeckGeom = new THREE.BoxGeometry(totalLength + 0.2, 0.22, 1.4);
    const headDeckMesh = new THREE.Mesh(headDeckGeom, this.materials.aluminumBlock);
    headDeckMesh.position.set(0, KINEMATICS.cylinderDeckY + 0.11, 0);
    this.headGroup.add(headDeckMesh);
    this.registerInteractable(headDeckMesh, 'engineBlock');

    // Rear Cylinder Head Wall (gives solid backing to valvetrain)
    const headBackGeom = new THREE.BoxGeometry(totalLength + 0.2, 1.0, 0.15);
    const headBackMesh = new THREE.Mesh(headBackGeom, this.materials.aluminumBlock);
    headBackMesh.position.set(0, KINEMATICS.cylinderDeckY + 0.60, -0.62);
    this.headGroup.add(headBackMesh);

    // 5 Camshaft Bearing Towers & Machined Bearing Caps (supporting both camshafts)
    for (let t = 0; t <= numCylinders; t++) {
      const tx = startX - spacing * 0.5 + t * spacing;

      // Center bridge between intake and exhaust cams
      const towerGeom = new THREE.BoxGeometry(0.14, 0.95, 1.15);
      const towerMesh = new THREE.Mesh(towerGeom, this.materials.aluminumBlock);
      towerMesh.position.set(tx, KINEMATICS.cylinderDeckY + 0.58, 0);
      this.headGroup.add(towerMesh);

      // Intake Cam Bearing Cap (top of tower at +Z)
      const inCapGeom = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16, 1, false, 0, Math.PI);
      inCapGeom.rotateZ(Math.PI / 2);
      const inCapMesh = new THREE.Mesh(inCapGeom, this.materials.aluminumCutawayEdge);
      inCapMesh.position.set(tx, KINEMATICS.headTopY, KINEMATICS.intakeCamZ);
      this.headGroup.add(inCapMesh);

      // Exhaust Cam Bearing Cap (top of tower at -Z)
      const exCapMesh = new THREE.Mesh(inCapGeom, this.materials.aluminumCutawayEdge);
      exCapMesh.position.set(tx, KINEMATICS.headTopY, KINEMATICS.exhaustCamZ);
      this.headGroup.add(exCapMesh);
    }

    // 2. Camshafts (Intake at +Z, Exhaust at -Z)
    const shaftGeom = new THREE.CylinderGeometry(0.11, 0.11, totalLength, 24);
    shaftGeom.rotateZ(Math.PI / 2);

    // Intake Camshaft
    const inCamShaft = new THREE.Mesh(shaftGeom, this.materials.camshaftSteel);
    this.intakeCamGroup.position.set(0, KINEMATICS.headTopY, KINEMATICS.intakeCamZ);
    this.intakeCamGroup.add(inCamShaft);
    this.registerInteractable(inCamShaft, 'intakeCamshaft');

    // Exhaust Camshaft
    const exCamShaft = new THREE.Mesh(shaftGeom, this.materials.camshaftSteel);
    this.exhaustCamGroup.position.set(0, KINEMATICS.headTopY, KINEMATICS.exhaustCamZ);
    this.exhaustCamGroup.add(exCamShaft);
    this.registerInteractable(exCamShaft, 'exhaustCamshaft');

    // 3. Cam Lobes on both Camshafts
    const lobeGeom = createCamLobeGeometry();

    for (let i = 0; i < numCylinders; i++) {
      const cx = startX + i * spacing;
      // Cylinder 720 firing offset mapped to 360 cam degrees:
      // In 4-stroke, cam revolves once (360°) while crank revolves twice (720°).
      // Cam lobe angle = cylinder offset / 2
      const camOffsetDeg = [0, 90, 270, 180][i]; // Corresponding to 1-3-4-2 firing order
      const camOffsetRad = (camOffsetDeg * Math.PI) / 180;

      // 2 Intake Lobes per cylinder (at +Z)
      for (const zOff of [-0.15, 0.15]) {
        const inLobe = new THREE.Mesh(lobeGeom, this.materials.camLobePolished);
        inLobe.position.set(cx + zOff, 0, 0);
        // Peak of intake cam lobe points down when valve is pushed
        inLobe.rotation.x = camOffsetRad + Math.PI * 0.75;
        this.intakeCamGroup.add(inLobe);
        this.registerInteractable(inLobe, 'intakeCamshaft');
      }

      // 2 Exhaust Lobes per cylinder (at -Z)
      for (const zOff of [-0.15, 0.15]) {
        const exLobe = new THREE.Mesh(lobeGeom, this.materials.camLobePolished);
        exLobe.position.set(cx + zOff, 0, 0);
        exLobe.rotation.x = camOffsetRad - Math.PI * 0.25;
        this.exhaustCamGroup.add(exLobe);
        this.registerInteractable(exLobe, 'exhaustCamshaft');
      }
    }

    // 4. Valves & Helical Springs (16 Valves Total)
    const inValveGeom = createValveGeometry(false);
    const exValveGeom = createValveGeometry(true);
    const springGeom = createHelicalSpringGeometry(6.5, 0.085, 0.015, 0.58);

    for (let i = 0; i < numCylinders; i++) {
      const cx = startX + i * spacing;

      // 2 Intake Valves per cylinder (positioned under intake cam)
      for (const xOff of [-0.15, 0.15]) {
        const vMesh = new THREE.Mesh(inValveGeom, this.materials.valveStemChrome);
        const sMesh = new THREE.Mesh(springGeom, this.materials.valveSpringSteel);

        const vx = cx + xOff;
        const vy = KINEMATICS.cylinderDeckY + 0.10;
        const vz = KINEMATICS.intakeCamZ;

        vMesh.position.set(vx, vy, vz);
        sMesh.position.set(vx, vy + 0.35, vz);

        this.valvetrainGroup.add(vMesh);
        this.valvetrainGroup.add(sMesh);
        this.registerInteractable(vMesh, 'valves');
        this.registerInteractable(sMesh, 'valveSprings');

        this.valveMeshes.push({
          mesh: vMesh,
          springMesh: sMesh,
          baseY: vy,
          baseZ: vz,
          angleZ: 0,
          isExhaust: false,
          cylinderIndex: i,
        });
      }

      // 2 Exhaust Valves per cylinder (positioned under exhaust cam)
      for (const xOff of [-0.15, 0.15]) {
        const vMesh = new THREE.Mesh(exValveGeom, this.materials.valveStemChrome);
        const sMesh = new THREE.Mesh(springGeom, this.materials.valveSpringSteel);

        const vx = cx + xOff;
        const vy = KINEMATICS.cylinderDeckY + 0.10;
        const vz = KINEMATICS.exhaustCamZ;

        vMesh.position.set(vx, vy, vz);
        sMesh.position.set(vx, vy + 0.35, vz);

        this.valvetrainGroup.add(vMesh);
        this.valvetrainGroup.add(sMesh);
        this.registerInteractable(vMesh, 'valves');
        this.registerInteractable(sMesh, 'valveSprings');

        this.valveMeshes.push({
          mesh: vMesh,
          springMesh: sMesh,
          baseY: vy,
          baseZ: vz,
          angleZ: 0,
          isExhaust: true,
          cylinderIndex: i,
        });
      }
    }
  }

  private buildTimingSystem(startX: number) {
    const frontX = startX - KINEMATICS.cylinderSpacing * 0.5 - 0.45;
    this.timingGroup.position.set(frontX, 0, 0);

    // 1. Crankshaft Timing Sprocket (Z=0, Y=0)
    // Pitch radius: 0.38 (22 teeth)
    const crankTeeth = 22;
    const crankRadius = 0.38;
    const crankSprocketGeom = createTimingSprocketGeometry(crankTeeth, crankRadius, 0.10);
    this.crankSprocket = new THREE.Mesh(crankSprocketGeom, this.materials.timingSprocket);
    this.crankSprocket.rotation.y = Math.PI / 2;
    this.timingGroup.add(this.crankSprocket);
    this.registerInteractable(this.crankSprocket, 'timingChain');

    // 2. Intake Cam Sprocket (Z = intakeCamZ, Y = headTopY)
    // Pitch radius: 0.76 (44 teeth, exactly 2:1 gear ratio!)
    const camTeeth = 44;
    const camRadius = crankRadius * 2.0; // 0.76
    const camSprocketGeom = createTimingSprocketGeometry(camTeeth, camRadius, 0.10);

    this.intakeCamSprocket = new THREE.Mesh(camSprocketGeom, this.materials.timingSprocket);
    this.intakeCamSprocket.position.set(0, KINEMATICS.headTopY, KINEMATICS.intakeCamZ);
    this.intakeCamSprocket.rotation.y = Math.PI / 2;
    this.timingGroup.add(this.intakeCamSprocket);
    this.registerInteractable(this.intakeCamSprocket, 'timingChain');

    // 3. Exhaust Cam Sprocket (Z = exhaustCamZ, Y = headTopY)
    this.exhaustCamSprocket = new THREE.Mesh(camSprocketGeom, this.materials.timingSprocket);
    this.exhaustCamSprocket.position.set(0, KINEMATICS.headTopY, KINEMATICS.exhaustCamZ);
    this.exhaustCamSprocket.rotation.y = Math.PI / 2;
    this.timingGroup.add(this.exhaustCamSprocket);
    this.registerInteractable(this.exhaustCamSprocket, 'timingChain');

    // 4. Chain Tensioner Arm & Guide Rails
    const guideShape = new THREE.Shape();
    guideShape.moveTo(-0.06, 0.5);
    guideShape.quadraticCurveTo(0.12, 1.8, -0.06, 2.8);
    guideShape.lineTo(0.04, 2.8);
    guideShape.quadraticCurveTo(0.20, 1.8, 0.04, 0.5);
    guideShape.closePath();

    const guideGeom = new THREE.ExtrudeGeometry(guideShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.01 });
    guideGeom.center();
    const guideMesh = new THREE.Mesh(guideGeom, this.materials.chainGuidePlastic);
    guideMesh.position.set(0, 1.65, KINEMATICS.intakeCamZ + 0.38);
    guideMesh.rotation.y = Math.PI / 2;
    this.timingGroup.add(guideMesh);
    this.registerInteractable(guideMesh, 'timingChain');

    // 5. Closed Timing Chain Loop (CatmullRomCurve3)
    // Points along the chain route around the 3 sprockets
    const chainPoints: THREE.Vector3[] = [];
    const rCrank = crankRadius;
    const rCam = camRadius;
    const yCrank = 0;
    const yCam = KINEMATICS.headTopY;
    const zIn = KINEMATICS.intakeCamZ;
    const zEx = KINEMATICS.exhaustCamZ;

    // Bottom crank sprocket wrap (from bottom -Z to bottom +Z)
    chainPoints.push(new THREE.Vector3(0, yCrank - rCrank, 0));
    chainPoints.push(new THREE.Vector3(0, yCrank - rCrank * 0.7, rCrank * 0.7));
    chainPoints.push(new THREE.Vector3(0, yCrank + 0.1, rCrank * 0.95));

    // Tensioner run up to intake cam sprocket
    chainPoints.push(new THREE.Vector3(0, 1.1, zIn + 0.35));
    chainPoints.push(new THREE.Vector3(0, 2.2, zIn + 0.45));

    // Wrap over Intake Cam Sprocket
    chainPoints.push(new THREE.Vector3(0, yCam - 0.2, zIn + rCam));
    chainPoints.push(new THREE.Vector3(0, yCam + rCam * 0.7, zIn + rCam * 0.7));
    chainPoints.push(new THREE.Vector3(0, yCam + rCam, zIn));

    // Top run between Intake and Exhaust Cam Sprockets
    chainPoints.push(new THREE.Vector3(0, yCam + rCam + 0.02, 0));

    // Wrap over Exhaust Cam Sprocket
    chainPoints.push(new THREE.Vector3(0, yCam + rCam, zEx));
    chainPoints.push(new THREE.Vector3(0, yCam + rCam * 0.7, zEx - rCam * 0.7));
    chainPoints.push(new THREE.Vector3(0, yCam - 0.2, zEx - rCam));

    // Guide run down from exhaust cam to crank
    chainPoints.push(new THREE.Vector3(0, 2.2, zEx - 0.35));
    chainPoints.push(new THREE.Vector3(0, 1.1, zEx - 0.25));
    chainPoints.push(new THREE.Vector3(0, yCrank + 0.1, -rCrank * 0.95));
    chainPoints.push(new THREE.Vector3(0, yCrank - rCrank * 0.7, -rCrank * 0.7));

    this.chainSpline = new THREE.CatmullRomCurve3(chainPoints, true, 'centripetal');

    // InstancedMesh for realistic timing chain links
    const linkGeom = createChainLinkGeometry();
    this.timingChainMesh = new THREE.InstancedMesh(linkGeom, this.materials.timingChainOuter, this.chainLinkCount);
    this.timingChainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.timingGroup.add(this.timingChainMesh);
    this.registerInteractable(this.timingChainMesh, 'timingChain');

    this.updateChainLinks(0);
  }

  private updateChainLinks(progressOffset: number) {
    if (!this.timingChainMesh || !this.chainSpline) return;

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(1, 0, 0); // Chain links lay perpendicular across width

    for (let i = 0; i < this.chainLinkCount; i++) {
      const u = (i / this.chainLinkCount + progressOffset) % 1.0;
      const pos = this.chainSpline.getPointAt(u);
      const tangent = this.chainSpline.getTangentAt(u);

      dummy.position.copy(pos);
      // Orient link along the tangent of the chain path
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      // Alternate outer and inner link plates for realistic roller chain look
      const isInner = i % 2 === 0;
      dummy.scale.set(1.0, 1.0, isInner ? 0.9 : 1.1);

      dummy.updateMatrix();
      this.timingChainMesh.setMatrixAt(i, dummy.matrix);
    }

    this.timingChainMesh.instanceMatrix.needsUpdate = true;
    this.timingChainMesh.computeBoundingSphere();
  }

  // ==========================================
  // ANIMATION LOOP & KINEMATICS UPDATE
  // ==========================================
  private animate = () => {
    if (this.isDisposed) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Advance Crankshaft Angle if Running
    if (this.simState.isRunning && this.simState.rpm > 0) {
      // Deg/sec = (RPM * 360) / 60 = RPM * 6
      const crankSpeedDegPerSec = this.simState.rpm * 6 * this.simState.simSpeed;
      this.simState.crankAngle = (this.simState.crankAngle + crankSpeedDegPerSec * dt) % 720;
      this.simState.camAngle = (this.simState.crankAngle * 0.5) % 360;

      // Update Web Audio engine synthesis
      if (this.simState.audioEnabled) {
        engineAudio.update(this.simState.rpm, true);
      }
    } else {
      if (this.simState.audioEnabled) {
        engineAudio.update(0, false);
      }
    }

    // Apply Mechanical Kinematics
    this.updateKinematics(dt);

    // Camera smoothing
    if (this.isCameraTransitioning) {
      this.camera.position.lerp(this.targetCameraPos, 0.08);
      this.controls.target.lerp(this.targetControlsTarget, 0.08);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.02) {
        this.isCameraTransitioning = false;
      }
    }

    this.controls.update();

    // Render Scene
    this.renderer.render(this.scene, this.camera);

    // Frame scheduling (software-gl safe)
    if (this.isSoftwareGl) {
      this.afterDrawSoftwareGl(this.animate);
    } else {
      this.frameId = requestAnimationFrame(this.animate);
    }
  };

  private afterDrawSoftwareGl(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDisposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateKinematics(dt: number) {
    const crankAngleDeg = this.simState.crankAngle;
    const crankAngleRad = (crankAngleDeg * Math.PI) / 180;
    const camAngleRad = (this.simState.camAngle * Math.PI) / 180;

    // 1. Rotate Crankshaft Group
    // In our coordinate space: crankshaft axis is X. Y is vertical. Z is transverse.
    // Crank rotates around X axis
    this.crankGroup.rotation.x = -crankAngleRad;

    // 2. Rotate Camshaft Groups at half speed
    this.intakeCamGroup.rotation.x = -camAngleRad;
    this.exhaustCamGroup.rotation.x = -camAngleRad;

    // 3. Rotate Timing Sprockets
    if (this.crankSprocket) {
      this.crankSprocket.rotation.x = -crankAngleRad;
    }
    if (this.intakeCamSprocket) {
      this.intakeCamSprocket.rotation.x = -camAngleRad;
    }
    if (this.exhaustCamSprocket) {
      this.exhaustCamSprocket.rotation.x = -camAngleRad;
    }

    // 4. Update Timing Chain Motion
    // Chain travels synchronously with sprockets: progress offset = camAngle / 360
    this.chainLinearProgress = (this.simState.camAngle / 360) % 1.0;
    this.updateChainLinks(this.chainLinearProgress);

    // 5. Update Cylinders, Pistons & Connecting Rods
    const R = KINEMATICS.crankRadius;
    const L = KINEMATICS.rodLength;

    for (let i = 0; i < 4; i++) {
      const cylState = getCylinderState(i, crankAngleDeg);
      this.simState.cylinders[i] = cylState;

      // Crank pin angle for cylinder i in crankshaft local space
      const pinOffsetRad = (CRANK_PIN_ANGLES[i] * Math.PI) / 180;
      const currentPinTheta = crankAngleRad + pinOffsetRad;

      const slider = calculateSliderCrank(currentPinTheta, R, L);

      // Piston moves purely along Y
      const pGroup = this.pistons[i];
      if (pGroup) {
        pGroup.position.y = slider.pistonY;
      }

      // Connecting Rod
      // Top wrist pin is at (x, slider.pistonY, 0)
      // Bottom big end journal is at (x, R * cos(theta), R * sin(theta))
      const rGroup = this.connectingRods[i];
      if (rGroup) {
        // Position rod group at wrist pin
        rGroup.position.y = slider.pistonY;
        // Tilt rod by slider.rodAngle
        rGroup.rotation.x = slider.rodAngle;
        // The rod geometry extends downward from (0, 0, 0) to (0, -L, 0)
        rGroup.position.z = 0;
      }

      // Combustion Flame Visual Effect
      const fireMesh = this.combustionFlashes[i];
      if (fireMesh) {
        if (this.simState.visibility.combustion && cylState.isCombusting) {
          fireMesh.visible = true;
          // Scale & pulse flame during power stroke
          const fireScale = 0.8 + 0.5 * Math.sin(cylState.phaseProgress * Math.PI);
          fireMesh.scale.set(fireScale, fireScale * 0.6, fireScale);
          const mat = fireMesh.material as THREE.MeshStandardMaterial;
          mat.opacity = Math.max(0.1, 0.9 * (1.0 - cylState.phaseProgress));
        } else {
          fireMesh.visible = false;
        }
      }

      // Spark Ignition Flash
      const spark = this.sparkGlows[i];
      if (spark) {
        spark.visible = this.simState.visibility.combustion && cylState.sparkActive;
      }
    }

    // 6. Update 16 Valves & Compressing Springs
    for (const vData of this.valveMeshes) {
      const cylState = this.simState.cylinders[vData.cylinderIndex];
      const liftFactor = vData.isExhaust ? cylState.exhaustValveLift : cylState.intakeValveLift;
      const currentLift = liftFactor * KINEMATICS.maxValveLift;

      // Valve depresses downward into cylinder (-Y)
      vData.mesh.position.y = vData.baseY - currentLift;

      // Helical valve spring visibly compresses
      vData.springMesh.position.y = vData.baseY + 0.35 - currentLift * 0.5;
      const springCompression = Math.max(0.65, 1.0 - liftFactor * 0.30);
      vData.springMesh.scale.set(1.0, springCompression, 1.0);
    }

    // 7. Smooth Exploded View Separation
    this.currentExplodedAmount = THREE.MathUtils.damp(
      this.currentExplodedAmount,
      this.simState.explodedAmount,
      8,
      dt
    );

    const exp = this.currentExplodedAmount;
    // Cylinder head moves up
    this.headGroup.position.y = exp * 1.5;
    // Valvetrain separates further up
    this.valvetrainGroup.position.y = exp * 2.4;
    // Camshafts splay outwards
    this.intakeCamGroup.position.z = KINEMATICS.intakeCamZ + exp * 0.45;
    this.exhaustCamGroup.position.z = KINEMATICS.exhaustCamZ - exp * 0.45;
    // Timing assembly slides forward
    this.timingGroup.position.x = -KINEMATICS.cylinderSpacing * 2.0 - 0.45 - exp * 0.9;
    // Lower crankcase drops slightly
    this.blockGroup.position.y = -exp * 0.35;
    this.crankGroup.position.y = -exp * 0.75;

    // Apply visibility toggles
    this.blockGroup.visible = this.simState.visibility.block;
    for (let i = 0; i < 4; i++) {
      if (this.pistons[i]) this.pistons[i].visible = this.simState.visibility.pistons;
      if (this.connectingRods[i]) this.connectingRods[i].visible = this.simState.visibility.pistons;
    }
    this.valvetrainGroup.visible = this.simState.visibility.valvetrain;
    this.timingGroup.visible = this.simState.visibility.timingChain;
  }

  // ==========================================
  // INTERACTION & RAYCASTING
  // ==========================================
  private setupInteraction() {
    const el = this.renderer.domElement;

    el.addEventListener('pointerdown', (e) => {
      this.handlePointerClick(e);
    });

    window.addEventListener('resize', this.onWindowResize);
  }

  private handlePointerClick(e: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshesToTest: THREE.Object3D[] = [];
    for (const item of this.interactableMeshes) {
      meshesToTest.push(item.mesh);
    }

    const intersects = this.raycaster.intersectObjects(meshesToTest, true);
    if (intersects.length > 0) {
      let target: THREE.Object3D | null = intersects[0].object;
      while (target && !target.userData.componentId && target.parent) {
        target = target.parent;
      }

      if (target && target.userData.componentId) {
        const compId = target.userData.componentId as string;
        const comp = ENGINE_COMPONENTS[compId];
        if (comp) {
          this.setSelectedComponent(comp);
        }
      }
    }
  }

  public setSelectedComponent(comp: EngineComponentInfo) {
    this.simState.selectedComponent = comp;

    // Reset previous selection highlights
    if (this.selectedMesh) {
      this.restoreMeshMaterial(this.selectedMesh);
      this.selectedMesh = null;
    }

    // Find and highlight new mesh
    const match = this.interactableMeshes.find((m) => m.componentId === comp.id);
    if (match) {
      this.selectedMesh = match.mesh;
      this.applyHighlight(match.mesh);
    }

    this.onStateChange(this.simState);
  }

  private applyHighlight(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.materials.selectionHighlight;
      }
    });
  }

  private restoreMeshMaterial(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const orig = this.originalMaterials.get(child);
        if (orig) child.material = orig;
      }
    });
  }

  // ==========================================
  // CAMERA PRESETS
  // ==========================================
  public setCameraPreset(preset: EngineSimState['cameraPreset']) {
    this.simState.cameraPreset = preset;
    this.isCameraTransitioning = true;

    switch (preset) {
      case 'threeQuarter':
        this.targetCameraPos.set(3.8, 3.2, 4.6);
        this.targetControlsTarget.set(0, 1.6, 0);
        break;
      case 'front':
        // Front view focused on sprockets and timing chain
        this.targetCameraPos.set(-5.6, 2.0, 0.1);
        this.targetControlsTarget.set(-1.8, 1.8, 0);
        break;
      case 'side':
        // Side view looking straight into the 4 cylinders
        this.targetCameraPos.set(0.1, 1.9, 5.4);
        this.targetControlsTarget.set(0, 1.6, 0);
        break;
      case 'top':
        // Bird's eye looking down at valvetrain & camshafts
        this.targetCameraPos.set(0, 6.8, 0.2);
        this.targetControlsTarget.set(0, 2.2, 0);
        break;
      case 'crank':
        // Close-up on crankshaft throws and counterweights
        this.targetCameraPos.set(0.6, 0.4, 3.2);
        this.targetControlsTarget.set(0, 0.2, 0);
        break;
      case 'valvetrain':
        // Close-up on camshafts, lobes, valves and springs
        this.targetCameraPos.set(0.4, 4.1, 2.6);
        this.targetControlsTarget.set(0, 3.2, 0);
        break;
      case 'free':
        this.isCameraTransitioning = false;
        break;
    }

    this.onStateChange(this.simState);
  }

  // ==========================================
  // PUBLIC CONTROLS API
  // ==========================================
  public setRPM(rpm: number) {
    this.simState.rpm = Math.max(0, Math.min(6000, rpm));
    this.onStateChange(this.simState);
  }

  public setRunning(running: boolean) {
    this.simState.isRunning = running;
    if (running && this.simState.rpm === 0) {
      this.simState.rpm = 800; // auto-start at idle
    }
    this.onStateChange(this.simState);
  }

  public setCrankAngle(deg: number) {
    this.simState.crankAngle = ((deg % 720) + 720) % 720;
    this.simState.camAngle = (this.simState.crankAngle * 0.5) % 360;
    this.onStateChange(this.simState);
  }

  public setSimSpeed(speed: number) {
    this.simState.simSpeed = Math.max(0.05, Math.min(2.0, speed));
    this.onStateChange(this.simState);
  }

  public setExplodedAmount(amount: number) {
    this.simState.explodedAmount = Math.max(0, Math.min(1.0, amount));
    this.onStateChange(this.simState);
  }

  public toggleAudio() {
    this.simState.audioEnabled = !this.simState.audioEnabled;
    if (this.simState.audioEnabled) {
      engineAudio.start();
      engineAudio.setMuted(false);
      engineAudio.setVolume(this.simState.audioVolume);
    } else {
      engineAudio.setMuted(true);
    }
    this.onStateChange(this.simState);
  }

  public setAudioVolume(vol: number) {
    this.simState.audioVolume = vol;
    engineAudio.setVolume(vol);
    this.onStateChange(this.simState);
  }

  public toggleVisibility(part: keyof EngineSimState['visibility']) {
    this.simState.visibility[part] = !this.simState.visibility[part];
    this.onStateChange(this.simState);
  }

  public resetSimulation() {
    this.simState.crankAngle = 0;
    this.simState.camAngle = 0;
    this.simState.rpm = 1200;
    this.simState.isRunning = true;
    this.simState.explodedAmount = 0.0;
    this.setCameraPreset('threeQuarter');
  }

  private onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onWindowResize);
    this.controls.dispose();
    this.renderer.dispose();
    engineAudio.setMuted(true);
  }
}
