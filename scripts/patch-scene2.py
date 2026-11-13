p = 'src/client/kiln-canvas.ts'
s = open(p, encoding='utf-8').read()

# 1. no more floating props; keep the room quiet
s = s.replace("  drawWoodpile(ctx, 60, 366, seed);\n  drawBucket(ctx, 900, 424);\n  drawPlank(ctx, 878, 470, seed);",
              "  drawForeground(ctx, seed);")

# 2. flames -> soft licking tongues plus a floor glow
old_flames_start = s.index("    // idle flame licks")
old_flames_end = s.index("  // the two walls between chambers")
old_flames = s[old_flames_start:old_flames_end]
new_flames = '''    // heat pooling on the chamber floor
    const pool = ctx.createLinearGradient(0, bottom - 90, 0, bottom);
    pool.addColorStop(0, 'rgba(255,150,70,0)');
    pool.addColorStop(1, 'rgba(255,150,70,' + (0.16 + heat * 0.18).toFixed(3) + ')');
    ctx.fillStyle = pool;
    ctx.fillRect(c.x + 4, bottom - 90, c.w - 8, 90);

    // a few slow tongues, barely there
    if (!state.reducedMotion) {
      const count = zone === 'mouth' ? 3 : zone === 'body' ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const t = time * 0.0013 + i * 2.4 + (zone === 'tail' ? 1.7 : 0);
        const fx = c.x + 24 + ((i + 0.5) / count) * (c.w - 48);
        const h = (40 + Math.sin(t * 2.6) * 16) * (0.4 + heat * 0.7);
        const sway = Math.sin(t * 1.9 + i) * 8;
        const g = ctx.createLinearGradient(fx, bottom, fx, bottom - h * 2);
        g.addColorStop(0, 'rgba(255,196,130,0.22)');
        g.addColorStop(0.5, 'rgba(255,150,70,0.08)');
        g.addColorStop(1, 'rgba(226,83,31,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(fx - 12, bottom);
        ctx.quadraticCurveTo(fx - 8, bottom - h * 0.7, fx + sway, bottom - h * 1.9);
        ctx.quadraticCurveTo(fx + 9, bottom - h * 0.6, fx + 12, bottom);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

'''
s = s[:old_flames_start] + new_flames + s[old_flames_end:]

# 3. brick: darker mortar, varied block tone, warm top rim
s = s.replace("    ctx.strokeStyle = 'rgba(12,8,6,0.55)';", "    ctx.strokeStyle = 'rgba(10,6,5,0.7)';")
s = s.replace("  brickTexture(ctx, x, y, w, h, kiln.seed);",
              """  brickTexture(ctx, x, y, w, h, kiln.seed);

  // warm rim along the crown, as if the kiln were lit from inside
  const rim = ctx.createLinearGradient(x, y, x, y + 60);
  rim.addColorStop(0, 'rgba(255,176,110,0.10)');
  rim.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = rim;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();""")

# 4. foreground band instead of props
s = s.replace("""function drawWoodpile(ctx: CanvasRenderingContext2D, x: number, baseY: number, seed: number): void {""",
              """function drawForeground(ctx: CanvasRenderingContext2D, seed: number): void {
  const rand = mulberry(seed ^ 0x2ff1);
  // the workshop floor falls away into dark, with a few brick shards
  const band = ctx.createLinearGradient(0, 486, 0, VIEW_H);
  band.addColorStop(0, 'rgba(6,4,3,0)');
  band.addColorStop(0.45, 'rgba(6,4,3,0.55)');
  band.addColorStop(1, 'rgba(4,3,2,0.92)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 486, VIEW_W, VIEW_H - 486);
  for (let i = 0; i < 14; i += 1) {
    const x = rand() * VIEW_W;
    const y = 496 + rand() * 40;
    const w = 8 + rand() * 22;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(46,30,24,0.75)' : 'rgba(30,20,16,0.8)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.35, rand() * 0.6 - 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWoodpile(ctx: CanvasRenderingContext2D, x: number, baseY: number, seed: number): void {""")

open(p, 'w', encoding='utf-8').write(s)
print('patched flames and foreground')
