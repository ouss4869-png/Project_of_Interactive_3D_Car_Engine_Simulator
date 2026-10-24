import * as THREE from 'three';
import { KINEMATICS } from './kinematics';

/**
 * Creates a procedural teardrop cam lobe geometry
 */
export function createCamLobeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const baseR = 0.18; // Base circle radius
  const noseR = 0.08; // Nose circle radius
  const lift = 0.15; // Cam lift offset

  // Draw base circle arc (from -90 to +90 deg relative to nose)
  const angleStart = Math.PI * 0.35;
  const angleEnd = Math.PI * 1.65;
  shape.absarc(0, 0, baseR, angleStart, angleEnd, false);

  // Tangents connecting base circle to nose
  shape.lineTo(noseR, lift);
  shape.absarc(0, lift, noseR, 0, Math.PI, false);
  shape.lineTo(-baseR * Math.cos(angleStart), -baseR * Math.sin(angleStart));

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 3,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  return geom;
}

/**
 * Creates a detailed piston geometry with crown valve recesses, ring lands, and skirt
 */
export function createPistonGeometry(): THREE.BufferGeometry {
  const boreR = KINEMATICS.cylinderBore * 0.49; // 0.42
  const height = 0.72;

  // Lathe profile for piston crown & ring lands
  const points: THREE.Vector2[] = [];
  // Center of crown with subtle dish
  points.push(new THREE.Vector2(0, height * 0.5));
  points.push(new THREE.Vector2(boreR * 0.75, height * 0.5));
  points.push(new THREE.Vector2(boreR * 0.98, height * 0.5));
  points.push(new THREE.Vector2(boreR, height * 0.5 - 0.02)); // Top chamfer

  // Top ring land
  points.push(new THREE.Vector2(boreR, height * 0.42));
  points.push(new THREE.Vector2(boreR - 0.045, height * 0.42));
  points.push(new THREE.Vector2(boreR - 0.045, height * 0.37));
  points.push(new THREE.Vector2(boreR, height * 0.37));

  // Second ring land
  points.push(new THREE.Vector2(boreR, height * 0.31));
  points.push(new THREE.Vector2(boreR - 0.045, height * 0.31));
  points.push(new THREE.Vector2(boreR - 0.045, height * 0.26));
  points.push(new THREE.Vector2(boreR, height * 0.26));

  // Oil ring land
  points.push(new THREE.Vector2(boreR, height * 0.20));
  points.push(new THREE.Vector2(boreR - 0.05, height * 0.20));
  points.push(new THREE.Vector2(boreR - 0.05, height * 0.13));
  points.push(new THREE.Vector2(boreR, height * 0.13));

  // Skirt
  points.push(new THREE.Vector2(boreR * 0.99, -height * 0.48));
  points.push(new THREE.Vector2(boreR * 0.88, -height * 0.5));
  points.push(new THREE.Vector2(0.25, -height * 0.5)); // hollow underside
  points.push(new THREE.Vector2(0.22, 0.1));
  points.push(new THREE.Vector2(0, 0.1));

  const latheGeom = new THREE.LatheGeometry(points, 32);
  latheGeom.computeVertexNormals();
  return latheGeom;
}

/**
 * Creates an H-Beam connecting rod geometry
 */
