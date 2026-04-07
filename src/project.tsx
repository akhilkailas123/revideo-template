import { makeProject, waitFor, createRef, all, tween, easeInOutCubic } from '@revideo/core';
import { makeScene2D, Img, Video, Audio, Txt, Rect } from '@revideo/2d';
import rawConfig from './video.config.json';
import type { VideoConfig } from './types';
import './global.css';

import { initDimensions, toSceneX, toSceneY, WIDTH, HEIGHT } from './utils';
import { runPerLetterAnimation } from './runners/perLetter';
import { runColourAnimation }    from './runners/colour';
import { runClipAnimation }      from './runners/clip';
import { runTypingAnimation }    from './runners/typing';
import { runAttentionAnimation } from './runners/attention';
import { runThreeJsLayer }       from './runners/threejs';
import { runCubeScene }          from './runners/cubeScene';
import { runTextLayer }          from './runners/text';

// Cast to VideoConfig so TS never infers a narrow literal type from the JSON
const config = rawConfig as unknown as VideoConfig;

// Initialise shared dimensions once from config
initDimensions(config.settings.size.x, config.settings.size.y);

// ─── Main scene ──────────────────────────────────────────────────────────────
const scene = makeScene2D('scene', function* (view) {
  const refs: Record<string, any> = {};
  const tasks = config.timeline.map((item: any) => runLayer(view, item, refs));
  yield* all(...tasks);
});

