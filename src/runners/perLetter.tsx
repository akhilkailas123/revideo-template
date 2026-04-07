import { createRef, waitFor, all, delay, tween, easeInOutCubic, easeOutBounce, easeOutBack, easeInOutBack, easeOutCubic } from '@revideo/core';
import { Txt } from '@revideo/2d';
import { toSceneX, toSceneY, clamp } from '../utils';

function makeLetterRefs(str: string) {
  return str.split('').map(() => createRef<Txt>());
}

function addLetters(
  view: any,
  str: string,
  refs: ReturnType<typeof makeLetterRefs>,
  opts: { x: number; y: number; fill: string; fontSize?: number; opacity?: number; spacing?: number; fontFamily?: string }
) {
  const fs = opts.fontSize  ?? 44;
  const sp = opts.spacing   ?? 32;
  const op = opts.opacity   ?? 0;
  const ff = opts.fontFamily ?? 'Lexend';
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

export function* runPerLetterAnimation(view: any, item: any, _refs: any) {
  const text: string        = item.text ?? '';
  const pos                 = item.position ?? { x: 0.5, y: 0.5 };
  const tx                  = toSceneX(pos.x);
  const ty                  = toSceneY(pos.y);
  const fs: number          = item.fontSize ?? 44;
  const sp: number          = item.letterSpacing ?? 32;
  const fill: string        = item.color ?? '#ffffff';
  const ff: string          = item.fontFamily ?? 'Lexend';
  const animType: string    = item.animation?.type ?? '';
  const duration: number    = item.duration ?? 2;
  const fadeOutTime: number = item.animation?.fadeOut?.time ?? 0;
  const PI = Math.PI;
  const TAU = PI * 2;

  const alwaysVisible = ['letterShake','letterScale','letterSwing','letterSkew','letterGlitch'];
  const letterRefs = makeLetterRefs(text);
  addLetters(view, text, letterRefs, {
    x: tx, y: ty, fill, fontSize: fs, spacing: sp, fontFamily: ff,
    opacity: alwaysVisible.includes(animType) ? 1 : 0,
  });
  yield* waitFor(0);

  if (animType === 'characterFade') {
    yield* all(...letterRefs.map((r, i) => delay(i * 0.06, r().opacity(1, 0.35))));
  }
  else if (animType === 'letterDrop') {
    letterRefs.forEach(r => { r().position.y(ty - 220); });
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.07, all(r().opacity(1, 0.15), r().position.y(ty, 0.45, easeOutBounce)))
    ));
  }
  else if (animType === 'letterBounce') {
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.07, all(
        r().opacity(1, 0.12),
        tween(0.55, v => { r().position.y(ty - 40 * Math.abs(Math.sin(v * PI * 2.5)) * (1 - v)); })
      ))
    ));
  }
  else if (animType === 'letterWave') {
    yield* all(...letterRefs.map(r => r().opacity(1, 0.2)));
    yield* tween(duration - fadeOutTime, v => {
      letterRefs.forEach((r, i) => { r().position.y(ty + 22 * Math.sin(v * PI * 4 + i * 0.5)); });
    });
  }
  else if (animType === 'letterRotate') {
    letterRefs.forEach(r => { r().rotation(-180); });
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.06, all(r().opacity(1, 0.2), r().rotation(0, 0.4, easeOutBack)))
    ));
  }
  else if (animType === 'letterZoom') {
    letterRefs.forEach(r => { r().scale(0); });
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.06, all(r().opacity(1, 0.15), r().scale(1, 0.35, easeOutBack)))
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
      delay(i * 0.07, all(r().opacity(1, 0.15), r().scale.x(1, 0.4, easeInOutBack)))
    ));
  }
  else if (animType === 'letterFloat') {
    yield* all(...letterRefs.map(r => r().opacity(1, 0.2)));
    yield* tween(duration - fadeOutTime, v => {
      letterRefs.forEach((r, i) => { r().position.y(ty + 18 * Math.sin(v * PI * 2 + i * 0.6)); });
    });
  }
  else if (animType === 'letterStagger') {
    yield* all(...letterRefs.map((r, i) =>
      delay(i * 0.1, all(r().opacity(1, 0.3), r().position.y(ty, 0.3, easeOutCubic)))
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
    letterRefs.forEach((r, i) => { r().position.x(tx + (i - text.length / 2) * sp); r().position.y(ty); });
  }
  else if (animType === 'letterScale') {
    const inTime = item.animation?.inTime ?? 2.0;
    yield* tween(inTime, v => {
      letterRefs.forEach((r, i) => { r().scale(1 + 0.35 * Math.abs(Math.sin(v * PI * 3 + i * 0.45))); });
    });
    letterRefs.forEach(r => r().scale(1));
  }
  else if (animType === 'letterSwing') {
    const inTime = item.animation?.inTime ?? 2.0;
    yield* tween(inTime, v => {
      letterRefs.forEach((r, i) => { r().rotation(20 * Math.sin(v * PI * 4 + i * 0.5) * Math.exp(-v * 1.5)); });
    });
  }
  else if (animType === 'letterSkew') {
    const inTime = item.animation?.inTime ?? 2.0;
    yield* tween(inTime, v => {
      letterRefs.forEach((r, i) => { r().skew.x(25 * Math.sin(v * PI * 3 + i * 0.4) * (1 - v * 0.5)); });
    });
    letterRefs.forEach(r => r().skew.x(0));
  }
  else if (animType === 'letterGlitch') {
    const inTime = item.animation?.inTime ?? 2.5;
    const colors = item.animation?.colors ?? ['#ff4757', '#ffffff', '#2ed573'];
    yield* tween(inTime, () => {
      letterRefs.forEach((r, i) => {
        const g = Math.random() > 0.7;
        r().position.x(tx + (i - text.length / 2) * sp + (g ? (Math.random() - 0.5) * 20 : 0));
        r().position.y(ty + (g ? (Math.random() - 0.5) * 20 : 0));
        r().fill(g ? colors[Math.floor(Math.random() * colors.length)] : fill);
      });
    });
    letterRefs.forEach((r, i) => { r().position.x(tx + (i - text.length / 2) * sp); r().position.y(ty); r().fill(fill); });
  }

  if (animType !== 'letterWave' && animType !== 'letterFloat') {
    const inTime = item.animation?.inTime ?? 0;
    const holdTime = duration - inTime - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
  }
  if (fadeOutTime > 0) {
    yield* all(...letterRefs.map(r =>
      tween(fadeOutTime, v => { r().opacity(1 - easeInOutCubic(v)); })
    ));
    letterRefs.forEach(r => r().opacity(0));
  }
}