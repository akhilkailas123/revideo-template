import { createRef, waitFor, tween, easeInOutCubic, easeInOutQuad } from '@revideo/core';
import { Three } from '../components/Three';
import * as THREE from 'three';
import { WIDTH, HEIGHT } from '../utils';

// ─── Image cache ─────────────────────────────────────────────────────────────
const cache: Record<string, HTMLImageElement> = {};
function loadImage(src: string) {
  if (!cache[src]) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    cache[src] = img;
  }
  return cache[src];
}

// ─── Canvas / texture helpers ─────────────────────────────────────────────────
function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function drawFace(canvas: HTMLCanvasElement, src: string, tex: THREE.CanvasTexture) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const img = loadImage(src);
  if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  tex.needsUpdate = true;
}

function makeScene(bg: string, W: number, H: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 100);
  camera.position.set(0, 0, 2.2);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2);
  dl.position.set(3, 4, 5); scene.add(dl);
  return { scene, camera };
}

// ─── TRANSITION A: Horizontal flip slices (original, improved) ────────────────
function buildFlipSlicesH(
  texA: THREE.Texture, texB: THREE.Texture,
  fw: number, fh: number, depth: number, n: number
) {
  const group = new THREE.Group();
  const slices: THREE.Group[] = [];
  const partH = fh / n;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.BoxGeometry(fw, partH, depth);
    const tA = texA.clone(); tA.repeat.set(1, 1 / n); tA.offset.set(0, 1 - (i + 1) / n); tA.needsUpdate = true;
    const tB = texB.clone(); tB.repeat.set(1, 1 / n); tB.offset.set(0, 1 - (i + 1) / n);
    tB.wrapS = THREE.RepeatWrapping; tB.repeat.x = -1; tB.needsUpdate = true;
    const mats = [
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ map: tA }),
      new THREE.MeshStandardMaterial({ map: tB }),
    ];
    const mesh = new THREE.Mesh(geo, mats);
    const g = new THREE.Group(); g.add(mesh);
    g.position.y = fh / 2 - partH / 2 - i * partH;
    group.add(g); slices.push(g);
  }
  return { group, slices };
}

// ─── TRANSITION B: Vertical column flip (Y-axis) ─────────────────────────────
function buildFlipSlicesV(
  texA: THREE.Texture, texB: THREE.Texture,
  fw: number, fh: number, depth: number, n: number
) {
  const group = new THREE.Group();
  const slices: THREE.Group[] = [];
  const partW = fw / n;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.BoxGeometry(partW, fh, depth);
    const tA = texA.clone(); tA.repeat.set(1 / n, 1); tA.offset.set(i / n, 0); tA.needsUpdate = true;
    const tB = texB.clone(); tB.repeat.set(1 / n, 1); tB.offset.set(i / n, 0);
    tB.wrapT = THREE.RepeatWrapping; tB.repeat.y = -1; tB.needsUpdate = true;
    const mats = [
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ map: tA }),
      new THREE.MeshStandardMaterial({ map: tB }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
    ];
    const mesh = new THREE.Mesh(geo, mats);
    const g = new THREE.Group(); g.add(mesh);
    g.position.x = -fw / 2 + partW / 2 + i * partW;
    group.add(g); slices.push(g);
  }
  return { group, slices };
}

// ─── TRANSITION C: 3-D cube spin (full face rotation on XY diagonal) ─────────
function buildSpinCube(
  texA: THREE.Texture, texB: THREE.Texture,
  fw: number, fh: number, depth: number
) {
  const geo = new THREE.BoxGeometry(fw, fh, depth);
  const mats = [
    new THREE.MeshStandardMaterial({ color: '#0a0a0a' }),
    new THREE.MeshStandardMaterial({ color: '#0a0a0a' }),
    new THREE.MeshStandardMaterial({ color: '#0a0a0a' }),
    new THREE.MeshStandardMaterial({ color: '#0a0a0a' }),
    new THREE.MeshStandardMaterial({ map: texA }),
    new THREE.MeshStandardMaterial({ map: texB }),
  ];
  const mesh = new THREE.Mesh(geo, mats);
  const group = new THREE.Group(); group.add(mesh);
  return { group, mesh };
}

