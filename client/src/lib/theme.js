const THEME_KEY = 'theme';
const SOUND_KEY = 'soundEnabled';
const ENTER_TO_SEND_KEY = 'enterToSend';
const CUSTOM_SNIPPETS_KEY = 'customSnippets';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function setTheme(theme) {
  const v = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', v);
  if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, v);
  return v;
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  return setTheme(next);
}

export function isSoundEnabled() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SOUND_KEY) === 'true';
}

export function setSoundEnabled(enabled) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
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
