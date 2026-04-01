import {
  makeProject,
  waitFor,
  createRef,
  all,
  delay,
  chain,
  tween,
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
  easeInOutSine,
  easeInOutExpo,
} from '@revideo/core';
import {
  makeScene2D,
  Img,
  Video,
  Audio,
  Txt,
  Rect,
  Layout,
  Circle,
} from '@revideo/2d';
import { Three } from './components/Three';
import * as THREE from 'three';
import config from './video.config.json';
import './global.css';

const WIDTH  = config.settings.size.x;
const HEIGHT = config.settings.size.y;

// ─── Utility helpers ────────────────────────────────────────────────────────
function toSceneX(x: number) { return (x - 0.5) * WIDTH;  }
function toSceneY(y: number) { return (y - 0.5) * HEIGHT; }
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─── Text-decode helpers ─────────────────────────────────────────────────────
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>?/';
function scramble(target: string, t: number, chars: string = SCRAMBLE_CHARS) {
  return target.split('').map((ch: string, i: number) => {
    const r = clamp((t * target.length - i), 0, 1);
    return r >= 1 ? ch : chars[Math.floor(Math.random() * chars.length)];
  }).join('');
}
function binaryDecode(target: string, t: number) {
  return target.split('').map((ch: string, i: number) => {
    const r = clamp((t * target.length - i), 0, 1);
    return r >= 1 ? ch : (Math.random() > 0.5 ? '1' : '0');
  }).join('');
}
function hexDecode(target: string, t: number) {
  const hex = '0123456789ABCDEF';
  return target.split('').map((ch: string, i: number) => {
    const r = clamp((t * target.length - i), 0, 1);
    return r >= 1 ? ch : hex[Math.floor(Math.random() * hex.length)];
  }).join('');
}
function morseReveal(target: string, t: number) {
  return target.split('').map((ch: string, i: number) => {
    const r = clamp((t * target.length - i), 0, 1);
    if (r >= 1) return ch;
    return r > 0.5 && Math.random() > 0.5 ? ch : '_';
  }).join('');
}

// ─── Per-letter helpers ──────────────────────────────────────────────────────
function makeLetterRefs(str: string) {
  return str.split('').map(() => createRef<Txt>());
}
function addLetters(
  view: any,
  str: string,
  refs: ReturnType<typeof makeLetterRefs>,
  opts: {
    x: number; y: number; fill: string; fontSize?: number;
    opacity?: number; spacing?: number;
    fontFamily?: string;
  }
) {
  const fs  = opts.fontSize  ?? 44;
  const sp  = opts.spacing   ?? 32;
  const op  = opts.opacity   ?? 0;
  const ff  = opts.fontFamily ?? 'Lexend';
  str.split('').forEach((ch, i) => {
    view.add(
      <Txt
        ref={refs[i]}
        fill={opts.fill}
        fontFamily={ff}
        fontWeight={700}
        fontSize={fs}
        opacity={op}
        position={[opts.x + (i - str.length / 2) * sp, opts.y]}
        text={ch === ' ' ? '\u00A0' : ch}
      />
    );
  });
}

// ─── Per-letter animation runner ─────────────────────────────────────────────
function* runPerLetterAnimation(view: any, item: any, refs: any) {
  const text: string       = item.text ?? '';
  const pos                = item.position ?? { x: 0.5, y: 0.5 };
  const tx                 = toSceneX(pos.x);
  const ty                 = toSceneY(pos.y);
  const fs: number         = item.fontSize ?? 44;
  const sp: number         = item.letterSpacing ?? 32;
  const fill: string       = item.color ?? '#ffffff';
  const ff: string         = item.fontFamily ?? 'Lexend';
  const animType: string   = item.animation?.type ?? '';
  const duration: number   = item.duration ?? 2;
  const fadeOut            = item.animation?.fadeOut;
  const fadeOutTime: number = fadeOut?.time ?? 0;
  const PI = Math.PI;
  const TAU = PI * 2;
  const letterRefs = makeLetterRefs(text);
  addLetters(view, text, letterRefs, {
    x: tx, y: ty,
    fill, fontSize: fs, spacing: sp, fontFamily: ff,
    opacity: animType === 'letterShake' || animType === 'letterScale' ||
             animType === 'letterSwing' || animType === 'letterSkew'  ||
             animType === 'letterGlitch' ? 1 : 0,
  });
  yield* waitFor(0);
  if (animType === 'characterFade') {
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.06, r().opacity(1, 0.35))
    ));
  }
  else if (animType === 'letterDrop') {
    letterRefs.forEach(r => { r().position.y(ty - 220); });
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.07, all(
        r().opacity(1, 0.15),
        r().position.y(ty, 0.45, easeOutBounce)
      ))
    ));
  }
  else if (animType === 'letterBounce') {
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.07, all(
        r().opacity(1, 0.12),
        tween(0.55, v => {
          r().position.y(ty - 40 * Math.abs(Math.sin(v * PI * 2.5)) * (1 - v));
        })
      ))
    ));
  }
  else if (animType === 'letterWave') {
    yield* all(...letterRefs.map((r) => r().opacity(1, 0.2)));
    const holdTime = duration - fadeOutTime;
    yield* tween(holdTime, v => {
      letterRefs.forEach((r, i) => {
        r().position.y(ty + 22 * Math.sin(v * PI * 4 + i * 0.5));
      });
    });
  }
  else if (animType === 'letterRotate') {
    letterRefs.forEach(r => { r().rotation(-180); });
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.06, all(
        r().opacity(1, 0.2),
        r().rotation(0, 0.4, easeOutBack)
      ))
    ));
  }
  else if (animType === 'letterZoom') {
    letterRefs.forEach(r => { r().scale(0); });
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.06, all(
        r().opacity(1, 0.15),
        r().scale(1, 0.35, easeOutBack)
      ))
    ));
  }
  else if (animType === 'letterSpiral') {
    yield* all(...letterRefs.map((r, i) => {
      const angle  = (i / text.length) * TAU;
      const radius = 120;
      const baseX  = tx + (i - text.length / 2) * sp;
      r().position.x(baseX + Math.cos(angle) * radius);
      r().position.y(ty    + Math.sin(angle) * radius);
      return delay(i * 0.05, all(
        r().opacity(1, 0.25),
        r().position.x(baseX, 0.5, easeOutCubic),
        r().position.y(ty,    0.5, easeOutCubic)
      ));
    }));
  }
  else if (animType === 'letterFlip') {
    letterRefs.forEach(r => { r().scale.x(0); });
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.07, all(
        r().opacity(1, 0.15),
        r().scale.x(1, 0.4, easeInOutBack)
      ))
    ));
  }
  else if (animType === 'letterFloat') {
    yield* all(...letterRefs.map((r) => r().opacity(1, 0.2)));
    const holdTime = duration - fadeOutTime;
    yield* tween(holdTime, v => {
      letterRefs.forEach((r, i) => {
        r().position.y(ty + 18 * Math.sin(v * PI * 2 + i * 0.6));
      });
    });
  }
  else if (animType === 'letterStagger') {
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.1, all(
        r().opacity(1, 0.3),
        r().position.y(ty, 0.3, easeOutCubic)
      ))
    ));
  }
  else if (animType === 'letterShake') {
    const inTime = item.animation?.inTime ?? 1.0;
    yield* tween(inTime, () => {
      letterRefs.forEach((r, i) => {
        r().position.x(tx + (i - text.length / 2) * sp + (Math.random() - 0.5) * 16);
        r().position.y(ty + (Math.random() - 0.5) * 16);
      });
    });
    letterRefs.forEach((r, i) => {
      r().position.x(tx + (i - text.length / 2) * sp);
      r().position.y(ty);
    });
  }
  else if (animType === 'letterScale') {
    const inTime = item.animation?.inTime ?? 2.0;
    yield* tween(inTime, v => {
      letterRefs.forEach((r, i) => {
        r().scale(1 + 0.35 * Math.abs(Math.sin(v * PI * 3 + i * 0.45)));
      });
    });
    letterRefs.forEach(r => r().scale(1));
  }
  else if (animType === 'letterSwing') {
    const inTime = item.animation?.inTime ?? 2.0;
    yield* tween(inTime, v => {
      letterRefs.forEach((r, i) => {
        r().rotation(20 * Math.sin(v * PI * 4 + i * 0.5) * Math.exp(-v * 1.5));
      });
    });
  }
  else if (animType === 'letterSkew') {
    const inTime = item.animation?.inTime ?? 2.0;
    yield* tween(inTime, v => {
      letterRefs.forEach((r, i) => {
        r().skew.x(25 * Math.sin(v * PI * 3 + i * 0.4) * (1 - v * 0.5));
      });
    });
    letterRefs.forEach(r => r().skew.x(0));
  }
  else if (animType === 'letterGlitch') {
    const inTime = item.animation?.inTime ?? 2.5;
    const colors = item.animation?.colors ?? ['#ff4757', '#ffffff', '#2ed573'];
    yield* tween(inTime, () => {
      letterRefs.forEach((r, i) => {
        const glitching = Math.random() > 0.7;
        r().position.x(tx + (i - text.length / 2) * sp + (glitching ? (Math.random() - 0.5) * 20 : 0));
        r().position.y(ty + (glitching ? (Math.random() - 0.5) * 20 : 0));
        r().fill(glitching ? colors[Math.floor(Math.random() * colors.length)] : fill);
      });
    });
    letterRefs.forEach((r, i) => {
      r().position.x(tx + (i - text.length / 2) * sp);
      r().position.y(ty);
      r().fill(fill);
    });
  }
  if (animType !== 'letterWave' && animType !== 'letterFloat') {
    const inTime = item.animation?.inTime ?? 0;
    const holdTime = duration - inTime - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
  }
  if (fadeOutTime > 0) {
    yield* all(...letterRefs.map(r =>
      tween(fadeOutTime, v => {
        r().opacity(1 - easeInOutCubic(v));
      })
    ));
    letterRefs.forEach(r => r().opacity(0));
  }
}

