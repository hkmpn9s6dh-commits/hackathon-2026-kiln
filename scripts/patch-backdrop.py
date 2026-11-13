import re

p = 'src/client/kiln-canvas.ts'
s = open(p, encoding='utf-8').read()

start = s.index('function drawBackdrop')
end = s.index('function drawKilnMass')
old_backdrop = s[start:end]

new_backdrop = r'''function drawBackdrop(ctx: CanvasRenderingContext2D, heat: number, time: number, seed: number): void {
  // the wall
  const wall = ctx.createLinearGradient(0, 0, 0, 470);
  wall.addColorStop(0, '#15100e');
  wall.addColorStop(0.55, '#100c0a');
  wall.addColorStop(1, '#0b0806');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, VIEW_W, 470);

  // plaster blotches, so the wall is not a flat rectangle
  const rand = mulberry(seed ^ 0x51f3);
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * VIEW_W;
    const y = rand() * 430;
    const r = 30 + rand() * 110;
    const blot = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rand() > 0.5;
    blot.addColorStop(0, warm ? 'rgba(90,58,40,0.10)' : 'rgba(0,0,0,0.16)');
    blot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blot;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // floor
  const floor = ctx.createLinearGradient(0, 470, 0, VIEW_H);
  floor.addColorStop(0, '#191210');
  floor.addColorStop(0.35, '#120d0b');
  floor.addColorStop(1, '#0a0706');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 470, VIEW_W, VIEW_H - 470);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const x = i * 130;
    ctx.beginPath();
    ctx.moveTo(x, 470);
    ctx.lineTo(x - 40, VIEW_H);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(242,237,228,0.05)';
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.lineTo(VIEW_W, 470);
  ctx.stroke();

  // ambient bounce off the kiln
  const glow = ctx.createRadialGradient(500, 440, 60, 500, 440, 470);
  glow.addColorStop(0, 'rgba(226,83,31,' + (0.12 + heat * 0.14).toFixed(3) + ')');
  glow.addColorStop(0.5, 'rgba(226,83,31,' + (0.04 + heat * 0.05).toFixed(3) + ')');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // shadow under the kiln
  const shadow = ctx.createRadialGradient(500, 486, 20, 500, 486, 330);
  shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(500, 486, 340, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // a hanging bulb, the only cool light in the room
  ctx.strokeStyle = 'rgba(242,237,228,0.12)';
  ctx.beginPath();
  ctx.moveTo(150, 0);
  ctx.lineTo(150, 58);
  ctx.stroke();
  const bulb = ctx.createRadialGradient(150, 66, 2, 150, 66, 90);
  bulb.addColorStop(0, 'rgba(255,236,200,0.55)');
  bulb.addColorStop(0.25, 'rgba(255,208,150,0.12)');
  bulb.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = bulb;
  ctx.fillRect(40, 0, 240, 170);
  ctx.fillStyle = '#f6e6c8';
  ctx.beginPath();
  ctx.arc(150, 64, 5.5, 0, Math.PI * 2);
  ctx.fill();

  drawWoodpile(ctx, 946, 330, seed);
  drawBucket(ctx, 40, 404);
  drawPlank(ctx, 22, 262, seed);

  const shimmerY = 380 + Math.sin(time * 0.0011) * 3;
  const over = ctx.createRadialGradient(96, shimmerY, 4, 96, shimmerY, 150);
  over.addColorStop(0, 'rgba(255,170,90,' + (0.10 + heat * 0.12).toFixed(3) + ')');
  over.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = over;
  ctx.fillRect(-60, 220, 320, 300);
}

function drawWoodpile(ctx: CanvasRenderingContext2D, x: number, baseY: number, seed: number): void {
  const rand = mulberry(seed ^ 0x7a11);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x + 6, 480, 54, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let row = 0; row < 5; row += 1) {
    const y = baseY + row * 24;
    for (let col = 0; col < 4 - Math.floor(row / 3); col += 1) {
      const bx = x - 28 + col * 20 + (row % 2) * 7;
      const r = 9 + rand() * 2;
      ctx.fillStyle = row % 2 === 0 ? '#241814' : '#1d1310';
      ctx.beginPath();
      ctx.ellipse(bx, y, r, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,56,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBucket(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = '#1b1310';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 34, y);
  ctx.lineTo(x + 29, y + 46);
  ctx.lineTo(x + 5, y + 46);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,237,228,0.12)';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,170,140,0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + 6, y - 26);
  ctx.lineTo(x + 12, y + 20);
  ctx.moveTo(x + 20, y - 30);
  ctx.lineTo(x + 18, y + 22);
  ctx.stroke();
  ctx.restore();
}

function drawPlank(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  const rand = mulberry(seed ^ 0x9911);
  const glazes = ['#5c6f66', '#4d5f7a', '#6b5b4a'];
  ctx.save();
  ctx.fillStyle = 'rgba(242,237,228,0.06)';
  ctx.fillRect(x, y, 96, 5);
  for (let i = 0; i < 3; i += 1) {
    const cx = x + 18 + i * 30;
    const h = 22 + rand() * 10;
    ctx.fillStyle = glazes[i % 3] as string;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - 9, y);
    ctx.bezierCurveTo(cx - 12, y - h, cx + 12, y - h, cx + 9, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

'''

s = s[:start] + new_backdrop + s[end:]
s = s.replace('  drawBackdrop(ctx, heat, time);', '  drawBackdrop(ctx, heat, time, state.kiln.seed);')
open(p, 'w', encoding='utf-8').write(s)
print('patched backdrop')
