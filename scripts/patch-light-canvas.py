p = 'src/client/kiln-canvas.ts'
s = open(p, encoding='utf-8').read()

# page/background
s = s.replace("""  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0a0807');
  bg.addColorStop(0.62, '#0b0806');
  bg.addColorStop(1, '#120c09');""",
"""  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#f8f2e8');
  bg.addColorStop(0.62, '#f4ede2');
  bg.addColorStop(1, '#eadfce');""")
s = s.replace("""  ctx.fillStyle = '#070505';""", """  ctx.fillStyle = '#f4ede2';""")

start = s.index('function drawBackdrop')
end = s.index('function drawKilnMass')
new = r'''function drawBackdrop(ctx: CanvasRenderingContext2D, heat: number, time: number, seed: number): void {
  // paper wall, warm and flat, the way a workshop looks at ten in the morning
  const wall = ctx.createLinearGradient(0, 0, 0, 470);
  wall.addColorStop(0, '#f8f2e8');
  wall.addColorStop(0.6, '#f1e8db');
  wall.addColorStop(1, '#e9decb');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, VIEW_W, 470);

  const rand = mulberry(seed ^ 0x51f3);
  for (let i = 0; i < 30; i += 1) {
    const x = rand() * VIEW_W;
    const y = rand() * 430;
    const r = 40 + rand() * 130;
    const blot = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rand() > 0.45;
    blot.addColorStop(0, warm ? 'rgba(180,85,47,0.045)' : 'rgba(120,96,70,0.05)');
    blot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blot;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // floor: swept clay
  const floor = ctx.createLinearGradient(0, 470, 0, VIEW_H);
  floor.addColorStop(0, '#dfd0ba');
  floor.addColorStop(0.4, '#d6c5ac');
  floor.addColorStop(1, '#c9b79c');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 470, VIEW_W, VIEW_H - 470);
  ctx.strokeStyle = 'rgba(120,96,70,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const x = i * 130;
    ctx.beginPath();
    ctx.moveTo(x, 470);
    ctx.lineTo(x - 40, VIEW_H);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,96,70,0.25)';
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.lineTo(VIEW_W, 470);
  ctx.stroke();

  // heat spilling out of the kiln onto the floor
  const glow = ctx.createRadialGradient(500, 470, 40, 500, 470, 380);
  glow.addColorStop(0, 'rgba(226,87,31,' + (0.10 + heat * 0.14).toFixed(3) + ')');
  glow.addColorStop(0.55, 'rgba(226,87,31,' + (0.03 + heat * 0.05).toFixed(3) + ')');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 200, VIEW_W, VIEW_H - 200);

  // contact shadow, tight and dark: the kiln is heavy
  const shadow = ctx.createRadialGradient(500, 480, 20, 500, 480, 340);
  shadow.addColorStop(0, 'rgba(90,62,40,0.35)');
  shadow.addColorStop(1, 'rgba(90,62,40,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(500, 480, 350, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // a paper label pinned on the wall, the way a yard marks whose kiln this is
  ctx.save();
  ctx.translate(96, 96);
  ctx.rotate(-0.03);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeStyle = 'rgba(34,26,20,0.18)';
  ctx.lineWidth = 1;
  ctx.fillRect(-40, -26, 118, 52);
  ctx.strokeRect(-40, -26, 118, 52);
  ctx.fillStyle = 'rgba(34,26,20,0.55)';
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(-30, -14 + i * 12, 92 - i * 22, 2);
  }
  ctx.restore();

  drawForeground(ctx, seed);
}

'''
s = s[:start] + new + s[end:]

# kiln shell: terracotta, mortar lighter
s = s.replace("""  shell.addColorStop(0, '#3b261c');
  shell.addColorStop(0.45, '#2b1b14');
  shell.addColorStop(1, '#180f0b');""",
"""  shell.addColorStop(0, '#c4693f');
  shell.addColorStop(0.45, '#b4552f');
  shell.addColorStop(1, '#8e3f22');""")
