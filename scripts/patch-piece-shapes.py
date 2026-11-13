p = 'src/client/kiln-canvas.ts'
s = open(p, encoding='utf-8').read()

start = s.index('function drawPiece(')
end = s.index('/* ------------------------------------------------------------------ */\n/* Main draw')
new = r'''export function tintGlaze(hex: string, seed: number): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const shift = ((seed % 1000) / 1000 - 0.5) * 0.09;
  const lShift = (((seed >> 10) % 100) / 100 - 0.5) * 0.12;
  const hh = (h + shift + 1) % 1;
  const ss = Math.max(0.18, Math.min(0.8, sat));
  const ll = Math.max(0.32, Math.min(0.78, l + lShift));
  const hue2rgb = (p1: number, q1: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p1 + (q1 - p1) * 6 * tt;
    if (tt < 1 / 2) return q1;
    if (tt < 2 / 3) return p1 + (q1 - p1) * (2 / 3 - tt) * 6;
    return p1;
  };
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p1 = 2 * ll - q;
  const to255 = (x: number): string =>
    Math.round(Math.max(0, Math.min(1, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to255(hue2rgb(p1, q, hh + 1 / 3))}${to255(hue2rgb(p1, q, hh))}${to255(hue2rgb(p1, q, hh - 1 / 3))}`;
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  form: RenderPiece['form'],
  cx: number,
  baseY: number,
  scale: number,
  glaze: string,
  alpha: number,
  mine: boolean
): void {
  const s = scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, baseY);
  ctx.scale(s, s);

  const body = new Path2D();
  if (form === 'bowl') {
    // wide and shallow, with a foot ring
    body.moveTo(-34, -26);
    body.bezierCurveTo(-32, -4, -18, 0, 0, 0);
    body.bezierCurveTo(18, 0, 32, -4, 34, -26);
    body.bezierCurveTo(20, -30, -20, -30, -34, -26);
    body.closePath();
  } else if (form === 'jar') {
    // belly, shoulder, short neck, flared lip
    body.moveTo(-13, -62);
    body.bezierCurveTo(-15, -54, -34, -50, -32, -24);
    body.bezierCurveTo(-30, -4, -14, 0, 0, 0);
    body.bezierCurveTo(14, 0, 30, -4, 32, -24);
    body.bezierCurveTo(34, -50, 15, -54, 13, -62);
    body.closePath();
  } else if (form === 'vase') {
    // tall, shoulder high on the body, long neck
    body.moveTo(-8, -78);
    body.bezierCurveTo(-10, -66, -26, -58, -24, -34);
    body.bezierCurveTo(-22, -10, -12, 0, 0, 0);
    body.bezierCurveTo(12, 0, 22, -10, 24, -34);
    body.bezierCurveTo(26, -58, 10, -66, 8, -78);
    body.closePath();
  } else {
    // ovoid, narrow at the neck
    body.moveTo(-7, -80);
    body.bezierCurveTo(-9, -70, -30, -62, -30, -34);
    body.bezierCurveTo(-30, -10, -14, 0, 0, 0);
    body.bezierCurveTo(14, 0, 30, -10, 30, -34);
    body.bezierCurveTo(30, -62, 9, -70, 7, -80);
    body.closePath();
  }

  const grad = ctx.createLinearGradient(-28, -80, 30, 0);
  grad.addColorStop(0, glaze);
  grad.addColorStop(0.62, glaze);
  grad.addColorStop(1, 'rgba(18,14,12,0.92)');
  ctx.fillStyle = grad;
  ctx.fill(body);

  ctx.lineWidth = 1;
  ctx.strokeStyle = mine ? 'rgba(255,214,170,0.9)' : 'rgba(242,237,228,0.28)';
  ctx.stroke(body);

  // the light that makes it read as glazed clay
  ctx.save();
  ctx.clip(body);
  const sheen = ctx.createLinearGradient(-24, -60, 6, -10);
  sheen.addColorStop(0, 'rgba(255,255,255,0.38)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-36, -84, 70, 88);
  ctx.restore();

  // lip, so the silhouette has a mouth
  ctx.beginPath();
  const lipY = form === 'bowl' ? -26 : form === 'jar' ? -62 : form === 'vase' ? -78 : -80;
  const lipRx = form === 'bowl' ? 34 : form === 'jar' ? 13 : form === 'vase' ? 8 : 7;
  ctx.ellipse(0, lipY, lipRx, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12,9,7,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.restore();
}

'''
s = s[:start] + new + s[end:]
open(p, 'w', encoding='utf-8').write(s)
print('pieces redrawn')
