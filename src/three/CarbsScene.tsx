import * as THREE from 'three';
import { useMemo } from 'react';
import { createGlowTexture, useThreeScene, type ThreeContext } from './engine';

export interface CarbsParams {
  grams: number;
}

export function CarbsScene({ grams }: CarbsParams) {
  const params = useMemo<CarbsParams>(() => ({ grams }), [grams]);

  const hostRef = useThreeScene<CarbsParams>((ctx: ThreeContext) => {
    ctx.camera.position.set(0, 0.35, 4.2);
    ctx.camera.lookAt(0, 0, 0);

    ctx.scene.add(new THREE.AmbientLight(0xd8ccff, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2.4, 3, 3);
    ctx.scene.add(key);
    const accent = new THREE.PointLight(0xa78bfa, 26, 10, 2);
    accent.position.set(-2, -1, 2.2);
    ctx.scene.add(accent);

    const group = new THREE.Group();
    ctx.scene.add(group);

    const glowTexture = createGlowTexture('#a78bfa', 256);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.scale.setScalar(4.6);
    halo.position.z = -1.2;
    group.add(halo);

    const atoms: THREE.Vector3[] = [];
    const count = 6;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      atoms.push(new THREE.Vector3(Math.cos(angle) * 1.05, Math.sin(angle * 2) * 0.16, Math.sin(angle) * 0.5));
    }

    const atomMaterial = new THREE.MeshStandardMaterial({
      color: 0xa78bfa,
      emissive: new THREE.Color(0x4c2f9e),
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.35,
    });
    const atomGeometry = new THREE.IcosahedronGeometry(0.19, 1);
    const atomMeshes: THREE.Mesh[] = [];
    for (const position of atoms) {
      const atom = new THREE.Mesh(atomGeometry, atomMaterial);
      atom.position.copy(position);
      group.add(atom);
      atomMeshes.push(atom);
    }

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.3, 2),
      new THREE.MeshStandardMaterial({ color: 0x2fe0b0, emissive: new THREE.Color(0x0f6b5a), emissiveIntensity: 1, roughness: 0.18, metalness: 0.4 }),
    );
    group.add(core);

    const bondMaterial = new THREE.MeshBasicMaterial({ color: 0x8f7cf0, transparent: true, opacity: 0.55 });
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < atoms.length; i += 1) {
      const from = atoms[i];
      const to = atoms[(i + 1) % atoms.length];
      const direction = new THREE.Vector3().subVectors(to, from);
      const length = direction.length();
      const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, length, 6), bondMaterial);
      bond.position.copy(from).addScaledVector(direction, 0.5);
      bond.quaternion.setFromUnitVectors(up, direction.clone().normalize());
      group.add(bond);

      const spokeDirection = from.clone().normalize().multiplyScalar(1);
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75, 5), bondMaterial);
      spoke.position.copy(from).addScaledVector(spokeDirection, 0.28);
      spoke.quaternion.setFromUnitVectors(up, spokeDirection);
      group.add(spoke);
      void atomMeshes;
    }

    const dustCount = 90;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      const radius = 1.6 + Math.random() * 1.1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dustPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      dustPositions[i * 3 + 1] = radius * Math.cos(phi);
      dustPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ color: 0xc4b5fd, size: 0.04, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    group.add(dust);

    let targetScale = 1;
    let currentScale = 1;
    let aspectScale = 1;

    const update = (dt: number, elapsed: number) => {
      group.rotation.y = elapsed * 0.32 + ctx.pointer.x * 0.3;
      group.rotation.x = Math.sin(elapsed * 0.4) * 0.12 + ctx.pointer.y * 0.14;
      currentScale += (targetScale - currentScale) * Math.min(1, dt * 3);
      group.scale.setScalar(currentScale * aspectScale);
      core.rotation.y = -elapsed * 0.7;
      core.rotation.x = elapsed * 0.4;
      dust.rotation.y = elapsed * 0.1;
      halo.material.opacity = 0.28 + Math.sin(elapsed * 1.3) * 0.07;
    };

    const setParams = (next: CarbsParams) => {
      const pct = Math.max(0, Math.min(1, (Number.isFinite(next.grams) ? next.grams : 0) / 120));
      targetScale = 0.82 + pct * 0.4;
    };
    setParams({ grams });

    const resize = (width: number, height: number) => {
      const aspect = width / Math.max(1, height);
      ctx.camera.position.z = aspect < 1 ? 4.9 : 4.2;
      aspectScale = aspect < 1 ? 0.84 : 1;
    };
    resize(ctx.width, ctx.height);

    return {
      update,
      setParams,
      resize,
      dispose: () => glowTexture.dispose(),
    };
  }, params);

  return <div className="orb-scene" ref={hostRef} />;
}
