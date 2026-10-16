// noise-core @ 28289ac (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
/**
 * Cores do orbe: duas pontas de degradê, `deep` nos graves e `bright` nos
 * agudos, como [r, g, b] em 0..1.
 *
 * O núcleo não conhece temas. Quem hospeda entrega as duas cores — fixas,
 * ou uma função do tempo, para temas que giram de matiz como o Drift. Por
 * isso a função recebe o relógio absoluto em segundos: o orbe e a barra
 * chamam com o mesmo relógio e chegam na mesma cor sem estado
 * compartilhado.
 *
 * Aceita '#rrggbb', 0xrrggbb ou [r, g, b] — o app usa arrays, uma página
 * web costuma ter as cores em hex no CSS.
 */
export function toRGB(c) {
  if (Array.isArray(c)) return c
  if (typeof c === 'number') return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]
  if (typeof c === 'string') {
    let h = c.trim().replace('#', '')
    if (h.length === 3) h = h.split('').map((x) => x + x).join('')
    return toRGB(parseInt(h, 16))
  }
  return [1, 1, 1]
}

/** Normaliza o que veio em `theme` para uma função (segundos) → {deep, bright}. */
export function paletteSource(theme) {
  if (typeof theme === 'function') {
    return (s) => {
      const p = theme(s)
      return { deep: toRGB(p.deep), bright: toRGB(p.bright) }
    }
  }
  const fixed = theme
    ? { deep: toRGB(theme.deep), bright: toRGB(theme.bright) }
    : { deep: [0.616, 0.361, 0.941], bright: [0.518, 0.875, 0.949] }   // Aurora
  return () => fixed
}
