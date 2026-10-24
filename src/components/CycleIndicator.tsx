import React from 'react';
import { CylinderState, StrokePhase } from '../engine/types';

interface CycleIndicatorProps {
  cylinders: CylinderState[];
  crankAngle: number;
  camAngle: number;
}

const PHASE_COLORS: Record<StrokePhase, { bg: string; text: string; border: string; desc: string }> = {
  Intake: {
    bg: 'bg-sky-500/20',
    text: 'text-sky-400',
    border: 'border-sky-500/40',
    desc: 'Air-fuel induction, intake valve open',
  },
  Compression: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    desc: 'Charge compressed, valves sealed',
  },
  Power: {
    bg: 'bg-orange-500/25',
    text: 'text-orange-400',
    border: 'border-orange-500/50',
    desc: 'Spark ignited, expanding gas thrust',
  },
  Exhaust: {
    bg: 'bg-rose-500/20',
    text: 'text-rose-400',
    border: 'border-rose-500/40',
    desc: 'Burnt gas scavenged, exhaust valve open',
  },
};

export const CycleIndicator: React.FC<CycleIndicatorProps> = ({ cylinders, crankAngle, camAngle }) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      {/* 4 Cylinders Parallel Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cylinders.map((cyl, idx) => {
          const color = PHASE_COLORS[cyl.phase];
          const isFiring = cyl.phase === 'Power' && cyl.phaseProgress < 0.5;

          return (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-lg border p-2.5 transition-colors ${
                color.border
              } ${isFiring ? 'bg-orange-950/40 ring-1 ring-orange-500/50' : 'bg-slate-900/60'}`}
            >
              {/* Progress bar along bottom */}
              <div
                className={`absolute bottom-0 left-0 h-1 transition-all ${
                  cyl.phase === 'Power'
                    ? 'bg-orange-500'
                    : cyl.phase === 'Compression'
                    ? 'bg-amber-500'
                    : cyl.phase === 'Intake'
                    ? 'bg-sky-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.round(cyl.phaseProgress * 100)}%` }}
              />

              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-300">Cyl #{idx + 1}</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {Math.round(cyl.crankAngleRelative)}°
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${color.text}`}>
                  {cyl.phase}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {Math.round(cyl.pistonHeight * 100)}% TDC
                </span>
              </div>

              {/* Valve activity mini indicator */}
              <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                <span className={cyl.intakeValveLift > 0.1 ? 'text-sky-300 font-bold' : 'text-slate-600'}>
                  IN: {Math.round(cyl.intakeValveLift * 100)}%
                </span>
                <span className={cyl.exhaustValveLift > 0.1 ? 'text-rose-300 font-bold' : 'text-slate-600'}>
                  EX: {Math.round(cyl.exhaustValveLift * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Cycle Angle Stats */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
        <div>
          Crank: <span className="text-sky-400 font-bold">{Math.round(crankAngle)}°</span> / 720°
        </div>
        <div className="text-slate-500 text-[10px]">
          Order: 1 → 3 → 4 → 2
        </div>
        <div>
          Cam: <span className="text-indigo-400 font-bold">{Math.round(camAngle)}°</span> / 360° (1:2 ratio)
        </div>
      </div>
    </div>
  );
};