// ─── Colour-effect runner ────────────────────────────────────────────────────
function* runColourAnimation(view: any, item: any) {
  const pos      = item.position ?? { x: 0.5, y: 0.5 };
  const tx       = toSceneX(pos.x);
  const ty       = toSceneY(pos.y);
  const ref      = createRef<Txt>();
  const duration = item.duration ?? 3;
  const PI       = Math.PI;
  const animType = item.animation?.type ?? '';
  view.add(
    <Txt
      ref={ref}
      text={item.text}
      fontSize={item.fontSize ?? 52}
      fill={item.color ?? '#ffffff'}
      fontFamily={item.fontFamily ?? 'Lexend'}
      fontWeight={900}
      position={[tx, ty]}
      zIndex={item.zIndex ?? 1}
    />
  );
  yield* waitFor(0);
  if (animType === 'rainbowCycle') {
    const rainbow = item.animation?.colors ??
      ['#ff0000','#ff7700','#ffff00','#00ff00','#0000ff','#8b00ff'];
    yield* tween(duration, v => {
      const idx = Math.floor(v * (rainbow.length - 1) * 3) % rainbow.length;
      ref().fill(rainbow[idx]);
      ref().scale(1 + 0.06 * Math.sin(v * PI * 10));
    });
  }
  else if (animType === 'neonGlow') {
    const baseColor = item.animation?.baseColor ?? '00';
    yield* tween(duration, v => {
      const brightness = 0.6 + 0.4 * Math.abs(Math.sin(v * PI * 3));
      const b = Math.floor(brightness * 255).toString(16).padStart(2, '0');
      ref().fill(`#${baseColor}${b}88`);
      ref().scale(1 + 0.04 * Math.sin(v * PI * 6));
    });
    ref().fill(item.color ?? '#00ff88');
  }
  else if (animType === 'colourCycle') {
    const cycle = item.animation?.colors ?? [
      '#ff6b6b','#feca57','#48dbfb','#ff9ff3','#54a0ff',
      '#5f27cd','#00d2d3','#ff9f43','#ee5a24','#9980fa'
    ];
    yield* tween(duration, v => {
      const idx = Math.floor(v * cycle.length * 2) % cycle.length;
      ref().fill(cycle[idx]);
    });
  }
  else if (animType === 'gradientShift') {
    const grad = item.animation?.colorPairs ?? [
      ['#ff6348','#ff4757'],['#ffd700','#ff8c00'],
      ['#00cec9','#0984e3'],['#a29bfe','#6c5ce7']
    ];
    yield* tween(duration, v => {
      const pair = grad[Math.floor(v * grad.length * 2) % grad.length];
      ref().fill(pair[Math.round(v * 20) % 2]);
      ref().scale.x(1 + 0.08 * Math.sin(v * PI * 5));
    });
  }
}

// ─── Reveal/clip-effect runner ───────────────────────────────────────────────
function* runClipAnimation(view: any, item: any) {
  const pos      = item.position ?? { x: 0.5, y: 0.5 };
  const tx       = toSceneX(pos.x);
  const ty       = toSceneY(pos.y);
  const fs       = item.fontSize ?? 42;
  const fill     = item.color ?? '#ffffff';
  const bgColor  = item.animation?.bgColor ?? '#6a0572';
  const duration = item.animation?.revealTime ?? 0.8;
  const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
  const animType = item.animation?.type ?? '';
  const PI       = Math.PI;

  if (animType === 'maskReveal' || animType === 'brushStroke' || animType === 'wipeAnim' || animType === 'curtainReveal') {
    const textRef = createRef<Txt>();
    const clipRef = createRef<Rect>();
    const probeRef = createRef<Txt>();
    view.add(
      <Txt
        ref={probeRef}
        text={item.text}
        fontSize={fs}
        fill={fill}
        fontFamily={item.fontFamily ?? 'Lexend'}
        fontWeight={700}
        position={[tx, ty]}
        opacity={0}
        zIndex={item.zIndex ?? 1}
      />
    );
    yield* waitFor(0);
    const measuredW = probeRef().size().x + 20;
    const measuredH = probeRef().size().y;
    probeRef().remove();
    const easeMap: Record<string, any> = {
      maskReveal:    easeInOutCubic,
      brushStroke:   easeInOutQuart,
      wipeAnim:      linear,
      curtainReveal: easeOutBack,
    };
    const ease = easeMap[animType] ?? linear;
    view.add(
      <Layout clip position={[tx, ty]} zIndex={item.zIndex ?? 1}>
        <Rect
          ref={clipRef}
          fill={bgColor}
          width={0}
          height={measuredH * 1.1}
          position={[-measuredW / 2, 0]}
        />
        <Txt
          ref={textRef}
          text={item.text}
          fontSize={fs}
          fill={fill}
          fontFamily={item.fontFamily ?? 'Lexend'}
          fontWeight={700}
        />
      </Layout>
    );
    yield* clipRef().width(measuredW, duration, ease);
    const holdTime = (item.duration ?? 0) - duration - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) {
      yield* tween(fadeOutTime, v => {
        textRef().opacity(1 - easeInOutCubic(v));
        clipRef().opacity(1 - easeInOutCubic(v));
      });
    }
    return;
  }

  if (animType === 'blindsReveal') {
    const slices   = item.animation?.slices ?? 6;
    const sliceH   = (item.animation?.areaHeight ?? 300) / slices;
    const rectW    = item.animation?.width ?? 600;
    const blindsRects = Array.from({ length: slices }, () => createRef<Rect>());
    const textRef     = createRef<Txt>();
    view.add(
      <Txt
        ref={textRef}
        text={item.text}
        fontSize={fs}
        fill={fill}
        fontFamily={item.fontFamily ?? 'Lexend'}
        fontWeight={700}
        position={[tx, ty]}
        zIndex={item.zIndex ?? 1}
      />
    );
    blindsRects.forEach((r, i) => {
      view.add(
        <Layout clip position={[tx, ty + i * sliceH - sliceH * (slices / 2 - 0.5)]} zIndex={(item.zIndex ?? 1) + 1}>
          <Rect ref={r} fill={bgColor} width={0} height={sliceH - 2} position={[-rectW / 2, 0]} />
        </Layout>
      );
    });
    yield* all(
      ...blindsRects.map((r, i) =>
        delay(i * 0.06, r().width(rectW, duration, easeOutCubic))
      )
    );
    const holdTime = (item.duration ?? 0) - duration - 0.06 * slices - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) {
      yield* textRef().opacity(0, fadeOutTime);
    }
    return;
  }

  if (animType === 'splitReveal') {
    const textRef = createRef<Txt>();
    const topRef  = createRef<Rect>();
    const botRef  = createRef<Rect>();
    const halfH   = item.animation?.coverHeight ?? 30;
    const rW      = item.animation?.width ?? 500;
    const color   = item.animation?.coverColor ?? '#0d0d1a';
    view.add(
      <Txt
        ref={textRef}
        text={item.text}
        fontSize={fs}
        fill={fill}
        fontFamily={item.fontFamily ?? 'Lexend'}
        fontWeight={700}
        position={[tx, ty]}
        zIndex={item.zIndex ?? 1}
      />
    );
    view.add(<Rect ref={topRef} fill={color} width={rW} height={halfH} position={[tx, ty - halfH / 2]} zIndex={(item.zIndex ?? 1) + 1} />);
    view.add(<Rect ref={botRef} fill={color} width={rW} height={halfH} position={[tx, ty + halfH / 2]} zIndex={(item.zIndex ?? 1) + 1} />);
    yield* all(
      topRef().position.y(ty - halfH / 2 - halfH * 2, duration, easeInOutCubic),
      botRef().position.y(ty + halfH / 2 + halfH * 2, duration, easeInOutCubic),
    );
    const holdTime = (item.duration ?? 0) - duration - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) {
      yield* textRef().opacity(0, fadeOutTime);
    }
    return;
  }
}

// ─── Decode/typing runner ────────────────────────────────────────────────────
function* runTypingAnimation(view: any, item: any) {
  const pos      = item.position ?? { x: 0.5, y: 0.5 };
  const tx       = toSceneX(pos.x);
  const ty       = toSceneY(pos.y);
  const ref      = createRef<Txt>();
  const text     = item.text ?? '';
  const animType = item.animation?.type ?? '';
  const duration = item.duration ?? text.length * 0.07;
  const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
  view.add(
    <Txt
      ref={ref}
      text=""
      fontSize={item.fontSize ?? 40}
      fill={item.color ?? '#70a1ff'}
      fontFamily={item.fontFamily ?? "'Courier New'"}
      fontWeight={700}
      position={[tx, ty]}
      zIndex={item.zIndex ?? 1}
    />
  );
  yield* waitFor(0);
  if (animType === 'typewriter') {
    const typeDur = duration;
    yield* tween(typeDur, v => {
      const n = clamp(Math.floor((v / typeDur) * text.length), 0, text.length);
      ref().text(text.slice(0, n));
    });
    ref().text(text);
  }
  else if (animType === 'typewriterCursor') {
    let cursorVisible = true;
    tween(duration + 1.0, v => {
      cursorVisible = Math.round(v * 4) % 2 === 0;
    });
    const typeDur = text.length * 0.07;
    yield* tween(typeDur, v => {
      const n = clamp(Math.floor((v / typeDur) * text.length), 0, text.length);
      ref().text(text.slice(0, n) + (cursorVisible ? '|' : ' '));
    });
    ref().text(text);
  }
  else if (animType === 'scrambleText') {
    yield* tween(duration, v => {
      ref().text(scramble(text, v));
    });
    ref().text(text);
  }
  else if (animType === 'decodeEffect') {
    yield* tween(duration, v => {
      ref().text(scramble(text, v));
    });
    ref().text(text);
  }
  else if (animType === 'binaryDecode') {
    ref().text(text.split('').map(() => '0').join(''));
    yield* tween(duration, v => {
      ref().text(binaryDecode(text, v));
    });
    ref().text(text);
  }
  else if (animType === 'hexDecode') {
    ref().text(text.split('').map(() => 'F').join(''));
    yield* tween(duration, v => {
      ref().text(hexDecode(text, v));
    });
    ref().text(text);
  }
  else if (animType === 'morseReveal') {
    ref().text(text.split('').map(() => '_').join(''));
    yield* tween(duration, v => {
      ref().text(morseReveal(text, v));
    });
    ref().text(text);
  }
  else if (animType === 'glitchText') {
    const glitches: string[] = item.animation?.glitchVariants ?? [
      text,
      text.replace(/[aeiou]/gi, ch => Math.random() > 0.5 ? ch.toUpperCase() : '!'),
      text.replace(/[a-z]/gi, () => Math.random() > 0.5 ? '|' : '_'),
    ];
    const colors: string[] = item.animation?.colors ?? ['#ff4757','#ffffff','#2ed573','#a29bfe'];
    yield* tween(duration, () => {
      const idx = Math.floor(Math.random() * glitches.length);
      ref().text(glitches[idx]);
      ref().position.x(tx + (Math.random() - 0.5) * 24);
      ref().fill(colors[Math.floor(Math.random() * colors.length)]);
    });
    ref().text(text);
    ref().position.x(tx);
    ref().fill(item.color ?? '#ff4757');
  }
  const holdTime = (item.duration ?? 0) - duration - fadeOutTime;
  if (holdTime > 0) yield* waitFor(holdTime);
  if (fadeOutTime > 0) {
    yield* ref().opacity(0, fadeOutTime);
  }
}

