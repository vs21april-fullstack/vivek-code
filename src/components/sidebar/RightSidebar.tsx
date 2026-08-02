import React from 'react';
import { useApp } from '@/context/AppContext';
import { Cpu, Sliders, Layers, CheckSquare, RefreshCw, ChevronRight } from 'lucide-react';

export default function RightSidebar() {
  const {
    activeModel,
    ollamaModels,
    settings,
    saveSettings,
    isRightSidebarOpen,
  } = useApp();

  if (!isRightSidebarOpen) return null;

  const currentModelDetails = ollamaModels.find((m) => m.name === activeModel);
  const modelSizeGB = currentModelDetails
    ? Math.round(currentModelDetails.size / (1024 * 1024 * 10.24)) / 100
    : 0;

  const handleSliderChange = (key: string, value: number) => {
    saveSettings({ [key]: value });
  };

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 overflow-y-auto">
      
      {/* Active Model / Status Header */}
      <div className="p-4 border-b border-slate-850">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-violet-400" />
          Active Model Info
        </h3>
        
        {activeModel ? (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
            <span className="text-xs font-bold text-white block truncate">{activeModel}</span>
            {currentModelDetails ? (
              <div className="flex flex-col gap-0.5 text-[10px] text-slate-400">
                <span>Size: {modelSizeGB} GB</span>
                {currentModelDetails.details?.parameter_size && (
                  <span>Parameters: {currentModelDetails.details.parameter_size}</span>
                )}
                {currentModelDetails.warning && (
                  <span className="text-amber-400 font-medium mt-1 leading-normal block">
                    ⚠️ Model exceeds M1 8GB RAM recommendations.
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 font-medium block">
                Local Ollama model detected
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-medium p-3 bg-slate-950 rounded-xl border border-slate-850 text-center">
            No active model loaded
          </div>
        )}
      </div>

      {/* Context / File References */}
      <div className="p-4 border-b border-slate-850">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-cyan-400" />
          Current Context Tags
        </h3>
        
        <div className="space-y-1.5">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-850 text-[11px] text-slate-300">
            <span className="font-semibold text-slate-400">@codebase</span>
            <span className="text-[9px] px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 text-slate-500 font-bold">RAG</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-850 text-[11px] text-slate-300">
            <span className="font-semibold text-slate-400">@git diff</span>
            <span className="text-[9px] px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 text-slate-500 font-bold">Workspace</span>
          </div>
          <span className="text-[9.5px] text-slate-500 leading-relaxed block mt-2 text-center font-medium">
            Type <code className="bg-slate-950 px-1 py-0.5 rounded text-violet-400 font-mono">@</code> inside chat prompt to attach files or folder contexts.
          </span>
        </div>
      </div>

      {/* Model Parameters sliders */}
      <div className="p-4 border-b border-slate-850 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-emerald-400" />
          Model Parameters
        </h3>

        {settings && (
          <div className="space-y-3.5">
            {/* Temperature */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-slate-300">Temperature</span>
                <span className="text-slate-400">{settings.temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.2"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => handleSliderChange('temperature', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            {/* Context length */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-slate-300">Context Window</span>
                <span className="text-slate-400">{settings.contextLength} tokens</span>
              </div>
              <input
                type="range"
                min="2048"
                max="32768"
                step="2048"
                value={settings.contextLength}
                onChange={(e) => handleSliderChange('contextLength', parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Agent Workflow Sandbox Simulation (Phase 1 preview) */}
      <div className="p-4 flex-1 flex flex-col min-h-64">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <CheckSquare className="w-4 h-4 text-violet-400" />
          Agent Mode Sandbox
        </h3>
        
        {/* Placeholder / Simulation Box */}
        <div className="flex-1 rounded-2xl bg-slate-950/70 border border-slate-850 p-3.5 flex flex-col justify-between text-left">
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-300 block">Simulated Diff Preview</span>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-850 font-mono text-[9px] leading-relaxed text-slate-400">
              <span className="text-red-400 block">- const assistant = 'offline';</span>
              <span className="text-emerald-400 block">+ const assistant = 'Vivek Code';</span>
            </div>
            <span className="text-[10px] text-slate-400 block leading-normal mt-2.5">
              In **Agent Mode**, V Code drafts structural modifications and requests review before writing to your directory.
            </span>
          </div>

          <div className="flex flex-col gap-1.5 mt-4">
            <button
              onClick={() => alert('Agent Sandboxed Changes Approved!')}
              className="w-full py-1.5 bg-violet-600/25 border border-violet-500/30 hover:bg-violet-600/35 text-violet-400 font-bold rounded-lg text-[10px] transition text-center"
            >
              Approve Changes
            </button>
            <button
              onClick={() => alert('Agent Sandboxed Changes Rejected.')}
              className="w-full py-1.5 border border-slate-800 hover:bg-slate-850 text-slate-500 hover:text-slate-300 font-semibold rounded-lg text-[10px] transition text-center"
            >
              Reject
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
