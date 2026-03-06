import {
  makeProject,
  waitFor,
  createRef,
  all,
  chain,
  tween,
  easeInOutCubic,
  Signal,
} from '@revideo/core';
import {
  makeScene2D,
  Img,
  Video,
  Audio,
  Txt,
  Rect,
} from '@revideo/2d';
import config from './video.config.json';

const WIDTH  = config.settings.size.x;
const HEIGHT = config.settings.size.y;

function toSceneX(x: number) { return (x - 0.5) * WIDTH;  }
function toSceneY(y: number) { return (y - 0.5) * HEIGHT; }

const scene = makeScene2D('scene', function* (view) {
  const refs: Record<string, any> = {};
  const tasks = config.timeline.map(item => runLayer(view, item, refs));
  yield* all(...tasks);
});

function* runLayer(view: any, item: any, refs: any) {
  yield* waitFor(item.start ?? 0);

  const pos = item.position ?? { x: 0.5, y: 0.5 };

  /* VIDEO */
  if (item.type === 'video') {
    view.add(
      <Video
        src={item.src}
        play
        size={['100%', '100%']}
        zIndex={item.zIndex ?? 0}
      />
    );
  }

  /* AUDIO */
  if (item.type === 'audio') {
    view.add(
      <Audio src={item.src} play time={item.offset ?? 0} />
    );
  }

  /* IMAGE */
  if (item.type === 'image') {
    refs[item.id] = createRef<Img>();

    const imgWidth  = item.width  ?? 200;
    const imgHeight = item.height ?? imgWidth;
    const halfW = imgWidth  / 2;
    const halfH = imgHeight / 2;
    const rawX  = toSceneX(pos.x);
    const rawY  = toSceneY(pos.y);
    const clampedX = Math.max(-WIDTH  / 2 + halfW, Math.min(WIDTH  / 2 - halfW, rawX));
    const clampedY = Math.max(-HEIGHT / 2 + halfH, Math.min(HEIGHT / 2 - halfH, rawY));
    const startOpacity = item.animation?.fadeIn ? 0 : 1;

    view.add(
      <Img
        ref={refs[item.id]}
        src={item.src}
        width={imgWidth}
        x={clampedX}
        y={clampedY}
        opacity={startOpacity}
        zIndex={item.zIndex ?? 1}
      />
    );

    if (item.animation) {
      yield* chain(
        all(
          ...(item.animation.fadeIn
            ? [refs[item.id]().opacity(1, item.animation.fadeIn.time ?? 0.1)]
            : []),
          refs[item.id]().scale(
            item.animation.scaleIn?.value ?? 1,
            item.animation.scaleIn?.time  ?? 0,
          ),
          refs[item.id]().rotation(
            item.animation.rotate?.value ?? 0,
            item.animation.rotate?.time  ?? 0,
          ),
        ),
        refs[item.id]().scale(
          item.animation.scaleOut?.value ?? 1,
          item.animation.scaleOut?.time  ?? 0,
        ),
      );
    }
  }

  /* PLAIN TEXT */
  if (item.type === 'text') {
    refs[item.id] = createRef<Txt>();

    const wipeRight = item.animation?.wipeRight;

    if (wipeRight) {
      
      const maskRef  = createRef<Rect>();
      const txtRef2  = createRef<Txt>();
      const tx       = toSceneX(pos.x);
      const ty       = toSceneY(pos.y);
      const fSize    = item.fontSize ?? 80;

      view.add(
        <Txt
          ref={txtRef2}
          text={item.text}
          fontSize={fSize}
          fill={item.color ?? 'white'}
          x={tx}
          y={ty}
          textAlign={'center'}
          zIndex={item.zIndex ?? 1}
          opacity={0}
        />
      );

      yield* waitFor(0);
      const realW  = txtRef2().size().x;
      const realH  = txtRef2().size().y;

      view.add(
        <Rect
          ref={maskRef}
          x={tx - realW / 2}
          y={ty}
          width={0}
          height={realH * 1.1}
          clip={true}
          zIndex={item.zIndex ?? 1}
        >
          
          <Txt
            ref={refs[item.id]}
            text={item.text}
            fontSize={fSize}
            fill={item.color ?? 'white'}
            x={realW / 2}
            y={0}
            textAlign={'center'}
          />
        </Rect>
      );
      txtRef2().remove();
      const revealTime = wipeRight.time ?? 0.9;

      yield* tween(revealTime, v => {
        const w = realW * easeInOutCubic(v);
        maskRef().x(tx - realW / 2 + w / 2);
        maskRef().width(w);
        refs[item.id]().x(tx - (tx - realW / 2 + w / 2));
      });

      const holdTime = (item.duration ?? 0) - revealTime;
      if (holdTime > 0) yield* waitFor(holdTime);
      return;

    } else {
      view.add(
        <Txt
          ref={refs[item.id]}
          text={item.text}
          fontSize={item.fontSize ?? 80}
          fill={item.color ?? 'white'}
          x={toSceneX(pos.x)}
          y={toSceneY(pos.y)}
          zIndex={item.zIndex ?? 1}
        />
      );
    }
  }

  if (item.type === 'scroll-text') {
    const lines: string[]    = item.lines ?? [];
    const fontSize: number   = item.fontSize  ?? 50;
    const lineHeight: number = item.lineHeight ?? Math.round(fontSize * 1.6);
    const color: string      = item.color ?? '#ffffff';
    const area       = item.scrollArea ?? { x: 0.5, y: 0.5, width: 0.4, height: 0.6 };
    const areaX      = toSceneX(area.x);
    const areaY      = toSceneY(area.y);
    const areaW      = area.width  * WIDTH;
    const areaH      = area.height * HEIGHT;
    const totalH     = lines.length * lineHeight;
    const lineRefs: any[] = lines.map(() => createRef<Txt>());
    const initYs = lines.map((_: any, i: number) => areaH / 2 - lineHeight / 2 + (i + 1) * lineHeight);
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
            key={i}
            text={line === '' ? ' ' : line}
            fontSize={fontSize}
            fill={line === '' ? '#00000000' : color}
            textAlign={'center'}
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