// ─── Attention-seeker runner ─────────────────────────────────────────────────
function* runAttentionAnimation(view: any, item: any) {
  const pos      = item.position ?? { x: 0.5, y: 0.5 };
  const tx       = toSceneX(pos.x);
  const ty       = toSceneY(pos.y);
  const ref      = createRef<Txt>();
  const animType = item.animation?.type ?? '';
  const PI       = Math.PI;
  const duration = item.animation?.duration ?? item.duration ?? 2.0;
  const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
  view.add(
    <Txt
      ref={ref}
      text={item.text}
      fontSize={item.fontSize ?? 44}
      fill={item.color ?? '#ffffff'}
      fontFamily={item.fontFamily ?? 'Lexend'}
      fontWeight={700}
      position={[tx, ty]}
      zIndex={item.zIndex ?? 1}
    />
  );
  yield* waitFor(0);
  if (animType === 'pulse') {
    const amplitude = item.animation?.amplitude ?? 0.22;
    yield* tween(duration, v => {
      ref().scale(1 + amplitude * Math.sin(v * PI * 6));
    });
    ref().scale(1);
  }
  else if (animType === 'blink') {
    yield* tween(duration, v => {
      ref().opacity(Math.round(v * 8) % 2 === 0 ? 1 : 0);
    });
    ref().opacity(1);
  }
  else if (animType === 'flash') {
    const colors: string[] = item.animation?.colors ??
      ['#2ed573','#ffffff','#ff4757','#ffd700'];
    yield* tween(duration, v => {
      ref().fill(colors[clamp(Math.floor(v * (colors.length - 1)), 0, colors.length - 1)]);
      ref().scale(1 + 0.1 * Math.abs(Math.sin(v * PI * 9)));
    });
    ref().fill(item.color ?? '#2ed573');
    ref().scale(1);
  }
  else if (animType === 'flicker') {
    yield* tween(duration, v => {
      ref().opacity(Math.random() > 0.3 + 0.4 * v ? 1 : 0.04);
    });
    ref().opacity(1);
  }
  else if (animType === 'wave') {
    const amplitude = item.animation?.amplitude ?? 30;
    yield* tween(duration, v => {
      ref().position.y(ty + amplitude * Math.sin(v * PI * 4));
    });
    ref().position.y(ty);
  }
  else if (animType === 'float') {
    const amplitude = item.animation?.amplitude ?? 14;
    yield* tween(duration, v => {
      ref().position.y(ty + amplitude * Math.sin(v * PI * 2));
    });
    ref().position.y(ty);
  }
  else if (animType === 'shake') {
    const amplitude = item.animation?.amplitude ?? 12;
    yield* tween(duration, v => {
      ref().position.x(tx + amplitude * Math.sin(v * PI * 20));
    });
    ref().position.x(tx);
  }
  else if (animType === 'wobble') {
    yield* tween(duration, v => {
      ref().rotation(18 * Math.sin(v * PI * 5) * (1 - v));
    });
    ref().rotation(0);
  }
  else if (animType === 'rubberBand') {
    yield* tween(duration, v => {
      ref().scale.x(lerp(1, 1.6, Math.max(0, Math.sin(v * PI * 3) * (1 - v))));
      ref().scale.y(lerp(1, 0.6, Math.max(0, Math.sin(v * PI * 3) * (1 - v))));
    });
    ref().scale(1);
  }
  else if (animType === 'heartBeat') {
    yield* tween(duration, v => {
      const beat = Math.abs(Math.sin(v * PI * 4));
      ref().scale(1 + 0.35 * beat);
    });
    ref().scale(1);
  }
  else if (animType === 'jello') {
    yield* tween(duration, v => {
      ref().skew.x(20 * Math.sin(v * PI * 6) * (1 - v));
      ref().skew.y(10 * Math.cos(v * PI * 6) * (1 - v));
    });
    ref().skew(0);
  }
  else if (animType === 'swing') {
    yield* tween(duration, v => {
      ref().rotation(22 * Math.sin(v * PI * 5) * Math.exp(-v * 2));
    });
    ref().rotation(0);
  }
  else if (animType === 'tada') {
    yield* tween(0.4, v => {
      ref().scale(lerp(1, 0.9, v));
      ref().rotation(lerp(0, -3, v));
    });
    yield* tween(0.4, v => {
      ref().scale(lerp(0.9, 1.1, v));
      ref().rotation(lerp(-3, 3, v));
    });
    yield* tween(0.25, v => {
      ref().scale(lerp(1.1, 1, v));
      ref().rotation(lerp(3, 0, v));
    });
  }
  else if (animType === 'headShake') {
    yield* tween(duration, v => {
      ref().position.x(tx + 18 * Math.sin(v * PI * 6));
      ref().rotation(-6 * Math.sin(v * PI * 6));
    });
    ref().position.x(tx);
    ref().rotation(0);
  }
  else if (animType === 'spin') {
    const rotations = item.animation?.rotations ?? 1;
    yield* ref().rotation(360 * rotations, duration, easeInOutCubic);
    ref().rotation(0);
  }
  else if (animType === 'vibrate') {
    const amplitude = item.animation?.amplitude ?? 7;
    yield* tween(duration, () => {
      ref().position.x(tx + (Math.random() - 0.5) * amplitude * 2);
      ref().position.y(ty + (Math.random() - 0.5) * amplitude * 2);
    });
    ref().position([tx, ty]);
  }
  const holdTime = (item.duration ?? 0) - duration - fadeOutTime;
  if (holdTime > 0) yield* waitFor(holdTime);
  if (fadeOutTime > 0) {
    yield* ref().opacity(0, fadeOutTime);
  }
}

