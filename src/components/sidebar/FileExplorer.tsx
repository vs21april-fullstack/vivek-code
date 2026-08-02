import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Folder, FolderOpen, File, Plus, FolderPlus, Edit, Trash2, Search, FileText, Settings, ChevronRight, ChevronDown, Check, X, RefreshCw } from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  isOpen?: boolean;
  children?: FileNode[];
}

export default function FileExplorer() {
  const {
    activeWorkspace,
    setActiveWorkspace,
    openFile,
  } = useApp();

  const [explorerMode, setExplorerMode] = useState<'tree' | 'search' | 'grep'>('tree');
  const [treeData, setTreeData] = useState<FileNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // File operation controls
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editAction, setEditAction] = useState<'create_file' | 'create_folder' | 'rename' | null>(null);
  const [operationName, setOperationName] = useState('');

  // 1. Initial workspace folder load
  const loadRootDirectory = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(activeWorkspace)}`);
      if (!res.ok) throw new Error('Failed to load root');
      const data = await res.json();
      setTreeData(data.map((item: any) => ({ ...item, isOpen: false, children: [] })));
    } catch (err) {
      console.error('Error loading root workspace directory:', err);
    }
  };

  useEffect(() => {
    loadRootDirectory();
  }, [activeWorkspace]);

  // 2. Lazy loading child directories
  const toggleFolder = async (node: FileNode) => {
    if (!node.isDirectory) return;

    const updateNodeInTree = async (nodes: FileNode[]): Promise<FileNode[]> => {
      return Promise.all(
        nodes.map(async (n) => {
          if (n.path === node.path) {
            const nextOpen = !n.isOpen;
            let children = n.children || [];
            
            // Fetch children if opening and empty
            if (nextOpen && children.length === 0) {
              try {
                const res = await fetch(`/api/files?path=${encodeURIComponent(n.path)}`);
                if (res.ok) {
                  const data = await res.json();
                  children = data.map((item: any) => ({ ...item, isOpen: false, children: [] }));
                }
              } catch (err) {
                console.error('Error lazy loading children:', err);
              }
            }

            return { ...n, isOpen: nextOpen, children };
          } else if (n.children && n.children.length > 0) {
            return { ...n, children: await updateNodeInTree(n.children) };
          }
          return n;
        })
      );
    };

    const updated = await updateNodeInTree(treeData);
    setTreeData(updated);
  };

  // 3. Search and Grep functions
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const endpoint = explorerMode === 'search' ? '/api/files/search' : '/api/files/grep';
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // 4. File system operations handler
  const executeFileOperation = async (targetPath: string) => {
    if (!operationName.trim() || !editAction) return;

    try {
      let payload: any = { action: editAction };
      if (editAction === 'create_file' || editAction === 'create_folder') {
        payload.path = `${targetPath}/${operationName}`;
      } else if (editAction === 'rename') {
        payload.path = targetPath;
        const parent = targetPath.substring(0, targetPath.lastIndexOf('/'));
        payload.newPath = `${parent}/${operationName}`;
      }

      const res = await fetch('/api/files/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Operation failed');
      }

      // Reset states and reload tree
      setEditingPath(null);
      setEditAction(null);
      setOperationName('');
      loadRootDirectory();
    } catch (err: any) {
      alert(`File operation failed: ${err.message}`);
    }
  };

  const handleDelete = async (filePath: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      try {
        const res = await fetch('/api/files/operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', path: filePath }),
        });
        if (!res.ok) throw new Error('Delete failed');
        loadRootDirectory();
      } catch (err) {
        alert('Failed to delete file.');
      }
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNodes = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isEditing = editingPath === node.path;

      return (
        <div key={node.path} className="select-none flex flex-col">
          {/* Node Row */}
          <div
            style={{ paddingLeft: `${depth * 12 + 6}px` }}
            className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs cursor-pointer hover:bg-slate-800/40 transition-all ${
              node.isDirectory ? 'text-slate-350' : 'text-slate-300'
            }`}
            onClick={() => (node.isDirectory ? toggleFolder(node) : openFile(node.path, node.name))}
          >
            <div className="flex items-center gap-1.5 truncate">
              {node.isDirectory ? (
                <>
                  {node.isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                  {node.isOpen ? <FolderOpen className="w-4 h-4 text-violet-400 shrink-0" /> : <Folder className="w-4 h-4 text-violet-400 shrink-0" />}
                </>
              ) : (
                <>
                  <span className="w-3.5 h-3.5" /> {/* Align indent with folders */}
                  <File className="w-4 h-4 text-slate-400 shrink-0" />
                </>
              )}
              <span className="truncate">{node.name}</span>
            </div>

            {/* Quick Action Overlay (Folders/Files buttons) */}
            <div className="hidden group-hover:flex items-center gap-1">
              {node.isDirectory && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPath(node.path);
                      setEditAction('create_file');
                      setOperationName('');
                    }}
                    className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60"
                    title="New File"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPath(node.path);
                      setEditAction('create_folder');
                      setOperationName('');
                    }}
                    className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60"
                    title="New Folder"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingPath(node.path);
                  setEditAction('rename');
                  setOperationName(node.name);
                }}
                className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60"
                title="Rename"
              >
                <Edit className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => handleDelete(node.path, node.name, e)}
                className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700/60"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Inline Action Form (when editing / creating) */}
          {isEditing && (
            <div
              style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
              className="flex items-center gap-1.5 py-1 pr-2 bg-slate-900 border-l border-violet-500"
            >
              <input
                type="text"
                value={operationName}
                onChange={(e) => setOperationName(e.target.value)}
                placeholder={editAction?.replace('_', ' ')}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-200 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && executeFileOperation(node.path)}
                autoFocus
              />
              <button
                onClick={() => executeFileOperation(node.path)}
                className="p-0.5 text-emerald-400 hover:text-emerald-350 hover:bg-slate-800 rounded"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  setEditingPath(null);
                  setEditAction(null);
                }}
                className="p-0.5 text-red-400 hover:text-red-350 hover:bg-slate-800 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Nested Children (if directory and expanded) */}
          {node.isDirectory && node.isOpen && node.children && node.children.length > 0 && (
            <div className="flex flex-col">
              {renderTreeNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none bg-slate-900/30">
      
      {/* Search Type Tabs Header */}
      <div className="flex px-3 py-2 border-b border-slate-850 gap-1 bg-slate-900/20">
        <button
          onClick={() => setExplorerMode('tree')}
          className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
            explorerMode === 'tree' ? 'bg-slate-805 text-white shadow' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Files
        </button>
        <button
          onClick={() => setExplorerMode('search')}
          className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
            explorerMode === 'search' ? 'bg-slate-805 text-white shadow' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setExplorerMode('grep')}
          className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
            explorerMode === 'grep' ? 'bg-slate-805 text-white shadow' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Grep
        </button>
      </div>

      {/* Workspace Picker Info Bar */}
      <div className="px-3 py-2 border-b border-slate-850/80 bg-slate-950/20 flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-bold text-slate-500 uppercase tracking-wider">Workspace Explorer</span>
        <button
          onClick={loadRootDirectory}
          className="p-1 rounded text-slate-500 hover:text-slate-200 transition"
          title="Reload Workspace Tree"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode Subview Panels */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {explorerMode === 'tree' ? (
          /* TREE FOLDER VIEW */
          treeData.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              Workspace empty or loading
            </div>
          ) : (
            <div className="space-y-0.5">
              {renderTreeNodes(treeData)}
            </div>
          )
        ) : (
          /* FILENAME SEARCH & CONTENT GREP PANELS */
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={explorerMode === 'search' ? 'Search filenames...' : 'Search text inside files...'}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>

            {isSearching ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-xs text-slate-500 animate-pulse">Searching code...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500">
                Type query and hit Enter
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {searchResults.map((result: any, idx) => (
                  <div
                    key={idx}
                    onClick={() => openFile(result.path, result.name || result.fileName)}
                    className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-850 hover:border-slate-700 cursor-pointer transition flex flex-col gap-1 text-left"
                  >
                    <span className="text-xs font-bold text-white truncate">
                      {result.name || result.fileName}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate font-mono">
                      {result.relativePath}
                    </span>
                    {result.lineNumber && (
                      <div className="mt-1 p-1 bg-slate-900 rounded border border-slate-850 font-mono text-[9px] text-slate-400">
                        <span className="text-violet-400 font-bold mr-1">L{result.lineNumber}:</span>
                        {result.lineContent}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
