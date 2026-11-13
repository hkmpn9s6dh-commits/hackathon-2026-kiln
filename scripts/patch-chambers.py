p = 'src/client/kiln-canvas.ts'
s = open(p, encoding='utf-8').read()

start = s.index('function drawChambers')
end = s.index('function slotCenter')
new = r'''function drawChambers(ctx: CanvasRenderingContext2D, state: RenderState, heat: number, time: number): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    const top = 176;
    const bottom = 468;

    // A kiln is a hole with a fire at the bottom of it. Keep it dark; the only
    // light is the last 60px, where the embers are.
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, '#0d0806');
    grad.addColorStop(0.62, '#150c07');
    grad.addColorStop(0.86, '#2a1208');
    grad.addColorStop(1, zone === 'tail' ? '#3a1a0c' : '#4a1e0b');
    ctx.fillStyle = grad;
    ctx.fillRect(c.x, top, c.w, bottom - top);

    // ember bed
    const bed = ctx.createLinearGradient(0, bottom - 62, 0, bottom);
    const strength = (zone === 'mouth' ? 0.5 : zone === 'body' ? 0.34 : 0.2) + heat * 0.28;
    bed.addColorStop(0, 'rgba(255,140,60,0)');
    bed.addColorStop(0.65, 'rgba(255,140,60,' + (strength * 0.5).toFixed(3) + ')');
    bed.addColorStop(1, 'rgba(255,196,120,' + strength.toFixed(3) + ')');
    ctx.fillStyle = bed;
    ctx.fillRect(c.x + 2, bottom - 62, c.w - 4, 62);

    // arch
    ctx.beginPath();
    ctx.moveTo(c.x, bottom);
    ctx.lineTo(c.x, top + 46);
    ctx.quadraticCurveTo(c.x + c.w / 2, top - 4, c.x + c.w, top + 46);
    ctx.lineTo(c.x + c.w, bottom);
    ctx.strokeStyle = 'rgba(20,10,6,0.85)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // slow tongues, barely there, only where the fire is
    if (!state.reducedMotion) {
      const count = zone === 'mouth' ? 3 : zone === 'body' ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const t = time * 0.0013 + i * 2.4 + (zone === 'tail' ? 1.7 : 0);
        const fx = c.x + 24 + ((i + 0.5) / count) * (c.w - 48);
        const h = (34 + Math.sin(t * 2.6) * 12) * (0.45 + heat * 0.6);
        const sway = Math.sin(t * 1.9 + i) * 7;
        const g = ctx.createLinearGradient(fx, bottom, fx, bottom - h * 1.9);
        g.addColorStop(0, 'rgba(255,190,120,0.30)');
        g.addColorStop(0.55, 'rgba(255,140,60,0.10)');
        g.addColorStop(1, 'rgba(226,83,31,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(fx - 11, bottom);
        ctx.quadraticCurveTo(fx - 7, bottom - h * 0.65, fx + sway, bottom - h * 1.85);
        ctx.quadraticCurveTo(fx + 8, bottom - h * 0.55, fx + 11, bottom);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // the two walls between chambers
  for (const wallX of [352, 638]) {
    ctx.fillStyle = '#c4693f';
    ctx.fillRect(wallX, 176, 28, 292);
    ctx.strokeStyle = 'rgba(34,26,20,0.35)';
    ctx.strokeRect(wallX, 176, 28, 292);
  }
}

function drawShelves(ctx: CanvasRenderingContext2D, state: RenderState): void {
  for (const zone of ZONES) {
    const c = CHAMBER[zone];
    for (const y of SHELF_Y) {
      // the slab, lit from the fire below
      ctx.fillStyle = 'rgba(96,58,38,0.95)';
      ctx.fillRect(c.x + 4, y, c.w - 8, 4);
      ctx.fillStyle = 'rgba(255,196,140,0.35)';
      ctx.fillRect(c.x + 4, y, c.w - 8, 1.2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(c.x + 4, y + 4, c.w - 8, 3);
    }
  }
  void state;
}

'''
s = s[:start] + new + s[end:]
open(p, 'w', encoding='utf-8').write(s)
print('chambers rebuilt')