// ─── TRANSITION D: Page-peel (accordion fold) ────────────────────────────────
function buildPagePeel(
  texA: THREE.Texture, texB: THREE.Texture,
  fw: number, fh: number, depth: number, n: number
) {
  const group = new THREE.Group();
  const panels: THREE.Group[] = [];
  const partW = fw / n;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.BoxGeometry(partW, fh, depth);
    const tA = texA.clone(); tA.repeat.set(1 / n, 1); tA.offset.set(i / n, 0); tA.needsUpdate = true;
    const tB = texB.clone(); tB.repeat.set(1 / n, 1); tB.offset.set(1 - (i + 1) / n, 0);
    tB.wrapS = THREE.RepeatWrapping; tB.repeat.x = -1; tB.needsUpdate = true;
    const mats = [
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ map: tA }),
      new THREE.MeshStandardMaterial({ map: tB }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
      new THREE.MeshStandardMaterial({ color: '#111' }),
    ];
    const mesh = new THREE.Mesh(geo, mats);
    const pivot = new THREE.Group();
    pivot.add(mesh);
    mesh.position.x = partW / 2;          // hinge on left edge
    pivot.position.x = -fw / 2 + i * partW;
    group.add(pivot); panels.push(pivot);
  }
  return { group, panels };
}

// ─── TRANSITION E: Shatter (grid tiles scatter outward then reassemble) ───────
function buildShatterGrid(
  texA: THREE.Texture, texB: THREE.Texture,
  fw: number, fh: number, depth: number, cols: number, rows: number
) {
  const group = new THREE.Group();
  const tiles: { mesh: THREE.Mesh; ox: number; oy: number; angle: number; radius: number }[] = [];
  const tw = fw / cols; const th = fh / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const geo = new THREE.BoxGeometry(tw - 0.005, th - 0.005, depth);
      const uOff = c / cols; const vOff = 1 - (r + 1) / rows;
      const tA = texA.clone(); tA.repeat.set(1 / cols, 1 / rows); tA.offset.set(uOff, vOff); tA.needsUpdate = true;
      const tB = texB.clone(); tB.repeat.set(1 / cols, 1 / rows); tB.offset.set(uOff, vOff); tB.needsUpdate = true;
      const mats = [
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ map: tA }),
        new THREE.MeshStandardMaterial({ map: tB }),
      ];
      const mesh = new THREE.Mesh(geo, mats);
      const ox = -fw / 2 + tw / 2 + c * tw;
      const oy = fh / 2 - th / 2 - r * th;
      mesh.position.set(ox, oy, 0);
      const angle = Math.atan2(oy, ox);
      const radius = Math.sqrt(ox * ox + oy * oy) * 3;
      group.add(mesh);
      tiles.push({ mesh, ox, oy, angle, radius });
    }
  }
  return { group, tiles };
}

