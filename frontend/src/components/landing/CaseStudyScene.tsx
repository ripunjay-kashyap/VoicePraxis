"use client";

import * as React from "react";
import * as THREE from "three";
import { useThreeStage, fitCamera, SceneBuilder, clamp01, ease } from "@/components/three/stage";
import { COLORS, PX, loadImage, pageFont, paintedPlane, roundRect, setOpacity, textPlane, wrap } from "@/components/three/paint";
import { CHECK } from "./caseData";

const CARD = { w: 2.2, h: 1.22 };
const CYCLE = 10.5;
const fmt = (t: number) => `0:${Math.floor(t).toString().padStart(2, "0")}`;

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function cardPainter(font: string, img: HTMLImageElement | null, eyebrow: string, title: string, said: string | null): Draw {
  return (ctx, cw, ch) => {
    const r = 0.08 * PX;
    roundRect(ctx, 3, 3, cw - 6, ch - 6, r);
    ctx.fillStyle = COLORS.card;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.line;
    ctx.stroke();
    // Thumbnail (portrait still from the recording)
    const pad = 0.09 * PX;
    const th = ch - pad * 2;
    const tw = th * (9 / 16);
    ctx.save();
    roundRect(ctx, pad, pad, tw, th, 0.05 * PX);
    ctx.clip();
    if (img) ctx.drawImage(img, pad, pad, tw, th);
    else {
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(pad, pad, tw, th);
    }
    ctx.restore();
    // Text
    const x = pad * 2 + tw;
    const maxW = cw - x - pad;
    ctx.textBaseline = "top";
    ctx.font = `600 ${0.085 * PX}px ${font}`;
    ctx.fillStyle = COLORS.faint;
    ctx.fillText(eyebrow, x, pad + 2);
    const fpx = 0.128 * PX;
    ctx.font = `600 ${fpx}px ${font}`;
    ctx.fillStyle = COLORS.ink;
    const lines = wrap(ctx, title, maxW, said ? 2 : 3);
    lines.forEach((l, i) => ctx.fillText(l, x, pad + 0.18 * PX + i * fpx * 1.22));
    if (said) {
      ctx.font = `500 ${0.1 * PX}px ${font}`;
      ctx.fillStyle = COLORS.said;
      const s = wrap(ctx, `“${said}”`, maxW, 1)[0];
      ctx.fillText(s, x, ch - pad - 0.12 * PX);
    }
  };
}

const missedPainter = (font: string): Draw => (ctx, cw, ch) => {
  const r = 0.08 * PX;
  roundRect(ctx, 3, 3, cw - 6, ch - 6, r);
  ctx.fillStyle = "rgba(254, 242, 242, 0.85)";
  ctx.fill();
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(220, 38, 38, 0.55)";
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${0.135 * PX}px ${font}`;
  ctx.fillStyle = COLORS.missed;
  ctx.fillText("No matching step", cw / 2, ch / 2 - 0.08 * PX);
  ctx.font = `500 ${0.105 * PX}px ${font}`;
  ctx.fillStyle = "#b91c1c";
  ctx.fillText("Not done, not mentioned", cw / 2, ch / 2 + 0.1 * PX);
};

const badgePainter = (font: string, ok: boolean): Draw => (ctx, cw, ch) => {
  roundRect(ctx, 2, 2, cw - 4, ch - 4, (ch - 4) / 2);
  ctx.fillStyle = ok ? COLORS.okBg : COLORS.missedBg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ok ? "rgba(21, 128, 61, 0.45)" : "rgba(220, 38, 38, 0.55)";
  ctx.stroke();
  ctx.fillStyle = ok ? COLORS.ok : COLORS.missed;
  ctx.font = `600 ${ch * 0.48}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ok ? "✓  Complete" : "✕  Missed", cw / 2, ch / 2 + 1);
};

