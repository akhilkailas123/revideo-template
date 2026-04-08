import { createRef, waitFor, tween, easeInOutCubic } from '@revideo/core';
import { Three } from '../components/Three';
import * as THREE from 'three';
import { WIDTH, HEIGHT } from '../utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type CompositionItem =
  | BackgroundItem
  | GradientItem
  | RectItem
  | ImageItem
  | TextItem
  | CircleItem
  | DividerItem;

interface BackgroundItem   { type: 'background';  color: string; }
interface GradientItem     { type: 'gradient';    x0?: number; y0?: number; x1?: number; y1?: number; stops: { offset: number; color: string }[]; }
interface RectItem         { type: 'rect';        x: number; y: number; w: number; h: number; color?: string; radius?: number; opacity?: number; strokeColor?: string; strokeWidth?: number; }
interface CircleItem       { type: 'circle';      x: number; y: number; r: number; color?: string; opacity?: number; strokeColor?: string; strokeWidth?: number; }
interface DividerItem      { type: 'divider';     x0: number; y0: number; x1: number; y1: number; color?: string; width?: number; opacity?: number; }
interface ImageItem {
  type: 'image';
  src: string;
  x?: number;   // 0-1, center
  y?: number;
  w?: number;   // 0-1 fraction of canvas
  h?: number;
  opacity?: number;
  radius?: number;       // rounded corners (px on canvas)
  fit?: 'fill' | 'cover' | 'contain';
  shadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
}
interface TextItem {
  type: 'text';
  text: string;
  x?: number;   // 0-1
  y?: number;
  fontSize?: number;   // px on canvas
  color?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  italic?: boolean;
  maxWidth?: number;    // 0-1 fraction
  lineHeight?: number;  // multiplier
  shadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  stroke?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  // background pill behind text
  pill?: boolean;
  pillColor?: string;
  pillPadX?: number;
  pillPadY?: number;
  pillRadius?: number;
}

// ─── Image cache ──────────────────────────────────────────────────────────────
const imgCache: Record<string, HTMLImageElement> = {};
function loadImage(src: string): HTMLImageElement {
  if (!imgCache[src]) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    imgCache[src] = img;
  }
  return imgCache[src];
}

// Pre-load images so they are ready when drawComposition runs
function preloadImages(composition: CompositionItem[]): Promise<void>[] {
  return composition
    .filter((it): it is ImageItem => it.type === 'image')
    .map(it => {
      const img = loadImage(it.src);
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>(res => {
        img.onload = () => res();
        img.onerror = () => res(); // fail silently
      });
    });
}

// ─── Canvas helper ────────────────────────────────────────────────────────────
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ─── Rounded rect path helper ─────────────────────────────────────────────────
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ─── drawImage with fit modes ─────────────────────────────────────────────────
function drawImageFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number,
  fit: 'fill' | 'cover' | 'contain' = 'fill'
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (fit === 'fill') {
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }
  const scale = fit === 'cover'
    ? Math.max(dw / iw, dh / ih)
    : Math.min(dw / iw, dh / ih);
  const sw = iw * scale;
  const sh = ih * scale;
  ctx.drawImage(img, dx + (dw - sw) / 2, dy + (dh - sh) / 2, sw, sh);
}

