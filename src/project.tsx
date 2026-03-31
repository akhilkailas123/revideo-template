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

function* runPerLetterAnimation(
  view: any,
  item: any,
  refs: any
) {
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

  // ── entrance per-letter animations ──────────────────────────────────────

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
    yield* all(...letterRefs.map((r, i) => r().opacity(1, 0.2)));
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
    yield* all(...letterRefs.map((r, i) => r().opacity(1, 0.2)));
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
    yield* tween(inTime, v => {
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
    yield* tween(inTime, v => {
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

  // ── hold ────────────────────────────────────────────────────────────────

  if (animType !== 'letterWave' && animType !== 'letterFloat') {
    const inTime = item.animation?.inTime ?? 0;
    const holdTime = duration - inTime - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
  }

  // ── fade out ────────────────────────────────────────────────────────────

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

    // measure text width via hidden probe
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

    // wipeLeft animation
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

    // ── entrance: slideInLeft ──────────────────────────────────────────────
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

    // ── entrance: fadeIn (no wipeRight) ───────────────────────────────────
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

    // ── entrance: wipeRight ───────────────────────────────────────────────
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

    // ── NEW: entrance animations on text ──────────────────────────────────

    const animType = item.animation?.type;

    // Exit animations
    if (animType === 'fadeOut') {
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
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.6);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().opacity(0, item.animation?.exitTime ?? 0.6);
      return;
    }

    if (animType === 'slideOutLeft') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.x(-WIDTH, item.animation?.exitTime ?? 0.55, easeInCubic);
      return;
    }

    if (animType === 'slideOutRight') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.x(WIDTH, item.animation?.exitTime ?? 0.55, easeInCubic);
      return;
    }

    if (animType === 'slideOutUp') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.y(-HEIGHT, item.animation?.exitTime ?? 0.55, easeInCubic);
      return;
    }

    if (animType === 'slideOutDown') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.y(HEIGHT, item.animation?.exitTime ?? 0.55, easeInCubic);
      return;
    }

    if (animType === 'zoomOut') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const exitTime = item.animation?.exitTime ?? 0.5;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(
        refs[item.id]().scale(0, exitTime, easeInOutBack),
        refs[item.id]().opacity(0, exitTime * 0.8)
      );
      return;
    }

    if (animType === 'shrinkOut') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const exitTime = item.animation?.exitTime ?? 0.5;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(
        refs[item.id]().scale(0, exitTime, easeInCubic),
        refs[item.id]().opacity(0, exitTime * 0.8)
      );
      return;
    }

    if (animType === 'bounceOut') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const exitTime = item.animation?.exitTime ?? 0.75;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* refs[item.id]().position.y(HEIGHT, exitTime, easeInCubic);
      return;
    }

    if (animType === 'flipOutX') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const exitTime = item.animation?.exitTime ?? 0.5;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(
        refs[item.id]().scale.x(0, exitTime, easeInOutBack),
        refs[item.id]().opacity(0, exitTime)
      );
      return;
    }

    if (animType === 'flipOutY') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const exitTime = item.animation?.exitTime ?? 0.5;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(
        refs[item.id]().scale.y(0, exitTime, easeInOutBack),
        refs[item.id]().opacity(0, exitTime)
      );
      return;
    }

    if (animType === 'spinOut') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const exitTime = item.animation?.exitTime ?? 0.7;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(
        refs[item.id]().rotation(720, exitTime, easeInCubic),
        refs[item.id]().opacity(0, exitTime),
        refs[item.id]().scale(0, exitTime, easeInCubic)
      );
      return;
    }

    if (animType === 'swirlOut') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const exitTime = item.animation?.exitTime ?? 0.6;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(
        refs[item.id]().scale(0, exitTime, easeInQuart),
        refs[item.id]().rotation(540, exitTime, easeInQuart),
        refs[item.id]().opacity(0, exitTime)
      );
      return;
    }

    if (animType === 'dissolveOut') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} />
      );
      const exitTime = item.animation?.exitTime ?? 0.3;
      const holdTime = (item.duration ?? 0) - exitTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      yield* all(
        refs[item.id]().scale.x(4, exitTime, easeInQuart),
        refs[item.id]().scale.y(0, exitTime, easeInQuart),
        refs[item.id]().opacity(0, exitTime)
      );
      return;
    }

    // Entrance: zoomIn
    if (animType === 'zoomIn') {
      const enterTime = item.animation?.enterTime ?? 0.5;
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={0} scale={0} />
      );
      yield* waitFor(0);
      yield* all(
        refs[item.id]().opacity(1, enterTime * 0.6),
        refs[item.id]().scale(1, enterTime, easeInOutBack)
      );
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }

    if (animType === 'popIn') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={0} scale={0} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y) - 520}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
      yield* waitFor(0);
      yield* refs[item.id]().position.y(toSceneY(pos.y), 0.9, easeOutBounce);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - 0.9 - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }

    if (animType === 'flipInX') {
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={0} rotation={-180} />
      );
      yield* waitFor(0);
      yield* all(
        refs[item.id]().opacity(1, enterTime * 0.4),
        refs[item.id]().rotation(0, enterTime, easeInOutBack)
      );
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }

    if (animType === 'swingIn') {
      const enterTime = item.animation?.enterTime ?? 0.65;
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={0} rotation={-90} />
      );
      yield* waitFor(0);
      yield* all(
        refs[item.id]().opacity(1, enterTime * 0.4),
        refs[item.id]().rotation(0, enterTime, easeOutElastic)
      );
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }

    if (animType === 'rollIn') {
      const enterTime = item.animation?.enterTime ?? 0.7;
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={-WIDTH} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} rotation={-360} />
      );
      yield* waitFor(0);
      yield* all(
        refs[item.id]().position.x(toSceneX(pos.x), enterTime, easeOutCubic),
        refs[item.id]().rotation(0, enterTime, easeOutCubic)
      );
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }

    if (animType === 'dropIn') {
      const enterTime = item.animation?.enterTime ?? 0.75;
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={-HEIGHT}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={HEIGHT}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={-WIDTH} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={WIDTH} y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={HEIGHT}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
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
      view.add(
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'} x={toSceneX(pos.x)} y={-HEIGHT}
          zIndex={item.zIndex ?? 1} fontFamily={fontFamily} opacity={1} />
      );
      yield* waitFor(0);
      yield* refs[item.id]().position.y(toSceneY(pos.y), enterTime, easeOutCubic);
      const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
      const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime);
      return;
    }

    // ── plain text (no animation) ──────────────────────────────────────────
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