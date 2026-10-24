/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Viewport } from './components/Viewport';
import { HeaderBar } from './components/HeaderBar';
import { ControlDock } from './components/ControlDock';
import { InspectionCard } from './components/InspectionCard';
import { EngineScene } from './engine/EngineScene';
import { EngineComponentInfo, EngineSimState } from './engine/types';
import { ENGINE_COMPONENTS, getCylinderState } from './engine/kinematics';

export default function App() {
  const engineRef = useRef<EngineScene | null>(null);

  // Simulation State mirrored from EngineScene
  const [simState, setSimState] = useState<EngineSimState>({
    isRunning: true,
    rpm: 1200,
    crankAngle: 0,
    camAngle: 0,
    simSpeed: 0.45,
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
  });

  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [showHelpHint, setShowHelpHint] = useState(true);

  // Sync state from engine tick (throttled by EngineScene state emission)
  const handleStateChange = useCallback((newState: EngineSimState) => {
    setSimState(newState);
  }, []);

  const handleEngineReady = useCallback((engine: EngineScene) => {
    engineRef.current = engine;
  }, []);

  // UI Control Callbacks
  const handleSetRPM = (rpm: number) => {
    if (engineRef.current) engineRef.current.setRPM(rpm);
  };

  const handleSetRunning = (running: boolean) => {
    if (engineRef.current) engineRef.current.setRunning(running);
  };

  const handleSetCrankAngle = (deg: number) => {
    if (engineRef.current) engineRef.current.setCrankAngle(deg);
  };

  const handleSetSimSpeed = (speed: number) => {
    if (engineRef.current) engineRef.current.setSimSpeed(speed);
  };

  const handleSetExplodedAmount = (amount: number) => {
    if (engineRef.current) engineRef.current.setExplodedAmount(amount);
  };

  const handleToggleVisibility = (part: keyof EngineSimState['visibility']) => {
    if (engineRef.current) engineRef.current.toggleVisibility(part);
  };

  const handleCameraChange = (preset: EngineSimState['cameraPreset']) => {
    if (engineRef.current) engineRef.current.setCameraPreset(preset);
  };

  const handleToggleAudio = () => {
    if (engineRef.current) engineRef.current.toggleAudio();
  };

  const handleReset = () => {
    if (engineRef.current) engineRef.current.resetSimulation();
  };

  const handleSelectComponent = (comp: EngineComponentInfo) => {
    if (engineRef.current) engineRef.current.setSelectedComponent(comp);
    setIsInspectOpen(true);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (engineRef.current) {
          engineRef.current.setRunning(!simState.isRunning);
        }
      } else if (e.code === 'KeyR') {
        handleReset();
      } else if (e.code === 'KeyM') {
        handleToggleAudio();
      } else if (e.code === 'KeyI') {
        setIsInspectOpen((prev) => !prev);
      } else if (e.code === 'Digit1') {
        handleSetRPM(800);
      } else if (e.code === 'Digit2') {
        handleSetRPM(1500);
      } else if (e.code === 'Digit3') {
        handleSetRPM(3000);
      } else if (e.code === 'Digit4') {
        handleSetRPM(6000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [simState.isRunning]);

  // Hide help hint after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHelpHint(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans text-slate-100 select-none">
      {/* 3D WebGL Canvas Viewport (100% full bleed) */}
      <Viewport
        onEngineReady={handleEngineReady}
        onStateChange={handleStateChange}
      />

      {/* Top Header Bar */}
      <HeaderBar
        state={simState}
        onCameraChange={handleCameraChange}
        onToggleAudio={handleToggleAudio}
        onToggleInspect={() => setIsInspectOpen(!isInspectOpen)}
        onReset={handleReset}
        isInspectOpen={isInspectOpen}
      />

      {/* Selected Component Technical Inspection Drawer (Floating Right) */}
      {isInspectOpen && (
        <aside
          aria-label="Component Inspection Details"
          className="fixed top-18 right-4 z-30 max-w-sm pointer-events-auto"
        >
          <InspectionCard
            component={simState.selectedComponent}
            onSelectComponent={handleSelectComponent}
            onClose={() => setIsInspectOpen(false)}
          />
        </aside>
      )}

      {/* First-visit interaction helper toast */}
      {showHelpHint && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-opacity duration-500">
          <div className="bg-slate-900/90 border border-slate-700/80 text-slate-300 text-[11px] font-mono px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>Drag to rotate • Scroll to zoom • Right-click to pan • Click any part to inspect</span>
            <button
              onClick={() => setShowHelpHint(false)}
              className="pointer-events-auto text-slate-400 hover:text-white ml-1"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Ergonomic Collapsible Bottom Control Dock */}
      <ControlDock
        state={simState}
        onSetRPM={handleSetRPM}
        onSetRunning={handleSetRunning}
        onSetCrankAngle={handleSetCrankAngle}
        onSetSimSpeed={handleSetSimSpeed}
        onSetExplodedAmount={handleSetExplodedAmount}
        onToggleVisibility={handleToggleVisibility}
        onReset={handleReset}
      />
    </div>
  );
}
