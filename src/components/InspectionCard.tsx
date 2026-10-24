import React from 'react';
import { EngineComponentInfo } from '../engine/types';
import { ENGINE_COMPONENTS } from '../engine/kinematics';
import { X, Layers, Cpu, Compass, Activity, Thermometer, ShieldCheck } from 'lucide-react';

interface InspectionCardProps {
  component: EngineComponentInfo | null;
  onSelectComponent: (comp: EngineComponentInfo) => void;
  onClose: () => void;
}

export const InspectionCard: React.FC<InspectionCardProps> = ({
  component,
  onSelectComponent,
  onClose,
}) => {
  if (!component) return null;

  const componentList = Object.values(ENGINE_COMPONENTS);

  return (
    <div
      className="bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl p-4 text-slate-200 text-xs w-full max-w-md max-h-[85vh] overflow-y-auto"
      style={{
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-sky-500/20 text-sky-400 border border-sky-500/30">
              {component.category}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">DOHC I4 Spec</span>
          </div>
          <h2 className="text-sm font-bold text-white tracking-tight">{component.name}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close component inspection card"
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Component Quick Selector Bar */}
      <div className="py-2.5">
        <label htmlFor="component-select" className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
          Inspect Assembly Part:
        </label>
        <select
          id="component-select"
          aria-label="Select engine component to inspect"
          value={component.id}
          onChange={(e) => {
            const found = ENGINE_COMPONENTS[e.target.value];
            if (found) onSelectComponent(found);
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono cursor-pointer"
        >
          {componentList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.category})
            </option>
          ))}
        </select>
      </div>

      {/* Main Function */}
      <div className="space-y-3 pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>Primary Function</span>
          </div>
          <p className="text-slate-300 leading-relaxed pl-5">{component.functionSummary}</p>
        </div>

        {/* Mechanical Interaction */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>Kinematic Interaction</span>
          </div>
          <p className="text-slate-300 leading-relaxed pl-5">{component.mechanicalInteraction}</p>
        </div>

        {/* Cycle Role */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Role in 4-Stroke Cycle</span>
          </div>
          <p className="text-slate-300 leading-relaxed pl-5">{component.cycleRole}</p>
        </div>

        {/* Technical Engineering Specifications */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5 mt-2 font-mono text-[11px]">
          <div className="text-[10px] text-slate-400 uppercase font-sans font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Engineering Tolerances & Material</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 pb-1">
            <span className="text-slate-400">Alloy / Material:</span>
            <span className="text-slate-200 font-medium text-right">{component.technicalSpecs.material}</span>
          </div>
          {component.technicalSpecs.operatingTemp && (
            <div className="flex justify-between border-b border-slate-800/60 pb-1">
              <span className="text-slate-400">Peak Thermal Load:</span>
              <span className="text-amber-300 font-medium text-right">{component.technicalSpecs.operatingTemp}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-slate-800/60 pb-1">
            <span className="text-slate-400">Kinematic Motion:</span>
            <span className="text-sky-300 font-medium text-right">{component.technicalSpecs.motionType}</span>
          </div>
          {component.technicalSpecs.clearanceOrSpec && (
            <div className="flex justify-between">
              <span className="text-slate-400">Service Clearance:</span>
              <span className="text-emerald-300 font-medium text-right">{component.technicalSpecs.clearanceOrSpec}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
