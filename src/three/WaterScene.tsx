import * as THREE from 'three';
import { useMemo } from 'react';
import { useThreeScene, type ThreeContext } from './engine';

export interface WaterParams {
  fill: number;
}

const SURFACE_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vec3 p = position;
    float d = length(p.xy);
    p.z += sin(d * 13.0 - uTime * 2.0) * 0.011
         + sin(p.x * 7.0 + uTime * 1.3) * 0.006
         + sin(p.y * 5.0 - uTime * 1.7) * 0.005;
    vPos = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const SURFACE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float edge = smoothstep(0.72, 1.0, d);
    float shimmer = 0.5 + 0.5 * sin(vPos.x * 18.0 + vPos.y * 14.0 + uTime * 2.2);
    vec3 color = mix(uColor, vec3(0.82, 0.97, 1.0), 0.3 + shimmer * 0.28);
    float alpha = 0.9 - edge * 0.3;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export function WaterScene({ fill }: WaterParams) {
  const params = useMemo<WaterParams>(() => ({ fill }), [fill]);

  const hostRef = useThreeScene<WaterParams>((ctx: ThreeContext) => {
    ctx.renderer.localClippingEnabled = true;
    ctx.camera.position.set(0, 0.18, 3.65);
    ctx.camera.lookAt(0, -0.02, 0);

    ctx.scene.add(new THREE.AmbientLight(0xbfe9ff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2.6, 4, 3);
    ctx.scene.add(key);
    const rim = new THREE.PointLight(0x4cc9f0, 22, 8, 2);
    rim.position.set(2.2, 0.6, 1.8);
    ctx.scene.add(rim);
    const warm = new THREE.PointLight(0x2fe0b0, 8, 8, 2);
    warm.position.set(-2, -1.4, 1.4);
    ctx.scene.add(warm);

    const group = new THREE.Group();
    ctx.scene.add(group);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xcdefff,
      transparent: true,
      opacity: 0.14,
      roughness: 0.06,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 0.9, 2.34, 72, 1, true), glassMaterial);
    group.add(glass);

    const rimMaterial = new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.38 });
    const topRim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.012, 8, 96), rimMaterial);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 1.17;
    const bottomRim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.012, 8, 96), rimMaterial);
    bottomRim.rotation.x = Math.PI / 2;
    bottomRim.position.y = -1.17;
    group.add(topRim, bottomRim);

    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.9);

    const liquidMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x2fa8d8,
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
      emissive: new THREE.Color(0x0a4054),
      emissiveIntensity: 0.65,
      clippingPlanes: [clipPlane],
      side: THREE.DoubleSide,
    });
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.86, 2.3, 72, 1, false), liquidMaterial);
    group.add(liquid);

    const surfaceUniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#47c9ef') },
    };
    const surface = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 96),
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
        uniforms: surfaceUniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    surface.rotation.x = -Math.PI / 2;
    group.add(surface);

    // Bolhas
    const bubbleCount = 46;
    const bubbleGeometry = new THREE.SphereGeometry(0.024, 8, 8);
    const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xbdefff, transparent: true, opacity: 0.55, depthWrite: false });
    const bubbles = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, bubbleCount);
    bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const bubbleData = Array.from({ length: bubbleCount }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.12 + Math.random() * 0.72,
      y: -1.1 + Math.random() * 2.1,
      speed: 0.12 + Math.random() * 0.28,
      scale: 0.5 + Math.random() * 1.1,
    }));
    group.add(bubbles);

    const dummy = new THREE.Object3D();
    let currentFill = 0;
    let targetFill = 0;
    setTarget(params.fill);
    currentFill = targetFill * 0.72;

    function setTarget(value: number) {
      targetFill = Math.max(0.02, Math.min(1, Number.isFinite(value) ? value : 0));
    }

    const update = (dt: number, elapsed: number) => {
      currentFill += (targetFill - currentFill) * Math.min(1, dt * 3.6);
      const surfaceY = -1.08 + currentFill * 2.08;
      clipPlane.constant = surfaceY;
      surface.position.y = surfaceY;
      surfaceUniforms.uTime.value = elapsed;

      for (let i = 0; i < bubbleCount; i += 1) {
        const bubble = bubbleData[i];
        bubble.y += bubble.speed * dt * (0.7 + currentFill * 0.8);
        if (bubble.y > surfaceY - 0.03) {
          bubble.y = -1.12;
          bubble.angle = Math.random() * Math.PI * 2;
          bubble.radius = 0.12 + Math.random() * 0.72;
        }
        const x = Math.cos(bubble.angle) * bubble.radius;
        const z = Math.sin(bubble.angle) * bubble.radius;
        dummy.position.set(x, bubble.y, z);
        dummy.scale.setScalar(bubble.scale * (0.7 + Math.sin(elapsed * 3 + i) * 0.15));
        dummy.updateMatrix();
        bubbles.setMatrixAt(i, dummy.matrix);
      }
      bubbles.instanceMatrix.needsUpdate = true;

      group.rotation.y = elapsed * 0.07 + ctx.pointer.x * 0.18;
      group.rotation.x = ctx.pointer.y * 0.06;
    };

    const resize = (width: number, height: number) => {
      const aspect = width / Math.max(1, height);
      const distance = aspect < 0.95 ? 4.5 : 3.65;
      ctx.camera.position.set(0, aspect < 0.95 ? 0.1 : 0.18, distance);
      ctx.camera.lookAt(0, -0.05, 0);
    };
    resize(ctx.width, ctx.height);

    return {
      update,
      setParams: (next) => setTarget(next.fill),
      resize,
    };
  }, params);

  return <div className="water-scene__canvas" ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
}