s = s.replace("""    ctx.strokeStyle = 'rgba(10,6,5,0.7)';""", """    ctx.strokeStyle = 'rgba(255,240,220,0.22)';""")
s = s.replace("""    ctx.fillStyle = rand() > 0.5 ? `rgba(255,170,110,${a * 1.6})` : `rgba(0,0,0,${a * 1.6})`;""",
              """    ctx.fillStyle = rand() > 0.5 ? `rgba(255,225,190,${a * 1.8})` : `rgba(70,30,14,${a * 1.8})`;""")
s = s.replace("""  ctx.shadowColor = 'rgba(0,0,0,0.7)';""", """  ctx.shadowColor = 'rgba(90,62,40,0.45)';""")
s = s.replace("""  ctx.fillStyle = '#241a15';
  roundRect(ctx, x, y, w, h, 12);""", """  ctx.fillStyle = '#8e3f22';
  roundRect(ctx, x, y, w, h, 12);""")
# cap stones + arch
s = s.replace("""  ctx.fillStyle = 'rgba(242,237,228,0.05)';
  ctx.fillRect(x + 40, y - 10, w - 80, 10);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(x + 40, y - 10, w - 80, 10);""",
"""  ctx.fillStyle = 'rgba(255,246,232,0.55)';
  ctx.fillRect(x + 40, y - 10, w - 80, 10);
  ctx.strokeStyle = 'rgba(34,26,20,0.25)';
  ctx.strokeRect(x + 40, y - 10, w - 80, 10);""")

# walls between chambers
s = s.replace("""    ctx.fillStyle = '#2f211a';
    ctx.fillRect(wallX, 176, 28, 292);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';""",
"""    ctx.fillStyle = '#c4693f';
    ctx.fillRect(wallX, 176, 28, 292);
    ctx.strokeStyle = 'rgba(34,26,20,0.35)';""")

# shelves keep light lines but darker against paper
s = s.replace("""  ctx.fillStyle = 'rgba(242,237,228,0.10)';
  for (const zone of ZONES) {""", """  ctx.fillStyle = 'rgba(255,244,228,0.35)';
  for (const zone of ZONES) {""")
s = s.replace("""      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(c.x + 4, y + 3, c.w - 8, 2);
      ctx.fillStyle = 'rgba(242,237,228,0.10)';""",
"""      ctx.fillStyle = 'rgba(70,30,14,0.35)';
      ctx.fillRect(c.x + 4, y + 3, c.w - 8, 2);
      ctx.fillStyle = 'rgba(255,244,228,0.35)';""")

# foreground: pale dust and shards
s = s.replace("""  band.addColorStop(0, 'rgba(6,4,3,0)');
  band.addColorStop(0.45, 'rgba(6,4,3,0.55)');
  band.addColorStop(1, 'rgba(4,3,2,0.92)');""",
"""  band.addColorStop(0, 'rgba(150,124,94,0)');
  band.addColorStop(0.45, 'rgba(150,124,94,0.18)');
  band.addColorStop(1, 'rgba(120,96,70,0.30)');""")
s = s.replace("""    ctx.fillStyle = rand() > 0.5 ? 'rgba(46,30,24,0.75)' : 'rgba(30,20,16,0.8)';""",
              """    ctx.fillStyle = rand() > 0.5 ? 'rgba(180,85,47,0.55)' : 'rgba(140,110,80,0.45)';""")

# smoke lighter
s = s.replace("""    ctx.fillStyle = `rgba(190,180,170,${s.life * (0.03 + heat * 0.05)})`;""",
              """    ctx.fillStyle = `rgba(120,110,100,${s.life * (0.05 + heat * 0.06)})`;""")
s = s.replace("""  ctx.fillStyle = '#2b1e18';
  roundRect(ctx, 826, 84, 56, 80, 4);""", """  ctx.fillStyle = '#b4552f';
  roundRect(ctx, 826, 84, 56, 80, 4);""")
s = s.replace("""  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeRect(826, 84, 56, 80);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(832, 86, 44, 8);""",
"""  ctx.strokeStyle = 'rgba(34,26,20,0.35)';
  ctx.strokeRect(826, 84, 56, 80);
  ctx.fillStyle = 'rgba(34,26,20,0.45)';
  ctx.fillRect(832, 86, 44, 8);""")

open(p, 'w', encoding='utf-8').write(s)
print('canvas lightened')
