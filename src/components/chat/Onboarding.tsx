import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Play, Terminal, Shield, FolderOpen, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import Logo from '@/components/ui/Logo';

export default function Onboarding() {
  const {
    isOllamaConnected,
    ollamaModels,
    refetchOllamaStatus,
    activeWorkspace,
    setActiveWorkspace,
    setIsOnboarding,
    settings,
    saveSettings,
    downloadingModel,
    setDownloadingModel,
  } = useApp();

  const [step, setStep] = useState(1);
  const [selectedModel, setSelectedModel] = useState('qwen2.5-coder:3b');
  const [workspacePath, setWorkspacePath] = useState('');
  const [pullError, setPullError] = useState('');
  const [permissions, setPermissions] = useState({
    fileReadPermission: 'ask',
    fileWritePermission: 'ask',
    terminalPermission: 'ask',
  });

  // Recommended lightweight models list
  const recommendedModels = [
    { name: 'qwen2.5-coder:3b', size: '1.9 GB', desc: 'Highly recommended for M1 Mac (8 GB RAM). Fast & accurate.' },
    { name: 'deepseek-coder:1.3b', size: '800 MB', desc: 'Ultralight weight coding model. Minimal memory footprint.' },
    { name: 'qwen2.5-coder:7b', size: '4.7 GB', desc: 'Advanced coding intelligence. Might cause swap lag on 8 GB RAM.' },
    { name: 'codegemma:2b', size: '1.4 GB', desc: 'Google lightweight model for developers.' }
  ];

  // Try to prefill path with a local default workspace if available
  useEffect(() => {
    if (activeWorkspace) {
      setWorkspacePath(activeWorkspace);
    }
  }, [activeWorkspace]);

  const handlePullModel = async (modelName: string) => {
    setPullError('');
    setDownloadingModel({ name: modelName, progress: 0, status: 'Connecting...' });

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName }),
      });

      if (!res.ok) {
        throw new Error(`Failed to initiate pull: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Response stream not readable.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.status === 'success') {
                setDownloadingModel(null);
                refetchOllamaStatus();
                return;
              }

              // Calculate progress percent
              let pct = 0;
              if (data.total > 0) {
                pct = Math.round((data.completed / data.total) * 100);
              }
              setDownloadingModel({
                name: modelName,
                progress: pct,
                status: data.status || 'Downloading...',
              });
            } catch (e: any) {
              console.error('Failed to parse line:', line, e);
            }
          }
        }
      }
    } catch (err: any) {
      setPullError(err.message || 'Error occurred while pulling model.');
      setDownloadingModel(null);
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      if (!isOllamaConnected) {
        alert('Please ensure Ollama is installed and running before proceeding, or select "Offline Simulator" options.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Check if selected model is downloaded
      const isDownloaded = ollamaModels.some((m) => m.name.startsWith(selectedModel));
      if (!isDownloaded) {
        if (confirm(`You have not downloaded ${selectedModel} yet. Would you like to download it now?`)) {
          handlePullModel(selectedModel);
          return;
        }
      }
      setStep(3);
    } else if (step === 3) {
      if (!workspacePath.trim()) {
        alert('Please enter a workspace folder path to restrict assistant access.');
        return;
      }
      
      // Save settings
      await saveSettings({
        defaultWorkspace: workspacePath,
        defaultModel: selectedModel,
        fileReadPermission: permissions.fileReadPermission,
        fileWritePermission: permissions.fileWritePermission,
        terminalPermission: permissions.terminalPermission,
      });
      setActiveWorkspace(workspacePath);
      setIsOnboarding(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 overflow-y-auto">
      
      {/* Container Card */}
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden glow-primary animate-scale-up">
        
        {/* Abstract Background Blur */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-cyan-600/10 rounded-full blur-3xl"></div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
          <Logo />
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'bg-violet-500 w-12'
                    : s < step
                    ? 'bg-violet-700/60'
                    : 'bg-slate-800'
                }`}
              ></div>
            ))}
          </div>
        </div>

        {/* STEP 1: WELCOME & OLLAMA CHECK */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Welcome to Vivek Code <Sparkles className="w-5 h-5 text-violet-400" />
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                V Code is a local-first, privacy-focused AI development workspace. It processes all queries, reads files, and runs terminal tasks locally on your device without upload.
              </p>
            </div>

            {/* Connection Status Box */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Local Ollama Service Detection</span>
                <button
                  onClick={refetchOllamaStatus}
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-check
                </button>
              </div>

              {isOllamaConnected ? (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-emerald-300 block">Connected successfully!</span>
                    <span className="text-xs text-slate-400">Ollama is running locally at http://127.0.0.1:11434.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-semibold text-amber-300 block">Ollama is offline or not installed</span>
                      <span className="text-xs text-slate-400 leading-normal block mt-1">
                        Vivek Code relies on Ollama to load AI models. Download it from <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-violet-400 underline hover:text-violet-300">ollama.com</a>.
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                    <span className="text-slate-500 block"># Start the service in your terminal:</span>
                    <span>ollama run qwen2.5-coder:3b</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: MODEL SELECTION & DOWNLOAD */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Select Local AI Model</h2>
              <p className="text-slate-400 text-sm">
                Choose a model suitable for your hardware. Smaller parameter counts run faster on an M1 Mac with 8 GB RAM.
              </p>
            </div>

            {/* Model list cards */}
            <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1">
              {recommendedModels.map((item) => {
                const isDownloaded = ollamaModels.some((m) => m.name.startsWith(item.name));
                const isSelected = selectedModel === item.name;
                const isMemoryWarning = item.name.includes(':7b'); // Flag 7B model warning

                return (
                  <div
                    key={item.name}
                    onClick={() => {
                      if (!downloadingModel) setSelectedModel(item.name);
                    }}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-violet-600/15 border-violet-500 glow-primary'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        {item.name}
                        {isDownloaded && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium">
                            Ready
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{item.size}</span>
                    </div>
                    <span className="text-xs text-slate-400 leading-relaxed">{item.desc}</span>

                    {/* 8GB memory warning */}
                    {isMemoryWarning && isSelected && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-amber-400 font-medium bg-amber-500/5 px-2.5 py-1 rounded-md border border-amber-500/10">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Memory warning: May swap heavily and lag on M1 with 8 GB RAM.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pull / Progress details */}
            {downloadingModel ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                    </span>
                    Pulling {downloadingModel.name}...
                  </span>
                  <span>{downloadingModel.progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadingModel.progress}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-500 block text-right font-medium">
                  {downloadingModel.status}
                </span>
              </div>
            ) : (
              !ollamaModels.some((m) => m.name.startsWith(selectedModel)) && (
                <button
                  onClick={() => handlePullModel(selectedModel)}
                  className="w-full py-3 bg-slate-950 border border-slate-800 hover:border-violet-500 text-violet-400 hover:text-violet-300 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-inner"
                >
                  <Terminal className="w-4 h-4" />
                  Pull {selectedModel} in Ollama
                </button>
              )
            )}
            {pullError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {pullError}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: WORKSPACE & PERMISSIONS */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Project Folder & Permissions</h2>
              <p className="text-slate-400 text-sm">
                Define your default coding workspace. V Code blocks the AI from reading or writing files outside this directory.
              </p>
            </div>

            {/* Path Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Workspace Folder Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  placeholder="e.g. /Users/vivek/Documents/work/vivek-code"
                  className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition shadow-inner font-mono"
                />
              </div>
              <span className="text-[10px] text-slate-500 block font-medium">
                Tip: Enter your absolute path (e.g. /Users/vivek/Documents/work/my-project)
              </span>
            </div>

            {/* Permission Toggles */}
            <div className="space-y-3.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                AI Coding Agent Permissions
              </label>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-violet-400" />
                    Read Files
                  </span>
                  <select
                    value={permissions.fileReadPermission}
                    onChange={(e) => setPermissions({ ...permissions, fileReadPermission: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2 py-1 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="ask">Ask</option>
                    <option value="allow">Allow All</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                    Write Files
                  </span>
                  <select
                    value={permissions.fileWritePermission}
                    onChange={(e) => setPermissions({ ...permissions, fileWritePermission: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2 py-1 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="ask">Ask</option>
                    <option value="allow">Allow All</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    Terminal
                  </span>
                  <select
                    value={permissions.terminalPermission}
                    onChange={(e) => setPermissions({ ...permissions, terminalPermission: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2 py-1 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="ask">Ask</option>
                    <option value="allow">Allow All</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-800 bg-slate-900/10">
          {step > 1 ? (
            <button
              onClick={() => {
                if (!downloadingModel) setStep(step - 1);
              }}
              className="px-5 py-2.5 border border-slate-800 hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-200 text-sm font-semibold transition"
            >
              Back
            </button>
          ) : (
            <div></div>
          )}

          <button
            onClick={handleNextStep}
            disabled={downloadingModel !== null}
            className={`px-5 py-2.5 rounded-2xl text-sm font-semibold text-white flex items-center gap-2 shadow-lg transition select-none ${
              downloadingModel
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 shadow-violet-950/30'
            }`}
          >
            {step === 3 ? 'Launch Vivek Code' : 'Next Step'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
