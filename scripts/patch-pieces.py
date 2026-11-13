p = 'src/client/kiln-canvas.ts'
s = open(p, encoding='utf-8').read()

start = s.index('function drawPieces(')
end = s.index('function drawFireMouth(')
new = r'''function drawPieces(ctx: CanvasRenderingContext2D, state: RenderState, time: number): void {
  const bySlot = new Map<string, RenderPiece[]>();
  for (const piece of state.pieces) {
    const list = bySlot.get(piece.slotId);
    if (list) list.push(piece);
    else bySlot.set(piece.slotId, [piece]);
  }

  for (const slot of state.kiln.slots) {
    const list = bySlot.get(slot.id) ?? [];
    const center = slotCenter(slot);
    if (list.length === 0) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = 'rgba(242,237,228,0.6)';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, 22, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const rect = slotRect(slot);
    const count = list.length;
    const gap = Math.min(52, (rect.w - 30) / Math.max(1, count));
    const scale = count > 3 ? 0.72 : count > 2 ? 0.84 : 0.95;

    list.forEach((piece, index) => {
      const x = center.x + (index - (count - 1) / 2) * gap;
      const dim = state.spotlight !== null && state.spotlight !== slot.id;
      const alpha = dim ? 0.4 : 1;
      const bob = state.reducedMotion ? 0 : Math.sin(time * 0.002 + slot.row + index) * 0.6;
      drawPiece(ctx, piece.form, x, center.y + bob, scale, piece.glaze, alpha, piece.mine);
    });
  }
}

'''
s = s[:start] + new + s[end:]
open(p, 'w', encoding='utf-8').write(s)
print('pieces layout patched')
