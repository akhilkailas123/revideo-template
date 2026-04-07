import {
  linear,
  easeInOutCubic,
  easeOutCubic,
  easeInCubic,
  easeOutBounce,
  easeInOutBack,
  easeOutBack,
  easeOutElastic,
  easeInOutQuart,
  easeOutQuart,
  easeInQuart,
} from '@revideo/core';

// Width/Height are set once at startup from config
let _W = 1920;
let _H = 1080;

export function initDimensions(w: number, h: number) {
  _W = w;
  _H = h;
}

export function WIDTH()  { return _W; }
export function HEIGHT() { return _H; }

export function toSceneX(x: number) { return (x - 0.5) * _W; }
export function toSceneY(y: number) { return (y - 0.5) * _H; }

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─── Ease lookup ─────────────────────────────────────────────────────────────
export function getEase(name: string): (t: number) => number {
  const map: Record<string, (t: number) => number> = {
    linear,
    easeInOut:      easeInOutCubic,
    easeIn:         easeInCubic,
    easeOut:        easeOutCubic,
    easeInOutCubic,
    easeOutCubic,
    easeInCubic,
    easeInOutBack,
    easeOutBack,
    easeOutBounce,
    easeOutElastic,
    easeInOutQuart,
    easeOutQuart,
    easeInQuart,
  };
  return map[name] ?? easeInOutCubic;
}

// ─── Text-decode helpers ─────────────────────────────────────────────────────
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>?/';

export function scramble(target: string, t: number, chars: string = SCRAMBLE_CHARS) {
  return target.split('').map((ch: string, i: number) => {
    const r = clamp((t * target.length - i), 0, 1);
    return r >= 1 ? ch : chars[Math.floor(Math.random() * chars.length)];
  }).join('');
}

export function binaryDecode(target: string, t: number) {
  return target.split('').map((ch: string, i: number) => {
    const r = clamp((t * target.length - i), 0, 1);
    return r >= 1 ? ch : (Math.random() > 0.5 ? '1' : '0');
  }).join('');
}

export function hexDecode(target: string, t: number) {
  const hex = '0123456789ABCDEF';
  return target.split('').map((ch: string, i: number) => {
    const r = clamp((t * target.length - i), 0, 1);
    return r >= 1 ? ch : hex[Math.floor(Math.random() * hex.length)];
  }).join('');
}

export function morseReveal(target: string, t: number) {
  return target.split('').map((ch: string, i: number) => {
    const r = clamp((t * target.length - i), 0, 1);
    if (r >= 1) return ch;
    return r > 0.5 && Math.random() > 0.5 ? ch : '_';
  }).join('');
}