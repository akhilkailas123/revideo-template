import { createRef, waitFor, tween, all, easeInOutCubic } from '@revideo/core';
import { Rect } from '@revideo/2d';
import { Three } from '../components/Three';
import * as THREE from 'three';
import { lerp, getEase, WIDTH, HEIGHT } from '../utils';

// ─── Scene + camera + lights setup ───────────────────────────────────────────
export function setupThreeScene(item: any) {
  const threeScene = new THREE.Scene();
  const camCfg = item.camera ?? {};
  const camera = new THREE.PerspectiveCamera(camCfg.fov ?? 70);
  camera.position.set(camCfg.x ?? 0, camCfg.y ?? 0, camCfg.z ?? 5);
  if (camCfg.lookAt) camera.lookAt(camCfg.lookAt.x ?? 0, camCfg.lookAt.y ?? 0, camCfg.lookAt.z ?? 0);

  const lightsArr: any[] = item.lights ?? [];
  if (lightsArr.length === 0) {
    const lCfg = item.light ?? {};
    const aCfg = item.ambient ?? {};
    lightsArr.push({ type: 'directional', color: lCfg.color ?? '#ffffff', intensity: lCfg.intensity ?? 1.5, x: lCfg.x ?? 4, y: lCfg.y ?? 4, z: lCfg.z ?? 6 });
    lightsArr.push({ type: 'ambient',     color: aCfg.color ?? '#ffffff', intensity: aCfg.intensity ?? 0.4 });
  }
  lightsArr.forEach((lCfg: any) => {
    const col = new THREE.Color(lCfg.color ?? '#ffffff');
    const int = lCfg.intensity ?? 1;
    switch (lCfg.type) {
      case 'ambient': threeScene.add(new THREE.AmbientLight(col, int)); break;
      case 'point': {
        const pl = new THREE.PointLight(col, int, lCfg.distance ?? 0, lCfg.decay ?? 1);
        pl.position.set(lCfg.x ?? 0, lCfg.y ?? 2, lCfg.z ?? 2);
        threeScene.add(pl); break;
      }
      case 'spot': {
        const sl = new THREE.SpotLight(col, int);
        sl.angle = lCfg.angle ?? 0.4; sl.penumbra = lCfg.penumbra ?? 0.3;
        sl.position.set(lCfg.x ?? 0, lCfg.y ?? 5, lCfg.z ?? 0);
        threeScene.add(sl); break;
      }
      default: {
        const dl = new THREE.DirectionalLight(col, int);
        dl.position.set(lCfg.x ?? 4, lCfg.y ?? 4, lCfg.z ?? 6);
        threeScene.add(dl); break;
      }
    }
  });
  return { threeScene, camera };
}

// ─── Material factory ─────────────────────────────────────────────────────────
export function buildMaterial(cfg: any): THREE.Material {
  const loader      = new THREE.TextureLoader();
  const color       = new THREE.Color(cfg.color    ?? '#888888');
  const emissive    = new THREE.Color(cfg.emissive ?? '#000000');
  const opacity     = cfg.opacity ?? 1;
  const transparent = opacity < 1;
  const wireframe   = cfg.wireframe ?? false;
  const side = cfg.side === 'back' ? THREE.BackSide : cfg.side === 'double' ? THREE.DoubleSide : THREE.FrontSide;
  const base: any = { color, wireframe, transparent, opacity, side };
  if (cfg.texture) base.map = loader.load(cfg.texture);
  const matType = cfg.material ?? 'standard';
  if (matType === 'basic')     return new THREE.MeshBasicMaterial(base);
  if (matType === 'phong')     return new THREE.MeshPhongMaterial({ ...base, emissive, specular: color, shininess: cfg.shininess ?? 30 });
  if (matType === 'toon')      return new THREE.MeshToonMaterial({ ...base, emissive, emissiveIntensity: cfg.emissiveIntensity ?? 0 });
  if (matType === 'normal')    return new THREE.MeshNormalMaterial({ wireframe, side });
  if (matType === 'wireframe') return new THREE.MeshBasicMaterial({ color, wireframe: true, transparent, opacity });
  return new THREE.MeshStandardMaterial({ ...base, emissive, emissiveIntensity: cfg.emissiveIntensity ?? 0, metalness: cfg.metalness ?? 0, roughness: cfg.roughness ?? 0.5, flatShading: cfg.flatShading ?? false });
}

