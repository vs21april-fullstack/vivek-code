import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, MessageSquare, Edit3, Trash2, Settings, FolderClosed, Check, X, GitBranch } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import FileExplorer from './FileExplorer';

export default function Sidebar() {
  const {
    currentConversationId,
    setCurrentConversationId,
    activeWorkspace,
    isOllamaConnected,
    setIsSettingsOpen,
    setIsOnboarding,
    activeExplorerTab,
    setActiveExplorerTab,
  } = useApp();

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // 1. Fetch conversations from API
  const { data: conversations = [], refetch } = useQuery<any[]>({
    queryKey: ['conversations', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/conversations?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    },
  });

  // 2. Mutations for conversation management
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setCurrentConversationId(data.id);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (currentConversationId === deletedId) {
        setCurrentConversationId(null);
      }
    },
  });

  const startRename = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
  };

  const handleRename = (id: string) => {
    if (editTitle.trim()) {
      renameMutation.mutate({ id, title: editTitle });
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteMutation.mutate(id);
    }
  };

  const getWorkspaceName = () => {
    if (!activeWorkspace) return 'No Workspace';
    const parts = activeWorkspace.split(/[\\/]/);
    return parts[parts.length - 1] || activeWorkspace;
  };

  return (
    <div className="w-64 bg-slate-50 border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col h-full shrink-0">
      
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between">
        <Logo />
      </div>

      {/* Workspace Display */}
      {activeWorkspace && (
        <div className="mx-3 my-2.5 p-3 rounded-xl bg-white border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800/80 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <FolderClosed className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={activeWorkspace}>
              {getWorkspaceName()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
            <GitBranch className="w-3 h-3 text-emerald-400" />
            main
          </div>
        </div>
      )}

      {/* Tab Switcher Headers */}
      <div className="flex px-3 py-1.5 border-b border-slate-200 dark:border-slate-850 gap-1 bg-slate-100/30 dark:bg-slate-950/20">
        <button
          onClick={() => setActiveExplorerTab('chat')}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
            activeExplorerTab === 'chat'
              ? 'bg-violet-650/10 text-violet-500 dark:text-violet-400 border border-violet-500/20 shadow-sm'
              : 'text-slate-500 hover:bg-slate-200/40 hover:text-slate-700 dark:hover:bg-slate-800/40 dark:hover:text-slate-350 border border-transparent'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveExplorerTab('explorer')}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
            activeExplorerTab === 'explorer'
              ? 'bg-violet-650/10 text-violet-500 dark:text-violet-400 border border-violet-500/20 shadow-sm'
              : 'text-slate-500 hover:bg-slate-200/40 hover:text-slate-700 dark:hover:bg-slate-800/40 dark:hover:text-slate-350 border border-transparent'
          }`}
        >
          Files
        </button>
      </div>

      {/* Dynamic Tab Body */}
      {activeExplorerTab === 'chat' ? (
        <>
          {/* New Conversation Button */}
          <div className="px-3 py-2">
            <button
              onClick={() => createMutation.mutate()}
              className="w-full py-2 px-3 bg-violet-600 hover:bg-violet-500 active:bg-violet-750 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-violet-950/20 transition-all select-none"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>

          {/* Search Conversations */}
          <div className="px-3 py-1.5 relative font-sans">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500 transition shadow-sm"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-6 top-3.5" />
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">
                No chats found
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = currentConversationId === conv.id;
                const isEditing = editingId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => !isEditing && setCurrentConversationId(conv.id)}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-violet-600/10 text-violet-400 border border-violet-500/25 glow-primary'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(conv.id)}
                          className="flex-1 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none text-[11px]"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(conv.id)}
                          className="p-0.5 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-0.5 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 overflow-hidden pr-12">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{conv.title}</span>
                        </div>

                        {/* Action buttons (revealed on hover) */}
                        <div className="absolute right-2 top-1.5 hidden group-hover:flex items-center gap-1 bg-gradient-to-l from-slate-900 via-slate-900 to-transparent pl-4 py-0.5">
                          <button
                            onClick={(e) => startRename(conv.id, conv.title, e)}
                            className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-850 transition"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(conv.id, e)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-850 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <FileExplorer />
      )}

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-850 flex flex-col gap-2 bg-slate-100/50 dark:bg-slate-900/50">
        
        {/* Ollama Connection Indicator */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
          <span className="flex items-center gap-1.5 font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                isOllamaConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            ></span>
            Ollama {isOllamaConnected ? 'Connected' : 'Offline'}
          </span>
          <button
            onClick={() => setIsOnboarding(true)}
            className="text-violet-500 dark:text-violet-400 hover:underline font-semibold"
          >
            Setup Guide
          </button>
        </div>

        {/* Settings button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition select-none"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Ctrl+,</span>
        </button>

      </div>
    </div>
  );
}
