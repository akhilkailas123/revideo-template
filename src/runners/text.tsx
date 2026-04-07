import { createRef, waitFor, tween, all, easeInOutCubic, easeInCubic, easeOutCubic, easeOutBounce, easeInOutBack, easeOutBack, easeOutElastic, easeInQuart } from '@revideo/core';
import { Txt, Rect, Layout } from '@revideo/2d';
import { toSceneX, toSceneY, WIDTH, HEIGHT } from '../utils';

// Shared Txt props used in many branches
function baseTxtProps(item: any, pos: any, extra: Record<string, any> = {}) {
  const fontFamily: string | undefined = item.fontFamily ?? undefined;
  const lineHeight: number = item.lineHeight ?? 300;
  const letterSpacing: number = item.letterSpacing ?? 0;
  const skewX: number = item.skewX ?? 0;
  const skewY: number = item.skewY ?? 0;
  const textWidth: number | undefined = item.width ?? undefined;
  const textWrap: boolean | 'pre' | 'balance' = item.textWrap ?? true;
  const rotation: number = item.rotation ?? 0;
  const textAlign: 'left' | 'center' | 'right' = item.textAlign ?? 'center';
  return {
    text: item.text, fontSize: item.fontSize ?? 80,
    fill: item.color ?? 'white',
    x: toSceneX(pos.x), y: toSceneY(pos.y),
    zIndex: item.zIndex ?? 1, fontFamily,
    lineHeight, letterSpacing, skewX, skewY,
    width: textWidth, textWrap, rotation, textAlign,
    ...extra,
  };
}