// ─── Geometry factory ─────────────────────────────────────────────────────────
export function buildGeometry(cfg: any): THREE.BufferGeometry {
  switch (cfg.shape) {
    case 'sphere':   return new THREE.SphereGeometry(cfg.radius ?? 1, cfg.widthSegments ?? 32, cfg.heightSegments ?? 32);
    case 'cylinder': return new THREE.CylinderGeometry(cfg.radiusTop ?? 0.5, cfg.radiusBottom ?? 0.5, cfg.height ?? 2, cfg.radialSegments ?? 32);
    case 'cone':     return new THREE.ConeGeometry(cfg.radius ?? 0.5, cfg.height ?? 2, cfg.radialSegments ?? 32);
    case 'torus':    return new THREE.TorusGeometry(cfg.radius ?? 1, cfg.tube ?? 0.3, cfg.radialSegments ?? 16, cfg.tubularSegments ?? 48);
    case 'plane':    return new THREE.PlaneGeometry(cfg.width ?? 2, cfg.height ?? 2, cfg.widthSegments ?? 1, cfg.heightSegments ?? 1);
    case 'ring':     return new THREE.RingGeometry(cfg.innerRadius ?? 0.5, cfg.outerRadius ?? 1.2, cfg.thetaSegments ?? 32);
    case 'capsule': {
      const CG = (THREE as any).CapsuleGeometry;
      if (CG) return new CG(cfg.radius ?? 0.5, cfg.length ?? 1.5, cfg.capSegments ?? 8, cfg.radialSegments ?? 16);
      return new THREE.CylinderGeometry(cfg.radius ?? 0.5, cfg.radius ?? 0.5, (cfg.length ?? 1.5) + (cfg.radius ?? 0.5) * 2, cfg.radialSegments ?? 16);
    }
    default: return new THREE.BoxGeometry(cfg.width ?? 1, cfg.height ?? 1, cfg.depth ?? 1);
  }
}

// ─── Build a single mesh ──────────────────────────────────────────────────────
export function buildObject(cfg: any): THREE.Mesh {
  const mesh = new THREE.Mesh(buildGeometry(cfg), buildMaterial(cfg));
  mesh.position.set(cfg.x ?? 0, cfg.y ?? 0, cfg.z ?? 0);
  mesh.rotation.set((cfg.rotationX ?? 0) * Math.PI / 180, (cfg.rotationY ?? 0) * Math.PI / 180, (cfg.rotationZ ?? 0) * Math.PI / 180);
  const su = cfg.scale ?? 1;
  mesh.scale.set(cfg.scaleX ?? su, cfg.scaleY ?? su, cfg.scaleZ ?? su);
  (mesh as any).__cfg   = cfg;
  (mesh as any).__origX = mesh.position.x;
  (mesh as any).__origY = mesh.position.y;
  (mesh as any).__origZ = mesh.position.z;
  (mesh as any).__phase = Math.random() * Math.PI * 2;
  (mesh as any).__orbit = 0;
  return mesh;
}

