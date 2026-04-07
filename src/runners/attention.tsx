import { createRef, waitFor, tween, all, easeInOutCubic, easeInOutBack, easeOutElastic } from '@revideo/core';
import { Txt } from '@revideo/2d';
import { toSceneX, toSceneY, clamp, lerp } from '../utils';

export function* runAttentionAnimation(view: any, item: any) {
  const pos         = item.position ?? { x: 0.5, y: 0.5 };
  const tx          = toSceneX(pos.x);
  const ty          = toSceneY(pos.y);
  const ref         = createRef<Txt>();
  const animType    = item.animation?.type ?? '';
  const PI          = Math.PI;
  const duration    = item.animation?.duration ?? item.duration ?? 2.0;
  const fadeOutTime = item.animation?.fadeOut?.time ?? 0;

  view.add(
    <Txt ref={ref} text={item.text} fontSize={item.fontSize ?? 44}
      fill={item.color ?? '#ffffff'} fontFamily={item.fontFamily ?? 'Lexend'}
      fontWeight={700} position={[tx, ty]} zIndex={item.zIndex ?? 1} />
  );
  yield* waitFor(0);

  if (animType === 'pulse') {
    const amp = item.animation?.amplitude ?? 0.22;
    yield* tween(duration, v => { ref().scale(1 + amp * Math.sin(v * PI * 6)); });
    ref().scale(1);
  }
  else if (animType === 'blink') {
    yield* tween(duration, v => { ref().opacity(Math.round(v * 8) % 2 === 0 ? 1 : 0); });
    ref().opacity(1);
  }
  else if (animType === 'flash') {
    const colors: string[] = item.animation?.colors ?? ['#2ed573','#ffffff','#ff4757','#ffd700'];
    yield* tween(duration, v => {
      ref().fill(colors[clamp(Math.floor(v * (colors.length - 1)), 0, colors.length - 1)]);
      ref().scale(1 + 0.1 * Math.abs(Math.sin(v * PI * 9)));
    });
    ref().fill(item.color ?? '#2ed573'); ref().scale(1);
  }
  else if (animType === 'flicker') {
    yield* tween(duration, v => { ref().opacity(Math.random() > 0.3 + 0.4 * v ? 1 : 0.04); });
    ref().opacity(1);
  }
  else if (animType === 'wave') {
    const amp = item.animation?.amplitude ?? 30;
    yield* tween(duration, v => { ref().position.y(ty + amp * Math.sin(v * PI * 4)); });
    ref().position.y(ty);
  }
  else if (animType === 'float') {
    const amp = item.animation?.amplitude ?? 14;
    yield* tween(duration, v => { ref().position.y(ty + amp * Math.sin(v * PI * 2)); });
    ref().position.y(ty);
  }
  else if (animType === 'shake') {
    const amp = item.animation?.amplitude ?? 12;
    yield* tween(duration, v => { ref().position.x(tx + amp * Math.sin(v * PI * 20)); });
    ref().position.x(tx);
  }
  else if (animType === 'wobble') {
    yield* tween(duration, v => { ref().rotation(18 * Math.sin(v * PI * 5) * (1 - v)); });
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
    yield* tween(duration, v => { ref().scale(1 + 0.35 * Math.abs(Math.sin(v * PI * 4))); });
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
    yield* tween(duration, v => { ref().rotation(22 * Math.sin(v * PI * 5) * Math.exp(-v * 2)); });
    ref().rotation(0);
  }
  else if (animType === 'tada') {
    yield* tween(0.4, v => { ref().scale(lerp(1, 0.9, v)); ref().rotation(lerp(0, -3, v)); });
    yield* tween(0.4, v => { ref().scale(lerp(0.9, 1.1, v)); ref().rotation(lerp(-3, 3, v)); });
    yield* tween(0.25, v => { ref().scale(lerp(1.1, 1, v)); ref().rotation(lerp(3, 0, v)); });
  }
  else if (animType === 'headShake') {
    yield* tween(duration, v => {
      ref().position.x(tx + 18 * Math.sin(v * PI * 6));
      ref().rotation(-6 * Math.sin(v * PI * 6));
    });
    ref().position.x(tx); ref().rotation(0);
  }
  else if (animType === 'spin') {
    const rotations = item.animation?.rotations ?? 1;
    yield* ref().rotation(360 * rotations, duration, easeInOutCubic);
    ref().rotation(0);
  }
  else if (animType === 'vibrate') {
    const amp = item.animation?.amplitude ?? 7;
    yield* tween(duration, () => {
      ref().position.x(tx + (Math.random() - 0.5) * amp * 2);
      ref().position.y(ty + (Math.random() - 0.5) * amp * 2);
    });
    ref().position([tx, ty]);
  }

  const holdTime = (item.duration ?? 0) - duration - fadeOutTime;
  if (holdTime > 0) yield* waitFor(holdTime);
  if (fadeOutTime > 0) yield* ref().opacity(0, fadeOutTime);
}