// ─── Three.js runner ─────────────────────────────────────────────────────────
//
// Every property of every object is controllable from video.config.json.
//
// ┌─ TOP-LEVEL LAYER FIELDS ───────────────────────────────────────────────────
// {
//   "id":         "my3d",
//   "type":       "threejs",
//   "start":      0,          // seconds from video start
//   "duration":   6,          // total layer duration in seconds
//   "zIndex":     2,
//   "effect":     "objects",  // "objects" | "splitImage" | "rotateCube"
//                             // | "floatingSpheres" | "particleField"
//   "background": "#0f0f1a",  // optional solid bg rect (omit = transparent)
//   "fadeIn":  { "time": 0.8 },
//   "fadeOut": { "time": 0.6 },
//
// ┌─ CAMERA ────────────────────────────────────────────────────────────────────
//   "camera": {
//     "fov": 70,          // field of view in degrees
//     "x": 0, "y": 0, "z": 5,
//     "lookAt": { "x": 0, "y": 0, "z": 0 }  // optional target
//   },
//
// ┌─ LIGHTS ────────────────────────────────────────────────────────────────────
//   "lights": [
//     { "type": "directional", "color": "#ffffff", "intensity": 1.5,
//       "x": 4, "y": 4, "z": 6 },
//     { "type": "ambient",     "color": "#ffffff", "intensity": 0.4 },
//     { "type": "point",       "color": "#ff6b6b", "intensity": 2,
//       "x": 0, "y": 2, "z": 2, "distance": 10, "decay": 2 },
//     { "type": "spot",        "color": "#ffffff", "intensity": 3,
//       "x": 0, "y": 5, "z": 0, "angle": 0.4, "penumbra": 0.3 }
//   ],
//   // Legacy single-light shortcuts still work:
//   "light":   { "color": "#ffffff", "intensity": 1.5, "x": 4, "y": 4, "z": 6 },
//   "ambient": { "color": "#ffffff", "intensity": 0.4 },
//
// ┌─ OBJECTS (effect: "objects") ───────────────────────────────────────────────
//   "objects": [
//     {
//       "id": "myCube",           // optional, for reference
//
//       ── SHAPE ──
//       "shape": "box",           // "box" | "sphere" | "cylinder" | "cone"
//                                 // | "torus" | "plane" | "ring" | "capsule"
//
//       ── SIZE ──
//       // box:      width / height / depth  (all default 1)
//       "width": 2, "height": 2, "depth": 2,
//       // sphere:   radius (default 1), widthSegments, heightSegments
//       "radius": 1.5, "widthSegments": 32, "heightSegments": 32,
//       // cylinder: radiusTop, radiusBottom, height, radialSegments
//       "radiusTop": 0.5, "radiusBottom": 0.5, "height": 2, "radialSegments": 32,
//       // cone:     radius, height, radialSegments
//       // torus:    radius, tube, radialSegments, tubularSegments
//       "tube": 0.3,
//       // plane:    width, height
//       // ring:     innerRadius, outerRadius, thetaSegments
//       "innerRadius": 0.5, "outerRadius": 1.2,
//       // capsule:  radius, length, capSegments, radialSegments
//       "length": 1.5, "capSegments": 8,
//
//       ── POSITION ──
//       "x": 0, "y": 0, "z": 0,
//
//       ── ROTATION (degrees) ──
//       "rotationX": 0, "rotationY": 45, "rotationZ": 0,
//
//       ── SCALE ──
//       "scale": 1,               // uniform
//       "scaleX": 1, "scaleY": 1, "scaleZ": 1,  // per-axis (override uniform)
//
//       ── MATERIAL ──
//       "material": "standard",   // "standard" | "phong" | "basic" | "toon"
//                                 // | "normal" | "wireframe"
//       "color":     "#4444ff",
//       "emissive":  "#000000",   // self-illumination colour
//       "emissiveIntensity": 0,
//       "metalness": 0.0,         // 0–1 (standard only)
//       "roughness": 0.5,         // 0–1 (standard only)
//       "opacity":   1.0,         // 0–1 (enables transparency automatically)
//       "wireframe": false,
//       "texture":   "https://...",  // diffuse map URL
//       "envMap":    false,          // enable fake env reflection (standard)
//       "side":      "front",        // "front" | "back" | "double"
//       "flatShading": false,
//
//       ── CONTINUOUS ANIMATION (runs every frame for full duration) ──
//       "animate": {
//         "spinX": 0,      // degrees per second around X
//         "spinY": 90,     // degrees per second around Y
//         "spinZ": 0,      // degrees per second around Z
//         "bobY":  0.5,    // bob up/down amplitude (world units)
//         "bobSpeed": 1,   // bob cycles per second
//         "orbitRadius": 0, // orbit around scene origin in XZ plane
//         "orbitSpeed": 0,  // orbit degrees per second
//         "pulseScale": 0,  // ±scale pulse amplitude (0 = off)
//         "pulseSpeed": 1,  // pulses per second
//         "colorCycle": [] // array of hex colors to cycle through
//       },
//
//       ── KEYFRAME TRANSITIONS (animateTo) ─────────────────────────────────
//       // Array of timed property snapshots. The first fires at t=0 by default.
//       "animateTo": [
//         {
//           "at": 0,          // seconds after this layer's start
//           "duration": 1.2,  // transition time in seconds
//           "ease": "easeInOutCubic",  // easing name (see list below)
//           // any subset of these target values:
//           "x": 2, "y": 0, "z": 0,
//           "rotationX": 0, "rotationY": 180, "rotationZ": 0,
//           "scale": 1.5,
//           "scaleX": 1, "scaleY": 2, "scaleZ": 1,
//           "color": "#ff4757",
//           "emissive": "#ff0000",
//           "opacity": 0.5
//         }
//       ]
//       // Supported ease names: "linear" | "easeInOut" | "easeIn" | "easeOut"
//       //   | "easeInOutCubic" | "easeOutCubic" | "easeInCubic"
//       //   | "easeInOutBack" | "easeOutBack" | "easeOutBounce"
//       //   | "easeOutElastic" | "easeInOutQuart" | "easeOutQuart" | "easeInQuart"
//     }
//   ],
//
// ┌─ PRESET EFFECTS ────────────────────────────────────────────────────────────
//   // effect: "splitImage"
//   "src": "https://picsum.photos/800/800",
//   "splitImage": {
//     "slices": 3, "sliceSize": 2, "sideColor": "#222",
//     "animTime": 1.5, "holdTime": 0.3, "secondAnimTime": 1.0,
//     "position": { "x": 0, "y": 0, "z": 0 }
//   },
//
//   // effect: "rotateCube"
//   "rotateCube": {
//     "width": 2, "height": 2, "depth": 2,
//     "color": "#4444ff", "wireframe": false,
//     "metalness": 0.3, "roughness": 0.4,
//     "rotateX": 1, "rotateY": 2,
//     "position": { "x": 0, "y": 0, "z": 0 },
//     "animTime": 3.0
//   },
//
//   // effect: "floatingSpheres"
//   "floatingSpheres": {
//     "count": 8, "radius": 0.3, "spread": 3, "color": "#ff6b6b",
//     "metalness": 0.2, "roughness": 0.5, "animTime": 4.0, "speed": 1
//   },
//
//   // effect: "particleField"
//   "particleField": {
//     "count": 200, "spread": 6, "size": 0.04,
//     "color": "#ffffff", "animTime": 4.0, "speed": 0.5
//   }
// }

// ─── Ease lookup ─────────────────────────────────────────────────────────────
function getEase(name: string): (t: number) => number {
  const map: Record<string, (t: number) => number> = {
    linear:         linear,
    easeInOut:      easeInOutCubic,
    easeIn:         easeInCubic,
    easeOut:        easeOutCubic,
    easeInOutCubic: easeInOutCubic,
    easeOutCubic:   easeOutCubic,
    easeInCubic:    easeInCubic,
    easeInOutBack:  easeInOutBack,
    easeOutBack:    easeOutBack,
    easeOutBounce:  easeOutBounce,
    easeOutElastic: easeOutElastic,
    easeInOutQuart: easeInOutQuart,
    easeOutQuart:   easeOutQuart,
    easeInQuart:    easeInQuart,
  };
  return map[name] ?? easeInOutCubic;
}

// ─── Scene + camera + lights setup ───────────────────────────────────────────
function setupThreeScene(item: any) {
  const threeScene = new THREE.Scene();

  // Camera
  const camCfg = item.camera ?? {};
  const camera = new THREE.PerspectiveCamera(camCfg.fov ?? 70);
  camera.position.set(camCfg.x ?? 0, camCfg.y ?? 0, camCfg.z ?? 5);
  if (camCfg.lookAt) {
    camera.lookAt(camCfg.lookAt.x ?? 0, camCfg.lookAt.y ?? 0, camCfg.lookAt.z ?? 0);
  }

  // Multi-light array (preferred) or legacy single-light shortcuts
  const lightsArr: any[] = item.lights ?? [];
  if (lightsArr.length === 0) {
    // fall back to legacy fields
    const lCfg = item.light ?? {};
    const aCfg = item.ambient ?? {};
    lightsArr.push({ type: 'directional', color: lCfg.color ?? '#ffffff', intensity: lCfg.intensity ?? 1.5, x: lCfg.x ?? 4, y: lCfg.y ?? 4, z: lCfg.z ?? 6 });
    lightsArr.push({ type: 'ambient',     color: aCfg.color ?? '#ffffff', intensity: aCfg.intensity ?? 0.4 });
  }
  lightsArr.forEach((lCfg: any) => {
    const col = new THREE.Color(lCfg.color ?? '#ffffff');
    const int = lCfg.intensity ?? 1;
    switch (lCfg.type) {
      case 'ambient': {
        threeScene.add(new THREE.AmbientLight(col, int));
        break;
      }
      case 'point': {
        const pl = new THREE.PointLight(col, int, lCfg.distance ?? 0, lCfg.decay ?? 1);
        pl.position.set(lCfg.x ?? 0, lCfg.y ?? 2, lCfg.z ?? 2);
        threeScene.add(pl);
        break;
      }
      case 'spot': {
        const sl = new THREE.SpotLight(col, int);
        sl.angle    = lCfg.angle   ?? 0.4;
        sl.penumbra = lCfg.penumbra ?? 0.3;
        sl.position.set(lCfg.x ?? 0, lCfg.y ?? 5, lCfg.z ?? 0);
        threeScene.add(sl);
        break;
      }
      default: { // directional
        const dl = new THREE.DirectionalLight(col, int);
        dl.position.set(lCfg.x ?? 4, lCfg.y ?? 4, lCfg.z ?? 6);
        threeScene.add(dl);
        break;
      }
    }
  });

  return { threeScene, camera };
}

// ─── Material factory ─────────────────────────────────────────────────────────
function buildMaterial(cfg: any): THREE.Material {
  const loader   = new THREE.TextureLoader();
  const color    = new THREE.Color(cfg.color    ?? '#888888');
  const emissive = new THREE.Color(cfg.emissive ?? '#000000');
  const opacity  = cfg.opacity ?? 1;
  const transparent = opacity < 1;
  const wireframe   = cfg.wireframe ?? false;
  const side = cfg.side === 'back'   ? THREE.BackSide
             : cfg.side === 'double' ? THREE.DoubleSide
             : THREE.FrontSide;

  const base: any = { color, wireframe, transparent, opacity, side };
  if (cfg.texture) base.map = loader.load(cfg.texture);

  const matType = cfg.material ?? 'standard';
  if (matType === 'basic')      return new THREE.MeshBasicMaterial(base);
  if (matType === 'phong')      return new THREE.MeshPhongMaterial({ ...base, emissive, specular: color, shininess: cfg.shininess ?? 30 });
  if (matType === 'toon')       return new THREE.MeshToonMaterial({ ...base, emissive, emissiveIntensity: cfg.emissiveIntensity ?? 0 });
  if (matType === 'normal')     return new THREE.MeshNormalMaterial({ wireframe, side });
  if (matType === 'wireframe')  return new THREE.MeshBasicMaterial({ color, wireframe: true, transparent, opacity });
  // default: standard
  return new THREE.MeshStandardMaterial({
    ...base,
    emissive,
    emissiveIntensity: cfg.emissiveIntensity ?? 0,
    metalness:  cfg.metalness  ?? 0,
    roughness:  cfg.roughness  ?? 0.5,
    flatShading: cfg.flatShading ?? false,
  });
}

