import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSliderCrank,
  calculateValveLift,
  getCylinderState,
  CYLINDER_OFFSETS,
} from './kinematics';

test('slider crank reaches exact TDC and BDC heights', () => {
  // TDC at angle 0
  const tdc = calculateSliderCrank(0);
  assert(Math.abs(tdc.normalizedHeight - 1.0) < 1e-4, 'TDC normalized height must be 1.0');
  assert(Math.abs(tdc.rodAngle) < 1e-4, 'Rod angle at TDC must be 0');

  // BDC at angle PI (180 deg)
  const bdc = calculateSliderCrank(Math.PI);
  assert(Math.abs(bdc.normalizedHeight - 0.0) < 1e-4, 'BDC normalized height must be 0.0');
  assert(Math.abs(bdc.rodAngle) < 1e-4, 'Rod angle at BDC must be 0');
});

test('piston pairing: 1 & 4 move together, 2 & 3 move together', () => {
  // Check across 36 angles (every 20 degrees over 720)
  for (let deg = 0; deg < 720; deg += 20) {
    const s1 = getCylinderState(0, deg);
    const s2 = getCylinderState(1, deg);
    const s3 = getCylinderState(2, deg);
    const s4 = getCylinderState(3, deg);

    // Cylinders 1 and 4 must have identical piston heights
    assert(
      Math.abs(s1.pistonHeight - s4.pistonHeight) < 1e-3,
      `Cyl 1 and 4 must share piston height at ${deg} deg: got ${s1.pistonHeight} vs ${s4.pistonHeight}`
    );

    // Cylinders 2 and 3 must have identical piston heights
    assert(
      Math.abs(s2.pistonHeight - s3.pistonHeight) < 1e-3,
      `Cyl 2 and 3 must share piston height at ${deg} deg: got ${s2.pistonHeight} vs ${s3.pistonHeight}`
    );

    // When 1&4 are near TDC, 2&3 are near BDC
    if (Math.abs(s1.pistonHeight - 1.0) < 0.05) {
      assert(s2.pistonHeight < 0.15, 'When Cyl 1 is at TDC, Cyl 2 must be near BDC');
    }
  }
});

test('4-stroke cycle phases occur in correct order for Cylinder 1', () => {
  // Cycle 1: offset is 0
  // 0 - 180: Power
  assert.equal(getCylinderState(0, 90).phase, 'Power');
  // 180 - 360: Exhaust
  assert.equal(getCylinderState(0, 270).phase, 'Exhaust');
  // 360 - 540: Intake
  assert.equal(getCylinderState(0, 450).phase, 'Intake');
  // 540 - 720: Compression
  assert.equal(getCylinderState(0, 630).phase, 'Compression');
});

test('valve lift kinematics: intake and exhaust phases do not clash inappropriately', () => {
  // Cylinder 1 intake valve should be open during intake stroke (peak around 450 deg)
  const intakeMid = getCylinderState(0, 450);
  assert(intakeMid.intakeValveLift > 0.8, 'Intake valve should be widely open at mid-intake');
  assert.equal(intakeMid.exhaustValveLift, 0, 'Exhaust valve must be closed at mid-intake');

  // Cylinder 1 exhaust valve should be open during exhaust stroke (peak around 270 deg)
  const exhaustMid = getCylinderState(0, 270);
  assert(exhaustMid.exhaustValveLift > 0.8, 'Exhaust valve should be widely open at mid-exhaust');
  assert.equal(exhaustMid.intakeValveLift, 0, 'Intake valve must be closed at mid-exhaust');

  // Both valves must be closed during middle of compression and power strokes
  const compressionMid = getCylinderState(0, 630);
  assert.equal(compressionMid.intakeValveLift, 0, 'Intake valve closed at compression');
  assert.equal(compressionMid.exhaustValveLift, 0, 'Exhaust valve closed at compression');

  const powerMid = getCylinderState(0, 90);
  assert.equal(powerMid.intakeValveLift, 0, 'Intake valve closed at power');
  assert.equal(powerMid.exhaustValveLift, 0, 'Exhaust valve closed at power');
});

test('firing order follows 1 - 3 - 4 - 2 flat-plane sequence', () => {
  // Check which cylinder is in the beginning of the Power stroke (relative cycle 0..45 deg)
  // At crank 0: Cyl 1 is firing
  assert.equal(getCylinderState(0, 0).phase, 'Power');
  // At crank 180: Cyl 3 is firing
  assert.equal(getCylinderState(2, 180).phase, 'Power');
  // At crank 360: Cyl 4 is firing
  assert.equal(getCylinderState(3, 360).phase, 'Power');
  // At crank 540: Cyl 2 is firing
  assert.equal(getCylinderState(1, 540).phase, 'Power');
});