// ─── Main composition renderer ────────────────────────────────────────────────
function drawComposition(
  canvas: HTMLCanvasElement,
  composition: CompositionItem[],
  tex: THREE.CanvasTexture
) {
  const ctx = canvas.getContext('2d')!;
  const CW = canvas.width;
  const CH = canvas.height;

  ctx.clearRect(0, 0, CW, CH);

  for (const item of composition) {

    // ── background ──────────────────────────────────────────────────────────
    if (item.type === 'background') {
      ctx.save();
      ctx.fillStyle = item.color;
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

    // ── gradient ────────────────────────────────────────────────────────────
    else if (item.type === 'gradient') {
      ctx.save();
      const x0 = (item.x0 ?? 0) * CW;
      const y0 = (item.y0 ?? 0) * CH;
      const x1 = (item.x1 ?? 1) * CW;
      const y1 = (item.y1 ?? 1) * CH;
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      for (const stop of item.stops) grad.addColorStop(stop.offset, stop.color);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

    // ── rect ────────────────────────────────────────────────────────────────
    else if (item.type === 'rect') {
      ctx.save();
      ctx.globalAlpha = item.opacity ?? 1;
      const rx = item.x * CW;
      const ry = item.y * CH;
      const rw = item.w * CW;
      const rh = item.h * CH;
      const rad = item.radius ?? 0;
      if (rad > 0) roundedRect(ctx, rx, ry, rw, rh, rad);
      else { ctx.beginPath(); ctx.rect(rx, ry, rw, rh); }
      if (item.color) { ctx.fillStyle = item.color; ctx.fill(); }
      if (item.strokeColor) { ctx.strokeStyle = item.strokeColor; ctx.lineWidth = item.strokeWidth ?? 2; ctx.stroke(); }
      ctx.restore();
    }

    // ── circle ──────────────────────────────────────────────────────────────
    else if (item.type === 'circle') {
      ctx.save();
      ctx.globalAlpha = item.opacity ?? 1;
      ctx.beginPath();
      ctx.arc(item.x * CW, item.y * CH, item.r * Math.min(CW, CH), 0, Math.PI * 2);
      if (item.color) { ctx.fillStyle = item.color; ctx.fill(); }
      if (item.strokeColor) { ctx.strokeStyle = item.strokeColor; ctx.lineWidth = item.strokeWidth ?? 2; ctx.stroke(); }
      ctx.restore();
    }

    // ── divider ─────────────────────────────────────────────────────────────
    else if (item.type === 'divider') {
      ctx.save();
      ctx.globalAlpha = item.opacity ?? 1;
      ctx.strokeStyle = item.color ?? '#ffffff';
      ctx.lineWidth = item.width ?? 2;
      ctx.beginPath();
      ctx.moveTo(item.x0 * CW, item.y0 * CH);
      ctx.lineTo(item.x1 * CW, item.y1 * CH);
      ctx.stroke();
      ctx.restore();
    }

    // ── image ────────────────────────────────────────────────────────────────
    else if (item.type === 'image') {
      const img = loadImage(item.src);
      if (!img.complete || img.naturalWidth === 0) continue;

      ctx.save();
      ctx.globalAlpha = item.opacity ?? 1;

      const cx = (item.x ?? 0.5) * CW;
      const cy = (item.y ?? 0.5) * CH;
      const dw = (item.w ?? 1) * CW;
      const dh = (item.h ?? 1) * CH;
      const dx = cx - dw / 2;
      const dy = cy - dh / 2;
      const radius = item.radius ?? 0;

      if (item.shadow) {
        ctx.shadowColor  = item.shadowColor ?? 'rgba(0,0,0,0.5)';
        ctx.shadowBlur   = item.shadowBlur  ?? 20;
      }

      if (radius > 0) {
        roundedRect(ctx, dx, dy, dw, dh, radius);
        ctx.clip();
      }

      drawImageFit(ctx, img, dx, dy, dw, dh, item.fit ?? 'fill');
      ctx.restore();
    }

    // ── text ──────────────────────────────────────────────────────────────────
    else if (item.type === 'text') {
      ctx.save();
      ctx.globalAlpha = item.opacity ?? 1;

      const italic  = item.italic ? 'italic ' : '';
      const weight  = item.fontWeight ?? 'bold';
      const size    = item.fontSize ?? 60;
      const family  = item.fontFamily ?? 'Arial';
      ctx.font      = `${italic}${weight} ${size}px ${family}`;
      ctx.textAlign = item.align ?? 'center';
      ctx.textBaseline = item.baseline ?? 'middle';

      const tx = (item.x ?? 0.5) * CW;
      const ty = (item.y ?? 0.5) * CH;
      const maxW  = item.maxWidth ? item.maxWidth * CW : undefined;
      const lh    = (item.lineHeight ?? 1.25) * size;

      // word-wrap helper
      function wrapText(t: string): string[] {
        if (!maxW) return t.split('\n');
        const lines: string[] = [];
        for (const paragraph of t.split('\n')) {
          const words = paragraph.split(' ');
          let line = '';
          for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxW && line) {
              lines.push(line);
              line = word;
            } else {
              line = test;
            }
          }
          if (line) lines.push(line);
        }
        return lines;
      }

      const lines = wrapText(item.text ?? '');
      const totalH = lines.length * lh;
      const startY = ty - (totalH / 2) + lh / 2;

      lines.forEach((line, i) => {
        const ly = startY + i * lh;

        // pill background
        if (item.pill) {
          const metrics = ctx.measureText(line);
          const padX = item.pillPadX ?? 16;
          const padY = item.pillPadY ?? 8;
          const pillW = metrics.width + padX * 2;
          const pillH = size + padY * 2;
          const pr    = item.pillRadius ?? pillH / 2;
          let pillX: number;
          if (ctx.textAlign === 'center') pillX = tx - pillW / 2;
          else if (ctx.textAlign === 'right') pillX = tx - pillW;
          else pillX = tx;
          roundedRect(ctx, pillX, ly - pillH / 2, pillW, pillH, pr);
          ctx.fillStyle = item.pillColor ?? 'rgba(0,0,0,0.55)';
          ctx.fill();
        }

        // shadow
        if (item.shadow) {
          ctx.shadowColor   = item.shadowColor   ?? 'rgba(0,0,0,0.6)';
          ctx.shadowBlur    = item.shadowBlur    ?? 8;
          ctx.shadowOffsetX = item.shadowOffsetX ?? 2;
          ctx.shadowOffsetY = item.shadowOffsetY ?? 2;
        }

        // stroke
        if (item.stroke) {
          ctx.strokeStyle = item.strokeColor ?? '#000000';
          ctx.lineWidth   = item.strokeWidth  ?? 3;
          ctx.lineJoin    = 'round';
          if (maxW) ctx.strokeText(line, tx, ly, maxW);
          else      ctx.strokeText(line, tx, ly);
        }

        // fill
        ctx.fillStyle = item.color ?? '#ffffff';
        if (maxW) ctx.fillText(line, tx, ly, maxW);
        else      ctx.fillText(line, tx, ly);
      });

      ctx.restore();
    }
  }

  tex.needsUpdate = true;
}

