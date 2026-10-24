export type StrokePhase = 'Intake' | 'Compression' | 'Power' | 'Exhaust';

export interface CylinderState {
  cylinderIndex: number; // 0 to 3 (Cylinders 1 to 4)
  crankAngleRelative: number; // 0 to 720 deg in cylinder's individual cycle
  pistonHeight: number; // 0 (BDC) to 1 (TDC)
  pistonVelocity: number; // derivative of height
  rodAngle: number; // radians
  intakeValveLift: number; // 0 (closed) to 1 (fully open)
  exhaustValveLift: number; // 0 (closed) to 1 (fully open)
  phase: StrokePhase;
  phaseProgress: number; // 0.0 to 1.0 within current stroke
  isCombusting: boolean; // active flame flash in power stroke
  sparkActive: boolean; // spark ignition event at start of power stroke
}

export interface EngineSimState {
  isRunning: boolean;
  rpm: number;
  crankAngle: number; // 0 to 720 degrees
  camAngle: number; // 0 to 360 degrees (crankAngle / 2 % 360)
  simSpeed: number; // 0.1 to 2.0
  explodedAmount: number; // 0.0 to 1.0
  audioEnabled: boolean;
  audioVolume: number;
  selectedComponent: EngineComponentInfo | null;
  cylinders: CylinderState[];
  visibility: {
    block: boolean;
    pistons: boolean;
    valvetrain: boolean;
    timingChain: boolean;
    combustion: boolean;
    labels: boolean;
  };
  cameraPreset: 'threeQuarter' | 'front' | 'side' | 'top' | 'crank' | 'valvetrain' | 'free';
}

export interface EngineComponentInfo {
  id: string;
  name: string;
  category: 'Structure' | 'Cranktrain' | 'Valvetrain' | 'Timing' | 'Ignition';
  functionSummary: string;
  mechanicalInteraction: string;
  cycleRole: string;
  technicalSpecs: {
    material: string;
    operatingTemp?: string;
    motionType: string;
    clearanceOrSpec?: string;
  };
}
