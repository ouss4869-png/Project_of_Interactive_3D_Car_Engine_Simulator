import React, { useState } from 'react';
import { EngineSimState } from '../engine/types';
import { CycleIndicator } from './CycleIndicator';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Layers,
  Activity,
  Eye,
  ChevronDown,
  ChevronUp,
  Sliders,
  Flame,
} from 'lucide-react';

interface ControlDockProps {
  state: EngineSimState;
  onSetRPM: (rpm: number) => void;
  onSetRunning: (running: boolean) => void;
  onSetCrankAngle: (deg: number) => void;
  onSetSimSpeed: (speed: number) => void;
  onSetExplodedAmount: (amount: number) => void;
  onToggleVisibility: (part: keyof EngineSimState['visibility']) => void;
  onReset: () => void;
}

type TabType = 'rpm' | 'cycle' | 'exploded' | 'visibility';

export const ControlDock: React.FC<ControlDockProps> = ({
  state,
  onSetRPM,
  onSetRunning,
  onSetCrankAngle,
  onSetSimSpeed,
  onSetExplodedAmount,
  onToggleVisibility,
  onReset,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('rpm');

  const rpmPresets = [
    { label: 'Idle 800', value: 800 },
    { label: 'Cruise 1500', value: 1500 },
    { label: 'Highway 3000', value: 3000 },
    { label: 'Redline 6000', value: 6000 },
  ];

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 w-[96vw] max-w-4xl pointer-events-none transition-all duration-300"
      style={{
        transform: isCollapsed ? 'translate(-50%, calc(100% - 32px))' : 'translate(-50%, 0)',
      }}
    >
      {/* Floating Collapse / Expand Drawer Pill */}
      <div className="flex justify-center mb-1 pointer-events-auto">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 border border-slate-700/80 rounded-full text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-md"
          aria-label={isCollapsed ? 'Show simulation controls' : 'Hide simulation controls'}
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
              <span>Minimize Dock</span>
            </>
          )}
        </button>
      </div>

      {/* Main Glassmorphic Dock Container (Solid RGBA surface, no backdrop-filter over WebGL) */}
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl p-3 sm:p-4 pointer-events-auto">
        {/* Top Control Header with Play/Pause, Live RPM, and Tab Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          {/* Main Transport Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetRunning(!state.isRunning)}
              aria-label={state.isRunning ? 'Pause engine' : 'Start engine'}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                state.isRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-sky-500 text-slate-950 hover:bg-sky-400 font-bold'
              }`}
            >
              {state.isRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{state.isRunning ? 'PAUSE' : 'START ENGINE'}</span>
            </button>

            {/* Live RPM Digital Counter */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 flex items-baseline gap-1 font-mono">
              <span className="text-sm font-bold text-sky-400">{state.isRunning ? state.rpm : 0}</span>
              <span className="text-[10px] text-slate-400">RPM</span>
            </div>

            {/* Live Crank Angle Counter */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 hidden sm:flex items-baseline gap-1 font-mono">
              <span className="text-xs font-semibold text-slate-300">{Math.round(state.crankAngle)}°</span>
              <span className="text-[10px] text-slate-400">CRANK</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setActiveTab('rpm')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'rpm'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Engine Speed</span>
            </button>

            <button
              onClick={() => setActiveTab('cycle')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'cycle'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">4-Stroke Cycle</span>
            </button>

            <button
              onClick={() => setActiveTab('exploded')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'exploded'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exploded View</span>
            </button>

            <button
              onClick={() => setActiveTab('visibility')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'visibility'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Layers</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="pt-3">
          {/* TAB 1: RPM & Speed Controls */}
          {activeTab === 'rpm' && (
            <div className="space-y-3">
              {/* RPM Slider + Presets */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                    <span>Engine RPM:</span>
                    <span className="font-mono text-sky-400">{state.rpm} RPM</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6000"
                    step="50"
                    value={state.rpm}
                    onChange={(e) => onSetRPM(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0 (Off)</span>
                    <span>1500</span>
                    <span>3000</span>
                    <span>4500</span>
                    <span>6000 (Redline)</span>
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap sm:flex-nowrap gap-1.5">
                  {rpmPresets.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => onSetRPM(p.value)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                        state.rpm === p.value
                          ? 'bg-sky-500/20 text-sky-400 border-sky-500/50'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Crank Angle Scrubber (Available especially when paused) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/60">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                    <span>Manual Crank Angle (0–720°):</span>
                    <span className="font-mono text-indigo-400">{Math.round(state.crankAngle)}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="720"
                    step="1"
                    value={Math.round(state.crankAngle)}
                    onChange={(e) => {
                      onSetRunning(false); // Pause so user inspects manual angle
                      onSetCrankAngle(Number(e.target.value));
                    }}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                    <span>Simulation Speed Multiplier:</span>
                    <span className="font-mono text-emerald-400">{state.simSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={state.simSpeed}
                    onChange={(e) => onSetSimSpeed(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 4-Stroke Cycle Matrix */}
          {activeTab === 'cycle' && (
            <CycleIndicator
              cylinders={state.cylinders}
              crankAngle={state.crankAngle}
              camAngle={state.camAngle}
            />
          )}

          {/* TAB 3: Exploded View Controls */}
          {activeTab === 'exploded' && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-slate-300 font-medium">
                <span>Exploded View Separation:</span>
                <span className="font-mono text-sky-400">{Math.round(state.explodedAmount * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={state.explodedAmount}
                onChange={(e) => onSetExplodedAmount(Number(e.target.value))}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <span>Fully Assembled (0%)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSetExplodedAmount(0)}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300"
                  >
                    Assemble
                  </button>
                  <button
                    onClick={() => onSetExplodedAmount(0.5)}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300"
                  >
                    50% Explode
                  </button>
                  <button
                    onClick={() => onSetExplodedAmount(1.0)}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300"
                  >
                    Full Disassembly (100%)
                  </button>
                </div>
                <span>Disassembled (100%)</span>
              </div>
            </div>
          )}

          {/* TAB 4: Visibility & Subsystem Toggles */}
          {activeTab === 'visibility' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
              <button
                onClick={() => onToggleVisibility('block')}
                className={`flex items-center justify-between p-2 rounded-lg border font-medium transition-colors ${
                  state.visibility.block
                    ? 'bg-slate-800 text-slate-200 border-slate-700'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <span>Cylinder Block</span>
                <Eye className={`w-3.5 h-3.5 ${state.visibility.block ? 'text-sky-400' : 'text-slate-400'}`} />
              </button>

              <button
                onClick={() => onToggleVisibility('pistons')}
                className={`flex items-center justify-between p-2 rounded-lg border font-medium transition-colors ${
                  state.visibility.pistons
                    ? 'bg-slate-800 text-slate-200 border-slate-700'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <span>Pistons & Rods</span>
                <Eye className={`w-3.5 h-3.5 ${state.visibility.pistons ? 'text-sky-400' : 'text-slate-400'}`} />
              </button>

              <button
                onClick={() => onToggleVisibility('valvetrain')}
                className={`flex items-center justify-between p-2 rounded-lg border font-medium transition-colors ${
                  state.visibility.valvetrain
                    ? 'bg-slate-800 text-slate-200 border-slate-700'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <span>DOHC Valvetrain</span>
                <Eye className={`w-3.5 h-3.5 ${state.visibility.valvetrain ? 'text-sky-400' : 'text-slate-400'}`} />
              </button>

              <button
                onClick={() => onToggleVisibility('timingChain')}
                className={`flex items-center justify-between p-2 rounded-lg border font-medium transition-colors ${
                  state.visibility.timingChain
                    ? 'bg-slate-800 text-slate-200 border-slate-700'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <span>Timing Chain</span>
                <Eye className={`w-3.5 h-3.5 ${state.visibility.timingChain ? 'text-sky-400' : 'text-slate-400'}`} />
              </button>

              <button
                onClick={() => onToggleVisibility('combustion')}
                className={`flex items-center justify-between p-2 rounded-lg border font-medium transition-colors ${
                  state.visibility.combustion
                    ? 'bg-slate-800 text-slate-200 border-slate-700'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <span>Combustion Glow</span>
                <Flame className={`w-3.5 h-3.5 ${state.visibility.combustion ? 'text-orange-400' : 'text-slate-400'}`} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
