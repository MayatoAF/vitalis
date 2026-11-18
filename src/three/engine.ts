import * as THREE from 'three';
import { useEffect, useRef, type RefObject } from 'react';

export interface ThreeContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
  pointer: THREE.Vector2;
  theme: 'dark' | 'light';
}

export interface ThreeController<P> {
  update: (dt: number, elapsed: number) => void;
  setParams?: (params: P) => void;
  resize?: (width: number, height: number) => void;
  dispose?: () => void;
}

type Setup<P> = (context: ThreeContext, params: P) => ThreeController<P>;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function readTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (mesh as THREE.Mesh).material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else if (material) material.dispose();
  });
}

/**
 * Cria renderer/câmera/loop com resize, pausa fora da tela,
 * respeito a movimento reduzido e descarte completo.
 */
export function useThreeScene<P>(setup: Setup<P>, params: P, options: { className?: string } = {}): RefObject<HTMLDivElement | null> {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ThreeController<P> | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 5);

    const width = host.clientWidth || 600;
    const height = host.clientHeight || 320;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const context: ThreeContext = {
      renderer,
      scene,
      camera,
      width,
      height,
      pointer: new THREE.Vector2(0, 0),
      theme: readTheme(),
    };

    const controller = setup(context, paramsRef.current);
    controllerRef.current = controller;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      controller.resize?.(w, h);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const onPointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      context.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      context.pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    };
    const onPointerLeave = () => {
      context.pointer.set(0, 0);
    };
    host.addEventListener('pointermove', onPointer, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave);

    let visible = true;
    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.01 },
    );
    intersection.observe(host);

    const reduced = prefersReducedMotion();
    const clock = new THREE.Clock();
    let raf = 0;
    let lastTheme = context.theme;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      if (!visible || document.hidden) return;

      const theme = readTheme();
      if (theme !== lastTheme) {
        lastTheme = theme;
        context.theme = theme;
        controller.setParams?.(paramsRef.current);
      }
      controller.update(dt, elapsed);
      renderer.render(scene, camera);
    };

    if (reduced) {
      controller.update(0, 0);
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(tick);
    }

    const onVisibility = () => {
      if (!document.hidden) clock.getDelta();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      host.removeEventListener('pointermove', onPointer);
      host.removeEventListener('pointerleave', onPointerLeave);
      controller.dispose?.();
      disposeObject(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    controllerRef.current?.setParams?.(params);
  }, [params]);

  return hostRef;
}

/* ------------------------------ small helpers ----------------------------- */

export function createGlowTexture(color = '#2fe0b0', size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.35, `${color}aa`);
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
