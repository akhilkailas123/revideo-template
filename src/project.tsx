import {
  makeProject,
  all,
  waitFor,
  createRef,
  linear,
  easeInOutCubic,
} from '@revideo/core';

import {
  Audio,
  Img,
  Length,
  makeScene2D,
  Txt,
  Video,
  Rect,
  Layout,
} from '@revideo/2d';

import rawConfig from './video.config.json';
import type {
  VideoConfig,
  VideoItem,
  AudioItem,
  ImageItem,
  TextItem,
  RectItem,
  Animation,
  Transition,
  OpacityKeyframe,
} from './config.types';

const config = rawConfig as VideoConfig;
const CW = config.settings.size.x;
const CH = config.settings.size.y;

function* animateOpacity(ref: any, kfs: OpacityKeyframe[]) {
  if (!kfs?.length) return;
  const sorted = [...kfs].sort((a, b) => a.time - b.time);
  ref().opacity(sorted[0].value);
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].time - sorted[i].time;
    if (gap > 0) yield* ref().opacity(sorted[i + 1].value, gap, linear);
  }
}

function transitionInitPos(
  finalX: number,
  finalY: number,
  t: Transition
): [number, number] {
  switch (t.type) {
    case 'crossFade': return [finalX, finalY];
    case 'wipeRight': return [finalX - CW, finalY];
    case 'wipeLeft':  return [finalX + CW, finalY];
    case 'wipeUp':    return [finalX, finalY + CH];
    case 'wipeDown':  return [finalX, finalY - CH];
    default:          return [finalX, finalY];
  }
}

function* runTransitionMove(
  ref: any,
  finalX: number,
  finalY: number,
  t: Transition
) {
  if (t.delay && t.delay > 0) yield* waitFor(t.delay);
  const d = t.duration;
  switch (t.type) {
    case 'crossFade':
      ref().opacity(0);
      yield* ref().opacity(1, d, linear);
      break;
    case 'wipeRight':
    case 'wipeLeft':
      yield* ref().x(finalX, d, easeInOutCubic);
      break;
    case 'wipeUp':
    case 'wipeDown':
      yield* ref().y(finalY, d, easeInOutCubic);
      break;
  }
}

function* runAnimation(ref: any, anim: Animation) {
  if (anim.delay && anim.delay > 0) yield* waitFor(anim.delay);
  switch (anim.type) {
    case 'scale':
      yield* ref().scale(anim.to as number, anim.duration, easeInOutCubic);
      break;
    case 'rotation':
      yield* ref().rotation(anim.to as number, anim.duration, easeInOutCubic);
      break;
    case 'opacity':
      yield* ref().opacity(anim.to as number, anim.duration, linear);
      break;
    case 'position': {
      const to = anim.to as { x: number; y: number };
      if (anim.from) ref().position([(anim.from as any).x, (anim.from as any).y]);
      yield* ref().position([to.x, to.y], anim.duration, easeInOutCubic);
      break;
    }
  }
}

function* runVideo(view: any, item: VideoItem) {
  const ref    = createRef<Video>();
  const finalX = item.position.x;
  const finalY = item.position.y;
  const initOp = item.transition?.type === 'crossFade' ? 0
               : (item.opacityKeyframes?.[0]?.value ?? item.opacity ?? 1);
  const [initX, initY] = item.transition
    ? transitionInitPos(finalX, finalY, item.transition)
    : [finalX, finalY];

  if (item.startTime > 0) yield* waitFor(item.startTime);

  yield view.add(
    <Video
      ref={ref}
      src={item.src}
      size={[item.size.width as Length, (item.size.height ?? item.size.width) as Length]}
      position={[initX, initY]}
      opacity={initOp}
      loop={item.loop ?? false}
      play={item.play ?? true}
    />
  );

  const tasks: Generator[] = [];
  if (item.transition)               tasks.push(runTransitionMove(ref, finalX, finalY, item.transition));
  if (item.opacityKeyframes?.length) tasks.push(animateOpacity(ref, item.opacityKeyframes));
  if (item.animations?.length)       tasks.push(...item.animations.map(a => runAnimation(ref, a)));
  if (!tasks.length)                 tasks.push(waitFor(item.duration));

  yield* all(...tasks);
  ref().remove();
}

