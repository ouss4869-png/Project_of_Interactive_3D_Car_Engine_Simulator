import { CylinderState, EngineComponentInfo, StrokePhase } from './types';

// Physical dimensions for kinematics
export const KINEMATICS = {
  crankRadius: 0.44, // R (meters/scaled units)
  rodLength: 1.32, // L
  cylinderBore: 0.86,
  cylinderSpacing: 1.16, // Distance along X between cylinder centers
  wristPinOffset: 0.0,
  maxValveLift: 0.22,
  crankBaseY: 0.0, // Crankshaft center line Y
  cylinderDeckY: 2.15, // Top of cylinder block deck
  headTopY: 3.35, // Camshaft center line Y
  intakeCamZ: 0.42, // Camshaft offset in Z
  exhaustCamZ: -0.42,
  sparkPlugY: 2.75,
};

// Standard Inline-4 flat-plane crank 720° firing order: 1 - 3 - 4 - 2
// Cylinder 1 fires at 0°, Cylinder 3 at 180°, Cylinder 4 at 360°, Cylinder 2 at 540°
export const CYLINDER_OFFSETS = [
  0, // Cylinder 1 (offset 0 -> fires at crank 0°)
  180, // Cylinder 2 (offset 180 -> fires at crank 540°)
  540, // Cylinder 3 (offset 540 -> fires at crank 180°)
  360, // Cylinder 4 (offset 360 -> fires at crank 360°)
];

// Physical crank pin angle offset on the crankshaft (0° to 360°)
// Cylinders 1 & 4 share crank angle 0°, Cylinders 2 & 3 share crank angle 180°
export const CRANK_PIN_ANGLES = [0, 180, 180, 0];

/**
 * Calculates crank-slider kinematics for a given crank angle in radians
 */
export function calculateSliderCrank(crankAngleRad: number, R = KINEMATICS.crankRadius, L = KINEMATICS.rodLength) {
  // theta = 0 at Top Dead Center (piston highest, crank pin at top)
  const sinTheta = Math.sin(crankAngleRad);
  const cosTheta = Math.cos(crankAngleRad);

  // Crank pin position in local 2D plane (transverse Z or X, and vertical Y)
  const pinTransverse = R * sinTheta;
  const pinY = R * cosTheta;

  // Slider position (piston wrist pin Y)
  // y_piston = R*cos(theta) + sqrt(L^2 - (R*sin(theta))^2)
  const underRadical = Math.max(0, L * L - pinTransverse * pinTransverse);
  const pistonY = pinY + Math.sqrt(underRadical);

  // Connecting rod tilt angle (radians)
  const rodAngle = Math.asin(Math.max(-1, Math.min(1, pinTransverse / L)));

  // Normalized stroke progress: 0 at BDC, 1 at TDC
  const tdcY = L + R;
  const bdcY = L - R;
  const normalizedHeight = Math.max(0, Math.min(1, (pistonY - bdcY) / (tdcY - bdcY)));

  // Velocity (derivative with respect to theta)
  const velocity = -R * sinTheta - (R * R * sinTheta * cosTheta) / Math.sqrt(underRadical);

  return {
    pinTransverse,
    pinY,
    pistonY,
    rodAngle,
    normalizedHeight,
    velocity,
  };
}

/**
 * Calculates progressive valve lift (0.0 to 1.0) given current crank angle within 0-720° cycle
 * and valve opening range [openStart, openEnd] in degrees.
 */
export function calculateValveLift(cycleDeg: number, openStartDeg: number, openEndDeg: number): number {
  let deg = cycleDeg % 720;
  if (deg < 0) deg += 720;

  // Handle wrap-around if openStart > openEnd
  let inRange = false;
  let duration = 0;
  let progress = 0;

  if (openStartDeg < openEndDeg) {
    if (deg >= openStartDeg && deg <= openEndDeg) {
      inRange = true;
      duration = openEndDeg - openStartDeg;
      progress = (deg - openStartDeg) / duration;
    }
  } else {
    // e.g., 700° to 120°
    if (deg >= openStartDeg || deg <= openEndDeg) {
      inRange = true;
      duration = (720 - openStartDeg) + openEndDeg;
      const offset = deg >= openStartDeg ? (deg - openStartDeg) : (720 - openStartDeg + deg);
      progress = offset / duration;
    }
  }

  if (!inRange) return 0;

  // Smooth sinusoidal cam lobe lift profile: rises progressively, dwells, and cushions down
  // Lift = sin^1.5(pi * progress)
  const sinFactor = Math.sin(Math.PI * progress);
  return Math.pow(Math.max(0, sinFactor), 1.4);
}

