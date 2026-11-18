import * as THREE from 'three';
import { useMemo } from 'react';
import { createGlowTexture, useThreeScene, type ThreeContext } from './engine';

export interface GlucoseSceneParams {
  values: number[];
  low: number;
  high: number;
}

const MIN_MGDL = 40;
const MAX_MGDL = 300;
const HALF_WIDTH = 2.15;
const HALF_HEIGHT = 1.05;

const mapY = (mgdl: number): number => {
  const clamped = Math.max(MIN_MGDL, Math.min(MAX_MGDL, mgdl));
  const t = (clamped - MIN_MGDL) / (MAX_MGDL - MIN_MGDL);
  return (t - 0.5) * 2 * HALF_HEIGHT;
};

function colorFor(mgdl: number, low: number, high: number): string {
  if (mgdl < 54) return '#ff5d7a';
  if (mgdl < low) return '#ff9f6b';
  if (mgdl <= high) return '#2fe0b0';
  if (mgdl <= 250) return '#ffc65c';
  return '#ff5d7a';
}

const BAND_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BAND_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float horizontal = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float vertical = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
    gl_FragColor = vec4(uColor, horizontal * vertical * uOpacity);
    #include <colorspace_fragment>
  }
`;

interface BuiltCurve {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  dots: THREE.Mesh[];
  pulse: THREE.Mesh;
  pulseGlow: THREE.Sprite;
  glowTexture: THREE.CanvasTexture;
  bandMaterial: THREE.ShaderMaterial;
}

function buildCurve(params: GlucoseSceneParams): BuiltCurve {
  const group = new THREE.Group();
  const values = params.values.length ? params.values : [(params.low + params.high) / 2, (params.low + params.high) / 2];
  const count = values.length;

  const points = values.map((value, index) => {
    const x = count === 1 ? 0 : -HALF_WIDTH + (index / (count - 1)) * HALF_WIDTH * 2;
    const z = Math.sin(index * 0.72) * 0.16;
    return new THREE.Vector3(x, mapY(value), z);
  });

  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25);
  const geometry = new THREE.TubeGeometry(curve, Math.max(48, count * 10), 0.055, 10, false);

  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i);
    const t = (y / HALF_HEIGHT + 1) / 2;
    const mgdl = MIN_MGDL + t * (MAX_MGDL - MIN_MGDL);
    color.set(colorFor(mgdl, params.low, params.high));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const tube = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.28,
      metalness: 0.2,
      emissive: new THREE.Color(0x0a2928),
      emissiveIntensity: 0.75,
    }),
  );
  group.add(tube);

  const dotGeometry = new THREE.SphereGeometry(0.07, 16, 16);
  const dots: THREE.Mesh[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorFor(values[i], params.low, params.high)) });
    const dot = new THREE.Mesh(dotGeometry, material);
    dot.position.copy(points[i]);
    dot.renderOrder = 2;
    dots.push(dot);
    group.add(dot);
  }

  // faixa-alvo com bordas suaves
  const bandBottom = mapY(params.low);
  const bandTop = mapY(params.high);
  const bandHeight = Math.max(0.05, bandTop - bandBottom);
  const bandMaterial = new THREE.ShaderMaterial({
    vertexShader: BAND_VERTEX,
    fragmentShader: BAND_FRAGMENT,
    uniforms: {
      uColor: { value: new THREE.Color('#2fe0b0') },
      uOpacity: { value: 0.18 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const band = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2 + 0.24, bandHeight), bandMaterial);
  band.position.set(0, (bandTop + bandBottom) / 2, -0.35);
  group.add(band);

  const borderMaterial = new THREE.LineBasicMaterial({ color: 0x2fe0b0, transparent: true, opacity: 0.3 });
  for (const y of [bandTop, bandBottom]) {
    const borderPoints = [new THREE.Vector3(-HALF_WIDTH - 0.1, y, -0.35), new THREE.Vector3(HALF_WIDTH + 0.1, y, -0.35)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(borderPoints), borderMaterial));
  }

  // grade horizontal
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x8b98b6, transparent: true, opacity: 0.13 });
  for (const mgdl of [70, 120, 180, 250]) {
    const y = mapY(mgdl);
    const gridPoints = [new THREE.Vector3(-HALF_WIDTH - 0.1, y, -0.4), new THREE.Vector3(HALF_WIDTH + 0.1, y, -0.4)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(gridPoints), gridMaterial));
  }

  // pulso de luz que percorre a curva
  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.078, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xf2fffb, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  pulse.renderOrder = 3;
  const glowTexture = createGlowTexture('#8bffe4', 128);
  const pulseGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x9dffe9,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  pulseGlow.scale.setScalar(0.68);
  group.add(pulse, pulseGlow);

  return { group, curve, dots, pulse, pulseGlow, glowTexture, bandMaterial };
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
    if (mesh.geometry) mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      const map = (material as THREE.MeshBasicMaterial).map;
      if (map) map.dispose();
      material.dispose();
    }
  });
}

export function GlucoseScene({ values, low, high }: GlucoseSceneParams) {
  const key = values.join(',');
  const params = useMemo<GlucoseSceneParams>(() => ({ values: key ? key.split(',').map(Number) : [], low, high }), [key, low, high]);

  const hostRef = useThreeScene<GlucoseSceneParams>((ctx: ThreeContext, initial) => {
    ctx.camera.position.set(0, 0.18, 5.15);
    ctx.camera.lookAt(0, 0, 0);

    ctx.scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const dir = new THREE.DirectionalLight(0xffffff, 2.4);
    dir.position.set(-2.5, 3.5, 3);
    ctx.scene.add(dir);
    const fill = new THREE.PointLight(0x4cc9f0, 12, 12, 2);
    fill.position.set(2.6, -1.2, 2.4);
    ctx.scene.add(fill);

    let built = buildCurve(initial);
    ctx.scene.add(built.group);

    let lastKey = initial.values.join(',');
    let lastLow = initial.low;
    let lastHigh = initial.high;

    const setParams = (next: GlucoseSceneParams) => {
      if (next.values.join(',') === lastKey && next.low === lastLow && next.high === lastHigh) return;
      lastKey = next.values.join(',');
      lastLow = next.low;
      lastHigh = next.high;
      ctx.scene.remove(built.group);
      disposeGroup(built.group);
      built = buildCurve(next);
      ctx.scene.add(built.group);
    };

    const update = (dt: number, elapsed: number) => {
      const travel = (elapsed * 0.055) % 1;
      const point = built.curve.getPointAt(travel);
      built.pulse.position.copy(point);
      built.pulseGlow.position.copy(point);

      const pulseScale = 1 + Math.sin(elapsed * 4.4) * 0.24;
      built.pulse.scale.setScalar(pulseScale);
      built.pulseGlow.scale.setScalar(0.66 * pulseScale);
      built.bandMaterial.uniforms.uOpacity.value = 0.16 + Math.sin(elapsed * 1.6) * 0.03;

      for (let index = 0; index < built.dots.length; index += 1) {
        const scale = 1 + Math.sin(elapsed * 2.3 + index * 0.75) * 0.12;
        built.dots[index].scale.setScalar(scale);
      }

      built.group.rotation.y = Math.sin(elapsed * 0.5) * 0.34 + ctx.pointer.x * 0.3;
      built.group.rotation.x = -0.1 + Math.sin(elapsed * 0.36) * 0.07 + ctx.pointer.y * 0.12;
      built.group.position.y = Math.sin(elapsed * 0.85) * 0.025;
      void dt;
    };

    const resize = (width: number, height: number) => {
      const aspect = width / Math.max(1, height);
      ctx.camera.position.z = aspect > 2.1 ? 3.25 : aspect > 1.6 ? 3.6 : 4.25;
      ctx.camera.lookAt(0, 0, 0);
    };
    resize(ctx.width, ctx.height);

    return {
      update,
      setParams,
      resize,
      dispose: () => disposeGroup(built.group),
    };
  }, params);

  return <div className="orb-scene" ref={hostRef} />;
}