// ─── Layer dispatcher ─────────────────────────────────────────────────────────
function* runLayer(view: any, item: any, refs: any) {
  yield* waitFor(item.start ?? 0);

  if (item.type === 'cube-scene') { yield* runCubeScene(view, item); return; }
  if (item.type === 'threejs')    { yield* runThreeJsLayer(view, item); return; }

  // ── VIDEO ────────────────────────────────────────────────────────────────
  if (item.type === 'video') {
    refs[item.id] = createRef<Video>();
    const prevVideoId   = item.prevVideoId ?? null;
    const transition    = item.transition ?? null;
    const transType     = transition?.type ?? 'none';
    const transDuration = transition?.duration ?? 1;
    const zIdx          = item.zIndex ?? 0;
    const W             = WIDTH();
    if (transType === 'fade') {
      view.add(<Video ref={refs[item.id]} src={item.src} play size={['100%','100%']} opacity={0} zIndex={zIdx} />);
      yield* refs[item.id]().opacity(1, transDuration);
      const holdTime = (item.duration ?? 0) - transDuration;
      if (holdTime > 0) yield* waitFor(holdTime);
      return;
    }
    if (transType === 'swipe-left-blur') {
      const inRef  = refs[item.id];
      const outRef = prevVideoId ? refs[prevVideoId] : null;
      view.add(<Video ref={inRef} src={item.src} play size={['100%','100%']} x={W} zIndex={zIdx + 1} />);
      yield* waitFor(0);
      yield* tween(transDuration, v => {
        const ease = easeInOutCubic(v); const blur = 40 * Math.sin(Math.PI * v);
        inRef().x(W * (1 - ease)); inRef().filters([{ type: 'blur', radius: blur }] as any);
        if (outRef) { outRef().x(-W * ease); outRef().filters([{ type: 'blur', radius: blur }] as any); }
      });
      inRef().x(0); inRef().filters([]);
      if (outRef) outRef().filters([]);
      const holdTime = (item.duration ?? 0) - transDuration;
      if (holdTime > 0) yield* waitFor(holdTime);
      return;
    }
    view.add(<Video ref={refs[item.id]} src={item.src} play size={['100%','100%']} zIndex={zIdx} />);
    if (item.duration) yield* waitFor(item.duration);
    return;
  }

  // ── AUDIO ────────────────────────────────────────────────────────────────
  if (item.type === 'audio') {
    view.add(<Audio src={item.src} play time={item.offset ?? 0} />);
  }

  // ── IMAGE ────────────────────────────────────────────────────────────────
  if (item.type === 'image') {
    refs[item.id] = createRef<Img>();
    const pos         = item.position ?? { x: 0.5, y: 0.5 };
    const rawX        = toSceneX(pos.x);
    const rawY        = toSceneY(pos.y);
    const imgWidth    = item.width ?? 200;
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    const wipeLeft    = item.animation?.wipeLeft;
    if (wipeLeft) {
      const probeRef = createRef<Img>();
      const maskRef  = createRef<Rect>();
      const wipeTime = wipeLeft.time ?? 0.9;
      view.add(<Img ref={probeRef} src={item.src} width={imgWidth} x={rawX} y={rawY} opacity={0} zIndex={item.zIndex ?? 1} />);
      yield* waitFor(0);
      const realW = probeRef().size().x; const realH = probeRef().size().y;
      view.add(
        <Rect ref={maskRef} x={rawX + realW / 2} y={rawY} width={0} height={realH * 1.05} clip={true} zIndex={item.zIndex ?? 1}>
          <Img ref={refs[item.id]} src={item.src} width={imgWidth} x={-realW / 2} y={0} />
        </Rect>
      );
      probeRef().remove();
      yield* tween(wipeTime, v => {
        const ease = easeInOutCubic(v); const w = realW * ease;
        maskRef().x(rawX + realW / 2 - w / 2); maskRef().width(w);
        refs[item.id]().x(-realW / 2 + (realW - w) / 2);
      });
      maskRef().x(rawX); maskRef().width(realW); refs[item.id]().x(0);
      const holdTime = (item.duration ?? 0) - wipeTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) { yield* tween(fadeOutTime, v => { maskRef().opacity(1 - easeInOutCubic(v)); }); maskRef().opacity(0); }
      return;
    }
    const startOpacity = item.animation?.fadeIn ? 0 : 1;
    const fadeInTime   = item.animation?.fadeIn?.time ?? 0;
    view.add(<Img ref={refs[item.id]} src={item.src} width={imgWidth} x={rawX} y={rawY} opacity={startOpacity} zIndex={item.zIndex ?? 1} />);
    if (item.animation) {
      yield* waitFor(0);
      if (fadeInTime > 0) { yield* tween(fadeInTime, v => { refs[item.id]().opacity(easeInOutCubic(v)); }); refs[item.id]().opacity(1); }
      const holdTime = (item.duration ?? 0) - fadeInTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      if (fadeOutTime > 0) { yield* tween(fadeOutTime, v => { refs[item.id]().opacity(1 - easeInOutCubic(v)); }); refs[item.id]().opacity(0); }
    }
  }

  // ── TEXT ─────────────────────────────────────────────────────────────────
  if (item.type === 'text') { yield* runTextLayer(view, item, refs); return; }

  // ── TYPED / DECODE ────────────────────────────────────────────────────────
  if (item.type === 'per-letter-text') { yield* runPerLetterAnimation(view, item, refs); return; }
  if (item.type === 'attention-text')  { yield* runAttentionAnimation(view, item); return; }
  if (item.type === 'typing-text')     { yield* runTypingAnimation(view, item); return; }
  if (item.type === 'colour-text')     { yield* runColourAnimation(view, item); return; }
  if (item.type === 'clip-text')       { yield* runClipAnimation(view, item); return; }

  // ── SCROLL TEXT ──────────────────────────────────────────────────────────
  if (item.type === 'scroll-text') {
    const lines: string[]    = item.lines ?? [];
    const fontSize: number   = item.fontSize ?? 50;
    const lineHeight: number = item.lineHeight ?? Math.round(fontSize * 1.6);
    const color: string      = item.color ?? '#ffffff';
    const fontFamily         = item.fontFamily ?? undefined;
    const area               = item.scrollArea ?? { x: 0.5, y: 0.5, width: 0.4, height: 0.6 };
    const areaX = toSceneX(area.x); const areaY = toSceneY(area.y);
    const areaW = area.width * WIDTH(); const areaH = area.height * HEIGHT();
    const lineRefs: any[] = lines.map(() => createRef<Txt>());
    const initYs = lines.map((_: any, i: number) => areaH / 2 - lineHeight / 2 + (i + 1) * lineHeight);
    view.add(
      <Rect x={areaX} y={areaY} width={areaW} height={areaH} clip={true} zIndex={item.zIndex ?? 2}>
        {lines.map((line: string, i: number) => (
          <Txt ref={lineRefs[i]} key={String(i)} text={line === '' ? ' ' : line}
            fontSize={fontSize} fontFamily={fontFamily} lineHeight={lineHeight}
            fill={line === '' ? '#00000000' : color}
            textAlign={item.textAlign ?? 'center'} width={areaW} x={0} y={initYs[i]} />
        ))}
      </Rect>
    );
    yield* waitFor(0);
    const scrollDist = areaH + lineHeight + lines.length * lineHeight;
    yield* tween(item.duration ?? 10, value => {
      const offset = scrollDist * value;
      lineRefs.forEach((ref: any, i: number) => { ref().y(initYs[i] - offset); });
    });
    return;
  }

  if (item.duration) yield* waitFor(item.duration);
}

export default makeProject({
  scenes: [scene],
  settings: { shared: { size: config.settings.size } },
});