// ─── Per-frame continuous animation tick ─────────────────────────────────────
export function tickObject(mesh: THREE.Mesh, anim: any, dt: number, elapsed: number) {
  if (!anim) return;
  const PI    = Math.PI;
  const cfg   = (mesh as any).__cfg  ?? {};
  const origY = (mesh as any).__origY ?? mesh.position.y;
  const phase = (mesh as any).__phase ?? 0;
  if (anim.spinX) mesh.rotation.x += (anim.spinX * PI / 180) * dt;
  if (anim.spinY) mesh.rotation.y += (anim.spinY * PI / 180) * dt;
  if (anim.spinZ) mesh.rotation.z += (anim.spinZ * PI / 180) * dt;
  if (anim.bobY) {
    const speed = anim.bobSpeed ?? 1;
    mesh.position.y = origY + anim.bobY * Math.sin(elapsed * PI * 2 * speed + phase);
  }
  if (anim.orbitRadius && anim.orbitSpeed) {
    (mesh as any).__orbit = ((mesh as any).__orbit ?? 0) + (anim.orbitSpeed * PI / 180) * dt;
    const angle = (mesh as any).__orbit;
    mesh.position.x = Math.sin(angle) * anim.orbitRadius + ((mesh as any).__origX ?? 0);
    mesh.position.z = Math.cos(angle) * anim.orbitRadius + ((mesh as any).__origZ ?? 0);
  }
  if (anim.pulseScale) {
    const ps = anim.pulseSpeed ?? 1;
    const p  = 1 + anim.pulseScale * Math.sin(elapsed * PI * 2 * ps + phase);
    const su = cfg.scale ?? 1;
    mesh.scale.set((cfg.scaleX ?? su) * p, (cfg.scaleY ?? su) * p, (cfg.scaleZ ?? su) * p);
  }
  if (anim.colorCycle?.length > 0) {
    const idx = Math.floor(elapsed * (anim.colorCycleSpeed ?? 1)) % anim.colorCycle.length;
    (mesh.material as THREE.MeshStandardMaterial).color?.set(anim.colorCycle[idx]);
  }
}

// ─── Keyframe runner ──────────────────────────────────────────────────────────
export function* runKeyframes(mesh: THREE.Mesh, keyframes: any[], _totalDuration: number) {
  if (!keyframes?.length) return;
  for (const kf of keyframes) {
    const kfDur  = kf.duration ?? 0.5;
    const easeFn = getEase(kf.ease ?? 'easeInOutCubic');
    yield* waitFor(kf.at ?? 0);
    const startX = mesh.position.x, startY = mesh.position.y, startZ = mesh.position.z;
    const startRX = mesh.rotation.x, startRY = mesh.rotation.y, startRZ = mesh.rotation.z;
    const startSX = mesh.scale.x, startSY = mesh.scale.y, startSZ = mesh.scale.z;
    const mat = mesh.material as any;
    const startColor    = mat.color    ? mat.color.clone()    : null;
    const startEmissive = mat.emissive ? mat.emissive.clone() : null;
    const startOpacity  = mat.opacity  ?? 1;
    const tsu   = kf.scale ?? null;
    const endX  = kf.x         !== undefined ? kf.x                         : startX;
    const endY  = kf.y         !== undefined ? kf.y                         : startY;
    const endZ  = kf.z         !== undefined ? kf.z                         : startZ;
    const endRX = kf.rotationX !== undefined ? kf.rotationX * Math.PI / 180 : startRX;
    const endRY = kf.rotationY !== undefined ? kf.rotationY * Math.PI / 180 : startRY;
    const endRZ = kf.rotationZ !== undefined ? kf.rotationZ * Math.PI / 180 : startRZ;
    const endSX = kf.scaleX !== undefined ? kf.scaleX : (tsu !== null ? tsu : startSX);
    const endSY = kf.scaleY !== undefined ? kf.scaleY : (tsu !== null ? tsu : startSY);
    const endSZ = kf.scaleZ !== undefined ? kf.scaleZ : (tsu !== null ? tsu : startSZ);
    const endColor    = kf.color    ? new THREE.Color(kf.color)    : startColor;
    const endEmissive = kf.emissive ? new THREE.Color(kf.emissive) : startEmissive;
    const endOpacity  = kf.opacity  !== undefined ? kf.opacity : startOpacity;
    yield* tween(kfDur, v => {
      const t = easeFn(v);
      mesh.position.set(lerp(startX, endX, t), lerp(startY, endY, t), lerp(startZ, endZ, t));
      mesh.rotation.set(lerp(startRX, endRX, t), lerp(startRY, endRY, t), lerp(startRZ, endRZ, t));
      mesh.scale.set(lerp(startSX, endSX, t), lerp(startSY, endSY, t), lerp(startSZ, endSZ, t));
      if (mat.color && endColor)       mat.color.lerpColors(startColor, endColor, t);
      if (mat.emissive && endEmissive) mat.emissive.lerpColors(startEmissive, endEmissive, t);
      if (mat.opacity !== undefined)   mat.opacity = lerp(startOpacity, endOpacity, t);
    });
  }
}

