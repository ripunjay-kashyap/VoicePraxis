"use client";

import * as React from "react";
import * as THREE from "three";

/** What a scene gets each frame: elapsed seconds, the pointer (-1..1) and the viewport aspect. */
export interface FrameInfo {
  t: number;
  dt: number;
  pointer: { x: number; y: number };
  aspect: number;
  /** prefers-reduced-motion: a single still frame is drawn */
  reduced: boolean;
}

export interface SceneHandle {
  update: (f: FrameInfo) => void;
  /** Called on every resize with the new aspect (width / height). */
  resize?: (aspect: number, camera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
}

export type SceneBuilder = (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => SceneHandle | Promise<SceneHandle>;

/**
 * Mounts a transparent WebGL canvas in the returned ref. Renders only while visible,
 * draws a single still frame for reduced motion, and frees everything on unmount.
 * If WebGL isn't available the container stays empty (the caller shows its fallback).
 */
export function useThreeStage(build: SceneBuilder, onFail?: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  const buildRef = React.useRef(build);
  const failRef = React.useRef(onFail);

  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      failRef.current?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    let handle: SceneHandle | null = null;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let aspect = 1;

    const size = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      aspect = w / h;
      renderer.setSize(w, h, false);
      camera.aspect = aspect;
      handle?.resize?.(aspect, camera);
      camera.updateProjectionMatrix();
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed || !handle) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      elapsed += dt;
      pointer.x += (target.x - pointer.x) * Math.min(1, dt * 3);
      pointer.y += (target.y - pointer.y) * Math.min(1, dt * 3);
      handle.update({ t: elapsed, dt, pointer, aspect, reduced });
      renderer.render(scene, camera);
      if (visible && !reduced) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && !disposed) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const onPointer = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
    };
    host.addEventListener("pointermove", onPointer);
    host.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => {
      size();
      if (reduced) start();
    });
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(host);

    Promise.resolve(buildRef.current(scene, camera))
      .then((h) => {
        if (disposed) {
          h.dispose();
          return;
        }
        handle = h;
        size();
        start();
      })
      .catch(() => failRef.current?.());

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerleave", onLeave);
      handle?.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          (x as THREE.MeshBasicMaterial).map?.dispose();
          x.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return ref;
}

/** Fit a width × height box (scene units) into the camera view at the given aspect. */
export function fitCamera(camera: THREE.PerspectiveCamera, aspect: number, width: number, height: number) {
  const vFov = (camera.fov * Math.PI) / 180;
  const distForHeight = height / 2 / Math.tan(vFov / 2);
  const distForWidth = width / 2 / (Math.tan(vFov / 2) * aspect);
  return Math.max(distForHeight, distForWidth);
}

/** Ease in-out for 0..1 progress. */
export const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
