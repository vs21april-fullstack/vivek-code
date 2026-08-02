import React, { useRef, useEffect, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useApp } from '@/context/AppContext';
import { X, Save, RefreshCw, Sparkles, HelpCircle, Columns, Minimize, Maximize2, Zap } from 'lucide-react';

export default function MonacoEditor() {
  const {
    openTabs,
    activeTabPath,
    setActiveTabPath,
    closeFile,
    saveFile,
    updateTabContent,
    isSplitEditor,
    setIsSplitEditor,
    setActiveExplorerTab,
    currentConversationId,
    setCurrentConversationId,
    activeModel,
  } = useApp();

  const editorRef = useRef<any>(null);
  const [selectedText, setSelectedText] = useState('');
  const [editorTheme, setEditorTheme] = useState('vs-dark');

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  // Debounced auto-save implementation
  useEffect(() => {
    if (!activeTab || !activeTab.isDirty) return;
    
    // Auto-save check from local Settings
    const saveTimeout = setTimeout(() => {
      saveFile(activeTab.path);
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(saveTimeout);
  }, [activeTab?.content, activeTab?.isDirty, activeTabPath]);

  if (openTabs.length === 0 || !activeTabPath || !activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500 select-none">
        <HelpCircle className="w-10 h-10 mb-3 text-slate-700 animate-pulse" />
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-650">No open documents</span>
      </div>
    );
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Track text selection
    editor.onDidChangeCursorSelection((e: any) => {
      const selection = editor.getSelection();
      const text = editor.getModel().getValueInRange(selection);
      setSelectedText(text);
    });

    // Save shortcut bindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile(activeTab.path);
    });
  };

  const handleAIAction = async (promptAction: string) => {
    const textToAnalyze = selectedText || activeTab.content;
    const commandText = `Inside my open file \`${activeTab.name}\`:\n\n${
      selectedText ? '### Highlighted Code:\n' : '### Complete File Contents:\n'
    }\`\`\`\n${textToAnalyze}\n\`\`\`\n\nPlease ${promptAction} and return the optimized solution.`;

    // Open chat sidebar and append prompt
    setActiveExplorerTab('chat');

    // Create a new conversation if none is active
    let convId = currentConversationId;
    if (!convId) {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${promptAction} ${activeTab.name}` }),
        });
        if (res.ok) {
          const data = await res.json();
          convId = data.id;
          setCurrentConversationId(data.id);
        }
      } catch (err) {
        console.error('Failed to auto-create conversation:', err);
      }
    }

    // Call chat message submit (simplified by populating the text area)
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = commandText;
      // Focus and simulate typing
      textarea.focus();
    }
  };

  const getLanguageFromExtension = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'json':
        return 'json';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'md':
        return 'markdown';
      case 'prisma':
        return 'prisma';
      case 'py':
        return 'python';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      
      {/* Editor Tabs Header */}
      <div className="flex items-center justify-between border-b border-slate-850 bg-slate-900/40 select-none">
        
        {/* Open Tab List */}
        <div className="flex-1 flex overflow-x-auto pr-8">
          {openTabs.map((tab) => {
            const isSelected = activeTabPath === tab.path;
            return (
              <div
                key={tab.path}
                onClick={() => setActiveTabPath(tab.path)}
                className={`group flex items-center gap-2 px-4 py-2 text-xs font-semibold cursor-pointer border-r border-slate-850/80 transition ${
                  isSelected
                    ? 'bg-slate-950 text-white border-t-2 border-t-violet-500'
                    : 'text-slate-500 hover:bg-slate-900/60 hover:text-slate-350'
                }`}
              >
                <span className="max-w-[120px] truncate">{tab.name}</span>
                
                {/* Save/Unsaved state indicator */}
                {tab.isDirty ? (
                  <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" title="Unsaved changes" />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(tab.path);
                    }}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-650 group-hover:text-slate-350 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Editor Settings / Actions */}
        <div className="flex items-center gap-1.5 px-3 py-1 border-l border-slate-850">
          <button
            onClick={() => setIsSplitEditor(!isSplitEditor)}
            className={`p-1.5 rounded-lg border border-slate-850 text-slate-500 hover:text-slate-200 transition ${
              isSplitEditor ? 'bg-slate-800 border-slate-700' : ''
            }`}
            title="Toggle Split Editor"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => saveFile(activeTab.path)}
            disabled={!activeTab.isDirty}
            className={`p-1.5 rounded-lg border border-slate-850 transition ${
              activeTab.isDirty ? 'text-violet-400 border-violet-500/20 hover:bg-violet-650/10' : 'text-slate-700 cursor-not-allowed'
            }`}
            title="Save File"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Primary Editor */}
        <div className="flex-1 h-full relative">
          
          {/* Floating AI Actions (if text is highlighted) */}
          {selectedText.trim().length > 0 && (
            <div className="absolute top-3 right-8 z-10 flex items-center gap-1.5 bg-slate-900 border border-slate-800/80 px-2 py-1 rounded-xl shadow-lg glow-primary animate-fade-in select-none">
              <span className="text-[10px] text-slate-400 font-bold mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                AI Actions:
              </span>
              <button
                onClick={() => handleAIAction('Explain this selection')}
                className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 hover:bg-slate-850 font-semibold transition"
              >
                Explain
              </button>
              <button
                onClick={() => handleAIAction('Fix issues in this selection')}
                className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 hover:bg-slate-850 font-semibold transition"
              >
                Fix
              </button>
              <button
                onClick={() => handleAIAction('Refactor or optimize this selection')}
                className="px-2 py-0.5 rounded text-[10px] bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-605/20 font-bold transition"
              >
                Refactor
              </button>
            </div>
          )}

          <Editor
            height="100%"
            language={getLanguageFromExtension(activeTab.name)}
            theme={editorTheme}
            value={activeTab.content}
            onChange={(val) => updateTabContent(activeTab.path, val || '')}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: true },
              fontSize: 13,
              fontFamily: 'var(--font-geist-mono), Courier, monospace',
              tabSize: 2,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              lineNumbersMinChars: 3,
            }}
          />
        </div>

        {/* Split Editor Pane (if toggled) */}
        {isSplitEditor && (
          <div className="flex-1 h-full border-l border-slate-850 relative">
            <Editor
              height="100%"
              language={getLanguageFromExtension(activeTab.name)}
              theme={editorTheme}
              value={activeTab.content}
              options={{
                readOnly: true, // Split view defaults as preview/readOnly
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'var(--font-geist-mono), Courier, monospace',
                tabSize: 2,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        )}

      </div>

    </div>
  );
}
