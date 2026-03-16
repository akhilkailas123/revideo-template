import {
  makeProject,
  waitFor,
  createRef,
  all,
  chain,
  tween,
  easeInOutCubic,
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
import './global.css';

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
  const textAlign: 'left' | 'center' | 'right' = item.textAlign ?? 'center';
  const fontFamily: string | undefined = item.fontFamily ?? undefined;

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
      if (outRef) {
        outRef().filters([]);
      }

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
    const rawX  = toSceneX(pos.x);
    const rawY  = toSceneY(pos.y);
    const startOpacity = item.animation?.fadeIn ? 0 : 1;
    // ── NEW ──
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
      // ── CHANGED: replaced chain/all block with explicit fade-in → hold → fade-out ──
      yield* waitFor(0);

      // Fade in
      if (fadeInTime > 0) {
        yield* tween(fadeInTime, v => {
          refs[item.id]().opacity(easeInOutCubic(v));
        });
        refs[item.id]().opacity(1);
      }

      // Hold (total duration minus fade-in and fade-out)
      const holdTime = (item.duration ?? 0) - fadeInTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);

      // Fade out
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          refs[item.id]().opacity(1 - easeInOutCubic(v));
        });
        refs[item.id]().opacity(0);
      }
    }
  }

  if (item.type === 'text') {
    refs[item.id] = createRef<Txt>();

    const wipeRight   = item.animation?.wipeRight;
    const slideInLeft = item.animation?.slideInLeft;
    const fadeIn      = item.animation?.fadeIn;
    // ── NEW ──
    const fadeOut     = item.animation?.fadeOut;

    const textWidth: number | undefined = item.width ?? undefined;
    const textWrap: boolean | 'pre' | 'balance' = item.textWrap ?? true;
    const lineHeight: number = item.lineHeight ?? 300;
    const letterSpacing: number = item.letterSpacing ?? 0;
    const skewX: number = item.skewX ?? 0;
    const skewY: number = item.skewY ?? 0;
    const rotation: number = item.rotation ?? 0;

    if (slideInLeft) {
      const tx       = toSceneX(pos.x);
      const ty       = toSceneY(pos.y);
      const fSize    = item.fontSize ?? 80;
      const slideTime = slideInLeft.time ?? 0.2;
      // ── NEW ──
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

      // ── CHANGED: subtract fadeOutTime from holdTime ──
      const holdTime = (item.duration ?? 0) - slideTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);

      // ── NEW: fade out ──
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          refs[item.id]().opacity(1 - easeInOutCubic(v));
        });
        refs[item.id]().opacity(0);
      }
      return;
    }

    if (fadeIn && !wipeRight && !slideInLeft) {
      const tx       = toSceneX(pos.x);
      const ty       = toSceneY(pos.y);
      const fSize    = item.fontSize ?? 80;
      const fadeInTime  = fadeIn.time ?? 0.3;
      // ── NEW ──
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

      // ── CHANGED: subtract fadeOutTime from holdTime ──
      const holdTime = (item.duration ?? 0) - fadeInTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);

      // ── NEW: fade out ──
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          refs[item.id]().opacity(1 - easeInOutCubic(v));
        });
        refs[item.id]().opacity(0);
      }
      return;
    }

    if (wipeRight) {
      const maskRef = createRef<Rect>();
      const txtRef2 = createRef<Txt>();
      const tx      = toSceneX(pos.x);
      const ty      = toSceneY(pos.y);
      const fSize   = item.fontSize ?? 80;
      const withFade = !!fadeIn;
      // ── NEW ──
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

      // ── CHANGED: subtract fadeOutTime from holdTime ──
      const holdTime = (item.duration ?? 0) - revealTime - fadeOutTime;
      if (holdTime > 0) yield* waitFor(holdTime);

      // ── NEW: fade out (fades the mask container so entire text fades out) ──
      if (fadeOutTime > 0) {
        yield* tween(fadeOutTime, v => {
          maskRef().opacity(1 - easeInOutCubic(v));
        });
        maskRef().opacity(0);
      }
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
  }

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
            key={i}
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