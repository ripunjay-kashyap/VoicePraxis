"use client";

import * as React from "react";
import * as THREE from "three";
import { useThreeStage, fitCamera, SceneBuilder } from "@/components/three/stage";
import { COLORS, PX, pageFont, paintedPlane, roundRect, setOpacity, textPlane, wrap } from "@/components/three/paint";
import { REFERENCE } from "./caseData";

const K = 0.6; // scene units per second of video
const X0 = (-REFERENCE.duration * K) / 2;
const xOf = (t: number) => X0 + t * K;
const ROW = { frames: 1.6, seen: 0.3, said: -0.55, caption: -1.22 };
const RATE = 1.35; // playback speed of the loop
const HOLD = 1.6; // pause at the end of the loop, seconds

const fmt = (t: number) => `0:${Math.floor(t).toString().padStart(2, "0")}`;

/** The reference recording as one episode in 3D: video frames, what was seen, what was said. */
const build: SceneBuilder = async (scene, camera) => {
  await document.fonts?.ready;
  const font = pageFont();
  const root = new THREE.Group();
  scene.add(root);
  const { actions, narration, frames, duration } = REFERENCE;

  // Lane labels
  const lanes: [string, number][] = [
    ["VIDEO", ROW.frames + 0.62],
    ["SEEN", ROW.seen + 0.4],
    ["SAID", ROW.said + 0.4],
  ];
  for (const [label, y] of lanes) {
    const t = textPlane(label, { size: 0.12, color: COLORS.muted, weight: 600, font, anchor: "left" });
    t.position.set(X0, y, 0);
    root.add(t);
  }

  // Video frames (real stills from the recording)
  const loader = new THREE.TextureLoader();
  const frameItems = await Promise.all(
    frames.map(async (f) => {
      const tex = await loader.loadAsync(f.src).catch(() => null);
      if (tex) tex.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group();
      const border = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 1.04),
        new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true }),
      );
      const img = new THREE.Mesh(
        new THREE.PlaneGeometry(0.56, 1.0),
        new THREE.MeshBasicMaterial({ map: tex ?? undefined, color: tex ? 0xffffff : 0xf1f5f9, transparent: true }),
      );
      img.position.z = 0.002;
      g.add(border, img);
      g.position.set(xOf(f.t), ROW.frames, -0.35);
      root.add(g);
      return { t: f.t, g };
    }),
  );

  // Seen: one bar per step, sized to its time span
  const bars = actions.map((a) => {
    const w = Math.max((a.end - a.start) * K - 0.04, 0.5);
    const h = 0.5;
    const { mesh } = paintedPlane(w, h, (ctx, cw, ch) => {
      const r = 0.06 * PX;
      roundRect(ctx, 2, 2, cw - 4, ch - 4, r);
      ctx.fillStyle = COLORS.seenBg;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(37, 99, 235, 0.35)";
      ctx.stroke();
      ctx.fillStyle = COLORS.seen;
      roundRect(ctx, 2, 2, 0.035 * PX, ch - 4, r / 2);
      ctx.fill();
      ctx.fillStyle = "#1e40af";
      const fpx = 0.125 * PX;
      ctx.font = `600 ${fpx}px ${font}`;
      ctx.textBaseline = "middle";
      const lines = wrap(ctx, `${a.verb} · ${a.object}`, cw - 0.13 * PX, 2);
      const lh = fpx * 1.2;
      lines.forEach((l, i) => ctx.fillText(l, 0.085 * PX, ch / 2 + (i - (lines.length - 1) / 2) * lh));
    });
    mesh.position.set(xOf(a.start) + w / 2 + 0.02, ROW.seen, 0);
    root.add(mesh);
    return { a, mesh };
  });

  // Said: an audio waveform; speech is amber, silence is grey
  const BARS = 150;
  const barW = (duration * K) / BARS;
  const wave = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(barW * 0.6, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    BARS,
  );
  const m = new THREE.Matrix4();
  const speechOf = (t: number) => narration.findIndex((u) => t >= u.start && t <= u.end);
  const barTime: number[] = [];
  for (let i = 0; i < BARS; i++) {
    const t = ((i + 0.5) / BARS) * duration;
    barTime.push(t);
    const speaking = speechOf(t) !== -1;
    const noise = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.63 + 1.1));
    const h = speaking ? 0.12 + 0.3 * noise : 0.025 + 0.02 * noise;
    m.makeScale(1, h, 1).setPosition(xOf(t), ROW.said, 0.3);
    wave.setMatrixAt(i, m);
  }
  root.add(wave);
  const silent = new THREE.Color(0xcbd5e1);
  const speechIdle = new THREE.Color(0xfdba74);
  const speechOn = new THREE.Color(COLORS.said);
  const paintWave = (active: number) => {
    for (let i = 0; i < BARS; i++) {
      const s = speechOf(barTime[i]);
      wave.setColorAt(i, s === -1 ? silent : s === active ? speechOn : speechIdle);
    }
    if (wave.instanceColor) wave.instanceColor.needsUpdate = true;
  };
  paintWave(-1);

  // Links: each sentence to the step it happened in (largest overlap, else nearest)
  const links = narration.map((u) => {
    let best = 0;
    let score = -Infinity;
    actions.forEach((a, i) => {
      const overlap = Math.min(a.end, u.end) - Math.max(a.start, u.start);
      const s = overlap > 0 ? overlap : -Math.min(Math.abs(u.start - a.end), Math.abs(a.start - u.end));
      if (s > score) {
        score = s;
        best = i;
      }
    });
    const a = actions[best];
    const from = new THREE.Vector3(xOf((u.start + u.end) / 2), ROW.said + 0.22, 0.3);
    const to = new THREE.Vector3(xOf((a.start + a.end) / 2), ROW.seen - 0.27, 0);
    const ctrl = new THREE.Vector3((from.x + to.x) / 2, (from.y + to.y) / 2, 0.55);
    const geo = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(from, ctrl, to).getPoints(24));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.45 }));
    root.add(line);
    return line;
  });

  // Caption: the sentence being said, like subtitles
  const caption = paintedPlane(8, 0.6, () => {});
  caption.mesh.position.set(0, ROW.caption, 0.4);
  root.add(caption.mesh);
  let captionIdx = -2;
  const drawCaption = (i: number) => {
    caption.redraw((ctx, cw, ch) => {
      if (i < 0) return;
      const u = narration[i];
      const fpx = 0.2 * PX;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.font = `500 ${fpx}px ${font}`;
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(`“${u.text}”`, cw / 2, ch / 2 + fpx * 0.35);
      ctx.font = `500 ${fpx * 0.6}px ${font}`;
      ctx.fillStyle = COLORS.said;
      ctx.fillText(`SAID AT ${fmt(u.start)}`, cw / 2, ch / 2 - fpx * 0.75);
    });
  };

  // Playhead with a time chip
  const playhead = new THREE.Group();
  const lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 3.2), new THREE.MeshBasicMaterial({ color: COLORS.ink }));
  lineMesh.position.y = 0.6;
  const chip = paintedPlane(0.56, 0.24, () => {});
  chip.mesh.position.y = 2.25;
  playhead.add(lineMesh, chip.mesh);
  playhead.position.z = 0.45;
  root.add(playhead);
  let chipSec = -1;
  const drawChip = (s: number) =>
    chip.redraw((ctx, cw, ch) => {
      roundRect(ctx, 0, 0, cw, ch, ch / 2);
      ctx.fillStyle = COLORS.ink;
      ctx.fill();
      ctx.font = `600 ${ch * 0.55}px ${font}`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fmt(s), cw / 2, ch / 2 + 1);
    });

  const cycle = duration / RATE + HOLD;
  // Narrow screens zoom in and follow the playhead instead of showing the whole timeline
  let narrow = false;
  const halfSpan = (duration * K) / 2;
  let lastSaid = -1;
  let waveIdx = -2;

  return {
    resize(aspect, cam) {
      narrow = aspect < 1.5;
      const dist = narrow ? fitCamera(cam, aspect, 5.6, 4.6) : fitCamera(cam, aspect, 11.2, 4.6);
      cam.position.set(narrow ? cam.position.x : 0, 0.85, dist);
      cam.lookAt(narrow ? cam.position.x : 0, 0.3, 0);
    },
    update({ t, pointer, reduced }) {
      const playT = reduced ? 11.2 : Math.min(duration, (t % cycle) * RATE);
      root.rotation.y = -0.2 + pointer.x * 0.12 + (reduced ? 0 : Math.sin(t * 0.25) * 0.025);
      root.rotation.x = 0.06 + pointer.y * 0.05;
      playhead.position.x = xOf(playT);
      if (narrow) {
        const want = Math.max(-halfSpan + 2.3, Math.min(halfSpan - 2.3, xOf(playT)));
        camera.position.x += (want - camera.position.x) * (reduced ? 1 : 0.08);
        camera.lookAt(camera.position.x, 0.3, 0);
      }
      const sec = Math.floor(playT);
      if (sec !== chipSec) {
        chipSec = sec;
        drawChip(sec);
      }

      // Current frame comes forward
      let cur = 0;
      frameItems.forEach((f, i) => {
        if (f.t <= playT + 0.75) cur = i;
      });
      frameItems.forEach((f, i) => {
        const on = i === cur;
        f.g.position.z += ((on ? 0.05 : -0.35) - f.g.position.z) * 0.15;
        const s = f.g.scale.x + ((on ? 1.12 : 1) - f.g.scale.x) * 0.15;
        f.g.scale.setScalar(s);
        setOpacity(f.g, on ? 1 : 0.55);
      });

      // Active step
      bars.forEach(({ a, mesh }) => {
        const on = playT >= a.start && playT <= a.end;
        mesh.position.z += ((on ? 0.12 : 0) - mesh.position.z) * 0.15;
        (mesh.material as THREE.MeshBasicMaterial).opacity = on ? 1 : 0.62;
      });

      // Active sentence, its link and the caption
      const said = speechOf(playT);
      if (said !== -1) lastSaid = said;
      if (playT < 0.2) lastSaid = -1;
      if (said !== waveIdx) {
        waveIdx = said;
        paintWave(said);
        links.forEach((l, i) => {
          const mat = l.material as THREE.LineBasicMaterial;
          mat.color.set(i === said ? COLORS.said : 0x94a3b8);
          mat.opacity = i === said ? 1 : 0.45;
        });
      }
      if (lastSaid !== captionIdx) {
        captionIdx = lastSaid;
        drawCaption(lastSaid);
      }
      (caption.mesh.material as THREE.MeshBasicMaterial).opacity = said !== -1 ? 1 : 0.45;
    },
    dispose() {},
  };
};

/** Hero visual. Falls back to a still screenshot if WebGL is unavailable. */
export function HeroScene({ className }: { className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const ref = useThreeStage(build, () => setFailed(true));
  return (
    <div className={className}>
      {failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/screens/review.png" alt="" className="w-full h-full object-cover object-top" />
      ) : (
        <div ref={ref} className="w-full h-full" />
      )}
    </div>
  );
}
