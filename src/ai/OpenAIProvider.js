/**
 * OpenAIProvider — Talks to OpenAI's Chat Completions API with tool calling.
 *
 * Also handles any OpenAI-compatible endpoint, including local Ollama. Set
 * config.baseUrl to override the default.
 *
 *   - OpenAI:  https://api.openai.com/v1
 *   - Ollama:  http://localhost:11434/v1  (with model id like "llama3.1:8b")
 *   - LM Studio, vLLM, etc. — same shape, different URL
 *
 * Why one provider for both OpenAI and Ollama: the API surface is identical
 * for tool calling. Ollama deliberately speaks the OpenAI dialect.
 */

import { AIProvider, parseToolCallArguments, safeFetch } from './AIProvider.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

export class OpenAIProvider extends AIProvider {
  /**
   * @param {object} config
   * @param {string} config.apiKey
   * @param {string} [config.baseUrl=DEFAULT_BASE_URL]
   * @param {string} [config.label]      - Defaults to "OpenAI" or "Ollama" based on baseUrl.
   * @param {string} [config.id]         - Defaults to "openai" or "ollama".
   * @param {boolean} [config.requiresKey] - Auto: ollama doesn't, openai does.
   */
  constructor(config = {}) {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const isOllama = !!config.baseUrl && /\/(11434|api\/ollama|ollama)/.test(config.baseUrl);
    super({
      id: config.id || (isOllama ? 'ollama' : 'openai'),
      label: config.label || (isOllama ? 'Ollama (local)' : 'OpenAI'),
      requiresKey: typeof config.requiresKey === 'boolean' ? config.requiresKey : !isOllama,
    });
    this.apiKey = config.apiKey || '';
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.isOllama = isOllama;
  }

  listModels() {
    if (this.isOllama) {
      // Ollama models are user-installed; we can't enumerate without an HTTP
      // call. Default to a few common ones; the user can type a custom model.
      return ['llama3.1:8b', 'llama3.1:70b', 'qwen2.5:7b', 'mistral:7b'];
    }
    return OPENAI_MODELS;
  }

  async generate({ systemPrompt, userPrompt, tool, model, signal }) {
    if (this.requiresKey && !this.apiKey) {
      throw new Error(`${this.label} requires an API key. Add one in Settings → AI.`);
    }
    const modelId = model || DEFAULT_MODEL;

    const body = {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }],
      tool_choice: { type: 'function', function: { name: tool.name } },
      temperature: 0.6,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await safeFetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, signal);

    if (!res.ok) {
      let errText = '';
      try { errText = (await res.json()).error?.message || ''; } catch (_) { errText = await res.text().catch(() => ''); }
      throw new Error(`${this.label} ${res.status}: ${errText.slice(0, 240) || res.statusText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const toolCalls = choice?.message?.tool_calls || [];
    const call = toolCalls.find(c => c.function?.name === tool.name) || toolCalls[0];
    if (!call) {
      const text = choice?.message?.content || '';
      throw new Error(`${this.label} did not call submitSequence. Returned: ${text.slice(0, 200) || '(empty)'}`);
    }

    const args = parseToolCallArguments(call.function?.name || tool.name, call.function?.arguments);

    return {
      arguments: args,
      rawToolName: call.function?.name || tool.name,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
      providerId: this.id,
      model: modelId,
    };
  }
}