/** Reference steps above, the take below; each step is matched or flagged as missed. */
const build: SceneBuilder = async (scene) => {
  await document.fonts?.ready;
  const font = pageFont();
  const root = new THREE.Group();
  scene.add(root);

  const imgs = await Promise.all(
    CHECK.steps.flatMap((s) => [loadImage(s.refFrame), s.take ? loadImage(s.take.frame) : Promise.resolve(null)]),
  );

  const refLabel = textPlane("REFERENCE", { size: 0.12, color: COLORS.muted, weight: 600, font, anchor: "left" });
  const takeLabel = textPlane("TAKE", { size: 0.12, color: COLORS.muted, weight: 600, font, anchor: "left" });
  root.add(refLabel, takeLabel);

  const items = CHECK.steps.map((s, i) => {
    const ref = paintedPlane(CARD.w, CARD.h, cardPainter(font, imgs[i * 2], `STEP ${i + 1}`, s.instruction, null)).mesh;
    const take = s.take
      ? paintedPlane(CARD.w, CARD.h, cardPainter(font, imgs[i * 2 + 1], `${fmt(s.take.time)} · TAKE`, s.take.instruction, s.take.said)).mesh
      : paintedPlane(CARD.w, CARD.h, missedPainter(font)).mesh;
    const ok = s.status === "complete";
    const badge = paintedPlane(0.92, 0.24, badgePainter(font, ok)).mesh;
    const mat = ok
      ? new THREE.LineBasicMaterial({ color: COLORS.ok, transparent: true })
      : new THREE.LineDashedMaterial({ color: COLORS.missed, dashSize: 0.07, gapSize: 0.05, transparent: true });
    const line = new THREE.Line(new THREE.BufferGeometry(), mat);
    root.add(ref, take, line, badge);
    return { ok, ref, take, badge, line, points: 0 };
  });

  let portrait: boolean | null = null;
  const layout = (p: boolean) => {
    portrait = p;
    items.forEach((it, i) => {
      let from: THREE.Vector3;
      let to: THREE.Vector3;
      if (!p) {
        const x = (i - 1.5) * 2.45;
        it.ref.position.set(x, 1.12, 0);
        it.take.position.set(x, -1.12, 0);
        from = new THREE.Vector3(x, 1.12 - CARD.h / 2 - 0.03, 0);
        to = new THREE.Vector3(x, -1.12 + CARD.h / 2 + 0.03, 0);
      } else {
        const y = (1.5 - i) * 1.5;
        it.ref.position.set(-1.6, y, 0);
        it.take.position.set(1.6, y, 0);
        from = new THREE.Vector3(-1.6 + CARD.w / 2 + 0.02, y, 0);
        to = new THREE.Vector3(1.6 - CARD.w / 2 - 0.02, y, 0);
      }
      const mid = from.clone().lerp(to, 0.5);
      mid.z = 0.35;
      const pts = new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(40);
      it.line.geometry.dispose();
      it.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      it.line.computeLineDistances();
      it.points = pts.length;
      it.badge.position.copy(from.clone().lerp(to, 0.5)).setZ(0.3);
    });
    if (!p) {
      refLabel.position.set(-1.5 * 2.45 - CARD.w / 2, 1.12 + CARD.h / 2 + 0.16, 0);
      takeLabel.position.set(-1.5 * 2.45 - CARD.w / 2, -1.12 - CARD.h / 2 - 0.16, 0);
    } else {
      refLabel.position.set(-1.6 - CARD.w / 2, 1.5 * 1.5 + CARD.h / 2 + 0.16, 0);
      takeLabel.position.set(1.6 - CARD.w / 2, 1.5 * 1.5 + CARD.h / 2 + 0.16, 0);
    }
  };

  return {
    resize(aspect, cam) {
      const p = aspect < 1;
      if (p !== portrait) layout(p);
      const dist = p ? fitCamera(cam, aspect, 5.7, 6.6) : fitCamera(cam, aspect, 10.4, 3.9);
      cam.position.set(0, p ? 0.2 : 0.6, dist);
      cam.lookAt(0, p ? 0.15 : 0, 0);
    },
    update({ t, pointer, reduced }) {
      const lt = reduced ? 8 : t % CYCLE;
      root.rotation.y = pointer.x * 0.14 + (reduced ? 0 : Math.sin(t * 0.3) * 0.04);
      root.rotation.x = -0.1 + pointer.y * 0.06;
      const fade = lt > CYCLE - 0.8 ? 1 - (lt - (CYCLE - 0.8)) / 0.8 : 1;
      items.forEach((it, i) => {
        const start = 0.6 + i * 1.35;
        const p = ease(clamp01((lt - start) / 0.7));
        it.line.geometry.setDrawRange(0, Math.max(2, Math.round(it.points * p)));
        (it.line.material as THREE.LineBasicMaterial).opacity = p > 0 ? fade : 0;
        const b = ease(clamp01((lt - start - 0.55) / 0.35));
        it.badge.scale.setScalar((0.8 + 0.2 * b) * (portrait ? 0.82 : 1));
        setOpacity(it.badge, b * fade);
        const takeOn = it.ok ? 1 : 0.35 + 0.65 * b * (0.75 + 0.25 * Math.sin(t * 4));
        setOpacity(it.take, it.ok ? 0.55 + 0.45 * b : takeOn * fade + (1 - fade) * 0.35);
        it.take.position.z = 0.1 * b;
      });
    },
    dispose() {},
  };
};

/** Case-study visual. Falls back to the template-check screenshot without WebGL. */
export function CaseStudyScene({ className }: { className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const ref = useThreeStage(build, () => setFailed(true));
  return (
    <div className={className}>
      {failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/screens/template-check.png" alt="" className="w-full h-full object-contain" />
      ) : (
        <div ref={ref} className="w-full h-full" />
      )}
    </div>
  );
}