function* runAudio(view: any, item: AudioItem) {
  const ref = createRef<Audio>();
  if (item.startTime > 0) yield* waitFor(item.startTime);
  yield view.add(
    <Audio ref={ref} src={item.src} play={item.play ?? true}
           time={item.audioStartTime ?? 0} volume={item.volume ?? 1} />
  );
  yield* waitFor(item.duration);
  ref().remove();
}

function* runImage(view: any, item: ImageItem) {
  const ref    = createRef<Img>();
  const initOp = item.transition?.type === 'crossFade' ? 0
               : (item.opacityKeyframes?.[0]?.value ?? item.opacity ?? 1);
  const finalX = item.kenBurns
    ? item.kenBurns.startLeft + item.kenBurns.startWidth  / 2 - CW / 2
    : item.position.x;
  const finalY = item.kenBurns
    ? item.kenBurns.startTop  + item.kenBurns.startHeight / 2 - CH / 2
    : item.position.y;
  const [initX, initY] = item.transition
    ? transitionInitPos(finalX, finalY, item.transition)
    : [finalX, finalY];

  if (item.startTime > 0) yield* waitFor(item.startTime);

  yield view.add(
    <Img
      ref={ref}
      src={item.src}
      width={item.size.width as Length}
      height={(item.size.height ?? item.size.width) as Length}
      position={[initX, initY]}
      opacity={initOp}
      rotation={item.rotation ?? 0}
    />
  );

  const tasks: Generator[] = [];
  if (item.transition)               tasks.push(runTransitionMove(ref, finalX, finalY, item.transition));
  if (item.opacityKeyframes?.length) tasks.push(animateOpacity(ref, item.opacityKeyframes));
  if (item.animations?.length)       tasks.push(...item.animations.map(a => runAnimation(ref, a)));
  if (item.kenBurns) {
    const kb   = item.kenBurns;
    const endX = kb.endLeft + kb.endWidth  / 2 - CW / 2;
    const endY = kb.endTop  + kb.endHeight / 2 - CH / 2;
    tasks.push((function* () { yield* ref().position([endX, endY], item.duration, linear); })());
  }
  if (!tasks.length) tasks.push(waitFor(item.duration));

  yield* all(...tasks);
  ref().remove();
}

function* runText(view: any, item: TextItem) {
  const ref    = createRef<Txt>();
  const initOp = item.transition?.type === 'crossFade' ? 0
               : (item.opacityKeyframes?.[0]?.value ?? item.opacity ?? 1);
  const finalX = item.position.x;
  const finalY = item.position.y;
  const [initX, initY] = item.transition
    ? transitionInitPos(finalX, finalY, item.transition)
    : [finalX, finalY];

  if (item.startTime > 0) yield* waitFor(item.startTime);

  yield view.add(
    <Txt
      ref={ref}
      text={item.text}
      fontSize={item.fontSize ?? 46}
      fontFamily={item.fontFamily ?? 'Arial'}
      fill={item.fill ?? '#ffffff'}
      width={(item.size?.width ?? 1200) as Length}
      textAlign={item.textAlign ?? 'left'}
      position={[initX, initY]}
      opacity={initOp}
      rotation={item.rotation ?? 0}
      lineHeight={item.lineHeight ?? 1.2}
      letterSpacing={item.letterSpacing ?? 0}
    />
  );

  const tasks: Generator[] = [];
  if (item.transition)               tasks.push(runTransitionMove(ref, finalX, finalY, item.transition));
  if (item.opacityKeyframes?.length) tasks.push(animateOpacity(ref, item.opacityKeyframes));
  if (item.animations?.length)       tasks.push(...item.animations.map(a => runAnimation(ref, a)));
  if (!tasks.length)                 tasks.push(waitFor(item.duration));

  yield* all(...tasks);
  ref().remove();
}