export function createConnectingRodGeometry(): THREE.BufferGeometry {
  const L = KINEMATICS.rodLength; // 1.32
  const smallEndR = 0.18;
  const bigEndR = 0.28;
  const shankWidth = 0.22;
  const beamDepth = 0.14;

  const shape = new THREE.Shape();
  // Small end top
  shape.absarc(0, L, smallEndR, 0, Math.PI, false);
  // Shank taper down to big end
  shape.lineTo(-shankWidth * 0.5, L * 0.65);
  shape.lineTo(-shankWidth * 0.65, L * 0.25);
  shape.absarc(0, 0, bigEndR, Math.PI, 0, true);
  shape.lineTo(shankWidth * 0.65, L * 0.25);
  shape.lineTo(shankWidth * 0.5, L * 0.65);
  shape.closePath();

  // Holes for wrist pin and crank journal
  const smallHole = new THREE.Path();
  smallHole.absarc(0, L, 0.10, 0, Math.PI * 2, true);
  shape.holes.push(smallHole);

  const bigHole = new THREE.Path();
  bigHole.absarc(0, 0, 0.18, 0, Math.PI * 2, true);
  shape.holes.push(bigHole);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: beamDepth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.translate(0, -L, -beamDepth * 0.5);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a counterweight web geometry for crankshaft throws
 */
export function createCrankCounterweightGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const R = KINEMATICS.crankRadius; // 0.44

  // Sculpted aerodynamic counterweight lobe opposite the crankpin
  shape.moveTo(0.22, 0);
  shape.lineTo(0.24, R * 0.6);
  shape.absarc(0, R, 0.22, 0.1, Math.PI - 0.1, false);
  shape.lineTo(-0.24, R * 0.6);
  shape.lineTo(-0.22, 0);

  // Heavy balance counterweight extending in opposite direction (-Y)
  shape.lineTo(-0.48, -R * 0.4);
  shape.absarc(0, -R * 0.8, 0.58, Math.PI * 0.9, Math.PI * 0.1, true);
  shape.lineTo(0.48, -R * 0.4);
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.translate(0, 0, -0.09);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a poppet valve geometry (intake/exhaust)
 */
export function createValveGeometry(isExhaust = false): THREE.BufferGeometry {
  const headRadius = isExhaust ? 0.16 : 0.19;
  const stemRadius = 0.032;
  const totalLength = 1.05;

  const points: THREE.Vector2[] = [];
  // Valve face center
  points.push(new THREE.Vector2(0, 0));
  points.push(new THREE.Vector2(headRadius * 0.85, 0));
  // 45 degree seating chamfer
  points.push(new THREE.Vector2(headRadius, 0.025));
  points.push(new THREE.Vector2(headRadius * 0.95, 0.065));
  // Flared tulip transition to stem
  points.push(new THREE.Vector2(stemRadius * 2.2, 0.16));
  points.push(new THREE.Vector2(stemRadius, 0.3));
  // Cylindrical stem
  points.push(new THREE.Vector2(stemRadius, totalLength - 0.06));
  // Keeper groove and tip
  points.push(new THREE.Vector2(stemRadius * 0.8, totalLength - 0.04));
  points.push(new THREE.Vector2(stemRadius * 1.1, totalLength - 0.02));
  points.push(new THREE.Vector2(stemRadius * 1.1, totalLength));
  points.push(new THREE.Vector2(0, totalLength));

  const geom = new THREE.LatheGeometry(points, 24);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a helical valve spring geometry
 */
export function createHelicalSpringGeometry(coils = 6.5, radius = 0.10, wireRadius = 0.016, height = 0.65): THREE.BufferGeometry {
  // Generate helical curve
  class HelixCurve extends THREE.Curve<THREE.Vector3> {
    getPoint(t: number, optionalTarget = new THREE.Vector3()) {
      const angle = 2 * Math.PI * coils * t;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      const y = t * height;
      return optionalTarget.set(x, y, z);
    }
  }

  const path = new HelixCurve();
  const geom = new THREE.TubeGeometry(path, 100, wireRadius, 8, false);
  return geom;
}

/**
 * Creates a timing sprocket with gear teeth
 */
export function createTimingSprocketGeometry(teeth: number, pitchRadius: number, width = 0.12): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const toothDepth = pitchRadius * 0.14;
  const innerRadius = pitchRadius - toothDepth;
  const outerRadius = pitchRadius + toothDepth * 0.6;
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const angle = i * step;
    const a1 = angle;
    const a2 = angle + step * 0.3;
    const a3 = angle + step * 0.5;
    const a4 = angle + step * 0.8;

    if (i === 0) {
      shape.moveTo(Math.cos(a1) * innerRadius, Math.sin(a1) * innerRadius);
    } else {
      shape.lineTo(Math.cos(a1) * innerRadius, Math.sin(a1) * innerRadius);
    }
    shape.lineTo(Math.cos(a2) * outerRadius, Math.sin(a2) * outerRadius);
    shape.lineTo(Math.cos(a3) * outerRadius, Math.sin(a3) * outerRadius);
    shape.lineTo(Math.cos(a4) * innerRadius, Math.sin(a4) * innerRadius);
  }
  shape.closePath();

  // Center axle bore and lightening cutouts
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, pitchRadius * 0.28, 0, Math.PI * 2, true);
  shape.holes.push(centerHole);

  // 4 lightening spoke holes
  if (teeth >= 30) {
    for (let h = 0; h < 4; h++) {
      const holeAngle = (h * Math.PI) / 2;
      const holeDist = pitchRadius * 0.58;
      const holePath = new THREE.Path();
      holePath.absarc(
        Math.cos(holeAngle) * holeDist,
        Math.sin(holeAngle) * holeDist,
        pitchRadius * 0.16,
        0,
        Math.PI * 2,
        true
      );
      shape.holes.push(holePath);
    }
  }

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.translate(0, 0, -width * 0.5);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates an individual timing chain link geometry
 */
