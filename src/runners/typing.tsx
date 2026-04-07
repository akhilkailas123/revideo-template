import { createRef, waitFor, tween } from '@revideo/core';
import { Txt } from '@revideo/2d';
import { toSceneX, toSceneY, clamp, scramble, binaryDecode, hexDecode, morseReveal } from '../utils';

export function* runTypingAnimation(view: any, item: any) {
  const pos         = item.position ?? { x: 0.5, y: 0.5 };
  const tx          = toSceneX(pos.x);
  const ty          = toSceneY(pos.y);
  const ref         = createRef<Txt>();
  const text        = item.text ?? '';
  const animType    = item.animation?.type ?? '';
  const duration    = item.duration ?? text.length * 0.07;
  const fadeOutTime = item.animation?.fadeOut?.time ?? 0;

  view.add(
    <Txt ref={ref} text="" fontSize={item.fontSize ?? 40} fill={item.color ?? '#70a1ff'}
      fontFamily={item.fontFamily ?? "'Courier New'"} fontWeight={700}
      position={[tx, ty]} zIndex={item.zIndex ?? 1} />
  );
  yield* waitFor(0);

  if (animType === 'typewriter') {
    yield* tween(duration, v => {
      ref().text(text.slice(0, clamp(Math.floor(v * text.length), 0, text.length)));
    });
    ref().text(text);
  }
  else if (animType === 'typewriterCursor') {
    let cursorVisible = true;
    tween(duration + 1.0, v => { cursorVisible = Math.round(v * 4) % 2 === 0; });
    const typeDur = text.length * 0.07;
    yield* tween(typeDur, v => {
      const n = clamp(Math.floor((v / typeDur) * text.length), 0, text.length);
      ref().text(text.slice(0, n) + (cursorVisible ? '|' : ' '));
    });
    ref().text(text);
  }
  else if (animType === 'scrambleText' || animType === 'decodeEffect') {
    yield* tween(duration, v => { ref().text(scramble(text, v)); });
    ref().text(text);
  }
  else if (animType === 'binaryDecode') {
    ref().text(text.split('').map(() => '0').join(''));
    yield* tween(duration, v => { ref().text(binaryDecode(text, v)); });
    ref().text(text);
  }
  else if (animType === 'hexDecode') {
    ref().text(text.split('').map(() => 'F').join(''));
    yield* tween(duration, v => { ref().text(hexDecode(text, v)); });
    ref().text(text);
  }
  else if (animType === 'morseReveal') {
    ref().text(text.split('').map(() => '_').join(''));
    yield* tween(duration, v => { ref().text(morseReveal(text, v)); });
    ref().text(text);
  }
  else if (animType === 'glitchText') {
    const glitches: string[] = item.animation?.glitchVariants ?? [
      text,
      text.replace(/[aeiou]/gi, (ch: string) => Math.random() > 0.5 ? ch.toUpperCase() : '!'),
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
  if (fadeOutTime > 0) yield* ref().opacity(0, fadeOutTime);
}