// ─── Scene setup ──────────────────────────────────────────────────────────────
function makeScene(bg: string, W: number, H: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);

  const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 100);
  camera.position.set(0, 0, 2.2);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2);
  dl.position.set(3, 4, 5);
  scene.add(dl);

  return { scene, camera };
}

// ─── Flip slices (horizontal rows) ───────────────────────────────────────────
function buildFlipSlicesH(
  texA: THREE.Texture,
  texB: THREE.Texture,
  fw: number,
  fh: number,
  depth: number,
  n: number
) {
  const group = new THREE.Group();
  const slices: THREE.Group[] = [];
  const partH = fh / n;

  for (let i = 0; i < n; i++) {
    const geo = new THREE.BoxGeometry(fw, partH, depth);

    const tA = texA.clone();
    tA.repeat.set(1, 1 / n);
    tA.offset.set(0, 1 - (i + 1) / n);
    tA.needsUpdate = true;

    const tB = texB.clone();
    tB.repeat.set(1, 1 / n);
    tB.offset.set(0, 1 - (i + 1) / n);
    tB.wrapS = THREE.RepeatWrapping;
    tB.repeat.x = -1;
    tB.needsUpdate = true;

    const mats = [
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ map: tA }),
      new THREE.MeshStandardMaterial({ map: tB }),
    ];

    const mesh = new THREE.Mesh(geo, mats);
    const g = new THREE.Group();
    g.add(mesh);
    g.position.y = fh / 2 - partH / 2 - i * partH;
    group.add(g);
    slices.push(g);
  }

  return { group, slices };
}

