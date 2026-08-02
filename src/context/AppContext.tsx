'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AppSettings {
  theme: string;
  fontSize: number;
  autoSave: boolean;
  defaultWorkspace: string;
  language: string;
  ollamaEndpoint: string;
  defaultModel: string;
  temperature: number;
  contextLength: number;
  maxTokens: number;
  systemPrompt: string;
  fileReadPermission: string;
  fileWritePermission: string;
  terminalPermission: string;
  packageInstallPermission: string;
  gitPermission: string;
  autoApprovalSettings: boolean;
}

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

interface AppContextType {
  settings: AppSettings | undefined;
  isLoadingSettings: boolean;
  saveSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  
  activeWorkspace: string;
  setActiveWorkspace: (path: string) => void;
  
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  
  activeModel: string;
  setActiveModel: (model: string) => void;
  
  isOllamaConnected: boolean;
  ollamaModels: any[];
  refetchOllamaStatus: () => void;
  
  downloadingModel: { name: string; progress: number; status: string } | null;
  setDownloadingModel: (model: { name: string; progress: number; status: string } | null) => void;
  
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (open: boolean) => void;
  
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  
  isOnboarding: boolean;
  setIsOnboarding: (onboarding: boolean) => void;

  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  // Phase 2 states
  openTabs: EditorTab[];
  activeTabPath: string | null;
  setActiveTabPath: (path: string | null) => void;
  openFile: (path: string, name: string) => Promise<void>;
  closeFile: (path: string) => void;
  saveFile: (path: string) => Promise<void>;
  updateTabContent: (path: string, content: string) => void;
  isSplitEditor: boolean;
  setIsSplitEditor: (split: boolean) => void;
  activeExplorerTab: 'chat' | 'explorer' | 'git' | 'logs';
  setActiveExplorerTab: (tab: 'chat' | 'explorer' | 'git' | 'logs') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeWorkspace, setActiveWorkspaceState] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState('');
  const [downloadingModel, setDownloadingModel] = useState<{ name: string; progress: number; status: string } | null>(null);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(true);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [isSplitEditor, setIsSplitEditor] = useState(false);
  const [activeExplorerTab, setActiveExplorerTab] = useState<'chat' | 'explorer' | 'git' | 'logs'>('chat');

  const openFile = async (filePath: string, fileName: string) => {
    // Check if file is already open
    const existingTab = openTabs.find((tab) => tab.path === filePath);
    if (existingTab) {
      setActiveTabPath(filePath);
      return;
    }

    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        throw new Error(`Failed to read file: ${res.statusText}`);
      }
      const data = await res.json();
      
      const newTab: EditorTab = {
        path: filePath,
        name: fileName,
        content: data.content || '',
        isDirty: false,
      };

      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabPath(filePath);
    } catch (err: any) {
      alert(`Error reading file: ${err.message}`);
    }
  };

  const closeFile = (filePath: string) => {
    setOpenTabs((prev) => {
      const remaining = prev.filter((tab) => tab.path !== filePath);
      if (activeTabPath === filePath) {
        setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
      }
      return remaining;
    });
  };

  const saveFile = async (filePath: string) => {
    const tab = openTabs.find((t) => t.path === filePath);
    if (!tab) return;

    try {
      const res = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: tab.content }),
      });

      if (!res.ok) {
        throw new Error(`Failed to write file: ${res.statusText}`);
      }

      setOpenTabs((prev) =>
        prev.map((t) => (t.path === filePath ? { ...t, isDirty: false } : t))
      );
    } catch (err: any) {
      alert(`Error saving file: ${err.message}`);
    }
  };

  const updateTabContent = (filePath: string, content: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === filePath ? { ...t, content, isDirty: true } : t))
    );
  };
  // 1. Fetch settings from API
  const { data: settings, isLoading: isLoadingSettings, refetch: refetchSettings } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  // 2. Fetch Ollama Status and models
  const { data: ollamaData, refetch: refetchOllamaStatus } = useQuery({
    queryKey: ['ollamaStatus'],
    queryFn: async () => {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error('Failed to fetch models');
      return res.json();
    },
    refetchInterval: 10000, // Poll Ollama status every 10s
  });

  const isOllamaConnected = ollamaData?.isConnected || false;
  const ollamaModels = ollamaData?.models || [];

  // Initialize theme and workspace from settings
  useEffect(() => {
    if (settings) {
      setThemeState(settings.theme === 'light' ? 'light' : 'dark');
      if (settings.defaultWorkspace && !activeWorkspace) {
        setActiveWorkspaceState(settings.defaultWorkspace);
        setIsOnboarding(false);
      }
      if (settings.defaultModel && !activeModel) {
        setActiveModel(settings.defaultModel);
      } else if (ollamaModels.length > 0 && !activeModel) {
        // Fallback to first available model if default is unset
        setActiveModel(ollamaModels[0].name);
      }
    }
  }, [settings, ollamaModels, activeModel, activeWorkspace]);

  // Handle setting updates
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<AppSettings>) => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      refetchSettings();
    },
  });

  const saveSettings = async (newSettings: Partial<AppSettings>) => {
    await saveSettingsMutation.mutateAsync(newSettings);
  };

  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
    saveSettings({ theme: t });
    
    // Update DOM class list
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      if (t === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
      } else {
        root.classList.remove('light');
        root.classList.add('dark');
      }
    }
  };

  const setActiveWorkspace = (path: string) => {
    setActiveWorkspaceState(path);
    saveSettings({ defaultWorkspace: path });
    if (path) {
      setIsOnboarding(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        settings,
        isLoadingSettings,
        saveSettings,
        activeWorkspace,
        setActiveWorkspace,
        currentConversationId,
        setCurrentConversationId,
        activeModel,
        setActiveModel,
        isOllamaConnected,
        ollamaModels,
        refetchOllamaStatus,
        downloadingModel,
        setDownloadingModel,
        isRightSidebarOpen,
        setIsRightSidebarOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        isOnboarding,
        setIsOnboarding,
        theme,
        setTheme,
        openTabs,
        activeTabPath,
        setActiveTabPath,
        openFile,
        closeFile,
        saveFile,
        updateTabContent,
        isSplitEditor,
        setIsSplitEditor,
        activeExplorerTab,
        setActiveExplorerTab,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
