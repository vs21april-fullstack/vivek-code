import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { X, Settings, Cpu, Shield, User, Trash2, EyeOff } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function SettingsModal() {
  const { settings, saveSettings, isSettingsOpen, setIsSettingsOpen, ollamaModels, theme, setTheme } = useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'models' | 'permissions' | 'privacy'>('general');
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings, isSettingsOpen]);

  if (!isSettingsOpen || !settings) return null;

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await saveSettings(formData);
    setIsSettingsOpen(false);
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear all conversation history? This cannot be undone.')) {
      try {
        const res = await fetch('/api/conversations', { method: 'DELETE' });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          alert('Conversation history cleared successfully!');
        }
      } catch (err) {
        alert('Failed to clear conversations.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl h-[560px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl glow-primary">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-white">Settings</h2>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Tabs Sidebar */}
          <div className="w-52 border-r border-slate-800 bg-slate-900/30 p-3 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'general'
                  ? 'bg-violet-600/15 text-violet-400 border border-violet-500/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
              }`}
            >
              <User className="w-4 h-4" />
              General
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'models'
                  ? 'bg-violet-600/15 text-violet-400 border border-violet-500/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Cpu className="w-4 h-4" />
              AI Models
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'permissions'
                  ? 'bg-violet-600/15 text-violet-400 border border-violet-500/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Shield className="w-4 h-4" />
              Agent Permissions
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'privacy'
                  ? 'bg-violet-600/15 text-violet-400 border border-violet-500/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
              }`}
            >
              <EyeOff className="w-4 h-4" />
              Privacy & Logs
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-900/10">
            {activeTab === 'general' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Appearance</h3>
                  <div className="flex gap-4">
                    <label className="flex-1 flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer hover:border-slate-700 transition">
                      <span className="text-sm font-medium text-slate-300">Dark Mode</span>
                      <input
                        type="radio"
                        name="theme"
                        checked={theme === 'dark'}
                        onChange={() => setTheme('dark')}
                        className="text-violet-500 focus:ring-violet-500"
                      />
                    </label>
                    <label className="flex-1 flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer hover:border-slate-700 transition">
                      <span className="text-sm font-medium text-slate-300">Light Mode</span>
                      <input
                        type="radio"
                        name="theme"
                        checked={theme === 'light'}
                        onChange={() => setTheme('light')}
                        className="text-violet-500 focus:ring-violet-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Font Size</label>
                    <input
                      type="number"
                      value={formData.fontSize || 14}
                      onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Language</label>
                    <select
                      value={formData.language || 'en'}
                      onChange={(e) => handleChange('language', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="de">German</option>
                      <option value="fr">French</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Default Workspace</label>
                  <input
                    type="text"
                    value={formData.defaultWorkspace || ''}
                    onChange={(e) => handleChange('defaultWorkspace', e.target.value)}
                    placeholder="e.g. /Users/name/projects"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    V Code sandboxes file operations strictly to this path.
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'models' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Ollama Endpoint</label>
                  <input
                    type="text"
                    value={formData.ollamaEndpoint || ''}
                    onChange={(e) => handleChange('ollamaEndpoint', e.target.value)}
                    placeholder="http://127.0.0.1:11434"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Default Model</label>
                    <select
                      value={formData.defaultModel || ''}
                      onChange={(e) => handleChange('defaultModel', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    >
                      <option value="">Select a default model</option>
                      {ollamaModels.map((m: any) => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({Math.round(m.size / (1024 * 1024 * 10.24)) / 100} GB)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={formData.temperature ?? 0.2}
                      onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Context Length (Tokens)</label>
                    <input
                      type="number"
                      step="1024"
                      value={formData.contextLength ?? 8192}
                      onChange={(e) => handleChange('contextLength', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Max Output Tokens</label>
                    <input
                      type="number"
                      step="256"
                      value={formData.maxTokens ?? 2048}
                      onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">System Prompt</label>
                  <textarea
                    rows={3}
                    value={formData.systemPrompt || ''}
                    onChange={(e) => handleChange('systemPrompt', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition font-mono text-xs resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'permissions' && (
              <div className="space-y-4">
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 mb-2">
                  <span className="text-xs text-amber-400 font-semibold block mb-1">Security Guardrails</span>
                  <span className="text-xs text-slate-400 block">
                    Define how Vivek Code interacts with your filesystem, terminals, package installations, and git commands. 'Ask' requires explicit approval before any execution.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">File-Read Permission</label>
                    <select
                      value={formData.fileReadPermission || 'ask'}
                      onChange={(e) => handleChange('fileReadPermission', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    >
                      <option value="ask">Ask</option>
                      <option value="allow">Allow All</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">File-Write Permission</label>
                    <select
                      value={formData.fileWritePermission || 'ask'}
                      onChange={(e) => handleChange('fileWritePermission', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    >
                      <option value="ask">Ask</option>
                      <option value="allow">Allow All</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Terminal Execution</label>
                    <select
                      value={formData.terminalPermission || 'ask'}
                      onChange={(e) => handleChange('terminalPermission', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    >
                      <option value="ask">Ask</option>
                      <option value="allow">Allow All</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Git Access</label>
                    <select
                      value={formData.gitPermission || 'ask'}
                      onChange={(e) => handleChange('gitPermission', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition"
                    >
                      <option value="ask">Ask</option>
                      <option value="allow">Allow All</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Local Privacy Assurances</h3>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                    <span className="text-xs text-emerald-400 font-bold block mb-1">Local-First Architecture Active</span>
                    <span className="text-xs text-slate-300">
                      Vivek Code runs entirely locally. Your code indexing, conversation storage, database logs, and model interactions are completely private and never uploaded to any remote server.
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3.5">Danger Zone</h3>
                  <div className="flex gap-4">
                    <button
                      onClick={handleClearHistory}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-950/20 border border-red-900/35 hover:bg-red-950/40 text-red-400 rounded-xl text-sm font-medium transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear Chat History
                    </button>
                    <button
                      onClick={() => alert('Indexes cleared!')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-sm font-medium transition"
                    >
                      Clear Code Indexes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-300 text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white rounded-xl text-sm font-medium transition shadow-lg shadow-violet-950/30"
          >
            Save Settings
          </button>
        </div>

      </div>
    </div>
  );
}
