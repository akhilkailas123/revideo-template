import { createRef, waitFor, tween } from '@revideo/core';
import { Txt } from '@revideo/2d';
import { toSceneX, toSceneY } from '../utils';

export function* runColourAnimation(view: any, item: any) {
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
    const rainbow = item.animation?.colors ?? ['#ff0000','#ff7700','#ffff00','#00ff00','#0000ff','#8b00ff'];
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
    const cycle = item.animation?.colors ?? ['#ff6b6b','#feca57','#48dbfb','#ff9ff3','#54a0ff','#5f27cd','#00d2d3','#ff9f43','#ee5a24','#9980fa'];
    yield* tween(duration, v => {
      const idx = Math.floor(v * cycle.length * 2) % cycle.length;
      ref().fill(cycle[idx]);
    });
  }
  else if (animType === 'gradientShift') {
    const grad = item.animation?.colorPairs ?? [['#ff6348','#ff4757'],['#ffd700','#ff8c00'],['#00cec9','#0984e3'],['#a29bfe','#6c5ce7']];
    yield* tween(duration, v => {
      const pair = grad[Math.floor(v * grad.length * 2) % grad.length];
      ref().fill(pair[Math.round(v * 20) % 2]);
      ref().scale.x(1 + 0.08 * Math.sin(v * PI * 5));
    });
  }
}