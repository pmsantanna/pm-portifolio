// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'

const L = 1024
const A = Math.round(L * 0.34)

/**
 * A etiqueta com o título da música — o único adesivo que muda.
 *
 * Papel branco, uma faixa na cor de acento (tirada da capa) e o título
 * escrito à máquina. Sem faixa, um travessão: estojo de CD sem disco
 * gravado.
 */
export function criarEtiqueta() {
  const c = document.createElement('canvas')
  c.width = L
  c.height = A
  const textura = new THREE.CanvasTexture(c)
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = 4

  function desenhar({ titulo, artista, acento }) {
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, L, A)

    // papel com a linha de corte em volta (a mesma dos adesivos do atlas:
    // simétrica, para não virar franja de um lado só quando o disco gira)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 3
    ctx.shadowOffsetY = 0
    ctx.fillStyle = '#fbfaf6'
    ctx.beginPath()
    ctx.roundRect(14, 14, L - 28, A - 34, 26)
    ctx.fill()
    ctx.restore()

    ctx.fillStyle = acento || '#3e3c82'
    ctx.beginPath()
    ctx.roundRect(14, 14, 44, A - 34, [26, 0, 0, 26])
    ctx.fill()

    // linhas de caderno
    ctx.strokeStyle = 'rgba(62, 60, 130, 0.14)'
    ctx.lineWidth = 2
    for (let y = 120; y < A - 30; y += 52) {
      ctx.beginPath()
      ctx.moveTo(80, y)
      ctx.lineTo(L - 40, y)
      ctx.stroke()
    }

    const caber = (txt, px, max, peso) => {
      let p = px
      ctx.font = `${peso} ${p}px 'JetBrains Mono', ui-monospace, Consolas, monospace`
      while (ctx.measureText(txt).width > max && p > 26) {
        p -= 2
        ctx.font = `${peso} ${p}px 'JetBrains Mono', ui-monospace, Consolas, monospace`
      }
      if (ctx.measureText(txt).width <= max) return txt
      let t = txt
      while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
      return `${t}…`
    }

    ctx.fillStyle = '#1d1b3a'
    ctx.textBaseline = 'alphabetic'
    const max = L - 140
    ctx.font = "700 76px 'JetBrains Mono', ui-monospace, Consolas, monospace"
    ctx.fillText(caber(titulo || '—', 76, max, 700), 90, 140)
    if (artista) {
      ctx.fillStyle = 'rgba(29, 27, 58, 0.62)'
      ctx.fillText(caber(artista, 46, max, 400), 90, 214)
    }

    textura.needsUpdate = true
  }

  desenhar({ titulo: '—' })
  return { textura, desenhar, proporcao: A / L }
}