export function* runTextLayer(view: any, item: any, refs: any) {
  refs[item.id] = createRef<Txt>();
  const pos         = item.position ?? { x: 0.5, y: 0.5 };
  const tx          = toSceneX(pos.x);
  const ty          = toSceneY(pos.y);
  const textAlign: 'left' | 'center' | 'right' = item.textAlign ?? 'center';
  const fontFamily: string | undefined = item.fontFamily ?? undefined;
  const lineHeight: number = item.lineHeight ?? 300;
  const letterSpacing: number = item.letterSpacing ?? 0;
  const skewX: number = item.skewX ?? 0;
  const skewY: number = item.skewY ?? 0;
  const textWidth: number | undefined = item.width ?? undefined;
  const textWrap: boolean | 'pre' | 'balance' = item.textWrap ?? true;
  const rotation: number = item.rotation ?? 0;
  const wipeRight   = item.animation?.wipeRight;
  const slideInLeft = item.animation?.slideInLeft;
  const fadeIn      = item.animation?.fadeIn;
  const fadeOut     = item.animation?.fadeOut;
  const animType    = item.animation?.type;
  const W = WIDTH(), H = HEIGHT();

  // ── slideInLeft shorthand ─────────────────────────────────────────────────
  if (slideInLeft) {
    const slideTime   = slideInLeft.time ?? 0.2;
    const fadeOutTime = fadeOut?.time ?? 0;
    const startX      = W / 2 + 200;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { x: startX, opacity: 0 })} />);
    yield* waitFor(0);
    yield* tween(slideTime, v => { const e = easeInOutCubic(v); refs[item.id]().x(startX + (tx - startX) * e); refs[item.id]().opacity(e); });
    refs[item.id]().x(tx); refs[item.id]().opacity(1);
    const holdTime = (item.duration ?? 0) - slideTime - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) { yield* tween(fadeOutTime, v => { refs[item.id]().opacity(1 - easeInOutCubic(v)); }); refs[item.id]().opacity(0); }
    return;
  }

  // ── fadeIn (no wipeRight, no slideInLeft) ────────────────────────────────
  if (fadeIn && !wipeRight) {
    const fadeInTime  = fadeIn.time ?? 0.3;
    const fadeOutTime = fadeOut?.time ?? 0;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { opacity: 0 })} />);
    yield* waitFor(0); yield* waitFor(0);
    yield* tween(fadeInTime, v => { refs[item.id]().opacity(easeInOutCubic(v)); });
    refs[item.id]().opacity(1);
    const holdTime = (item.duration ?? 0) - fadeInTime - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) { yield* tween(fadeOutTime, v => { refs[item.id]().opacity(1 - easeInOutCubic(v)); }); refs[item.id]().opacity(0); }
    return;
  }

  // ── wipeRight ────────────────────────────────────────────────────────────
  if (wipeRight) {
    const maskRef     = createRef<Rect>();
    const probeRef    = createRef<Txt>();
    const withFade    = !!fadeIn;
    const fadeOutTime = fadeOut?.time ?? 0;
    view.add(<Txt ref={probeRef} {...baseTxtProps(item, pos, { opacity: 0 })} />);
    yield* waitFor(0);
    const realW = probeRef().size().x;
    const realH = probeRef().size().y;
    view.add(
      <Rect ref={maskRef} x={tx - realW / 2} y={ty} width={0} height={realH * 1.1}
        clip={true} zIndex={item.zIndex ?? 1} opacity={withFade ? 0 : 1}>
        <Txt ref={refs[item.id]} text={item.text} fontSize={item.fontSize ?? 80} fill={item.color ?? 'white'}
          x={realW / 2} y={0} textAlign={textAlign} fontFamily={fontFamily}
          lineHeight={lineHeight} letterSpacing={letterSpacing} skewX={skewX} skewY={skewY}
          width={textWidth} textWrap={textWrap} rotation={rotation} />
      </Rect>
    );
    probeRef().remove();
    const revealTime = wipeRight.time ?? 0.9;
    yield* tween(revealTime, v => {
      const e = easeInOutCubic(v); const w = realW * e;
      maskRef().x(tx - realW / 2 + w / 2); maskRef().width(w);
      refs[item.id]().x(tx - (tx - realW / 2 + w / 2));
      if (withFade) maskRef().opacity(e);
    });
    maskRef().opacity(1);
    const holdTime = (item.duration ?? 0) - revealTime - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) { yield* tween(fadeOutTime, v => { maskRef().opacity(1 - easeInOutCubic(v)); }); maskRef().opacity(0); }
    return;
  }

  // ── Exit-only animations (text appears immediately, then exits) ───────────
  if (animType === 'fadeOut') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.6);
    if (holdTime > 0) yield* waitFor(holdTime);
    yield* refs[item.id]().opacity(0, item.animation?.exitTime ?? 0.6); return;
  }
  if (animType === 'slideOutLeft') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
    if (holdTime > 0) yield* waitFor(holdTime);
    yield* refs[item.id]().position.x(-W, item.animation?.exitTime ?? 0.55, easeInCubic); return;
  }
  if (animType === 'slideOutRight') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
    if (holdTime > 0) yield* waitFor(holdTime);
    yield* refs[item.id]().position.x(W, item.animation?.exitTime ?? 0.55, easeInCubic); return;
  }
  if (animType === 'slideOutUp') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
    if (holdTime > 0) yield* waitFor(holdTime);
    yield* refs[item.id]().position.y(-H, item.animation?.exitTime ?? 0.55, easeInCubic); return;
  }
  if (animType === 'slideOutDown') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const holdTime = (item.duration ?? 0) - (item.animation?.exitTime ?? 0.55);
    if (holdTime > 0) yield* waitFor(holdTime);
    yield* refs[item.id]().position.y(H, item.animation?.exitTime ?? 0.55, easeInCubic); return;
  }
  if (animType === 'zoomOut') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.5;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* all(refs[item.id]().scale(0, exitTime, easeInOutBack), refs[item.id]().opacity(0, exitTime * 0.8)); return;
  }
  if (animType === 'shrinkOut') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.5;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* all(refs[item.id]().scale(0, exitTime, easeInCubic), refs[item.id]().opacity(0, exitTime * 0.8)); return;
  }
  if (animType === 'bounceOut') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.75;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* refs[item.id]().position.y(H, exitTime, easeInCubic); return;
  }
  if (animType === 'flipOutX') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.5;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* all(refs[item.id]().scale.x(0, exitTime, easeInOutBack), refs[item.id]().opacity(0, exitTime)); return;
  }
  if (animType === 'flipOutY') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.5;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* all(refs[item.id]().scale.y(0, exitTime, easeInOutBack), refs[item.id]().opacity(0, exitTime)); return;
  }
  if (animType === 'spinOut') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.7;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* all(refs[item.id]().rotation(720, exitTime, easeInCubic), refs[item.id]().opacity(0, exitTime), refs[item.id]().scale(0, exitTime, easeInCubic)); return;
  }
  if (animType === 'swirlOut') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.6;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* all(refs[item.id]().scale(0, exitTime, easeInQuart), refs[item.id]().rotation(540, exitTime, easeInQuart), refs[item.id]().opacity(0, exitTime)); return;
  }
  if (animType === 'dissolveOut') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.8;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* tween(exitTime, v => { refs[item.id]().opacity(v > 0.9 ? 0 : (Math.random() > v ? 1 : 0)); });
    refs[item.id]().opacity(0); return;
  }
  if (animType === 'scatterOut') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
    const exitTime = item.animation?.exitTime ?? 0.3;
    if ((item.duration ?? 0) - exitTime > 0) yield* waitFor((item.duration ?? 0) - exitTime);
    yield* all(refs[item.id]().scale.x(4, exitTime, easeInQuart), refs[item.id]().scale.y(0, exitTime, easeInQuart), refs[item.id]().opacity(0, exitTime)); return;
  }

  // ── Enter animations ──────────────────────────────────────────────────────
  if (animType === 'zoomIn') {
    const enterTime   = item.animation?.enterTime ?? 0.5;
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { opacity: 0, scale: 0 })} />);
    yield* waitFor(0);
    yield* all(refs[item.id]().opacity(1, enterTime * 0.6), refs[item.id]().scale(1, enterTime, easeInOutBack));
    const holdTime = (item.duration ?? 0) - enterTime - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'popIn') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { opacity: 0, scale: 0 })} />);
    yield* waitFor(0);
    yield* all(refs[item.id]().opacity(1, 0.1), refs[item.id]().scale(1.5, 0.14, easeOutCubic));
    yield* refs[item.id]().scale(1, 0.2, easeInOutCubic);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    const holdTime = (item.duration ?? 0) - 0.34 - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'bounceIn') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { y: toSceneY(pos.y) - 520, opacity: 1 })} />);
    yield* waitFor(0);
    yield* refs[item.id]().position.y(ty, 0.9, easeOutBounce);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - 0.9 - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - 0.9 - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'flipInX') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { opacity: 1 })} />);
    refs[item.id]().scale.x(0); yield* waitFor(0);
    yield* refs[item.id]().scale.x(1, 0.55, easeInOutBack);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - 0.55 - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - 0.55 - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'flipInY') {
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { opacity: 1 })} />);
    refs[item.id]().scale.y(0); yield* waitFor(0);
    yield* refs[item.id]().scale.y(1, 0.55, easeInOutBack);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - 0.55 - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - 0.55 - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'rotateIn') {
    const enterTime = item.animation?.enterTime ?? 0.7;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { opacity: 0, rotation: -180 })} />);
    yield* waitFor(0);
    yield* all(refs[item.id]().opacity(1, enterTime * 0.4), refs[item.id]().rotation(0, enterTime, easeInOutBack));
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'swingIn') {
    const enterTime = item.animation?.enterTime ?? 0.65;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { opacity: 0, rotation: -90 })} />);
    yield* waitFor(0);
    yield* all(refs[item.id]().opacity(1, enterTime * 0.4), refs[item.id]().rotation(0, enterTime, easeOutElastic));
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'rollIn') {
    const enterTime = item.animation?.enterTime ?? 0.7;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { x: -W, opacity: 1, rotation: -360 })} />);
    yield* waitFor(0);
    yield* all(refs[item.id]().position.x(tx, enterTime, easeOutCubic), refs[item.id]().rotation(0, enterTime, easeOutCubic));
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'dropIn') {
    const enterTime = item.animation?.enterTime ?? 0.75;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { y: -H, opacity: 1 })} />);
    yield* waitFor(0);
    yield* refs[item.id]().position.y(ty, enterTime, easeOutBounce);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'riseIn') {
    const enterTime = item.animation?.enterTime ?? 0.7;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { y: H, opacity: 1 })} />);
    yield* waitFor(0);
    yield* refs[item.id]().position.y(ty, enterTime, easeOutCubic);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'slideInLeft') {
    const enterTime = item.animation?.enterTime ?? 0.55;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { x: -W, opacity: 1 })} />);
    yield* waitFor(0);
    yield* refs[item.id]().position.x(tx, enterTime, easeOutCubic);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'slideInRight') {
    const enterTime = item.animation?.enterTime ?? 0.55;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { x: W, opacity: 1 })} />);
    yield* waitFor(0);
    yield* refs[item.id]().position.x(tx, enterTime, easeOutCubic);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'slideInUp') {
    const enterTime = item.animation?.enterTime ?? 0.55;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { y: H, opacity: 1 })} />);
    yield* waitFor(0);
    yield* refs[item.id]().position.y(ty, enterTime, easeOutCubic);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }
  if (animType === 'slideInDown') {
    const enterTime = item.animation?.enterTime ?? 0.55;
    view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos, { y: -H, opacity: 1 })} />);
    yield* waitFor(0);
    yield* refs[item.id]().position.y(ty, enterTime, easeOutCubic);
    const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
    if ((item.duration ?? 0) - enterTime - fadeOutTime > 0) yield* waitFor((item.duration ?? 0) - enterTime - fadeOutTime);
    if (fadeOutTime > 0) yield* refs[item.id]().opacity(0, fadeOutTime); return;
  }

  // ── Default: static text ──────────────────────────────────────────────────
  view.add(<Txt ref={refs[item.id]} {...baseTxtProps(item, pos)} />);
}