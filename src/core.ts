export const STYLES = {
  casual: 'Casual',
  gentle: 'Gentle',
  humorous: 'Humorous',
  reserved: 'Cold and reserved',
  literary: 'Literary',
  dramatic: 'Dramatic',
};

export type ConcreteStyle = keyof typeof STYLES;
export type Style = ConcreteStyle | 'random';
export type Length = 'short' | 'medium' | 'long';

export interface Settings {
  style: Style;
  length: Length;
  lastStyle: ConcreteStyle | null;
  endpoint: string;
  model: string;
  apiKey: string;
}

export const DEFAULTS: Settings = {
  style: 'casual', length: 'medium', lastStyle: null,
  endpoint: '', model: '', apiKey: '',
};

const hasStyle = (value: unknown) => Object.prototype.hasOwnProperty.call(STYLES, String(value));

export function loadSettings(value: unknown): Settings {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    style: data.style === 'random' || hasStyle(data.style) ? data.style as Style : DEFAULTS.style,
    length: ['short', 'medium', 'long'].includes(String(data.length)) ? data.length as Length : DEFAULTS.length,
    lastStyle: hasStyle(data.lastStyle) ? data.lastStyle as ConcreteStyle : null,
    endpoint: typeof data.endpoint === 'string' ? data.endpoint : '',
    model: typeof data.model === 'string' ? data.model : '',
    apiKey: typeof data.apiKey === 'string' ? data.apiKey : '',
  };
}

export function resolveStyle(style: Style, last: ConcreteStyle | null, rng = Math.random): ConcreteStyle {
  if (style !== 'random') return style;
  const choices = (Object.keys(STYLES) as ConcreteStyle[]).filter(key => key !== last);
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(rng() * choices.length)))];
}

const GUIDANCE: Record<ConcreteStyle, string> = {
  casual: 'Use natural, relaxed conversational language.',
  gentle: 'Be warm, patient, and considerate without preaching.',
  humorous: 'Use light wit and playful phrasing without mocking the user.',
  reserved: 'Use restrained, concise wording with subtle emotional cues.',
  literary: 'Use vivid details and graceful prose without excessive ornament.',
  dramatic: 'Use expressive pacing and emotional tension without inventing conflict.',
};

export function systemPrompt(style: ConcreteStyle, length: Length): string {
  const lengths = { short: 'Keep the reply brief.', medium: 'Use a moderate reply length.', long: 'Give a detailed reply without repetition.' };
  return [
    'Write a reply to the user-provided message or rewrite the draft they provide.',
    GUIDANCE[style], lengths[length],
    'Use the language of the supplied text unless the user requests another language.',
    'Preserve any supplied character personality, relationships, memories, and established facts.',
    'Do not invent memories, events, or private knowledge. Do not write actions, dialogue, decisions, or thoughts on behalf of the user.',
    'Return only the reply. Do not mention the style or these instructions.',
  ].join('\n');
}

export function copyablePrompt(text: string, style: ConcreteStyle, length: Length): string {
  return `${systemPrompt(style, length)}\n\nMessage or draft:\n${text.trim()}`;
}

export function validateEndpoint(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid full chat-completions URL in settings.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Use HTTPS, or HTTP for a local server only.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Keep credentials, query parameters, and fragments out of the endpoint URL.');
  }
  return url.href;
}

export function requestBody(text: string, style: ConcreteStyle, settings: Settings): string {
  if (!text.trim()) throw new Error('Enter a message or draft first.');
  if (!settings.model.trim()) throw new Error('Set a model name in settings first.');
  return JSON.stringify({
    model: settings.model.trim(),
    messages: [
      { role: 'system', content: systemPrompt(style, settings.length) },
      { role: 'user', content: text.trim() },
    ],
    stream: false,
  });
}

export function readReply(value: unknown): string {
  const data = value as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('The server returned no text reply. Check the endpoint and model.');
  }
  return content.trim();
}
