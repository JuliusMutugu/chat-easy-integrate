const THEME_KEY = 'theme';
const ACCENT_KEY = 'accent';
const CHAT_STYLE_KEY = 'chatStyle';
const SOUND_KEY = 'soundEnabled';
const ENTER_TO_SEND_KEY = 'enterToSend';
const CUSTOM_SNIPPETS_KEY = 'customSnippets';
const AVATAR_KEY = 'avatar';
const GEMINI_API_KEY = 'nego_gemini_api_key';

const ACCENT_VALUES = ['green', 'purple', 'blue', 'teal'];
const CHAT_STYLE_VALUES = ['solid', 'transparent', 'minimal'];

/** Resolved theme for CSS: 'light' or 'dark' */
export function getTheme() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
  if (stored === 'dark' || stored === 'light') return stored;
  if (stored === 'system' || !stored) {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** User preference: 'light' | 'dark' | 'system' */
export function getThemePreference() {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(THEME_KEY);
  return v === 'dark' || v === 'light' || v === 'system' ? v : 'system';
}

export function setThemePreference(preference) {
  const v = preference === 'dark' || preference === 'light' || preference === 'system' ? preference : 'system';
  if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, v);
  const resolved = v === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : v;
  document.documentElement.setAttribute('data-theme', resolved);
  return v;
}

export function applySystemTheme() {
  if (getThemePreference() !== 'system') return;
  const resolved = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', resolved);
}

export function setTheme(theme) {
  const v = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'system';
  if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, v);
  const resolved = v === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : v;
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setThemePreference(next);
  return next;
}

/** Accent color: 'green' | 'purple' | 'blue' | 'teal' */
export function getAccent() {
  if (typeof localStorage === 'undefined') return 'green';
  const v = localStorage.getItem(ACCENT_KEY);
  return ACCENT_VALUES.includes(v) ? v : 'green';
}

export function setAccent(accent) {
  const v = ACCENT_VALUES.includes(accent) ? accent : 'green';
  if (typeof localStorage !== 'undefined') localStorage.setItem(ACCENT_KEY, v);
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-accent', v);
  return v;
}

/** Chat/conversation style: 'solid' | 'transparent' | 'minimal' */
export function getChatStyle() {
  if (typeof localStorage === 'undefined') return 'solid';
  const v = localStorage.getItem(CHAT_STYLE_KEY);
  return CHAT_STYLE_VALUES.includes(v) ? v : 'solid';
}

export function setChatStyle(style) {
  const v = CHAT_STYLE_VALUES.includes(style) ? style : 'solid';
  if (typeof localStorage !== 'undefined') localStorage.setItem(CHAT_STYLE_KEY, v);
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-chat-style', v);
  return v;
}

export function applyAppearanceCustomization() {
  setAccent(getAccent());
  setChatStyle(getChatStyle());
}

export function isSoundEnabled() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SOUND_KEY) === 'true';
}

export function setSoundEnabled(enabled) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
}

export function getAvatar() {
  if (typeof localStorage === 'undefined') return '';
  const v = localStorage.getItem(AVATAR_KEY);
  return v === 'male' || v === 'female' ? v : '';
}

export function setAvatar(value) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(AVATAR_KEY, value === 'male' || value === 'female' ? value : '');
}

export function getEnterToSend() {
  if (typeof localStorage === 'undefined') return true;
  const v = localStorage.getItem(ENTER_TO_SEND_KEY);
  return v === null || v === 'true';
}

export function setEnterToSend(enabled) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(ENTER_TO_SEND_KEY, enabled ? 'true' : 'false');
}

export function getCustomSnippets() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SNIPPETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export function setCustomSnippets(snippets) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(CUSTOM_SNIPPETS_KEY, JSON.stringify(snippets || []));
}

export function addCustomSnippet({ name, body }) {
  const list = getCustomSnippets();
  const id = 's-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  list.push({ id, name: (name || '').trim() || 'Snippet', body: (body || '').trim() || '' });
  setCustomSnippets(list);
  return id;
}

export function removeCustomSnippet(id) {
  setCustomSnippets(getCustomSnippets().filter((s) => s.id !== id));
}

/** Gemini API key for workflows and AI (stored in localStorage; do not use for sensitive prod) */
export function getGeminiApiKey() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(GEMINI_API_KEY) || '';
}

export function setGeminiApiKey(key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(GEMINI_API_KEY, (key && typeof key === 'string' ? key.trim() : '') || '');
}

const WORKFLOW_CONFIG_PREFIX = 'nego_workflow_';

/** Get saved workflow config for a template (sales-engineer, marketing-engineer, receptionist) */
export function getWorkflowConfig(template) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WORKFLOW_CONFIG_PREFIX + template);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : null;
  } catch (_) {
    return null;
  }
}

/** Save workflow config for a template. { product, kpis, instructions, websiteText, documentText } */
export function setWorkflowConfig(template, data) {
  if (typeof localStorage === 'undefined') return;
  const payload =
    data && typeof data === 'object'
      ? {
          product: String(data.product ?? '').trim(),
          kpis: String(data.kpis ?? '').trim(),
          instructions: String(data.instructions ?? '').trim(),
          websiteText: String(data.websiteText ?? '').trim(),
          documentText: String(data.documentText ?? '').trim(),
        }
      : { product: '', kpis: '', instructions: '', websiteText: '', documentText: '' };
  localStorage.setItem(WORKFLOW_CONFIG_PREFIX + template, JSON.stringify(payload));
}

let audioCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export function playClick() {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.frequency.setValueAtTime(280, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.06);
  o.type = 'sine';
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.08);
}

export function playSuccess() {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.frequency.setValueAtTime(523, ctx.currentTime);
  o.frequency.setValueAtTime(659, ctx.currentTime + 0.05);
  o.frequency.setValueAtTime(784, ctx.currentTime + 0.1);
  o.type = 'sine';
  g.gain.setValueAtTime(0.06, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.18);
}

export function playOpen() {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.frequency.setValueAtTime(220, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
  o.type = 'sine';
  g.gain.setValueAtTime(0.05, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.14);
}
