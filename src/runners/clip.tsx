import { createRef, waitFor, all, delay, tween, easeInOutCubic, easeInOutQuart, easeOutCubic, easeOutBack, linear } from '@revideo/core';
import { Txt, Rect, Layout } from '@revideo/2d';
import { toSceneX, toSceneY } from '../utils';

export function* runClipAnimation(view: any, item: any) {
  const pos         = item.position ?? { x: 0.5, y: 0.5 };
  const tx          = toSceneX(pos.x);
  const ty          = toSceneY(pos.y);
  const fs          = item.fontSize ?? 42;
  const fill        = item.color ?? '#ffffff';
  const bgColor     = item.animation?.bgColor ?? '#6a0572';
  const duration    = item.animation?.revealTime ?? 0.8;
  const fadeOutTime = item.animation?.fadeOut?.time ?? 0;
  const animType    = item.animation?.type ?? '';

  if (['maskReveal','brushStroke','wipeAnim','curtainReveal'].includes(animType)) {
    const textRef  = createRef<Txt>();
    const clipRef  = createRef<Rect>();
    const probeRef = createRef<Txt>();
    view.add(
      <Txt ref={probeRef} text={item.text} fontSize={fs} fill={fill}
        fontFamily={item.fontFamily ?? 'Lexend'} fontWeight={700}
        position={[tx, ty]} opacity={0} zIndex={item.zIndex ?? 1} />
    );
    yield* waitFor(0);
    const measuredW = probeRef().size().x + 20;
    const measuredH = probeRef().size().y;
    probeRef().remove();

    const easeMap: Record<string, any> = {
      maskReveal: easeInOutCubic, brushStroke: easeInOutQuart,
      wipeAnim: linear, curtainReveal: easeOutBack,
    };
    view.add(
      <Layout clip position={[tx, ty]} zIndex={item.zIndex ?? 1}>
        <Rect ref={clipRef} fill={bgColor} width={0} height={measuredH * 1.1} position={[-measuredW / 2, 0]} />
        <Txt ref={textRef} text={item.text} fontSize={fs} fill={fill} fontFamily={item.fontFamily ?? 'Lexend'} fontWeight={700} />
      </Layout>
    );
    yield* clipRef().width(measuredW, duration, easeMap[animType] ?? linear);
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
    const slices      = item.animation?.slices ?? 6;
    const sliceH      = (item.animation?.areaHeight ?? 300) / slices;
    const rectW       = item.animation?.width ?? 600;
    const blindsRects = Array.from({ length: slices }, () => createRef<Rect>());
    const textRef     = createRef<Txt>();
    view.add(
      <Txt ref={textRef} text={item.text} fontSize={fs} fill={fill}
        fontFamily={item.fontFamily ?? 'Lexend'} fontWeight={700}
        position={[tx, ty]} zIndex={item.zIndex ?? 1} />
    );
    blindsRects.forEach((r, i) => {
      view.add(
        <Layout clip position={[tx, ty + i * sliceH - sliceH * (slices / 2 - 0.5)]} zIndex={(item.zIndex ?? 1) + 1}>
          <Rect ref={r} fill={bgColor} width={0} height={sliceH - 2} position={[-rectW / 2, 0]} />
        </Layout>
      );
    });
    yield* all(...blindsRects.map((r, i) => delay(i * 0.06, r().width(rectW, duration, easeOutCubic))));
    const holdTime = (item.duration ?? 0) - duration - 0.06 * slices - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) yield* textRef().opacity(0, fadeOutTime);
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
      <Txt ref={textRef} text={item.text} fontSize={fs} fill={fill}
        fontFamily={item.fontFamily ?? 'Lexend'} fontWeight={700}
        position={[tx, ty]} zIndex={item.zIndex ?? 1} />
    );
    view.add(<Rect ref={topRef} fill={color} width={rW} height={halfH} position={[tx, ty - halfH / 2]} zIndex={(item.zIndex ?? 1) + 1} />);
    view.add(<Rect ref={botRef} fill={color} width={rW} height={halfH} position={[tx, ty + halfH / 2]} zIndex={(item.zIndex ?? 1) + 1} />);
    yield* all(
      topRef().position.y(ty - halfH / 2 - halfH * 2, duration, easeInOutCubic),
      botRef().position.y(ty + halfH / 2 + halfH * 2, duration, easeInOutCubic),
    );
    const holdTime = (item.duration ?? 0) - duration - fadeOutTime;
    if (holdTime > 0) yield* waitFor(holdTime);
    if (fadeOutTime > 0) yield* textRef().opacity(0, fadeOutTime);
    return;
  }
}