import React from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export default function Logo({ className = '', iconOnly = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* V + </> Icon */}
      <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-black shadow-lg shadow-violet-950/40 glow-primary transition-all duration-300 hover:scale-105">
        <span className="text-xl tracking-tighter">V</span>
        
        {/* Absolute code symbol */}
        <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 rounded-md bg-slate-900 border border-slate-700 text-[9px] font-bold text-violet-400">
          &lt;/&gt;
        </div>
      </div>
      
      {!iconOnly && (
        <div className="flex flex-col">
          <span className="font-bold text-base leading-none tracking-tight text-white flex items-center gap-1.5">
            Vivek Code
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-medium border border-violet-500/20">
              v1.0
            </span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">
            Local AI Coding Assistant
          </span>
        </div>
      )}
    </div>
  );
}
