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
    proposedChanges,
    approveChange,
    rejectChange,
    activeWorkspace,
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
    <div className="w-80 bg-slate-50 border-l border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col h-full shrink-0 overflow-y-auto">
      
      {/* Active Model / Status Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-850">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-violet-400" />
          Active Model Info
        </h3>
        
        {activeModel ? (
          <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850 space-y-1">
            <span className="text-xs font-bold text-slate-800 dark:text-white block truncate">{activeModel}</span>
            {currentModelDetails ? (
              <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
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
          <div className="text-xs text-slate-500 font-medium p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850 text-center">
            No active model loaded
          </div>
        )}
      </div>

      {/* Context / File References */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-850">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-cyan-400" />
          Current Context Tags
        </h3>
        
        <div className="space-y-1.5">
          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 text-[11px] text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-550 dark:text-slate-400">@codebase</span>
            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-slate-500 font-bold">RAG</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 text-[11px] text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-550 dark:text-slate-400">@git diff</span>
            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-slate-500 font-bold">Workspace</span>
          </div>
          <span className="text-[9.5px] text-slate-500 leading-relaxed block mt-2 text-center font-medium">
            Type <code className="bg-white dark:bg-slate-950 px-1 py-0.5 rounded text-violet-500 dark:text-violet-400 font-mono border border-slate-200 dark:border-transparent">@</code> inside chat prompt to attach files or folder contexts.
          </span>
        </div>
      </div>

      {/* Model Parameters sliders */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-850 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-emerald-400" />
          Model Parameters
        </h3>

        {settings && (
          <div className="space-y-3.5">
            {/* Temperature */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Temperature</span>
                <span className="text-slate-500 dark:text-slate-400">{settings.temperature}</span>
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

      {/* Agent Workflow Proposed Changes (Phase 3) */}
      <div className="p-4 flex-1 flex flex-col min-h-64">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <CheckSquare className="w-4 h-4 text-violet-400" />
          Proposed Changes
        </h3>
        
        {proposedChanges.length === 0 ? (
          <div className="flex-1 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-850 p-4 flex flex-col items-center justify-center text-center select-none text-slate-400 dark:text-slate-650">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-550 dark:text-slate-400">No proposed changes</span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">
              Ask V Code to "create" or "modify" a file to see changes here.
            </span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-1">
            {proposedChanges.map((change) => {
              const relativePath = change.path.replace(activeWorkspace + '/', '');
              
              return (
                <div key={change.id} className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex flex-col gap-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-650/15 border border-violet-500/20 text-violet-400 font-bold uppercase tracking-wider">
                      {change.action === 'create_file' ? 'Create' : 'Modify'}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      change.status === 'pending'
                        ? 'text-amber-400'
                        : change.status === 'approved'
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}>
                      {change.status}
                    </span>
                  </div>

                  <span className="text-[10.5px] font-bold text-slate-200 truncate font-mono" title={change.path}>
                    {relativePath}
                  </span>

                  {change.status === 'pending' ? (
                    <div className="flex gap-1.5 mt-1 select-none">
                      <button
                        onClick={() => approveChange(change.id)}
                        className="flex-1 py-1 bg-violet-600 hover:bg-violet-500 active:bg-violet-750 text-white font-bold rounded-md text-[9px] transition text-center"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectChange(change.id)}
                        className="flex-1 py-1 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200 font-semibold rounded-md text-[9px] transition text-center"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-[9.5px] text-slate-500 font-semibold italic mt-0.5">
                      Change has been {change.status}.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