// ─── Preset builders ──────────────────────────────────────────────────────────
export function buildSplitImage(src: string, cfg: any) {
  const loader   = new THREE.TextureLoader();
  const texture  = loader.load(src);
  const group    = new THREE.Group();
  const size     = cfg.sliceSize ?? 2;
  const slices   = cfg.slices ?? 3;
  const partH    = size / slices;
  const sidCol   = cfg.sideColor ?? '#222222';
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < slices; i++) {
    const geometry = new THREE.BoxGeometry(size, partH, size);
    const tex = texture.clone(); tex.needsUpdate = true;
    tex.repeat.set(1, 1 / slices); tex.offset.set(0, 1 - (i + 1) / slices);
    const materials = [
      new THREE.MeshStandardMaterial({ color: sidCol }),
      new THREE.MeshStandardMaterial({ color: sidCol }),
      new THREE.MeshStandardMaterial({ color: sidCol }),
      new THREE.MeshStandardMaterial({ color: sidCol }),
      new THREE.MeshStandardMaterial({ map: tex }),
      new THREE.MeshStandardMaterial({ color: '#111111' }),
    ];
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.y = partH - i * partH - partH / 2;
    group.add(mesh); meshes.push(mesh);
  }
  if (cfg.position) group.position.set(cfg.position.x ?? 0, cfg.position.y ?? 0, cfg.position.z ?? 0);
  return { group, meshes };
}

export function buildRotateCubePreset(cfg: any) {
  const geo = new THREE.BoxGeometry(cfg.width ?? 2, cfg.height ?? 2, cfg.depth ?? 2);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.color ?? '#4444ff'), emissive: new THREE.Color(cfg.emissive ?? '#000000'), metalness: cfg.metalness ?? 0, roughness: cfg.roughness ?? 0.5, wireframe: cfg.wireframe ?? false });
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group(); group.add(mesh);
  if (cfg.position) group.position.set(cfg.position.x ?? 0, cfg.position.y ?? 0, cfg.position.z ?? 0);
  return { group, mesh };
}

export function buildFloatingSpheres(cfg: any) {
  const count  = cfg.count ?? 8;
  const group  = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const spread = cfg.spread ?? 3;
    const mesh = buildObject({ shape: 'sphere', radius: cfg.radius ?? 0.3, color: cfg.color ?? '#ff6b6b', emissive: cfg.emissive ?? '#000000', metalness: cfg.metalness ?? 0.2, roughness: cfg.roughness ?? 0.5, x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread, z: (Math.random() - 0.5) * spread });
    (mesh as any).__origY = mesh.position.y;
    (mesh as any).__phase = Math.random() * Math.PI * 2;
    group.add(mesh); meshes.push(mesh);
  }
  return { group, meshes };
}

export function buildParticleField(cfg: any) {
  const count  = cfg.count  ?? 200;
  const spread = cfg.spread ?? 6;
  const size   = cfg.size   ?? 0.04;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat    = new THREE.PointsMaterial({ color: new THREE.Color(cfg.color ?? '#ffffff'), size });
  const points = new THREE.Points(geo, mat);
  const group  = new THREE.Group(); group.add(points);
  return { group, points };
}

