import * as THREE from 'three';
import { useMemo } from 'react';
import { createGlowTexture, useThreeScene, type ThreeContext } from './engine';

export interface OrbParams {
  calories: number;
  water: number;
  glucose: number;
}

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 pos = position;
    float n = fbm(pos * 1.45 + vec3(uTime * 0.12, uTime * 0.16, -uTime * 0.09));
    float ripple = sin(pos.y * 4.2 + uTime * 0.75) * 0.5 + 0.5;
    float displacement = (n - 0.5) * 0.38 + (ripple - 0.5) * 0.03;
    pos += normalize(normal) * displacement * uAmp;

    vNoise = n;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vView = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColorDeep;
  uniform vec3 uColorMid;
  uniform vec3 uColorRim;
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 view = normalize(vView);
    float fresnel = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 2.1);
    float bands = smoothstep(0.32, 0.86, vNoise + 0.22 * sin(vNoise * 16.0 + uTime * 0.4));
    float ember = smoothstep(0.55, 1.0, vNoise) * 0.35;
    vec3 color = mix(uColorDeep, uColorMid, bands + ember);
    color = mix(color, uColorRim, fresnel * 0.85);
    color += vec3(0.02, 0.08, 0.07) * bands;
    float alpha = uOpacity * (0.62 + fresnel * 0.42);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

function makeRing(radius: number, color: string): { group: THREE.Group; bright: THREE.Mesh; maxIndex: number } {
  const group = new THREE.Group();
  const dim = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.008, 6, 240),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.14, depthWrite: false }),
  );
  const brightGeometry = new THREE.TorusGeometry(radius, 0.016, 8, 240);
  const bright = new THREE.Mesh(
    brightGeometry,
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.9, depthWrite: false }),
  );
  bright.rotation.z = -Math.PI / 2;
  group.add(dim, bright);
  return { group, bright, maxIndex: brightGeometry.index?.count ?? 0 };
}

export function OrbScene({ calories, water, glucose }: OrbParams) {
  const params = useMemo<OrbParams>(() => ({ calories, water, glucose }), [calories, water, glucose]);

  const hostRef = useThreeScene<OrbParams>((ctx: ThreeContext) => {
    const group = new THREE.Group();
    ctx.scene.add(group);

    const glowTexture = createGlowTexture('#2fe0b0', 256);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture, color: 0x3ce9c0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.scale.setScalar(6.4);
    halo.position.z = -1.6;
    ctx.scene.add(halo);

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 1 },
      uColorDeep: { value: new THREE.Color('#052029') },
      uColorMid: { value: new THREE.Color('#0d6f68') },
      uColorRim: { value: new THREE.Color('#63f5c8') },
      uOpacity: { value: 0.96 },
    };

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(1.28, 96, 72),
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    group.add(orb);

    // Aro luminoso interno
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(1.42, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x2fe0b0, transparent: true, opacity: 0.04, side: THREE.BackSide, depthWrite: false }),
    );
    group.add(rim);

    const kcalRing = makeRing(1.76, '#ffbe5c');
    kcalRing.group.rotation.set(1.24, 0.16, -0.22);
    const waterRing = makeRing(2.02, '#4cc9f0');
    waterRing.group.rotation.set(1.62, -0.42, 0.5);
    const glucoseRing = makeRing(1.58, '#2fe0b0');
    glucoseRing.group.rotation.set(0.92, 0.86, 0.12);
    group.add(kcalRing.group, waterRing.group, glucoseRing.group);

    const particleCount = 260;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 2.1 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.8;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        size: 0.035,
        color: 0x7df0d0,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(particles);

    let current = { calories: 0, water: 0, glucose: 0 };
    let target = { calories: 0, water: 0, glucose: 0 };
    let smoothX = 0;
    let smoothY = 0;
    let frame = 0;

    const applyArc = (ring: ReturnType<typeof makeRing>, pct: number) => {
      const clamped = Math.max(0.001, Math.min(1, pct));
      const indexCount = Math.floor((clamped * ring.maxIndex) / 3) * 3;
      ring.bright.geometry.setDrawRange(0, indexCount);
      (ring.bright.material as THREE.MeshBasicMaterial).opacity = 0.55 + clamped * 0.4;
    };

    const setParams = (next: OrbParams) => {
      target = {
        calories: Math.max(0.02, Math.min(1, next.calories)),
        water: Math.max(0.02, Math.min(1, next.water)),
        glucose: Math.max(0.02, Math.min(1, next.glucose)),
      };
    };
    setParams({ calories, water, glucose });

    const update = (dt: number, elapsed: number) => {
      uniforms.uTime.value = elapsed;
      frame += 1;
      const ease = Math.min(1, dt * 3.2);
      current.calories += (target.calories - current.calories) * ease;
      current.water += (target.water - current.water) * ease;
      current.glucose += (target.glucose - current.glucose) * ease;

      if (frame % 3 === 0) {
        applyArc(kcalRing, current.calories);
        applyArc(waterRing, current.water);
        applyArc(glucoseRing, current.glucose);
      }

      smoothX += (ctx.pointer.x - smoothX) * Math.min(1, dt * 2.4);
      smoothY += (ctx.pointer.y - smoothY) * Math.min(1, dt * 2.4);

      group.rotation.y = elapsed * 0.13 + smoothX * 0.45;
      group.rotation.x = Math.sin(elapsed * 0.22) * 0.06 + smoothY * 0.18;
      particles.rotation.y = -elapsed * 0.05;
      particles.rotation.x = Math.sin(elapsed * 0.12) * 0.08;
      const pulse = 1 + Math.sin(elapsed * 1.4) * 0.04;
      orb.scale.setScalar(pulse);
      halo.material.opacity = 0.4 + Math.sin(elapsed * 1.1) * 0.08;
    };

    const resize = (width: number, height: number) => {
      const aspect = width / Math.max(1, height);
      if (aspect > 1.9) {
        group.position.set(1.85, 0, 0);
        group.scale.setScalar(1.02);
      } else if (aspect > 1.3) {
        group.position.set(1.4, 0.18, 0);
        group.scale.setScalar(0.8);
      } else {
        group.position.set(0.95, 0.5, 0);
        group.scale.setScalar(0.68);
      }
      halo.position.set(group.position.x, group.position.y, -1.6);
    };
    resize(ctx.width, ctx.height);

    return {
      update,
      setParams,
      resize,
      dispose: () => {
        glowTexture.dispose();
      },
    };
  }, params);

  return <div className="orb-scene" ref={hostRef} />;
}