// ─── Geometry factory ─────────────────────────────────────────────────────────
function buildGeometry(cfg: any): THREE.BufferGeometry {
  switch (cfg.shape) {
    case 'sphere':
      return new THREE.SphereGeometry(
        cfg.radius ?? 1,
        cfg.widthSegments ?? 32,
        cfg.heightSegments ?? 32
      );
    case 'cylinder':
      return new THREE.CylinderGeometry(
        cfg.radiusTop    ?? 0.5,
        cfg.radiusBottom ?? 0.5,
        cfg.height ?? 2,
        cfg.radialSegments ?? 32
      );
    case 'cone':
      return new THREE.ConeGeometry(
        cfg.radius ?? 0.5,
        cfg.height ?? 2,
        cfg.radialSegments ?? 32
      );
    case 'torus':
      return new THREE.TorusGeometry(
        cfg.radius ?? 1,
        cfg.tube   ?? 0.3,
        cfg.radialSegments  ?? 16,
        cfg.tubularSegments ?? 48
      );
    case 'plane':
      return new THREE.PlaneGeometry(
        cfg.width ?? 2,
        cfg.height ?? 2,
        cfg.widthSegments  ?? 1,
        cfg.heightSegments ?? 1
      );
    case 'ring':
      return new THREE.RingGeometry(
        cfg.innerRadius ?? 0.5,
        cfg.outerRadius ?? 1.2,
        cfg.thetaSegments ?? 32
      );
    case 'capsule': {
      // CapsuleGeometry was added in r142 — guard for older three builds
      const CG = (THREE as any).CapsuleGeometry;
      if (CG) return new CG(cfg.radius ?? 0.5, cfg.length ?? 1.5, cfg.capSegments ?? 8, cfg.radialSegments ?? 16);
      // fallback: cylinder with sphere caps approximated by a tall cylinder
      return new THREE.CylinderGeometry(cfg.radius ?? 0.5, cfg.radius ?? 0.5, (cfg.length ?? 1.5) + (cfg.radius ?? 0.5) * 2, cfg.radialSegments ?? 16);
    }
    default: // box
      return new THREE.BoxGeometry(
        cfg.width  ?? 1,
        cfg.height ?? 1,
        cfg.depth  ?? 1
      );
  }
}

// ─── Build a single mesh from an object descriptor ───────────────────────────
function buildObject(cfg: any): THREE.Mesh {
  const geo  = buildGeometry(cfg);
  const mat  = buildMaterial(cfg);
  const mesh = new THREE.Mesh(geo, mat);

  // Position
  mesh.position.set(cfg.x ?? 0, cfg.y ?? 0, cfg.z ?? 0);

  // Rotation (degrees → radians)
  mesh.rotation.set(
    (cfg.rotationX ?? 0) * Math.PI / 180,
    (cfg.rotationY ?? 0) * Math.PI / 180,
    (cfg.rotationZ ?? 0) * Math.PI / 180
  );

  // Scale
  const su = cfg.scale ?? 1;
  mesh.scale.set(
    (cfg.scaleX ?? su),
    (cfg.scaleY ?? su),
    (cfg.scaleZ ?? su)
  );

  // Store original state for animation reference
  (mesh as any).__cfg    = cfg;
  (mesh as any).__origX  = mesh.position.x;
  (mesh as any).__origY  = mesh.position.y;
  (mesh as any).__origZ  = mesh.position.z;
  (mesh as any).__phase  = Math.random() * Math.PI * 2;
  (mesh as any).__orbit  = 0;  // current orbit angle

  return mesh;
}

// ─── Per-frame continuous animation tick ─────────────────────────────────────
function tickObject(mesh: THREE.Mesh, anim: any, dt: number, elapsed: number) {
  if (!anim) return;

  const PI   = Math.PI;
  const cfg  = (mesh as any).__cfg  ?? {};
  const origY = (mesh as any).__origY ?? mesh.position.y;
  const phase = (mesh as any).__phase ?? 0;

  // Spin (degrees/sec → radians/frame)
  if (anim.spinX) mesh.rotation.x += (anim.spinX * PI / 180) * dt;
  if (anim.spinY) mesh.rotation.y += (anim.spinY * PI / 180) * dt;
  if (anim.spinZ) mesh.rotation.z += (anim.spinZ * PI / 180) * dt;

  // Bob
  if (anim.bobY) {
    const speed = anim.bobSpeed ?? 1;
    mesh.position.y = origY + anim.bobY * Math.sin(elapsed * PI * 2 * speed + phase);
  }

  // Orbit in XZ plane around origin
  if (anim.orbitRadius && anim.orbitSpeed) {
    (mesh as any).__orbit = ((mesh as any).__orbit ?? 0) + (anim.orbitSpeed * PI / 180) * dt;
    const angle = (mesh as any).__orbit;
    mesh.position.x = Math.sin(angle) * anim.orbitRadius + ((mesh as any).__origX ?? 0);
    mesh.position.z = Math.cos(angle) * anim.orbitRadius + ((mesh as any).__origZ ?? 0);
  }

  // Pulse scale
  if (anim.pulseScale) {
    const ps = anim.pulseSpeed ?? 1;
    const p  = 1 + anim.pulseScale * Math.sin(elapsed * PI * 2 * ps + phase);
    const su = cfg.scale ?? 1;
    mesh.scale.set(
      (cfg.scaleX ?? su) * p,
      (cfg.scaleY ?? su) * p,
      (cfg.scaleZ ?? su) * p
    );
  }

  // Color cycle
  if (anim.colorCycle && anim.colorCycle.length > 0) {
    const colors = anim.colorCycle;
    const idx = Math.floor(elapsed * (anim.colorCycleSpeed ?? 1)) % colors.length;
    (mesh.material as THREE.MeshStandardMaterial).color?.set(colors[idx]);
  }
}

// ─── animateTo keyframe system ────────────────────────────────────────────────
// Runs all keyframes for a single mesh. Fires them in parallel with the main
// tween loop (they schedule themselves via waitFor inside all()).
function* runKeyframes(mesh: THREE.Mesh, keyframes: any[], totalDuration: number) {
  if (!keyframes || keyframes.length === 0) return;

  for (const kf of keyframes) {
    const at       = kf.at       ?? 0;
    const kfDur    = kf.duration ?? 0.5;
    const easeFn   = getEase(kf.ease ?? 'easeInOutCubic');

    yield* waitFor(at);

    // Snapshot start values
    const startX  = mesh.position.x;
    const startY  = mesh.position.y;
    const startZ  = mesh.position.z;
    const startRX = mesh.rotation.x;
    const startRY = mesh.rotation.y;
    const startRZ = mesh.rotation.z;
    const startSX = mesh.scale.x;
    const startSY = mesh.scale.y;
    const startSZ = mesh.scale.z;
    const mat = mesh.material as any;
    const startColor    = mat.color    ? mat.color.clone()    : null;
    const startEmissive = mat.emissive ? mat.emissive.clone() : null;
    const startOpacity  = mat.opacity  ?? 1;

    // Target values (fall back to current if not specified)
    const tsu = kf.scale ?? null;
    const endX  = kf.x         !== undefined ? kf.x                          : startX;
    const endY  = kf.y         !== undefined ? kf.y                          : startY;
    const endZ  = kf.z         !== undefined ? kf.z                          : startZ;
    const endRX = kf.rotationX !== undefined ? kf.rotationX * Math.PI / 180  : startRX;
    const endRY = kf.rotationY !== undefined ? kf.rotationY * Math.PI / 180  : startRY;
    const endRZ = kf.rotationZ !== undefined ? kf.rotationZ * Math.PI / 180  : startRZ;
    const endSX = kf.scaleX !== undefined ? kf.scaleX : (tsu !== null ? tsu : startSX);
    const endSY = kf.scaleY !== undefined ? kf.scaleY : (tsu !== null ? tsu : startSY);
    const endSZ = kf.scaleZ !== undefined ? kf.scaleZ : (tsu !== null ? tsu : startSZ);
    const endColor    = kf.color    ? new THREE.Color(kf.color)    : startColor;
    const endEmissive = kf.emissive ? new THREE.Color(kf.emissive) : startEmissive;
    const endOpacity  = kf.opacity  !== undefined ? kf.opacity : startOpacity;

    yield* tween(kfDur, v => {
      const t = easeFn(v);
      mesh.position.set(
        lerp(startX, endX, t),
        lerp(startY, endY, t),
        lerp(startZ, endZ, t)
      );
      mesh.rotation.set(
        lerp(startRX, endRX, t),
        lerp(startRY, endRY, t),
        lerp(startRZ, endRZ, t)
      );
      mesh.scale.set(
        lerp(startSX, endSX, t),
        lerp(startSY, endSY, t),
        lerp(startSZ, endSZ, t)
      );
      if (mat.color && endColor) {
        mat.color.lerpColors(startColor, endColor, t);
      }
      if (mat.emissive && endEmissive) {
        mat.emissive.lerpColors(startEmissive, endEmissive, t);
      }
      if (mat.opacity !== undefined) {
        mat.opacity = lerp(startOpacity, endOpacity, t);
      }
    });
  }
}

