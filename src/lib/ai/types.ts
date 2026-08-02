export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  contextLength?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AIModelInfo {
  name: string;
  size: number; // in bytes
  details?: {
    parameter_size?: string;
    family?: string;
  };
  warning?: string; // If memory footprint is large for 8GB RAM
}

export interface AIProvider {
  id: string;
  name: string;
  isLocal: boolean;
  checkConnection(): Promise<{ isConnected: boolean; error?: string }>;
  listModels(): Promise<AIModelInfo[]>;
  chat(
    messages: ChatMessage[],
    options: ChatOptions,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void>;
}
