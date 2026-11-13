p = 'src/client/kiln-canvas.ts'
s = open(p, encoding='utf-8').read()

# --- props: put everything on the floor, out of the kiln's way
s = s.replace("  drawWoodpile(ctx, 946, 330, seed);\n  drawBucket(ctx, 40, 404);\n  drawPlank(ctx, 22, 262, seed);",
              "  drawWoodpile(ctx, 60, 366, seed);\n  drawBucket(ctx, 900, 424);\n  drawPlank(ctx, 878, 470, seed);")

# --- warmer kiln shell
s = s.replace("""  const shell = ctx.createLinearGradient(x, y, x, y + h);
  shell.addColorStop(0, '#33241d');
  shell.addColorStop(0.5, '#2a1d17');
  shell.addColorStop(1, '#1d1410');""",
              """  const shell = ctx.createLinearGradient(x, y, x, y + h);
  shell.addColorStop(0, '#4a2f22');
  shell.addColorStop(0.45, '#38241a');
  shell.addColorStop(1, '#221610');""")

# --- stronger mortar, warmer flecks
s = s.replace("  ctx.strokeStyle = 'rgba(0,0,0,0.35)';\n  ctx.lineWidth = 1;\n  const rowH = 15;",
              "  ctx.strokeStyle = 'rgba(12,8,6,0.55)';\n  ctx.lineWidth = 1.2;\n  const rowH = 15;")
s = s.replace("    ctx.fillStyle = rand() > 0.5 ? `rgba(255,190,140,${a})` : `rgba(0,0,0,${a * 1.4})`;",
              "    ctx.fillStyle = rand() > 0.5 ? `rgba(255,170,110,${a * 1.6})` : `rgba(0,0,0,${a * 1.6})`;")

# --- flames: fewer, taller, softer
s = s.replace("      const count = zone === 'mouth' ? 7 : zone === 'body' ? 4 : 2;",
              "      const count = zone === 'mouth' ? 4 : zone === 'body' ? 3 : 2;")
s = s.replace("        const h = (16 + Math.sin(t * 3 + i) * 7) * (0.5 + heat);",
              "        const h = (26 + Math.sin(t * 3 + i) * 12) * (0.5 + heat);")
s = s.replace("        g.addColorStop(0, 'rgba(255,170,90,0.5)');",
              "        g.addColorStop(0, 'rgba(255,186,120,0.32)');")
s = s.replace("        ctx.moveTo(fx - 7, bottom);\n        ctx.quadraticCurveTo(fx - 2, bottom - h, fx, bottom - h * 2.1);\n        ctx.quadraticCurveTo(fx + 3, bottom - h, fx + 7, bottom);",
              "        ctx.moveTo(fx - 10, bottom);\n        ctx.quadraticCurveTo(fx - 6, bottom - h * 0.8, fx + Math.sin(t * 2 + i) * 3, bottom - h * 2.1);\n        ctx.quadraticCurveTo(fx + 6, bottom - h * 0.8, fx + 10, bottom);")

# --- smoke: softer, smaller, more of them
s = s.replace("      r: 6 + Math.random() * 8,", "      r: 4 + Math.random() * 5,")
s = s.replace("    ctx.fillStyle = `rgba(190,180,170,${s.life * (0.05 + heat * 0.07)})`;",
              "    ctx.fillStyle = `rgba(190,180,170,${s.life * (0.03 + heat * 0.05)})`;")
s = s.replace("  if (smoke.length < 34) {", "  if (smoke.length < 22) {")
s = s.replace("    s.r += 9 * step;", "    s.r += 7 * step;")

open(p, 'w', encoding='utf-8').write(s)
print('patched scene')