// ─── preset builders ──────────────────────────────────────────────────────────
function buildSplitImage(src: string, cfg: any) {
  const loader = new THREE.TextureLoader();
  const texture = loader.load(src);
  const group = new THREE.Group();
  const size    = cfg.sliceSize ?? 2;
  const slices  = cfg.slices ?? 3;
  const partH   = size / slices;
  const sidCol  = cfg.sideColor ?? '#222222';
  const meshes: THREE.Mesh[] = [];

  for (let i = 0; i < slices; i++) {
    const geometry = new THREE.BoxGeometry(size, partH, size);
    const tex = texture.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 1 / slices);
    tex.offset.set(0, 1 - (i + 1) / slices);
    const materials = [
      new THREE.MeshStandardMaterial({ color: sidCol }),
      new THREE.MeshStandardMaterial({ color: sidCol }),
      new THREE.MeshStandardMaterial({ color: sidCol }),
      new THREE.MeshStandardMaterial({ color: sidCol }),
      new THREE.MeshStandardMaterial({ map: tex }),
      new THREE.MeshStandardMaterial({ color: '#111111' }),
    ];
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.y = partH - i * partH - partH / 2;
    group.add(mesh);
    meshes.push(mesh);
  }
  if (cfg.position) group.position.set(cfg.position.x ?? 0, cfg.position.y ?? 0, cfg.position.z ?? 0);
  return { group, meshes };
}

function buildRotateCubePreset(cfg: any) {
  const geo = new THREE.BoxGeometry(cfg.width ?? 2, cfg.height ?? 2, cfg.depth ?? 2);
  const mat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(cfg.color     ?? '#4444ff'),
    emissive:  new THREE.Color(cfg.emissive  ?? '#000000'),
    metalness: cfg.metalness ?? 0,
    roughness: cfg.roughness ?? 0.5,
    wireframe: cfg.wireframe ?? false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mesh);
  if (cfg.position) group.position.set(cfg.position.x ?? 0, cfg.position.y ?? 0, cfg.position.z ?? 0);
  return { group, mesh };
}

function buildFloatingSpheres(cfg: any) {
  const count  = cfg.count ?? 8;
  const group  = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const spread = cfg.spread ?? 3;
    const mesh = buildObject({
      shape: 'sphere',
      radius: cfg.radius ?? 0.3,
      color:      cfg.color     ?? '#ff6b6b',
      emissive:   cfg.emissive  ?? '#000000',
      metalness:  cfg.metalness ?? 0.2,
      roughness:  cfg.roughness ?? 0.5,
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      z: (Math.random() - 0.5) * spread,
    });
    (mesh as any).__origY = mesh.position.y;
    (mesh as any).__phase = Math.random() * Math.PI * 2;
    group.add(mesh);
    meshes.push(mesh);
  }
  return { group, meshes };
}

function buildParticleField(cfg: any) {
  const count  = cfg.count  ?? 200;
  const spread = cfg.spread ?? 6;
  const size   = cfg.size   ?? 0.04;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat    = new THREE.PointsMaterial({ color: new THREE.Color(cfg.color ?? '#ffffff'), size });
  const points = new THREE.Points(geo, mat);
  const group  = new THREE.Group();
  group.add(points);
  return { group, points };
}

// ─── Main Three.js layer runner ───────────────────────────────────────────────
function* runThreeJsLayer(view: any, item: any) {
  const { threeScene, camera } = setupThreeScene(item);
  const threeRef   = createRef<Three>();
  const zIdx       = item.zIndex   ?? 0;
  const duration   = item.duration ?? 5;
  const fadeInTime  = item.fadeIn?.time  ?? 0;
  const fadeOutTime = item.fadeOut?.time ?? 0;
  const effect      = item.effect ?? 'objects';
  const animDur     = duration - fadeInTime - fadeOutTime;

  if (item.background) {
    view.add(<Rect width={WIDTH} height={HEIGHT} fill={item.background} zIndex={zIdx - 1} />);
  }

  view.add(
    <Three
      ref={threeRef}
      width={WIDTH}
      height={HEIGHT}
      camera={camera}
      scene={threeScene}
      opacity={fadeInTime > 0 ? 0 : 1}
      zIndex={zIdx}
    />
  );

  if (fadeInTime > 0) {
    yield* threeRef().opacity(1, fadeInTime);
  }

  // ── effect: "objects" — fully JSON-driven scene ───────────────────────────
  if (effect === 'objects') {
    const objCfgs: any[] = item.objects ?? [];
    const meshes: THREE.Mesh[] = objCfgs.map(cfg => {
      const mesh = buildObject(cfg);
      threeScene.add(mesh);
      return mesh;
    });

    // Run continuous-animation ticker + keyframe runners in parallel
    const FPS    = 60;
    const dt     = 1 / FPS;
    const frames = Math.ceil(animDur * FPS);

    yield* all(
      // Continuous tick tween
      tween(animDur, (_, absT) => {
        const elapsed = absT ?? 0;
        meshes.forEach((mesh, idx) => {
          const anim = objCfgs[idx]?.animate;
          if (anim) tickObject(mesh, anim, dt, elapsed);
        });
      }),
      // Per-mesh keyframe runners
      ...meshes.map((mesh, idx) => {
        const kfs = objCfgs[idx]?.animateTo ?? [];
        return runKeyframes(mesh, kfs, animDur);
      })
    );
  }

  // ── effect: "splitImage" ──────────────────────────────────────────────────
  else if (effect === 'splitImage') {
    const src = item.src ?? 'https://picsum.photos/800/800';
    const cfg = item.splitImage ?? {};
    const { group, meshes } = buildSplitImage(src, cfg);
    threeScene.add(group);

    const t1 = cfg.animTime       ?? 1.5;
    const th = cfg.holdTime       ?? 0.3;
    const t2 = cfg.secondAnimTime ?? 1.0;

    yield* tween(t1, v => {
      const angle = v * Math.PI;
      meshes.forEach((m, i) => { m.rotation.y = i % 2 === 0 ? -angle : angle; });
    });
    yield* waitFor(th);
    yield* tween(t2, v => {
      const angle = Math.PI + v * 0.3;
      meshes.forEach((m, i) => { m.rotation.y = i % 2 === 0 ? -angle : angle; });
    });

    const rem = animDur - t1 - th - t2;
    if (rem > 0) yield* waitFor(rem);
  }

  // ── effect: "rotateCube" ──────────────────────────────────────────────────
  else if (effect === 'rotateCube') {
    const cfg  = item.rotateCube ?? {};
    const { group } = buildRotateCubePreset(cfg);
    threeScene.add(group);

    const at   = cfg.animTime ?? animDur;
    const rotX = (cfg.rotateX ?? 1) * Math.PI * 2;
    const rotY = (cfg.rotateY ?? 2) * Math.PI * 2;

    yield* tween(at, v => {
      const e = easeInOutCubic(v);
      group.rotation.x = rotX * e;
      group.rotation.y = rotY * e;
    });
    const rem = animDur - at;
    if (rem > 0) yield* waitFor(rem);
  }

  // ── effect: "floatingSpheres" ─────────────────────────────────────────────
  else if (effect === 'floatingSpheres') {
    const cfg  = item.floatingSpheres ?? {};
    const { group, meshes } = buildFloatingSpheres(cfg);
    threeScene.add(group);

    const at    = cfg.animTime ?? animDur;
    const speed = cfg.speed ?? 1;

    yield* tween(at, v => {
      meshes.forEach(m => {
        const phase = (m as any).__phase ?? 0;
        const oy    = (m as any).__origY ?? 0;
        m.position.y = oy + Math.sin(v * Math.PI * 4 * speed + phase) * 0.3;
      });
      group.rotation.y = v * Math.PI * 2 * speed * 0.3;
    });
    const rem = animDur - at;
    if (rem > 0) yield* waitFor(rem);
  }

  // ── effect: "particleField" ───────────────────────────────────────────────
  else if (effect === 'particleField') {
    const cfg  = item.particleField ?? {};
    const { group } = buildParticleField(cfg);
    threeScene.add(group);

    const at    = cfg.animTime ?? animDur;
    const speed = cfg.speed ?? 0.5;

    yield* tween(at, v => {
      group.rotation.y = v * Math.PI * 2 * speed;
      group.rotation.x = v * Math.PI * speed * 0.4;
    });
    const rem = animDur - at;
    if (rem > 0) yield* waitFor(rem);
  }

  if (fadeOutTime > 0) {
    yield* threeRef().opacity(0, fadeOutTime);
  }
}

// ─── Main scene ──────────────────────────────────────────────────────────────
const scene = makeScene2D('scene', function* (view) {
  const refs: Record<string, any> = {};
  const tasks = config.timeline.map((item: any) => runLayer(view, item, refs));
  yield* all(...tasks);
});

