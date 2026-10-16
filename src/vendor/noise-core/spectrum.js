// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
/**
 * A barra de espectro, desenhada num canvas 2D.
 *
 * Lê exatamente as mesmas faixas que o orbe. Não recalcula nada: se a
 * barra 40 sobe, a célula 40 do orbe sobe no mesmo frame. O degradê é o
 * do orbe, do mesmo tema e no mesmo instante — deep nos graves, bright
 * nos agudos.
 *
 * `ctx` já vem com a escala do devicePixelRatio aplicada; w e h são em
 * pixels CSS.
 */
export function drawSpectrum(ctx, w, h, values, palette) {
  ctx.clearRect(0, 0, w, h)

  const n = values.length
  const gap = 1
  const bw = (w - gap * (n - 1)) / n
  const { deep, bright } = palette

  for (let i = 0; i < n; i++) {
    const bh = Math.max(1, values[i] * h)
    const t = i / (n - 1)
    const r = Math.round(255 * (deep[0] + (bright[0] - deep[0]) * t))
    const g = Math.round(255 * (deep[1] + (bright[1] - deep[1]) * t))
    const b = Math.round(255 * (deep[2] + (bright[2] - deep[2]) * t))
    ctx.fillStyle = `rgba(${r},${g},${b},${0.28 + values[i] * 0.6})`
    ctx.fillRect(i * (bw + gap), h - bh, bw, bh)
  }
}