/**
 * Returns stroke phase, progress (0-1), valve lifts, and combustion state for a cylinder
 */
export function getCylinderState(cylinderIndex: number, masterCrankDeg: number): CylinderState {
  // Normalize master crank angle to 0..720
  const normalizedMaster = ((masterCrankDeg % 720) + 720) % 720;
  const offset = CYLINDER_OFFSETS[cylinderIndex];
  const relativeCycle = (normalizedMaster + offset) % 720;

  // Stroke identification in 720° cycle:
  // 0° - 180°: Power
  // 180° - 360°: Exhaust
  // 360° - 540°: Intake
  // 540° - 720°: Compression
  let phase: StrokePhase = 'Power';
  let phaseProgress = 0;

  if (relativeCycle < 180) {
    phase = 'Power';
    phaseProgress = relativeCycle / 180;
  } else if (relativeCycle < 360) {
    phase = 'Exhaust';
    phaseProgress = (relativeCycle - 180) / 180;
  } else if (relativeCycle < 540) {
    phase = 'Intake';
    phaseProgress = (relativeCycle - 360) / 180;
  } else {
    phase = 'Compression';
    phaseProgress = (relativeCycle - 540) / 180;
  }

  // Kinematic calculations for piston & rod
  // In crank angle terms, TDC occurs at 0°, 360°, 720°. BDC occurs at 180°, 540°.
  const crankAngleRad = (relativeCycle * Math.PI) / 180;
  const slider = calculateSliderCrank(crankAngleRad);

  // Valve Timing (realistic timing with duration ~220° crank degrees):
  // Intake valve opens slightly before TDC (e.g. 345°) and closes after BDC (e.g. 565°)
  const intakeValveLift = calculateValveLift(relativeCycle, 345, 565);

  // Exhaust valve opens before BDC (e.g. 155°) and closes slightly after TDC (e.g. 375°)
  const exhaustValveLift = calculateValveLift(relativeCycle, 155, 375);

  // Combustion flame active in power stroke (0° to 110°)
  const isCombusting = relativeCycle >= 0 && relativeCycle <= 110;

  // Spark active in ignition window (712° to 720° / 0° to 10°)
  const sparkActive = relativeCycle >= 710 || relativeCycle <= 15;

  return {
    cylinderIndex,
    crankAngleRelative: relativeCycle,
    pistonHeight: slider.normalizedHeight,
    pistonVelocity: slider.velocity,
    rodAngle: slider.rodAngle,
    intakeValveLift,
    exhaustValveLift,
    phase,
    phaseProgress,
    isCombusting,
    sparkActive,
  };
}

/**
 * Technical database of engine components for inspection
 */