// ─── Layer dispatcher ─────────────────────────────────────────────────────────
function* runLayer(view: any, item: any, refs: any) {
  yield* waitFor(item.start ?? 0);
  const pos = item.position ?? { x: 0.5, y: 0.5 };
  const textAlign: 'left' | 'center' | 'right' = item.textAlign ?? 'center';
  const fontFamily: string | undefined = item.fontFamily ?? undefined;
  const PI = Math.PI;
  const TAU = PI * 2;

  // ── THREEJS ──────────────────────────────────────────────────────────────
  if (item.type === 'threejs') {
    yield* runThreeJsLayer(view, item);
    return;
  }

  // ── VIDEO ────────────────────────────────────────────────────────────────
  if (item.type === 'video') {
    refs[item.id]        = createRef<Video>();
    const prevVideoId    = item.prevVideoId ?? null;
    const transition     = item.transition ?? null;
    const transType      = transition?.type ?? 'none';
    const transDuration  = transition?.duration ?? 1;
    const zIdx           = item.zIndex ?? 0;

    if (transType === 'fade') {
      view.add(
        <Video
          ref={refs[item.id]}
          src={item.src}
          play
          size={['100%', '100%']}
          opacity={0}
          zIndex={zIdx}
        />
      );
      yield* refs[item.id]().opacity(1, transDuration);
      const holdTime = (item.duration ?? 0) - transDuration;
      if (holdTime > 0) yield* waitFor(holdTime);
      return;
    }

    if (transType === 'swipe-left-blur') {
      const inRef  = refs[item.id];
      const outRef = prevVideoId ? refs[prevVideoId] : null;
      view.add(
        <Video
          ref={inRef}
          src={item.src}
          play
          size={['100%', '100%']}
          x={WIDTH}
          zIndex={zIdx + 1}
        />
      );
      yield* waitFor(0);
      yield* tween(transDuration, v => {
        const ease  = easeInOutCubic(v);
        const maxBlur = 40;
        const blur  = maxBlur * Math.sin(Math.PI * v);
        inRef().x(WIDTH * (1 - ease));
        inRef().filters([{ type: 'blur', radius: blur }] as any);
        if (outRef) {
          outRef().x(-WIDTH * ease);
          outRef().filters([{ type: 'blur', radius: blur }] as any);
        }
      });
      inRef().x(0);
      inRef().filters([]);
      if (outRef) outRef().filters([]);
      const holdTime = (item.duration ?? 0) - transDuration;
      if (holdTime > 0) yield* waitFor(holdTime);
      return;
    }

    view.add(
      <Video
        ref={refs[item.id]}
        src={item.src}
        play
        size={['100%', '100%']}
        zIndex={zIdx}
      />
    );
    if (item.duration) yield* waitFor(item.duration);
    return;
  }

  // ── AUDIO ────────────────────────────────────────────────────────────────
  if (item.type === 'audio') {
    view.add(
      <Audio src={item.src} play time={item.offset ?? 0} />
    );
  }

  // ── IMAGE ────────────────────────────────────────────────────────────────
  if (item.type === 'image') {
    refs[item.id] = createRef<Img>();
    const imgWidth  = item.width  ?? 200;
    const imgHeight = item.height ?? imgWidth;
    const rawX  = toSceneX(pos.x);
    const rawY  = toSceneY(pos.y);

    const wipeLeft = item.animation?.wipeLeft;
    if (wipeLeft) {
      const maskRef  = createRef<Rect>();
      const imgRef2  = createRef<Img>();
      const wipeTime = wipeLeft.time ?? 0.9;
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      view.add(
        <Img
          ref={imgRef2}
          src={item.src}
          width={imgWidth}
          x={rawX}
          y={rawY}
          opacity={0}
          zIndex={item.zIndex ?? 1}
        />
      );
      yield* waitFor(0);
      const realW = imgRef2().size().x;
      const realH = imgRef2().size().y;
      view.add(
        <Rect
          ref={maskRef}
          x={rawX + realW / 2}
          y={rawY}
          width={0}
          height={realH * 1.05}
          clip={true}
          zIndex={item.zIndex ?? 1}
        >
          <Img
            ref={refs[item.id]}
            src={item.src}
            width={imgWidth}
            x={-realW / 2}
            y={0}
            zIndex={item.zIndex ?? 1}
          />
        </Rect>
      );
      imgRef2().remove();
      yield* tween(wipeTime, v => {
        const ease = easeInOutCubic(v);
        const w = realW * ease;
        maskRef().x(rawX + realW / 2 - w / 2);
        maskRef().width(w);
        refs[item.id]().x(-realW / 2 + (realW - w) / 2);
      });
      maskRef().x(rawX);
      maskRef().width(realW);
      refs[item.id]().x(0);
      const holdTime = (item.duration ?? 0) - wipeTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          maskRef().opacity(1 - easeInOutCubic(v));
        });
        maskRef().opacity(0);
      }
      return;
    }

    const startOpacity = item.animation?.fadeIn ? 0 : 1;
    const fadeInTime  = item.animation?.fadeIn?.time  ?? 0;
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    view.add(
      <Img
        ref={refs[item.id]}
        src={item.src}
        width={imgWidth}
        x={rawX}
        y={rawY}
        opacity={startOpacity}
        zIndex={item.zIndex ?? 1}
      />
    );
    if (item.animation) {
      yield* waitFor(0);
      if (fadeInTime > 0) {
        yield* tween(fadeInTime, v => {
          refs[item.id]().opacity(easeInOutCubic(v));
        });
        refs[item.id]().opacity(1);
      }
      const holdTime = (item.duration ?? 0) - fadeInTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          refs[item.id]().opacity(1 - easeInOutCubic(v));
        });
        refs[item.id]().opacity(0);
      }
    }
  }

  // ── TEXT ─────────────────────────────────────────────────────────────────
  if (item.type === 'text') {
    refs[item.id] = createRef<Txt>();
    const wipeRight   = item.animation?.wipeRight;
    const slideInLeft = item.animation?.slideInLeft;
    const fadeIn      = item.animation?.fadeIn;
    const fadeOut     = item.animation?.fadeOut;
    const textWidth: number | undefined = item.width ?? undefined;
    const textWrap: boolean | 'pre' | 'balance' = item.textWrap ?? true;
    const lineHeight: number = item.lineHeight ?? 300;
    const letterSpacing: number = item.letterSpacing ?? 0;
    const skewX: number = item.skewX ?? 0;
    const skewY: number = item.skewY ?? 0;
    const rotation: number = item.rotation ?? 0;

    if (slideInLeft) {
      const tx       = toSceneX(pos.x);
      const ty       = toSceneY(pos.y);
      const fSize    = item.fontSize ?? 80;
      const slideTime = slideInLeft.time ?? 0.2;
      const fadeOutTime = fadeOut?.time ?? 0;
      const startX = WIDTH / 2 + 200;
      view.add(
        <Txt
          ref={refs[item.id]}
          text={item.text}
          fontSize={fSize}
          fill={item.color ?? 'white'}
          x={startX}
          y={ty}
          textAlign={textAlign}
          opacity={0}
          zIndex={item.zIndex ?? 1}
          fontFamily={fontFamily}
          lineHeight={lineHeight}
          letterSpacing={letterSpacing}
          skewX={skewX}
          skewY={skewY}
          width={textWidth}
          textWrap={textWrap}
          rotation={rotation}
        />
      );
      yield* waitFor(0);
      yield* tween(slideTime, v => {
        const ease = easeInOutCubic(v);
        refs[item.id]().x(startX + (tx - startX) * ease);
        refs[item.id]().opacity(ease);
      });
      refs[item.id]().x(tx);
      refs[item.id]().opacity(1);
      const holdTime = (item.duration ?? 0) - slideTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          refs[item.id]().opacity(1 - easeInOutCubic(v));
        });
        refs[item.id]().opacity(0);
      }
      return;
    }

    if (fadeIn && !wipeRight && !slideInLeft) {
      const tx       = toSceneX(pos.x);
      const ty       = toSceneY(pos.y);
      const fSize    = item.fontSize ?? 80;
      const fadeInTime  = fadeIn.time ?? 0.3;
      const fadeOutTime = fadeOut?.time ?? 0;
      view.add(
        <Txt
          ref={refs[item.id]}
          text={item.text}
          fontSize={fSize}
          fill={item.color ?? 'white'}
          x={tx}
          y={ty}
          textAlign={textAlign}
          opacity={0}
          zIndex={item.zIndex ?? 1}
          fontFamily={fontFamily}
          lineHeight={lineHeight}
          letterSpacing={letterSpacing}
          skewX={skewX}
          skewY={skewY}
          width={textWidth}
          textWrap={textWrap}
          rotation={rotation}
        />
      );
      yield* waitFor(0);
      yield* waitFor(0);
      yield* tween(fadeInTime, v => {
        refs[item.id]().opacity(easeInOutCubic(v));
      });
      refs[item.id]().opacity(1);
      const holdTime = (item.duration ?? 0) - fadeInTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          refs[item.id]().opacity(1 - easeInOutCubic(v));
        });
        refs[item.id]().opacity(0);
      }
      return;
    }

    if (wipeRight) {
      const maskRef = createRef<Rect>();
      const txtRef2 = createRef<Txt>();
      const tx      = toSceneX(pos.x);
      const ty      = toSceneY(pos.y);
      const fSize   = item.fontSize ?? 80;
      const withFade = !!fadeIn;
      const fadeOutTime = fadeOut?.time ?? 0;
      view.add(
        <Txt
          ref={txtRef2}
          text={item.text}
          fontSize={fSize}
          fill={item.color ?? 'white'}
          x={tx}
          y={ty}
          textAlign={textAlign}
          zIndex={item.zIndex ?? 1}
          opacity={0}
          fontFamily={fontFamily}
          lineHeight={lineHeight}
          letterSpacing={letterSpacing}
          skewX={skewX}
          skewY={skewY}
          width={textWidth}
          textWrap={textWrap}
          rotation={rotation}
        />
      );
      yield* waitFor(0);
      const realW = txtRef2().size().x;
      const realH = txtRef2().size().y;
      view.add(
        <Rect
          ref={maskRef}
          x={tx - realW / 2}
          y={ty}
          width={0}
          height={realH * 1.1}
          clip={true}
          zIndex={item.zIndex ?? 1}
          opacity={withFade ? 0 : 1}
        >
          <Txt
            ref={refs[item.id]}
            text={item.text}
            fontSize={fSize}
            fill={item.color ?? 'white'}
            x={realW / 2}
            y={0}
            textAlign={textAlign}
            fontFamily={fontFamily}
            lineHeight={lineHeight}
            letterSpacing={letterSpacing}
            skewX={skewX}
            skewY={skewY}
            width={textWidth}
            textWrap={textWrap}
            rotation={rotation}
          />
        </Rect>
      );
      txtRef2().remove();
      const revealTime = wipeRight.time ?? 0.9;
      yield* tween(revealTime, v => {
        const ease = easeInOutCubic(v);
        const w = realW * ease;
        maskRef().x(tx - realW / 2 + w / 2);
        maskRef().width(w);
        refs[item.id]().x(tx - (tx - realW / 2 + w / 2));
        if (withFade) maskRef().opacity(ease);
      });
      maskRef().opacity(1);
      const holdTime = (item.duration ?? 0) - revealTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          maskRef().opacity(1 - easeInOutCubic(v));
        });
        maskRef().opacity(0);
      }
      return;
    }

    const animType = item.animation?.type;

    if (animType === 'fadeOut') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} lineHeight={lineHeight} letterSpacing={letterSpacing} skewX={skewX} skewY={skewY} width={textWidth} textWrap={textWrap} rotation={rotation} />);
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.6);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().opacity(0, item.animation?.exitTime ?? 0.6);
      return;
    }
    if (animType === 'slideOutLeft') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.x(-WIDTH, item.animation?.exitTime ?? 0.55, easeInCubic);
      return;
    }
    if (animType === 'slideOutRight') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.x(WIDTH, item.animation?.exitTime ?? 0.55, easeInCubic);
      return;
    }
    if (animType === 'slideOutUp') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.y(-HEIGHT, item.animation?.exitTime ?? 0.55, easeInCubic);
      return;
    }
    if (animType === 'slideOutDown') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.y(HEIGHT, item.animation?.exitTime ?? 0.55, easeInCubic);
      return;
    }
    if (animType === 'zoomOut') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.5;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(refs[item.id]().scale(0, exitTime, easeInOutBack), refs[item.id]().opacity(0, exitTime * 0.8));
      return;
    }
    if (animType === 'shrinkOut') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.5;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(refs[item.id]().scale(0, exitTime, easeInCubic), refs[item.id]().opacity(0, exitTime * 0.8));
      return;
    }
    if (animType === 'bounceOut') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.75;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.y(HEIGHT, exitTime, easeInCubic);
      return;
    }
    if (animType === 'flipOutX') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.5;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(refs[item.id]().scale.x(0, exitTime, easeInOutBack), refs[item.id]().opacity(0, exitTime));
      return;
    }
    if (animType === 'flipOutY') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.5;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(refs[item.id]().scale.y(0, exitTime, easeInOutBack), refs[item.id]().opacity(0, exitTime));
      return;
    }
    if (animType === 'spinOut') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.7;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(refs[item.id]().rotation(720, exitTime, easeInCubic), refs[item.id]().opacity(0, exitTime), refs[item.id]().scale(0, exitTime, easeInCubic));
      return;
    }
    if (animType === 'swirlOut') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.6;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(refs[item.id]().scale(0, exitTime, easeInQuart), refs[item.id]().rotation(540, exitTime, easeInQuart), refs[item.id]().opacity(0, exitTime));
      return;
    }
    if (animType === 'dissolveOut') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.8;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* tween(exitTime, v => {
        refs[item.id]().opacity(v > 0.9 ? 0 : (Math.random() > v ? 1 : 0));
      });
      refs[item.id]().opacity(0);
      return;
    }
    if (animType === 'scatterOut') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />);
      const exitTime = item.animation?.exitTime ?? 0.3;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(refs[item.id]().scale.x(4, exitTime, easeInQuart), refs[item.id]().scale.y(0, exitTime, easeInQuart), refs[item.id]().opacity(0, exitTime));
      return;
    }
    if (animType === 'zoomIn') {
      const enterTime = item.animation?.enterTime ?? 0.5;
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={0} scale={0} />);
      yield* waitFor(0);
      yield* all(refs[item.id]().opacity(1, enterTime * 0.6), refs[item.id]().scale(1, enterTime, easeInOutBack));
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'popIn') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={0} scale={0} />);
      yield* waitFor(0);
      yield* all(refs[item.id]().opacity(1, 0.1), refs[item.id]().scale(1.5, 0.14, easeOutCubic));
      yield* refs[item.id]().scale(1, 0.2, easeInOutCubic);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - 0.34 - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'bounceIn') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y) - 520} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      yield* waitFor(0);
      yield* refs[item.id]().position.y(toSceneY(pos.y), 0.9, easeOutBounce);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - 0.9 - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'flipInX') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      refs[item.id]().scale.x(0);
      yield* waitFor(0);
      yield* refs[item.id]().scale.x(1, 0.55, easeInOutBack);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - 0.55 - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'flipInY') {
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      refs[item.id]().scale.y(0);
      yield* waitFor(0);
      yield* refs[item.id]().scale.y(1, 0.55, easeInOutBack);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - 0.55 - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'rotateIn') {
      const enterTime = item.animation?.enterTime ?? 0.7;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={0} rotation={-180} />);
      yield* waitFor(0);
      yield* all(refs[item.id]().opacity(1, enterTime * 0.4), refs[item.id]().rotation(0, enterTime, easeInOutBack));
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'swingIn') {
      const enterTime = item.animation?.enterTime ?? 0.65;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={0} rotation={-90} />);
      yield* waitFor(0);
      yield* all(refs[item.id]().opacity(1, enterTime * 0.4), refs[item.id]().rotation(0, enterTime, easeOutElastic));
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'rollIn') {
      const enterTime = item.animation?.enterTime ?? 0.7;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={-WIDTH} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} rotation={-360} />);
      yield* waitFor(0);
      yield* all(refs[item.id]().position.x(toSceneX(pos.x), enterTime, easeOutCubic), refs[item.id]().rotation(0, enterTime, easeOutCubic));
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'dropIn') {
      const enterTime = item.animation?.enterTime ?? 0.75;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={-HEIGHT} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      yield* waitFor(0);
      yield* refs[item.id]().position.y(toSceneY(pos.y), enterTime, easeOutBounce);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'riseIn') {
      const enterTime = item.animation?.enterTime ?? 0.7;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={HEIGHT} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      yield* waitFor(0);
      yield* refs[item.id]().position.y(toSceneY(pos.y), enterTime, easeOutCubic);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'slideInLeft') {
      const enterTime = item.animation?.enterTime ?? 0.55;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={-WIDTH} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      yield* waitFor(0);
      yield* refs[item.id]().position.x(toSceneX(pos.x), enterTime, easeOutCubic);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'slideInRight') {
      const enterTime = item.animation?.enterTime ?? 0.55;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={WIDTH} y={toSceneY(pos.y)} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      yield* waitFor(0);
      yield* refs[item.id]().position.x(toSceneX(pos.x), enterTime, easeOutCubic);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'slideInUp') {
      const enterTime = item.animation?.enterTime ?? 0.55;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={HEIGHT} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      yield* waitFor(0);
      yield* refs[item.id]().position.y(toSceneY(pos.y), enterTime, easeOutCubic);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }
    if (animType === 'slideInDown') {
      const enterTime = item.animation?.enterTime ?? 0.55;
      view.add(<Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={-HEIGHT} zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />);
      yield* waitFor(0);
      yield* refs[item.id]().position.y(toSceneY(pos.y), enterTime, easeOutCubic);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }

    view.add(
      <Txt
        ref={refs[item.id]}
        text={item.text}
        fontSize={item.fontSize ?? 80}
        fill={item.color ?? 'white'}
        x={toSceneX(pos.x)}
        y={toSceneY(pos.y)}
        zIndex={item.zIndex ?? 1}
        fontFamily={fontFamily}
        lineHeight={lineHeight}
        letterSpacing={letterSpacing}
        skewX={skewX}
        skewY={skewY}
        width={textWidth}
        textWrap={textWrap}
        rotation={rotation}
      />
    );
  }

  // ── PER-LETTER TEXT ──────────────────────────────────────────────────────
  if (item.type === 'per-letter-text') {
    yield* runPerLetterAnimation(view, item, refs);
    return;
  }

  // ── ATTENTION TEXT ───────────────────────────────────────────────────────
  if (item.type === 'attention-text') {
    yield* runAttentionAnimation(view, item);
    return;
  }

  // ── TYPING / DECODE TEXT ─────────────────────────────────────────────────
  if (item.type === 'typing-text') {
    yield* runTypingAnimation(view, item);
    return;
  }

  // ── COLOUR EFFECT TEXT ───────────────────────────────────────────────────
  if (item.type === 'colour-text') {
    yield* runColourAnimation(view, item);
    return;
  }

  // ── CLIP / REVEAL TEXT ───────────────────────────────────────────────────
  if (item.type === 'clip-text') {
    yield* runClipAnimation(view, item);
    return;
  }

  // ── SCROLL TEXT ──────────────────────────────────────────────────────────
  if (item.type === 'scroll-text') {
    const lines: string[]    = item.lines ?? [];
    const fontSize: number   = item.fontSize  ?? 50;
    const lineHeight: number = item.lineHeight ?? Math.round(fontSize * 1.6);
    const color: string      = item.color ?? '#ffffff';
    const area  = item.scrollArea ?? { x: 0.5, y: 0.5, width: 0.4, height: 0.6 };
    const areaX = toSceneX(area.x);
    const areaY = toSceneY(area.y);
    const areaW = area.width  * WIDTH;
    const areaH = area.height * HEIGHT;
    const totalH = lines.length * lineHeight;
    const lineRefs: any[] = lines.map(() => createRef<Txt>());
    const initYs = lines.map((_: any, i: number) =>
      areaH / 2 - lineHeight / 2 + (i + 1) * lineHeight
    );
    view.add(
      <Rect
        x={areaX}
        y={areaY}
        width={areaW}
        height={areaH}
        clip={true}
        zIndex={item.zIndex ?? 2}
      >
        {lines.map((line: string, i: number) => (
          <Txt
            ref={lineRefs[i]}
            key={String(i)}
            text={line === '' ? ' ' : line}
            fontSize={fontSize}
            fontFamily={fontFamily}
            lineHeight={lineHeight}
            fill={line === '' ? '#00000000' : color}
            textAlign={item.textAlign ?? 'center'}
            width={areaW}
            x={0}
            y={initYs[i]}
          />
        ))}
      </Rect>
    );
    yield* waitFor(0);
    const scrollDist = areaH + lineHeight + totalH;
    const duration   = item.duration ?? 10;
    yield* tween(duration, value => {
      const offset = scrollDist * value;
      lineRefs.forEach((ref: any, i: number) => {
        ref().y(initYs[i] - offset);
      });
    });
    return;
  }

  if (item.duration) {
    yield* waitFor(item.duration);
  }
}

export default makeProject({
  scenes: [scene],
  settings: { shared: { size: config.settings.size } },
});