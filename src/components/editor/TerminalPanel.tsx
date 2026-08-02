import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Terminal, Play, Trash2, X, AlertTriangle } from 'lucide-react';

interface TerminalLine {
  type: 'input' | 'stdout' | 'stderr' | 'system';
  text: string;
}

export default function TerminalPanel({ onClose }: { onClose?: () => void }) {
  const { activeWorkspace } = useApp();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<TerminalLine[]>([
    { type: 'system', text: 'Vivek Code Integrated Terminal Shell' },
    { type: 'system', text: `CWD: ${activeWorkspace || 'none selected'}` },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const getWorkspaceName = () => {
    if (!activeWorkspace) return 'project';
    const parts = activeWorkspace.split(/[\\/]/);
    return parts[parts.length - 1] || 'project';
  };

  const handleRunCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;

    const cmd = input.trim();
    setInput('');
    setIsRunning(true);

    // Append user input line
    setHistory((prev) => [...prev, { type: 'input', text: `${getWorkspaceName()} % ${cmd}` }]);

    try {
      const res = await fetch('/api/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });

      const data = await res.json();

      if (!res.ok) {
        setHistory((prev) => [...prev, { type: 'stderr', text: data.error || 'Execution failed.' }]);
      } else {
        if (data.stdout) {
          setHistory((prev) => [...prev, { type: 'stdout', text: data.stdout }]);
        }
        if (data.stderr) {
          setHistory((prev) => [...prev, { type: 'stderr', text: data.stderr }]);
        }
        if (!data.stdout && !data.stderr) {
          setHistory((prev) => [...prev, { type: 'system', text: 'Command returned with exit code 0 (no output).' }]);
        }
      }
    } catch (err: any) {
      setHistory((prev) => [...prev, { type: 'stderr', text: err.message || 'Error executing command.' }]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-60 bg-slate-950 border-t border-slate-900 flex flex-col font-mono text-xs text-slate-350 select-text overflow-hidden">
      {/* Header bar */}
      <div className="px-4 py-2 border-b border-slate-900 bg-slate-900/35 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-violet-400" />
          <span className="font-semibold text-slate-200">Terminal - {getWorkspaceName()}</span>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setHistory([{ type: 'system', text: 'Terminal cleared.' }])}
            className="p-1 rounded hover:bg-slate-850 text-slate-500 hover:text-slate-250 transition"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-850 text-slate-500 hover:text-slate-250 transition"
              title="Close Terminal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal log panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin">
        {history.map((line, idx) => (
          <div
            key={idx}
            className={`whitespace-pre-wrap leading-relaxed ${
              line.type === 'input'
                ? 'text-white font-bold'
                : line.type === 'stderr'
                ? 'text-red-400'
                : line.type === 'system'
                ? 'text-slate-500 font-semibold'
                : 'text-slate-300'
            }`}
          >
            {line.text}
          </div>
        ))}
        {isRunning && (
          <div className="text-violet-400 animate-pulse flex items-center gap-1.5 select-none font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            Running command...
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal prompt input form */}
      <form onSubmit={handleRunCommand} className="px-4 py-2 border-t border-slate-900 bg-slate-900/10 flex items-center select-none">
        <span className="text-violet-400 font-bold mr-2">{getWorkspaceName()} %</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRunning ? 'Command is executing...' : 'npm run test, git status, etc...'}
          disabled={isRunning}
          className="flex-1 bg-transparent text-slate-250 focus:outline-none placeholder-slate-650"
          autoFocus
        />
      </form>
    </div>
  );
}