export function createChainLinkGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const linkLength = 0.10;
  const linkR = 0.04;
  const waistR = 0.028;

  // Figure-8 dog-bone shape for chain side plate
  shape.absarc(-linkLength * 0.5, 0, linkR, Math.PI * 0.5, Math.PI * 1.5, false);
  shape.quadraticCurveTo(0, -waistR, linkLength * 0.5, -linkR);
  shape.absarc(linkLength * 0.5, 0, linkR, -Math.PI * 0.5, Math.PI * 0.5, false);
  shape.quadraticCurveTo(0, waistR, -linkLength * 0.5, linkR);
  shape.closePath();

  // Pin holes
  const h1 = new THREE.Path();
  h1.absarc(-linkLength * 0.5, 0, 0.018, 0, Math.PI * 2, true);
  shape.holes.push(h1);

  const h2 = new THREE.Path();
  h2.absarc(linkLength * 0.5, 0, 0.018, 0, Math.PI * 2, true);
  shape.holes.push(h2);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates spark plug procedural mesh
 */
export function createSparkPlugModel(): THREE.Group {
  const group = new THREE.Group();

  // Hex nut body
  const hexGeom = new THREE.CylinderGeometry(0.065, 0.065, 0.12, 6);
  const hexMat = new THREE.MeshStandardMaterial({ color: 0x828b94, metalness: 0.85, roughness: 0.3 });
  const hexMesh = new THREE.Mesh(hexGeom, hexMat);
  hexMesh.position.y = 0.06;
  group.add(hexMesh);

  // Threaded bottom shell
  const threadGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16);
  const threadMat = new THREE.MeshStandardMaterial({ color: 0x5a626a, metalness: 0.9, roughness: 0.35 });
  const threadMesh = new THREE.Mesh(threadGeom, threadMat);
  threadMesh.position.y = -0.08;
  group.add(threadMesh);

  // Ceramic insulator body with rib rings
  const ceramicGeom = new THREE.CylinderGeometry(0.045, 0.052, 0.38, 16);
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xf6f7f9, metalness: 0.05, roughness: 0.15 });
  const ceramicMesh = new THREE.Mesh(ceramicGeom, ceramicMat);
  ceramicMesh.position.y = 0.28;
  group.add(ceramicMesh);

  // Terminal nut top
  const termGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.08, 12);
  const termMat = new THREE.MeshStandardMaterial({ color: 0xd4a359, metalness: 0.8, roughness: 0.25 });
  const termMesh = new THREE.Mesh(termGeom, termMat);
  termMesh.position.y = 0.50;
  group.add(termMesh);

  // Electrode tip
  const elecGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8);
  const elecMat = new THREE.MeshStandardMaterial({ color: 0xe0a060, metalness: 0.9, roughness: 0.2 });
  const elecMesh = new THREE.Mesh(elecGeom, elecMat);
  elecMesh.position.y = -0.19;
  group.add(elecMesh);

  return group;
}