// ─── Main Three.js layer runner ───────────────────────────────────────────────
export function* runThreeJsLayer(view: any, item: any) {
  const { threeScene, camera } = setupThreeScene(item);
  const threeRef    = createRef<Three>();
  const zIdx        = item.zIndex   ?? 0;
  const duration    = item.duration ?? 5;
  const fadeInTime  = item.fadeIn?.time  ?? 0;
  const fadeOutTime = item.fadeOut?.time ?? 0;
  const effect      = item.effect ?? 'objects';
  const animDur     = duration - fadeInTime - fadeOutTime;

  if (item.background) {
    view.add(<Rect width={WIDTH()} height={HEIGHT()} fill={item.background} zIndex={zIdx - 1} />);
  }
  view.add(<Three ref={threeRef} width={WIDTH()} height={HEIGHT()} camera={camera} scene={threeScene} opacity={fadeInTime > 0 ? 0 : 1} zIndex={zIdx} />);
  if (fadeInTime > 0) yield* threeRef().opacity(1, fadeInTime);

  if (effect === 'objects') {
    const objCfgs: any[] = item.objects ?? [];
    const meshes = objCfgs.map(cfg => { const m = buildObject(cfg); threeScene.add(m); return m; });
    const dt = 1 / 60;
    yield* all(
      tween(animDur, (_, absT) => {
        const elapsed = absT ?? 0;
        meshes.forEach((mesh, idx) => { const anim = objCfgs[idx]?.animate; if (anim) tickObject(mesh, anim, dt, elapsed); });
      }),
      ...meshes.map((mesh, idx) => runKeyframes(mesh, objCfgs[idx]?.animateTo ?? [], animDur))
    );
  }
  else if (effect === 'splitImage') {
    const { group, meshes } = buildSplitImage(item.src ?? 'https://picsum.photos/800/800', item.splitImage ?? {});
    threeScene.add(group);
    const cfg = item.splitImage ?? {};
    const t1 = cfg.animTime ?? 1.5, th = cfg.holdTime ?? 0.3, t2 = cfg.secondAnimTime ?? 1.0;
    yield* tween(t1, v => { const a = v * Math.PI; meshes.forEach((m, i) => { m.rotation.y = i % 2 === 0 ? -a : a; }); });
    yield* waitFor(th);
    yield* tween(t2, v => { const a = Math.PI + v * 0.3; meshes.forEach((m, i) => { m.rotation.y = i % 2 === 0 ? -a : a; }); });
    const rem = animDur - t1 - th - t2; if (rem > 0) yield* waitFor(rem);
  }
  else if (effect === 'rotateCube') {
    const cfg = item.rotateCube ?? {};
    const { group } = buildRotateCubePreset(cfg);
    threeScene.add(group);
    const at = cfg.animTime ?? animDur;
    yield* tween(at, v => { const e = easeInOutCubic(v); group.rotation.x = (cfg.rotateX ?? 1) * Math.PI * 2 * e; group.rotation.y = (cfg.rotateY ?? 2) * Math.PI * 2 * e; });
    const rem = animDur - at; if (rem > 0) yield* waitFor(rem);
  }
  else if (effect === 'floatingSpheres') {
    const cfg = item.floatingSpheres ?? {};
    const { group, meshes } = buildFloatingSpheres(cfg);
    threeScene.add(group);
    const at = cfg.animTime ?? animDur, speed = cfg.speed ?? 1;
    yield* tween(at, v => {
      meshes.forEach(m => { m.position.y = ((m as any).__origY ?? 0) + Math.sin(v * Math.PI * 4 * speed + ((m as any).__phase ?? 0)) * 0.3; });
      group.rotation.y = v * Math.PI * 2 * speed * 0.3;
    });
    const rem = animDur - at; if (rem > 0) yield* waitFor(rem);
  }
  else if (effect === 'particleField') {
    const cfg = item.particleField ?? {};
    const { group } = buildParticleField(cfg);
    threeScene.add(group);
    const at = cfg.animTime ?? animDur, speed = cfg.speed ?? 0.5;
    yield* tween(at, v => { group.rotation.y = v * Math.PI * 2 * speed; group.rotation.x = v * Math.PI * speed * 0.4; });
    const rem = animDur - at; if (rem > 0) yield* waitFor(rem);
  }

  if (fadeOutTime > 0) yield* threeRef().opacity(0, fadeOutTime);
}