export const ENGINE_COMPONENTS: Record<string, EngineComponentInfo> = {
  piston: {
    id: 'piston',
    name: 'Hypereutectic Aluminum Piston',
    category: 'Cranktrain',
    functionSummary: 'Receives the high-pressure gas expansion from combustion and transfers mechanical force down through the wrist pin and connecting rod.',
    mechanicalInteraction: 'Slides within the honed cast-iron cylinder sleeve. Linked to connecting rod via a floating steel wrist pin (gudgeon pin) with retaining circlips.',
    cycleRole: 'Moves down during Intake and Power strokes; moves up during Compression and Exhaust strokes.',
    technicalSpecs: {
      material: 'Forged 4032 / Hypereutectic Al-Si Alloy',
      operatingTemp: '280°C - 340°C Crown Peak',
      motionType: 'Linear Reciprocating (Stroke = 88 mm)',
      clearanceOrSpec: '0.035 mm - 0.050 mm skirt-to-bore clearance',
    },
  },
  connectingRod: {
    id: 'connectingRod',
    name: 'H-Beam Forged Connecting Rod',
    category: 'Cranktrain',
    functionSummary: 'Translates the linear reciprocating motion of the piston into the rotational motion of the crankshaft.',
    mechanicalInteraction: 'Small end houses bronze wrist-pin bushing; big end clamps onto the crankshaft rod journal with high-tensile ARP-grade rod bolts and tri-metal bearings.',
    cycleRole: 'Transmits peak combustion shock loads (up to 60+ kN) during the power stroke and guides piston kinematics.',
    technicalSpecs: {
      material: '4340 Chrome-Moly Forged Steel',
      operatingTemp: '120°C - 160°C Big End',
      motionType: 'Planar Oscillation (±19.2° max tilt)',
      clearanceOrSpec: '0.040 mm bearing oil clearance',
    },
  },
  crankshaft: {
    id: 'crankshaft',
    name: 'Forged Counterweighted Crankshaft',
    category: 'Cranktrain',
    functionSummary: 'The mechanical backbone of the engine; converts reciprocating piston thrust into smooth output torque to drive the flywheel and transmission.',
    mechanicalInteraction: 'Supported by 5 main bearing journals with cross-drilled chamfered oil passages. Drives the front timing sprocket and rear flywheel.',
    cycleRole: 'Rotates 720° for a full 4-stroke cycle; balanced counterweights offset primary and secondary inertial forces.',
    technicalSpecs: {
      material: 'Forged 4140 Steel / Nitrided Journals',
      operatingTemp: '90°C - 110°C Engine Oil Temp',
      motionType: 'Continuous Pure Rotation (0 - 6000+ RPM)',
      clearanceOrSpec: '0.038 mm main journal oil clearance',
    },
  },
  intakeCamshaft: {
    id: 'intakeCamshaft',
    name: 'DOHC Intake Camshaft',
    category: 'Valvetrain',
    functionSummary: 'Actuates the dual intake valves for each cylinder, timing the induction of fresh air-fuel charge into the combustion chambers.',
    mechanicalInteraction: 'Driven by the intake timing sprocket at exactly 1:2 speed ratio (half crank speed). Cam lobes push hydraulic bucket tappets down.',
    cycleRole: 'Depresses intake valves during the 360°–540° Intake stroke, maximizing volumetric efficiency.',
    technicalSpecs: {
      material: 'Chilled Cast Iron / Induction-hardened steel',
      operatingTemp: '95°C - 120°C',
      motionType: 'Rotational (Half Crankshaft RPM)',
      clearanceOrSpec: '9.8 mm peak valve lift profile',
    },
  },
  exhaustCamshaft: {
    id: 'exhaustCamshaft',
    name: 'DOHC Exhaust Camshaft',
    category: 'Valvetrain',
    functionSummary: 'Controls the opening and closing of dual exhaust valves to evacuate burnt exhaust gases from each cylinder into the exhaust manifold.',
    mechanicalInteraction: 'Synchronized via timing chain to the intake camshaft and crankshaft. Precision lobe profile governs duration and overlap.',
    cycleRole: 'Depresses exhaust valves during the 180°–360° Exhaust stroke.',
    technicalSpecs: {
      material: 'Nitrided Billet Alloy Steel',
      operatingTemp: '110°C - 140°C',
      motionType: 'Rotational (Half Crankshaft RPM)',
      clearanceOrSpec: '9.5 mm lift, 220° duration',
    },
  },
  valves: {
    id: 'valves',
    name: 'Poppet Valves (Intake & Exhaust)',
    category: 'Valvetrain',
    functionSummary: 'Precision-ground mushroom valves that seal the combustion chamber during compression and power strokes, and open to allow gas exchange.',
    mechanicalInteraction: 'Guided in bronze valve guides; sealed by hardened beryllium-copper valve seat inserts; returned by dual concentric springs.',
    cycleRole: 'Both valves seal during compression & power; intake opens in induction; exhaust opens in scavenging.',
    technicalSpecs: {
      material: 'Sodium-Filled Inconel (Exhaust) / 21-4N Steel (Intake)',
      operatingTemp: 'Intake: ~350°C | Exhaust: ~750°C - 850°C',
      motionType: 'Linear Reciprocating',
      clearanceOrSpec: '45° seat angle, multi-angle cut',
    },
  },
  valveSprings: {
    id: 'valveSprings',
    name: 'High-Rate Helical Valve Springs',
    category: 'Valvetrain',
    functionSummary: 'Provides continuous return force to keep the valve followers in intimate contact with the cam lobes and prevent valve float at high RPM.',
    mechanicalInteraction: 'Retained between the cylinder head spring pocket and titanium valve spring retainers locked with split collets/keepers.',
    cycleRole: 'Rapidly closes the valve as the cam lobe peak passes, preventing valve-to-piston contact.',
    technicalSpecs: {
      material: 'Chrome-Silicon Vanadium Spring Steel',
      operatingTemp: '100°C - 130°C',
      motionType: 'Helical Compression / Extension',
      clearanceOrSpec: '45 kg seat pressure, 115 kg open pressure',
    },
  },
  timingChain: {
    id: 'timingChain',
    name: 'Silent Multi-Link Timing Chain & Tensioner',
    category: 'Timing',
    functionSummary: 'Transmits synchronized rotation from the crankshaft timing sprocket to the dual overhead camshaft sprockets with exact 2:1 reduction.',
    mechanicalInteraction: 'Envelops the crank sprocket (22 teeth) and two cam sprockets (44 teeth), guided by synthetic polyamide damping rails and hydraulic tensioner.',
    cycleRole: 'Maintains exact valve-to-piston mechanical phasing across all 720° of the engine cycle.',
    technicalSpecs: {
      material: 'Hardened Micro-Alloy Steel Links & Chromized Pins',
      operatingTemp: '90°C - 110°C Engine Oil',
      motionType: 'Closed Loop Continuous Travel',
      clearanceOrSpec: 'Hydraulic oil-pressurized automatic tensioner',
    },
  },
  engineBlock: {
    id: 'engineBlock',
    name: 'Die-Cast Aluminum Cylinder Block & Sleeves',
    category: 'Structure',
    functionSummary: 'Main structural housing of the engine containing 4 inline cylinder bores, coolant jackets, main bearing girdles, and oil galleries.',
    mechanicalInteraction: 'Supports the crankshaft beneath, mounts the cylinder head above with head studs, and guides the reciprocating pistons.',
    cycleRole: 'Contains high-pressure combustion forces (100+ bar) and conducts thermal energy into the cooling system.',
    technicalSpecs: {
      material: 'A319 / A356 Cast Aluminum with Centrifugal Cast-Iron Liners',
      operatingTemp: '85°C - 98°C Coolant Temp',
      motionType: 'Stationary Rigid Foundation',
      clearanceOrSpec: '86.0 mm standard bore diameter, cross-hatch hone',
    },
  },
  sparkPlug: {
    id: 'sparkPlug',
    name: 'Iridium-Tipped High-Energy Spark Plug',
    category: 'Ignition',
    functionSummary: 'Delivers a 30,000+ Volt electrical arc across the electrode gap to initiate controlled flame front propagation in the compressed charge.',
    mechanicalInteraction: 'Threaded centrally into the pent-roof combustion chamber between the 4 valves for optimal flame kernel propagation.',
    cycleRole: 'Fires precisely before TDC (e.g. 15°–25° BTDC) to allow peak cylinder pressure to occur at ~14° after TDC.',
    technicalSpecs: {
      material: 'Alumina Ceramic Insulator & Laser-Welded 0.6mm Iridium Tip',
      operatingTemp: '500°C - 800°C Self-Cleaning Tip Temp',
      motionType: 'Stationary Solid-State Arc',
      clearanceOrSpec: '0.80 mm electrode gap',
    },
  },
  flywheel: {
    id: 'flywheel',
    name: 'Balanced Dual-Mass Engine Flywheel',
    category: 'Cranktrain',
    functionSummary: 'Stores rotational kinetic energy to smooth out torque pulses between combustion events and provides the starter ring gear.',
    mechanicalInteraction: 'Bolted to the rear crankshaft flange with 8 grade-12.9 bolts; couples to the vehicle clutch or torque converter.',
    cycleRole: 'Carries the crankshaft momentum smoothly through non-firing strokes (Compression, Exhaust, Intake).',
    technicalSpecs: {
      material: 'Nodular Ductile Iron / Billet Steel Ring Gear',
      operatingTemp: '80°C - 150°C',
      motionType: 'Rotational Inertial Damper',
      clearanceOrSpec: 'Precision dynamic balanced to < 0.5 g·cm',
    },
  },
};
