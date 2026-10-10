import * as THREE from "three";

/** Pixels per scene unit for text textures; high enough to stay crisp on retina screens. */
export const PX = 220;

export const COLORS = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  card: "#ffffff",
  seen: "#2563eb",
  seenBg: "#eff6ff",
  said: "#c2410c",
  saidBg: "#fff7ed",
  ok: "#15803d",
  okBg: "#f0fdf4",
  missed: "#dc2626",
  missedBg: "#fef2f2",
};

/** The page's sans font, for drawing text on canvases. */
export function pageFont(): string {
  if (typeof document === "undefined") return "system-ui, sans-serif";
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wrap text into at most maxLines lines that fit maxWidth, with an ellipsis on overflow. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

/** A canvas sized in scene units, drawn by `draw`, returned as a textured plane. */
export function paintedPlane(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): { mesh: THREE.Mesh; redraw: (d: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => void } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * PX);
  canvas.height = Math.round(height * PX);
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  const redraw = (d: typeof draw) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    d(ctx, canvas.width, canvas.height);
    tex.needsUpdate = true;
  };
  redraw(draw);
  return { mesh, redraw };
}

/** A single line of text as a plane; anchor "left" puts the plane's left edge at x = 0. */
export function textPlane(
  text: string,
  opts: { size: number; color: string; weight?: number; font: string; anchor?: "left" | "center"; mono?: boolean },
): THREE.Mesh {
  const probe = document.createElement("canvas").getContext("2d")!;
  const fontPx = opts.size * PX;
  const family = opts.mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : opts.font;
  const font = `${opts.weight ?? 500} ${fontPx}px ${family}`;
  probe.font = font;
  const w = (probe.measureText(text).width + fontPx * 0.2) / PX;
  const h = opts.size * 1.4;
  const { mesh } = paintedPlane(w, h, (ctx, cw, ch) => {
    ctx.font = font;
    ctx.fillStyle = opts.color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, fontPx * 0.1, ch / 2);
    void cw;
  });
  if (opts.anchor === "left") mesh.geometry.translate(w / 2, 0, 0);
  return mesh;
}

/** Set the opacity of every material in an object tree. */
export function setOpacity(obj: THREE.Object3D, opacity: number) {
  obj.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (mat && "opacity" in mat) {
      mat.transparent = true;
      mat.opacity = opacity;
    }
  });
}