function* runScrollText(view: any, item: TextItem) {
  const kb       = item.kenBurns!;
  const fontSize = item.fontSize ?? 58;
  const lhMult   = item.lineHeight ?? 3.0;
  const lineH    = fontSize * lhMult;
  const lines    = item.text.split('\n').filter((l: string) => l.trim() !== '');
  const numLines = lines.length;
  const blockH   = (item as any).scrollBlockH ?? (numLines * lineH);
  const startY   = (item as any).scrollStartY ?? (kb.startTop + blockH / 2 - CH / 2);
  const endY     = (item as any).scrollEndY   ?? (kb.endTop   + blockH / 2 - CH / 2);
  const finalX = item.position.x;
  const initOp = item.transition?.type === 'crossFade' ? 0
               : (item.opacityKeyframes?.[0]?.value ?? item.opacity ?? 1);
  const initX = item.transition?.type === 'crossFade'
    ? finalX
    : (item.transition ? transitionInitPos(finalX, startY, item.transition)[0] : finalX);

  if (item.startTime > 0) yield* waitFor(item.startTime);
  const containerRef = createRef<Layout>();

  yield view.add(
    <Layout
      ref={containerRef}
      width={(item.size?.width ?? 1114) as Length}
      height={blockH}
      position={[initX, startY]}
      opacity={initOp}
      layout={false}
    >
      {lines.map((lineText, i) => {
        const lineY = -(blockH / 2) + lineH / 2 + i * lineH;
        return (
          <Txt
            key={i}
            text={lineText}
            fontSize={fontSize}
            fontFamily={item.fontFamily ?? 'Roboto'}
            fill={item.fill ?? '#ffffff'}
            width={(item.size?.width ?? 1114) as Length}
            textAlign={item.textAlign ?? 'center'}
            position={[0, lineY]}
            letterSpacing={item.letterSpacing ?? 0}
          />
        );
      })}
    </Layout>
  );

  const tasks: Generator[] = [];

  if (item.opacityKeyframes?.length)
    tasks.push(animateOpacity(containerRef, item.opacityKeyframes));

  if (item.transition) {
    const t = item.transition;
    if (t.type === 'crossFade') {
      tasks.push((function* () {
        if (t.delay) yield* waitFor(t.delay);
        yield* containerRef().opacity(1, t.duration, linear);
      })());
    } else {
      tasks.push((function* () {
        if (t.delay) yield* waitFor(t.delay);
        yield* containerRef().x(finalX, t.duration, easeInOutCubic);
      })());
    }
  }

  tasks.push((function* () {
    yield* containerRef().y(endY, item.duration, linear);
  })());

  yield* all(...tasks);
  containerRef().remove();
}

function* runRect(view: any, item: RectItem) {
  const ref    = createRef<Rect>();
  const finalX = item.position.x;
  const finalY = item.position.y;
  const initOp = item.transition?.type === 'crossFade' ? 0 : (item.opacity ?? 1);
  const [initX, initY] = item.transition
    ? transitionInitPos(finalX, finalY, item.transition)
    : [finalX, finalY];

  if (item.startTime > 0) yield* waitFor(item.startTime);

  yield view.add(
    <Rect
      ref={ref}
      width={item.size.width as Length}
      height={item.size.height as Length}
      fill={item.fill ?? '#000000'}
      position={[initX, initY]}
      opacity={initOp}
      rotation={item.rotation ?? 0}
    />
  );

  const tasks: Generator[] = [];
  if (item.transition)         tasks.push(runTransitionMove(ref, finalX, finalY, item.transition));
  if (item.animations?.length) tasks.push(...item.animations.map(a => runAnimation(ref, a)));
  if (!tasks.length)           tasks.push(waitFor(item.duration));

  yield* all(...tasks);
  ref().remove();
}

const scene = makeScene2D('scene', function* (view) {
  if (config.settings.background) {
    yield view.add(
      <Rect width={CW} height={CH} fill={config.settings.background} zIndex={-999} />
    );
  }

  const sorted = [...config.timeline].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  const runners = sorted.map(item => {
    switch (item.type) {
      case 'video':  return runVideo(view, item as VideoItem);
      case 'audio':  return runAudio(view, item as AudioItem);
      case 'image':  return runImage(view, item as ImageItem);
      case 'rect':   return runRect(view, item as RectItem);
      case 'text': {
        const ti = item as TextItem;
        return ti.kenBurns ? runScrollText(view, ti) : runText(view, ti);
      }
    }
  }).filter(Boolean) as Generator[];

  yield* all(...runners);
});

export default makeProject({
  scenes: [scene],
  settings: { shared: { size: config.settings.size } },
});