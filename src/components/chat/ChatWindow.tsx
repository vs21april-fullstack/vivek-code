import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, StopCircle, RefreshCw, Edit3, Check, Copy, ChevronDown, Sparkles, Terminal, FileText, Globe } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  createdAt: string;
}

export default function ChatWindow() {
  const {
    currentConversationId,
    setCurrentConversationId,
    activeModel,
    setActiveModel,
    ollamaModels,
    isOllamaConnected,
    settings,
    activeWorkspace,
    setProposedChanges,
  } = useApp();

  const parseStreamProposedChanges = (text: string) => {
    const createRegex = /<<<<\s*CREATE:\s*(.*?)\s*\n([\s\S]*?)>>>>/g;
    const modifyRegex = /<<<<\s*MODIFY:\s*(.*?)\s*\n([\s\S]*?)>>>>/g;

    const changes: any[] = [];
    let match;
    let foundTagChange = false;

    // 1. Try custom tags
    while ((match = createRegex.exec(text)) !== null) {
      foundTagChange = true;
      const filePath = match[1].trim();
      const content = match[2];
      const fullPath = filePath.startsWith('/') ? filePath : `${activeWorkspace}/${filePath}`;
      changes.push({
        id: `change-create-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'create_file',
        path: fullPath,
        content,
        status: 'pending',
      });
    }

    while ((match = modifyRegex.exec(text)) !== null) {
      foundTagChange = true;
      const filePath = match[1].trim();
      const content = match[2];
      const fullPath = filePath.startsWith('/') ? filePath : `${activeWorkspace}/${filePath}`;
      changes.push({
        id: `change-modify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'modify_file',
        path: fullPath,
        content,
        status: 'pending',
      });
    }

    // 2. Fallback: Parse code blocks with filename comments (helpful for small models like Qwen 3B)
    if (!foundTagChange) {
      const codeBlockRegex = /```[a-zA-Z]*\n([\s\S]*?)\n```/g;
      while ((match = codeBlockRegex.exec(text)) !== null) {
        const codeText = match[1];
        const lines = codeText.split('\n');
        const firstLines = lines.slice(0, 3);
        let detectedPath = '';

        for (const line of firstLines) {
          const trimmedLine = line.trim();
          // Matches: // filename.js, # filename.js, /* filename.js */
          const fileMatch = trimmedLine.match(/^(?:\/\/\s*|#\s*|\/\*\s*|<!--\s*)([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
          if (fileMatch) {
            detectedPath = fileMatch[1].trim();
            break;
          }
        }

        if (detectedPath && !detectedPath.includes(' ') && detectedPath.includes('.')) {
          const fullPath = detectedPath.startsWith('/') ? detectedPath : `${activeWorkspace}/${detectedPath}`;
          changes.push({
            id: `change-detect-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            action: 'create_file',
            path: fullPath,
            content: codeText,
            status: 'pending',
          });
        }
      }
    }

    if (changes.length > 0) {
      setProposedChanges((prev) => {
        // Avoid duplicate paths/contents in the list
        const unique = changes.filter(
          (c) => !prev.some((p) => p.path === c.path && p.content === c.content)
        );
        return [...prev, ...unique];
      });
    }
  };

  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const [activeMode, setActiveMode] = useState<'ask' | 'plan' | 'edit' | 'agent'>('ask');

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 1. Fetch message history for selected conversation
  const { data: conversationData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['conversation', currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return null;
      const res = await fetch(`/api/conversations/${currentConversationId}`);
      if (!res.ok) throw new Error('Failed to fetch conversation messages');
      return res.json();
    },
    enabled: !!currentConversationId,
  });

  // Sync messages from fetch
  useEffect(() => {
    if (conversationData?.messages) {
      setMessages(conversationData.messages);
    } else {
      setMessages([]);
    }
  }, [conversationData]);

  // Auto scroll to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = async (textToSend: string, conversationIdToUse = currentConversationId, resendIndex: number | null = null) => {
    if (!textToSend.trim() || isGenerating) return;
    if (!activeModel) {
      alert('No AI Model selected. Please download or select a model first.');
      return;
    }

    setIsGenerating(true);
    setInput('');
    setEditingMessageId(null);

    // If editing/resending, remove all messages after the edit index
    let updatedHistory = [...messages];
    if (resendIndex !== null) {
      updatedHistory = updatedHistory.slice(0, resendIndex);
    }

    // Add user message locally
    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };
    
    // Add temporary assistant message for streaming
    const assistantMsg: Message = {
      id: 'temp-assistant',
      role: 'assistant',
      content: '',
      model: activeModel,
      createdAt: new Date().toISOString(),
    };

    setMessages([...updatedHistory, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const agentInstruction = `\n\nWhen writing or creating a file, you MUST output a block using this format:
<<<< CREATE: path/to/file
[file contents]
>>>>
When modifying an existing file, you MUST output:
<<<< MODIFY: path/to/file
[full modified file contents]
>>>>`;

      const chatPayload = {
        conversationId: conversationIdToUse,
        messages: [...updatedHistory, userMsg].map((m) => ({ role: m.role, content: m.content })),
        model: activeModel,
        temperature: settings?.temperature ?? 0.2,
        contextLength: settings?.contextLength ?? 8192,
        maxTokens: settings?.maxTokens ?? 2048,
        systemPrompt: (settings?.systemPrompt || '') + agentInstruction,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Chat connection failed: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Stream reader is not available');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentResponseText = '';
      let activeConvId = conversationIdToUse;

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
              if (data.type === 'metadata') {
                if (!activeConvId) {
                  activeConvId = data.conversationId;
                  setCurrentConversationId(data.conversationId);
                  queryClient.invalidateQueries({ queryKey: ['conversations'] });
                }
              } else if (data.type === 'chunk') {
                currentResponseText += data.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === 'temp-assistant'
                      ? { ...msg, content: currentResponseText }
                      : msg
                  )
                );
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e: any) {
              console.error('SSE JSON parse error:', e);
            }
          }
        }
      }

      // Finish streaming, refresh query to persist
      parseStreamProposedChanges(currentResponseText);
      queryClient.invalidateQueries({ queryKey: ['conversation', activeConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Generation aborted');
      } else {
        console.error('Chat error:', err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === 'temp-assistant'
              ? { ...msg, content: `Error: ${err.message || 'Failed to complete message.'}` }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    // Find last user message
    const history = [...messages];
    let lastUserMsgIndex = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        lastUserMsgIndex = i;
        break;
      }
    }

    if (lastUserMsgIndex !== -1) {
      const userText = history[lastUserMsgIndex].content;
      handleSend(userText, currentConversationId, lastUserMsgIndex);
    }
  };

  const handleResendEdit = (id: string, index: number) => {
    if (editInput.trim()) {
      handleSend(editInput, currentConversationId, index);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Simple Markdown & Code block formatter
  const renderMessageContent = (content: string) => {
    if (!content) return <span className="animate-pulse">|</span>;

    const parseInline = (text: string) => {
      if (!text) return '';

      // Split by inline code: `code`
      const inlineCodeParts = text.split(/(\`[^\`\n]+\`)/g);

      return inlineCodeParts.map((part, idx) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={idx} className="bg-slate-850 border border-slate-700/60 px-1.5 py-0.5 rounded text-violet-400 font-mono text-xs font-bold mx-0.5">
              {part.slice(1, -1)}
            </code>
          );
        }

        // Split by bold (**text**)
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((bPart, bIdx) => {
          if (bPart.startsWith('**') && bPart.endsWith('**')) {
            return (
              <strong key={bIdx} className="font-bold text-white">
                {bPart.slice(2, -2)}
              </strong>
            );
          }

          // Split by italics (*text*)
          const italicParts = bPart.split(/(\*[^*]+\*)/g);
          return italicParts.map((iPart, iIdx) => {
            if (iPart.startsWith('*') && iPart.endsWith('*')) {
              return (
                <em key={iIdx} className="italic text-slate-300">
                  {iPart.slice(1, -1)}
                </em>
              );
            }

            // Split by links ([text](url))
            const linkParts = iPart.split(/(\[[^\]]+\]\([^)]+\))/g);
            return linkParts.map((lPart, lIdx) => {
              const linkMatch = lPart.match(/\[([^\]]+)\]\(([^)]+)\)/);
              if (linkMatch) {
                return (
                  <a
                    key={lIdx}
                    href={linkMatch[2]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-400 hover:underline font-semibold"
                  >
                    {linkMatch[1]}
                  </a>
                );
              }
              return lPart;
            });
          });
        });
      });
    };

    const parseMarkdownBlocks = (text: string, blockKey: number) => {
      const lines = text.split('\n');
      const elements: React.ReactNode[] = [];
      let currentListItems: React.ReactNode[] = [];
      let currentListType: 'ul' | 'ol' | null = null;
      let pLines: string[] = [];

      const flushParagraph = (key: string) => {
        if (pLines.length > 0) {
          elements.push(
            <p key={`p-${key}`} className="leading-relaxed text-sm text-slate-300 my-2">
              {parseInline(pLines.join('\n'))}
            </p>
          );
          pLines = [];
        }
      };

      const flushList = (key: string) => {
        if (currentListItems.length > 0) {
          if (currentListType === 'ul') {
            elements.push(
              <ul key={`ul-${key}`} className="list-disc pl-5 my-2 space-y-1 text-slate-350">
                {currentListItems}
              </ul>
            );
          } else {
            elements.push(
              <ol key={`ol-${key}`} className="list-decimal pl-5 my-2 space-y-1 text-slate-350">
                {currentListItems}
              </ol>
            );
          }
          currentListItems = [];
          currentListType = null;
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const key = `${blockKey}-${i}`;

        // 1. Headers
        if (trimmed.startsWith('#### ')) {
          flushParagraph(key);
          flushList(key);
          elements.push(<h4 key={`h4-${key}`} className="text-sm font-bold text-white mt-4 mb-1.5">{parseInline(trimmed.slice(5))}</h4>);
          continue;
        }
        if (trimmed.startsWith('### ')) {
          flushParagraph(key);
          flushList(key);
          elements.push(<h3 key={`h3-${key}`} className="text-base font-bold text-white mt-5 mb-2">{parseInline(trimmed.slice(4))}</h3>);
          continue;
        }
        if (trimmed.startsWith('## ')) {
          flushParagraph(key);
          flushList(key);
          elements.push(<h2 key={`h2-${key}`} className="text-lg font-bold text-white mt-6 mb-2.5 border-b border-slate-800 pb-1">{parseInline(trimmed.slice(3))}</h2>);
          continue;
        }
        if (trimmed.startsWith('# ')) {
          flushParagraph(key);
          flushList(key);
          elements.push(<h1 key={`h1-${key}`} className="text-xl font-black text-white mt-7 mb-3 border-b border-slate-800 pb-1.5">{parseInline(trimmed.slice(2))}</h1>);
          continue;
        }

        // 2. Horizontal Rules
        if (trimmed === '---' || trimmed === '***') {
          flushParagraph(key);
          flushList(key);
          elements.push(<hr key={`hr-${key}`} className="border-slate-850 my-4" />);
          continue;
        }

        // 3. Blockquotes
        if (trimmed.startsWith('> ')) {
          flushParagraph(key);
          flushList(key);
          elements.push(
            <blockquote key={`quote-${key}`} className="border-l-4 border-violet-500/60 bg-slate-900/40 pl-4 py-2 pr-2 my-2.5 rounded-r-xl text-slate-400 italic">
              {parseInline(trimmed.slice(2))}
            </blockquote>
          );
          continue;
        }

        // 4. Unordered Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          flushParagraph(key);
          if (currentListType && currentListType !== 'ul') {
            flushList(key);
          }
          currentListType = 'ul';
          const cleanLine = trimmed.replace(/^[-*]\s+/, '');
          currentListItems.push(<li key={`li-${key}`}>{parseInline(cleanLine)}</li>);
          continue;
        }

        // 5. Ordered Lists
        const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (orderedMatch) {
          flushParagraph(key);
          if (currentListType && currentListType !== 'ol') {
            flushList(key);
          }
          currentListType = 'ol';
          currentListItems.push(<li key={`li-${key}`}>{parseInline(orderedMatch[2])}</li>);
          continue;
        }

        // 6. Blank Line
        if (!trimmed) {
          flushParagraph(key);
          flushList(key);
          continue;
        }

        // 7. Text accumulation for paragraphs
        flushList(key);
        pLines.push(line);
      }

      // Flush remainder
      flushParagraph(`end-${blockKey}`);
      flushList(`end-${blockKey}`);

      return elements;
    };

    const parts = content.split(/(\`\`\`[a-zA-Z]*\n[\s\S]*?\n\`\`\`)/g);

    return parts.map((part, index) => {
      // Code Block Match
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const header = lines[0] || '';
        const lang = header.replace('```', '') || 'code';
        const codeText = lines.slice(1, -1).join('\n');

        return (
          <div key={index} className="my-3.5 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden text-xs font-mono glow-accent">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-850 bg-slate-900/60 select-none">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">{lang}</span>
              <button
                onClick={() => copyToClipboard(codeText)}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 transition text-[10px] font-semibold"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-slate-350 leading-relaxed font-mono">
              <code>{codeText}</code>
            </pre>
          </div>
        );
      }

      // Standard Text block markdown translation
      return (
        <div key={index} className="flex flex-col">
          {parseMarkdownBlocks(part, index)}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      
      {/* Model Selection Header */}
      <div className="px-6 py-3 border-b border-slate-850 bg-slate-900/10 flex items-center justify-between select-none">
        
        {/* Model Picker */}
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <select
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
            className="bg-transparent text-sm font-bold text-slate-200 focus:outline-none cursor-pointer pr-4 border-r border-slate-800"
          >
            {ollamaModels.length === 0 ? (
              <option value="">No models installed</option>
            ) : (
              ollamaModels.map((m: any) => (
                <option key={m.name} value={m.name} className="bg-slate-900 text-slate-200">
                  {m.name}
                </option>
              ))
            )}
          </select>
          
          {/* Agent Mode Selection */}
          <div className="flex gap-1.5">
            {(['ask', 'plan', 'edit', 'agent'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${
                  activeMode === mode
                    ? 'bg-violet-600 text-white shadow shadow-violet-950/20'
                    : 'text-slate-500 hover:bg-slate-850 hover:text-slate-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Ollama Connection Dot */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className={`w-2 h-2 rounded-full ${isOllamaConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          {isOllamaConnected ? 'Ollama Online' : 'Ollama Offline'}
        </div>

      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 glow-primary">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">Ask Vivek Code Anything</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                V Code is ready to explore your workspace code. Type a message below or use context selectors to start.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-2.5 w-full text-left pt-2.5">
              <button
                onClick={() => setInput('Explain the system architecture')}
                className="p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-850 rounded-xl text-[11px] text-slate-300 font-medium transition"
              >
                <Globe className="w-3.5 h-3.5 text-violet-400 mb-1" />
                Explain architecture
              </button>
              <button
                onClick={() => setInput('How do I run tests in this repository?')}
                className="p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-850 rounded-xl text-[11px] text-slate-300 font-medium transition"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400 mb-1" />
                How to run tests
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isEditing = editingMessageId === msg.id;

            return (
              <div key={msg.id} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                
                {/* Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow shadow-violet-950/20">
                    V
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`group relative max-w-2xl px-4 py-3 rounded-2xl border text-sm ${
                  isUser
                    ? 'bg-violet-600/10 border-violet-500/20 text-slate-200'
                    : 'bg-slate-900/40 border-slate-850 text-slate-300'
                }`}>
                  
                  {/* Editing Message Mode */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none resize-none font-mono"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2 text-[10px]">
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="px-2.5 py-1.5 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 font-semibold transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleResendEdit(msg.id, index)}
                          className="px-2.5 py-1.5 bg-violet-600 text-white rounded-lg font-bold transition"
                        >
                          Resend Prompt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Render text with Markdown formatting */}
                      <div className="space-y-2.5 font-sans leading-relaxed">
                        {renderMessageContent(msg.content)}
                      </div>

                      {/* Header Model Info */}
                      {!isUser && msg.model && (
                        <span className="text-[9px] text-slate-500 font-bold tracking-wider mt-2.5 block select-none">
                          LOADED IN OLLAMA: {msg.model.toUpperCase()}
                        </span>
                      )}

                      {/* Hover action menu for edits or copies */}
                      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1.5 bg-slate-900 border border-slate-800/80 px-2 py-1 rounded-xl shadow shadow-slate-950/40">
                        <button
                          onClick={() => {
                            if (isUser) {
                              setEditingMessageId(msg.id);
                              setEditInput(msg.content);
                            } else {
                              copyToClipboard(msg.content);
                            }
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
                          title={isUser ? 'Edit prompt' : 'Copy message'}
                        >
                          {isUser ? <Edit3 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                    U
                  </div>
                )}

              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Message Input Form */}
      <div className="px-6 py-4 border-t border-slate-850 bg-slate-900/10">
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="relative flex items-end gap-2 bg-slate-950 border border-slate-850 hover:border-slate-800/80 focus-within:border-violet-500/80 rounded-2xl p-2 transition shadow-inner"
        >
          {/* Main textarea */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder={`Ask V Code in ${activeMode.toUpperCase()} mode... (@ to attach context)`}
            className="flex-1 max-h-36 min-h-[44px] px-3.5 py-2.5 bg-transparent text-sm text-slate-200 focus:outline-none resize-none"
            rows={1}
          />

          {/* Action buttons (send / stop / regenerate) */}
          <div className="flex items-center gap-1.5 pr-1 select-none">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-2 bg-red-650 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition shadow"
                title="Stop generation"
              >
                <StopCircle className="w-4 h-4" />
              </button>
            ) : (
              <>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    className="p-2 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-xl transition"
                    title="Regenerate response"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={`p-2 rounded-xl transition shadow ${
                    input.trim()
                      ? 'bg-violet-600 hover:bg-violet-500 active:bg-violet-750 text-white shadow-violet-950/20'
                      : 'bg-slate-900 border border-slate-850 text-slate-500 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </form>

        <span className="text-[10px] text-slate-500 block text-center mt-2.5 font-medium tracking-wide">
          Vivek Code runs entirely locally. Prompt data and file contexts stay offline.
        </span>

      </div>

    </div>
  );
}
