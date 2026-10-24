import React, { useEffect, useRef } from 'react';
import { EngineScene } from '../engine/EngineScene';
import { EngineSimState } from '../engine/types';

interface ViewportProps {
  onEngineReady: (engine: EngineScene) => void;
  onStateChange: (state: EngineSimState) => void;
}

export const Viewport: React.FC<ViewportProps> = ({ onEngineReady, onStateChange }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineInstanceRef = useRef<EngineScene | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize 3D Engine Scene once
    const engine = new EngineScene(mountRef.current, (state) => {
      onStateChange({ ...state });
    });
    engineInstanceRef.current = engine;
    onEngineReady(engine);

    return () => {
      engine.dispose();
      engineInstanceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full absolute inset-0 overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{ touchAction: 'none' }}
    />
  );
};