// ─── TRANSITION F: Wave-ripple flip (radial delay from centre) ───────────────
function buildRippleSlices(
  texA: THREE.Texture, texB: THREE.Texture,
  fw: number, fh: number, depth: number, cols: number, rows: number
) {
  const group = new THREE.Group();
  const tiles: { g: THREE.Group; dist: number }[] = [];
  const tw = fw / cols; const th = fh / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const geo = new THREE.BoxGeometry(tw - 0.004, th - 0.004, depth);
      const uOff = c / cols; const vOff = 1 - (r + 1) / rows;
      const tA = texA.clone(); tA.repeat.set(1 / cols, 1 / rows); tA.offset.set(uOff, vOff); tA.needsUpdate = true;
      const tB = texB.clone(); tB.repeat.set(1 / cols, 1 / rows); tB.offset.set(uOff, vOff);
      tB.wrapS = THREE.RepeatWrapping; tB.repeat.x = -1; tB.needsUpdate = true;
      const mats = [
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ map: tA }),
        new THREE.MeshStandardMaterial({ map: tB }),
      ];
      const mesh = new THREE.Mesh(geo, mats);
      const ox = -fw / 2 + tw / 2 + c * tw;
      const oy = fh / 2 - th / 2 - r * th;
      const g = new THREE.Group(); g.add(mesh);
      g.position.set(ox, oy, 0);
      // distance from centre normalised 0–1
      const dist = Math.sqrt(Math.pow((c / (cols - 1)) - 0.5, 2) + Math.pow((r / (rows - 1)) - 0.5, 2)) / 0.707;
      group.add(g); tiles.push({ g, dist });
    }
  }
  return { group, tiles };
}

// ─── TRANSITION G: Diagonal wipe with cube depth ─────────────────────────────
function buildDiagonalWipe(
  texA: THREE.Texture, texB: THREE.Texture,
  fw: number, fh: number, depth: number, cols: number, rows: number
) {
  const group = new THREE.Group();
  const tiles: { mesh: THREE.Mesh; diag: number }[] = [];
  const tw = fw / cols; const th = fh / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const geo = new THREE.BoxGeometry(tw - 0.004, th - 0.004, depth);
      const uOff = c / cols; const vOff = 1 - (r + 1) / rows;
      const tA = texA.clone(); tA.repeat.set(1 / cols, 1 / rows); tA.offset.set(uOff, vOff); tA.needsUpdate = true;
      const tB = texB.clone(); tB.repeat.set(1 / cols, 1 / rows); tB.offset.set(uOff, vOff); tB.needsUpdate = true;
      const mats = [
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ color: '#111' }),
        new THREE.MeshStandardMaterial({ map: tA }),
        new THREE.MeshStandardMaterial({ map: tB }),
      ];
      const mesh = new THREE.Mesh(geo, mats);
      const ox = -fw / 2 + tw / 2 + c * tw;
      const oy = fh / 2 - th / 2 - r * th;
      mesh.position.set(ox, oy, 0);
      // diagonal index (top-left = 0, bottom-right = 1)
      const diag = (c / (cols - 1) + r / (rows - 1)) / 2;
      group.add(mesh); tiles.push({ mesh, diag });
    }
  }
  return { group, tiles };
}

