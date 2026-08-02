import { AIModelInfo, AIProvider, ChatMessage, ChatOptions } from './types';

export class OllamaProvider implements AIProvider {
  id = 'ollama';
  name = 'Ollama (Local)';
  isLocal = true;
  private endpoint: string;

  constructor(endpoint = 'http://127.0.0.1:11434') {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
  }

  async checkConnection(): Promise<{ isConnected: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3-second timeout
      });
      if (response.ok) {
        return { isConnected: true };
      }
      return {
        isConnected: false,
        error: `Ollama service returned status ${response.status}`,
      };
    } catch (err: any) {
      return {
        isConnected: false,
        error: err.message || 'Could not connect to Ollama. Make sure the service is running.',
      };
    }
  }

  async listModels(): Promise<AIModelInfo[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch models from Ollama: ${response.statusText}`);
      }
      const data = await response.json();
      const models = data.models || [];

      return models.map((model: any) => {
        const sizeGB = model.size / (1024 * 1024 * 1024);
        let warning: string | undefined;

        // M1 Mac with 8GB RAM memory warnings
        if (sizeGB > 5.5) {
          warning = `Warning: This model size (${sizeGB.toFixed(1)} GB) exceeds recommended limits for an 8 GB RAM Apple Silicon Mac. It may run slowly due to high memory usage.`;
        }

        return {
          name: model.name,
          size: model.size,
          details: model.details,
          warning,
        };
      });
    } catch (err) {
      console.error('Error fetching Ollama models:', err);
      return [];
    }
  }

  async pullModel(
    modelName: string,
    onProgress: (status: string, completed: number, total: number) => void
  ): Promise<void> {
    const response = await fetch(`${this.endpoint}/api/pull`, {
      method: 'POST',
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported on Ollama response.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const completed = parsed.completed || 0;
          const total = parsed.total || 0;
          const status = parsed.status || 'Downloading...';
          onProgress(status, completed, total);
        } catch (e) {
          console.warn('Failed to parse pull progress line:', line);
        }
      }
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/api/delete`, {
      method: 'DELETE',
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete model: ${response.statusText}`);
    }
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const systemPrompt = options.systemPrompt || 'You are Vivek Code, a production-ready private local AI coding assistant.';
    
    // Inject system prompt as a message at the beginning
    const processedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const bodyPayload = {
      model: options.model,
      messages: processedMessages,
      options: {
        temperature: options.temperature ?? 0.2,
        num_ctx: options.contextLength ?? 8192,
        num_predict: options.maxTokens ?? 2048,
      },
      stream: true,
    };

    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
      signal,
    });

    if (!response.ok) {
      const errorMsg = await response.text().catch(() => response.statusText);
      throw new Error(`Ollama chat request failed: ${errorMsg}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported on Ollama response.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            onChunk(parsed.message.content);
          }
        } catch (e) {
          console.warn('Failed to parse chat response line:', line);
        }
      }
    }
  }
}
