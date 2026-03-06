import {
  makeProject,
  waitFor,
  createRef,
  all,
  chain,
} from '@revideo/core';
import {
  makeScene2D,
  Img,
  Video,
  Audio,
  Txt,
} from '@revideo/2d';
import config from './video.config.json';

const WIDTH = config.settings.size.x;
const HEIGHT = config.settings.size.y;

/* normalized → scene coordinates (center-anchored) */
function toSceneX(x: number) {
  return (x - 0.5) * WIDTH;
}
function toSceneY(y: number) {
  return (y - 0.5) * HEIGHT;
}

const scene = makeScene2D('scene', function* (view) {
  const refs: Record<string, any> = {};
  const tasks = config.timeline.map(item =>
    runLayer(view, item, refs)
  );
  yield* all(...tasks);
});

/* layer runner */
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
      <Audio
        src={item.src}
        play
        time={item.offset ?? 0}
      />
    );
  }

  /* IMAGE */
  if (item.type === 'image') {
    refs[item.id] = createRef<Img>();

    const imgWidth  = item.width  ?? 200;
    const imgHeight = item.height ?? imgWidth; // assume square unless specified

    // Clamp so the image stays fully inside the canvas:
    // toSceneX/Y give the center position, so we nudge inward by half the size.
    const halfW = imgWidth  / 2;
    const halfH = imgHeight / 2;

    const rawX = toSceneX(pos.x);
    const rawY = toSceneY(pos.y);

    const clampedX = Math.max(-WIDTH  / 2 + halfW, Math.min(WIDTH  / 2 - halfW, rawX));
    const clampedY = Math.max(-HEIGHT / 2 + halfH, Math.min(HEIGHT / 2 - halfH, rawY));

    // Start invisible if fadeIn animation is defined
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
          // Fade in
          ...(item.animation.fadeIn
            ? [refs[item.id]().opacity(1, item.animation.fadeIn.time ?? 0.1)]
            : []),
          // Scale in + rotate (run alongside fade)
          refs[item.id]().scale(
            item.animation.scaleIn?.value ?? 1,
            item.animation.scaleIn?.time  ?? 0
          ),
          refs[item.id]().rotation(
            item.animation.rotate?.value ?? 0,
            item.animation.rotate?.time  ?? 0
          )
        ),
        // Scale out after
        refs[item.id]().scale(
          item.animation.scaleOut?.value ?? 1,
          item.animation.scaleOut?.time  ?? 0
        )
      );
    }
  }

  /* TEXT */
  if (item.type === 'text') {
    refs[item.id] = createRef<Txt>();
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

  if (item.duration) {
    yield* waitFor(item.duration);
  }
}

export default makeProject({
  scenes: [scene],
  settings: {
    shared: {
      size: config.settings.size,
    },
  },
});