// ─── Main exported runner ─────────────────────────────────────────────────────
export function* runCubeScene(view: any, item: any) {
  const faces = item.faces ?? [];
  if (faces.length < 2) return;

  const W = WIDTH();
  const H = HEIGHT();
  const size     = item.size     ?? { width: 1, height: 1 };
  const fw       = (W / H) * size.width;
  const fh       = size.height;
  const depth    = item.depth    ?? 0.02;
  const bg       = item.background ?? '#000000';
  const transType: string = item.transitionType ?? 'h-flip-slices';

  const { scene, camera } = makeScene(bg, W, H);

  if (item.backgroundPlane) {
    const planeMat = new THREE.MeshBasicMaterial({ color: item.backgroundPlane.color ?? '#000000' });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), planeMat);
    plane.position.z = -1; scene.add(plane);
  }

  const CW = Math.round(fw * 1024);
  const CH = Math.round(fh * 1024);
  const canvA = makeCanvas(CW, CH);
  const canvB = makeCanvas(CW, CH);
  const texA   = new THREE.CanvasTexture(canvA);
  const texB   = new THREE.CanvasTexture(canvB);

  drawFace(canvA, faces[0].composition[0].src, texA);
  drawFace(canvB, faces[1].composition[0].src, texB);

  const pos      = item.position ?? { x: 0, y: 0 };
  const duration = item.flipDuration ?? 1.6;
  const shift    = item.shift        ?? 0.4;
  const sliceCount = item.slices ?? 10;

  const threeRef = createRef<Three>();
  view.add(<Three ref={threeRef} width={W} height={H} camera={camera} scene={scene} />);
  yield* waitFor(0.5);

  // ─── A: Horizontal slice flip ────────────────────────────────────────────
  // Each slice gets its own easeInOutCubic on its local [0,1] progress so the
  // deceleration tail is always preserved — no snap at the end.
  if (transType === 'h-flip-slices') {
    const { group, slices } = buildFlipSlicesH(texA, texB, fw, fh, depth, sliceCount);
    group.position.set(pos.x, pos.y, 0);
    scene.add(group);
    // stagger: last slice starts at 30 % of total duration so every slice
    // has 70 % of duration to complete its own smooth ease-in-out.
    const staggerWindow = 0.30;
    const sliceWindow   = 1 - staggerWindow;   // fraction of tween each slice gets
    yield* tween(duration, v => {
      slices.forEach((g, i) => {
        const startV = (i / (slices.length - 1)) * staggerWindow;
        const localV = Math.max(0, Math.min(1, (v - startV) / sliceWindow));
        const e = easeInOutCubic(localV);       // full, smooth ease on each slice
        g.rotation.y = -Math.PI * e;
        g.position.x = -shift * Math.sin(Math.PI * e);
      });
    });
    slices.forEach(g => { g.rotation.y = -Math.PI; g.position.x = 0; });
  }

  // ─── B: Vertical column flip ─────────────────────────────────────────────
  else if (transType === 'v-flip-slices') {
    const { group, slices } = buildFlipSlicesV(texA, texB, fw, fh, depth, sliceCount);
    group.position.set(pos.x, pos.y, 0);
    scene.add(group);
    yield* tween(duration, v => {
      const e = easeInOutCubic(v);
      slices.forEach((g, i) => {
        const delay = i * 0.06;
        const t = Math.max(0, Math.min(1, (e - delay) * 1.4));
        g.rotation.x = Math.PI * t;
        g.position.y = shift * Math.sin(Math.PI * t);
      });
    });
    slices.forEach(g => { g.rotation.x = Math.PI; g.position.y = 0; });
  }

  // ─── C: Full cube spin (Y-axis barrel roll) ───────────────────────────────
  else if (transType === 'cube-spin') {
    const { group } = buildSpinCube(texA, texB, fw, fh, depth);
    group.position.set(pos.x, pos.y, 0);
    scene.add(group);
    const spinAxis = item.spinAxis ?? 'y';   // 'x' | 'y' | 'xy'
    yield* tween(duration, v => {
      const e = easeInOutCubic(v);
      if (spinAxis === 'y' || spinAxis === 'xy') group.rotation.y = -Math.PI * e;
      if (spinAxis === 'x' || spinAxis === 'xy') group.rotation.x =  Math.PI * e;
    });
    if (spinAxis === 'y' || spinAxis === 'xy') group.rotation.y = -Math.PI;
    if (spinAxis === 'x' || spinAxis === 'xy') group.rotation.x =  Math.PI;
  }

  // ─── D: Page-peel accordion (left-to-right door fold) ────────────────────
  else if (transType === 'page-peel') {
    const { group, panels } = buildPagePeel(texA, texB, fw, fh, depth, sliceCount);
    group.position.set(pos.x - fw / 2, pos.y, 0);  // left-aligned
    scene.add(group);
    yield* tween(duration, v => {
      const e = easeInOutCubic(v);
      panels.forEach((pivot, i) => {
        const delay = i * (0.8 / sliceCount);
        const t = Math.max(0, Math.min(1, (e - delay) * 2));
        pivot.rotation.y = -Math.PI * t;
      });
    });
    panels.forEach(pivot => { pivot.rotation.y = -Math.PI; });
  }

  // ─── E: Shatter (explode outward → dissolve → reassemble as face B) ───────
  else if (transType === 'shatter') {
    const cols = item.cols ?? 6; const rows = item.rows ?? 4;
    const { group, tiles } = buildShatterGrid(texA, texB, fw, fh, depth, cols, rows);
    group.position.set(pos.x, pos.y, 0);
    scene.add(group);
    // Phase 1: explode outward (face A)
    yield* tween(duration * 0.45, v => {
      const e = easeInOutQuad(v);
      tiles.forEach(({ mesh, ox, oy, angle, radius }) => {
        const delay = Math.random() * 0;   // stagger done via radius
        const t = Math.max(0, Math.min(1, e));
        mesh.position.x = ox + Math.cos(angle) * radius * t;
        mesh.position.y = oy + Math.sin(angle) * radius * t;
        mesh.position.z = t * 0.4;
        mesh.rotation.z = t * (Math.random() > 0.5 ? 1 : -1) * Math.PI * 0.3;
      });
    });
    // Phase 2: swap to face B on all tiles, bring back from opposite side
    tiles.forEach(({ mesh }) => {
      // flip material to face B
      (mesh.material as THREE.MeshStandardMaterial[])[4].opacity = 0;
      (mesh.material as THREE.MeshStandardMaterial[])[5].opacity = 1;
      mesh.rotation.y = Math.PI;
    });
    yield* waitFor(0.05);
    yield* tween(duration * 0.5, v => {
      const e = easeInOutCubic(v);
      tiles.forEach(({ mesh, ox, oy, angle, radius }) => {
        const t = 1 - e;
        mesh.position.x = ox + Math.cos(angle) * radius * t;
        mesh.position.y = oy + Math.sin(angle) * radius * t;
        mesh.position.z = t * 0.4;
        mesh.rotation.z = t * mesh.rotation.z;
      });
    });
    tiles.forEach(({ mesh, ox, oy }) => {
      mesh.position.set(ox, oy, 0); mesh.rotation.set(0, Math.PI, 0);
    });
  }

  // ─── F: Ripple flip (radial wave outward from centre) ────────────────────
  else if (transType === 'ripple') {
    const cols = item.cols ?? 8; const rows = item.rows ?? 6;
    const { group, tiles } = buildRippleSlices(texA, texB, fw, fh, depth, cols, rows);
    group.position.set(pos.x, pos.y, 0);
    scene.add(group);
    yield* tween(duration, v => {
      const e = easeInOutCubic(v);
      tiles.forEach(({ g, dist }) => {
        // each tile starts flipping with a delay proportional to dist from centre
        const delay = dist * 0.55;
        const t = Math.max(0, Math.min(1, (e - delay) * 2.5));
        g.rotation.y = -Math.PI * t;
        g.position.z = 0.25 * Math.sin(Math.PI * t);
      });
    });
    tiles.forEach(({ g }) => { g.rotation.y = -Math.PI; g.position.z = 0; });
  }

  // ─── G: Diagonal wipe (tiles flip along a sweeping diagonal line) ─────────
  else if (transType === 'diagonal-wipe') {
    const cols = item.cols ?? 8; const rows = item.rows ?? 6;
    const { group, tiles } = buildDiagonalWipe(texA, texB, fw, fh, depth, cols, rows);
    group.position.set(pos.x, pos.y, 0);
    scene.add(group);
    yield* tween(duration, v => {
      const e = easeInOutCubic(v);
      tiles.forEach(({ mesh, diag }) => {
        const delay = diag * 0.6;
        const t = Math.max(0, Math.min(1, (e - delay) * 2.5));
        mesh.rotation.y = -Math.PI * t;
        // lift upward during flip
        mesh.position.z = 0.18 * Math.sin(Math.PI * t);
      });
    });
    tiles.forEach(({ mesh }) => { mesh.rotation.y = -Math.PI; mesh.position.z = 0; });
  }

  yield* waitFor(item.holdAfter ?? 2);
}