// ─── Vertical column slices ───────────────────────────────────────────────────
function buildFlipSlicesV(
  texA: THREE.Texture,
  texB: THREE.Texture,
  fw: number,
  fh: number,
  depth: number,
  n: number
) {
  const group = new THREE.Group();
  const slices: THREE.Group[] = [];
  const partW = fw / n;

  for (let i = 0; i < n; i++) {
    const geo = new THREE.BoxGeometry(partW, fh, depth);

    const tA = texA.clone();
    tA.repeat.set(1 / n, 1);
    tA.offset.set(i / n, 0);
    tA.needsUpdate = true;

    const tB = texB.clone();
    tB.repeat.set(1 / n, 1);
    tB.offset.set(i / n, 0);
    tB.wrapT = THREE.RepeatWrapping;
    tB.repeat.y = -1;
    tB.needsUpdate = true;

    const mats = [
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ map: tA }),
      new THREE.MeshStandardMaterial({ map: tB }),
    ];

    const mesh = new THREE.Mesh(geo, mats);
    const g = new THREE.Group();
    g.add(mesh);
    g.position.x = -fw / 2 + partW / 2 + i * partW;
    group.add(g);
    slices.push(g);
  }

  return { group, slices };
}

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────
export function* runCubeScene(view: any, item: any) {
  const faces: any[] = item.faces ?? [];
  if (faces.length < 2) return;

  const W = WIDTH();
  const H = HEIGHT();

  const size  = item.size      ?? { width: 1, height: 1 };
  const fw    = (W / H) * size.width;
  const fh    = size.height;
  const depth = item.depth     ?? 0.02;
  const bg    = item.background ?? '#000000';

  const { scene, camera } = makeScene(bg, W, H);

  // Canvas resolution – higher = sharper text/images
  const RES = item.resolution ?? 1024;
  const CW  = Math.round(fw * RES);
  const CH  = Math.round(fh * RES);

  // Build one canvas + texture per face (supports >2 faces for future use)
  const canvases  = faces.map(() => makeCanvas(CW, CH));
  const textures  = canvases.map(c => new THREE.CanvasTexture(c));

  // Pre-load all images across all faces then draw
  const allPreloads: Promise<void>[] = faces.flatMap(
    (face: any) => preloadImages(face.composition ?? [])
  );
  // yield* can't await Promises directly – schedule them and wait a frame
  yield* waitFor(0);
  // Give images time to load (configurable wait before flip)
  const preWait = item.preloadWait ?? 0.4;
  yield* waitFor(preWait);

  // Draw every face
  faces.forEach((face: any, idx: number) => {
    drawComposition(canvases[idx], face.composition ?? [], textures[idx]);
  });

  // ── Add Three canvas to view ──────────────────────────────────────────────
  const threeRef = createRef<Three>();
  view.add(
    <Three ref={threeRef} width={W} height={H} camera={camera} scene={scene} />
  );
  yield* waitFor(0);

  // ── Hold on first face ────────────────────────────────────────────────────
  const holdFirst = item.holdFirst ?? 0;
  if (holdFirst > 0) yield* waitFor(holdFirst);

  // ── Flip transition between consecutive face pairs ────────────────────────
  const flipDuration = item.flipDuration ?? 1.6;
  const sliceCount   = item.slices       ?? 10;
  const direction    = item.direction    ?? 'horizontal'; // 'horizontal' | 'vertical'
  const sliceDelay   = item.sliceDelay  ?? 0.05;

  for (let f = 0; f < faces.length - 1; f++) {
    const texA = textures[f];
    const texB = textures[f + 1];

    const { group, slices } =
      direction === 'vertical'
        ? buildFlipSlicesV(texA, texB, fw, fh, depth, sliceCount)
        : buildFlipSlicesH(texA, texB, fw, fh, depth, sliceCount);

    scene.add(group);

    yield* tween(flipDuration, v => {
      slices.forEach((g, i) => {
        const d = i * sliceDelay;
        const t = Math.max(0, Math.min(1, (v - d) * 2));
        const e = easeInOutCubic(t);
        if (direction === 'vertical') g.rotation.x = Math.PI * e;
        else                          g.rotation.y = -Math.PI * e;
      });
    });

    // lock slices at final rotation
    slices.forEach(g => {
      if (direction === 'vertical') g.rotation.x = Math.PI;
      else                          g.rotation.y = -Math.PI;
    });

    // hold between flips
    const holdBetween = faces[f + 1]?.holdAfter ?? item.holdAfter ?? 2;
    if (f < faces.length - 2 && holdBetween > 0) yield* waitFor(holdBetween);
  }

  // ── Final hold ────────────────────────────────────────────────────────────
  const finalHold = faces[faces.length - 1]?.holdAfter ?? item.holdAfter ?? 2;
  if (finalHold > 0) yield* waitFor(finalHold);
}