// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
/**
 * Cor de acento da capa: a média ponderada por saturação de uma versão
 * 8 × 8 da imagem.
 *
 * Média pura de capa dá marrom quase sempre; pesar pela saturação puxa
 * para a cor que de fato marca a capa. Capa sem CORS (canvas "sujo")
 * devolve null e a etiqueta fica no índigo do app.
 */
export function corDominante(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 8
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, 8, 8)
        const d = ctx.getImageData(0, 0, 8, 8).data
        let r = 0, g = 0, b = 0, peso = 0
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2])
          const min = Math.min(d[i], d[i + 1], d[i + 2])
          const sat = max === 0 ? 0 : (max - min) / max
          const w = 0.05 + sat * sat * (max / 255)
          r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; peso += w
        }
        if (!peso) { resolve(null); return }
        const hex = (v) => Math.round(v / peso).toString(16).padStart(2, '0')
        resolve(`#${hex(r)}${hex(g)}${hex(b)}`)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** A mesma média, de uma imagem já carregada (sem baixar de novo). */
export function corDaImagem(img) {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, 8, 8)
    const d = ctx.getImageData(0, 0, 8, 8).data
    let r = 0, g = 0, b = 0, peso = 0
    for (let i = 0; i < d.length; i += 4) {
      const max = Math.max(d[i], d[i + 1], d[i + 2])
      const min = Math.min(d[i], d[i + 1], d[i + 2])
      const sat = max === 0 ? 0 : (max - min) / max
      const w = 0.05 + sat * sat * (max / 255)
      r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; peso += w
    }
    if (!peso) return null
    const hex = (v) => Math.round(v / peso).toString(16).padStart(2, '0')
    return `#${hex(r)}${hex(g)}${hex(b)}`
  } catch {
    return null
  }
}
