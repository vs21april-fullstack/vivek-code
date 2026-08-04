'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import MonacoEditor from '@/components/editor/MonacoEditor';
import TerminalPanel from '@/components/editor/TerminalPanel';
import Onboarding from '@/components/chat/Onboarding';
import Sidebar from '@/components/sidebar/Sidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import RightSidebar from '@/components/sidebar/RightSidebar';
import SettingsModal from '@/components/settings/SettingsModal';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

export default function Home() {
  const { isOnboarding, isLoadingSettings, openTabs, activeTabPath } = useApp();
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  if (isLoadingSettings) {
    return (
      <div className="h-full flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-100 select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-650 text-white font-black text-xl shadow-lg glow-primary animate-pulse">
            V
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-400">Loading Vivek Code...</span>
        </div>
      </div>
    );
  }

  if (isOnboarding) {
    return (
      <div className="h-full flex-1 flex overflow-hidden">
        <Onboarding />
      </div>
    );
  }

  const isEditorOpen = openTabs.length > 0 && activeTabPath !== null;

  return (
    <div className="h-full flex-1 flex overflow-hidden bg-white dark:bg-slate-950">
      {/* 1. Left Sidebar */}
      <Sidebar />

      {/* 2. Main Center Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Workspace bar */}
        <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-900/20 text-slate-500 text-[10px] font-bold flex items-center justify-between select-none">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            ACTIVE EXPERIMENTAL DESKTOP WORKSPACE RUNNING LOCALLY
          </div>
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`px-2 py-0.5 rounded border text-[9px] font-bold transition ${
              isTerminalOpen
                ? 'bg-violet-650/10 border-violet-500/30 text-violet-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Toggle Terminal
          </button>
        </div>

        {/* Dynamic Split Layout */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden min-h-0">
            {isEditorOpen && (
              <div className="flex-1 h-full border-r border-slate-200 dark:border-slate-900 flex flex-col min-w-0">
                <MonacoEditor />
              </div>
            )}
            <div className={`h-full flex flex-col ${isEditorOpen ? 'w-[440px]' : 'flex-1'}`}>
              <ChatWindow />
            </div>
          </div>
          {isTerminalOpen && (
            <TerminalPanel onClose={() => setIsTerminalOpen(false)} />
          )}
        </div>
      </div>

      {/* 3. Right Context Panel */}
      <RightSidebar />

      {/* 4. Overlay Modals */}
      <SettingsModal />
    </div>
  );
}
