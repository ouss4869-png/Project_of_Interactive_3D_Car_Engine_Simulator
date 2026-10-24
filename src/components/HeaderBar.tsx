import React from 'react';
import { EngineSimState } from '../engine/types';
import {
  Volume2,
  VolumeX,
  Camera,
  Layers,
  Info,
  Maximize2,
  Eye,
  RotateCcw,
} from 'lucide-react';

interface HeaderBarProps {
  state: EngineSimState;
  onCameraChange: (preset: EngineSimState['cameraPreset']) => void;
  onToggleAudio: () => void;
  onToggleInspect: () => void;
  onReset: () => void;
  isInspectOpen: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  state,
  onCameraChange,
  onToggleAudio,
  onToggleInspect,
  onReset,
  isInspectOpen,
}) => {
  return (
    <header className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
      {/* Brand & Technical Spec Badge */}
      <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-lg pointer-events-auto">
        <div className="w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-sky-500/30" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-tight">I4 DOHC SIMULATOR</h1>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-sky-400 border border-slate-700">
              16-VALVE 4-STROKE
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
            Bore 86mm × Stroke 88mm • 1-3-4-2 Firing Order • Crank Kinematics
          </div>
        </div>
      </div>

      {/* Camera Presets & Tools Bar */}
      <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 shadow-lg pointer-events-auto">
        <div className="hidden md:flex items-center gap-1 pr-1 border-r border-slate-800 text-slate-400 text-xs pl-2">
          <Camera className="w-3.5 h-3.5 text-sky-400 mr-1" />
          <span className="text-[11px] font-medium mr-1">View:</span>

          <button
            onClick={() => onCameraChange('threeQuarter')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              state.cameraPreset === 'threeQuarter'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            3/4 Iso
          </button>

          <button
            onClick={() => onCameraChange('front')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              state.cameraPreset === 'front'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Front (Timing)
          </button>

          <button
            onClick={() => onCameraChange('side')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              state.cameraPreset === 'side'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Side (Bores)
          </button>

          <button
            onClick={() => onCameraChange('top')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              state.cameraPreset === 'top'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Top (Cams)
          </button>

          <button
            onClick={() => onCameraChange('crank')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              state.cameraPreset === 'crank'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Crankshaft
          </button>
        </div>

        {/* Audio Toggle */}
        <button
          onClick={onToggleAudio}
          title={state.audioEnabled ? 'Mute procedural engine audio' : 'Enable procedural engine sound'}
          aria-label={state.audioEnabled ? 'Mute engine audio' : 'Enable engine audio'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            state.audioEnabled
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'hover:bg-slate-800 text-slate-400'
          }`}
        >
          {state.audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-sky-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{state.audioEnabled ? 'Sound ON' : 'Sound'}</span>
        </button>

        {/* Component Specs Drawer Toggle */}
        <button
          onClick={onToggleInspect}
          title="Inspect selected component details"
          aria-label="Inspect component details"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isInspectOpen
              ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
              : 'hover:bg-slate-800 text-slate-400'
          }`}
        >
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Inspect</span>
        </button>

        {/* Reset Camera & Sim */}
        <button
          onClick={onReset}
          title="Reset simulation & camera"
          aria-label="Reset simulation and camera"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
