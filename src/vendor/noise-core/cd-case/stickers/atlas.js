// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { DESENHOS } from './designs'

const TAMANHO = 2048
const CELULA = 512
const POR_LINHA = TAMANHO / CELULA

function tela(t) {
  const c = document.createElement('canvas')
  c.width = c.height = t
  return c
}

/**
 * Contorno de papel: a silhueta da arte, dilatada e pintada de branco.
 *
 * Canvas não tem dilatação, então a silhueta é carimbada em volta de um
 * círculo, 24 vezes, e o resultado vira branco com `source-in`.
 */
function silhuetaBranca(arte, raio) {
  const c = tela(arte.width)
  const ctx = c.getContext('2d')
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    ctx.drawImage(arte, Math.cos(a) * raio, Math.sin(a) * raio)
  }
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  return c
}

/**
 * Um atlas só, 2048², com todos os adesivos — e um segundo, do mesmo
 * jeito, com a máscara do foil holográfico.
 *
 * Gerados uma vez na montagem; os adesivos são planos com UV apontando
 * para a própria célula. Um material e uma textura para todos: um draw
 * call de shader, não nove.
 */
export function criarAtlas() {
  const cor = tela(TAMANHO)
  const foil = tela(TAMANHO)
  const cc = cor.getContext('2d')
  const cf = foil.getContext('2d')
  const celulas = {}

  Object.entries(DESENHOS).forEach(([id, d], i) => {
    const cx = (i % POR_LINHA) * CELULA
    const cy = Math.floor(i / POR_LINHA) * CELULA

    // a arte numa tela própria, menor que a célula: sobra margem para o papel
    const arte = tela(CELULA)
    const ca = arte.getContext('2d')
    ca.translate(CELULA * 0.065, CELULA * 0.065)
    ca.scale(0.87, 0.87)
    d.desenhar(ca, CELULA)

    // brilho de plástico: uma luz de cima que some até o meio, presa à arte
    const ga = ca.createLinearGradient(0, 0, 0, CELULA)
    ga.addColorStop(0, 'rgba(255,255,255,0.42)')
    ga.addColorStop(0.45, 'rgba(255,255,255,0.08)')
    ga.addColorStop(0.5, 'rgba(255,255,255,0)')
    ga.addColorStop(1, 'rgba(0,0,0,0.12)')
    ca.setTransform(1, 0, 0, 1, 0, 0)
    ca.globalCompositeOperation = 'source-atop'
    ca.fillStyle = ga
    ca.fillRect(0, 0, CELULA, CELULA)
    ca.globalCompositeOperation = 'source-over'

    const papel = silhuetaBranca(arte, CELULA * 0.038)

    // linha de corte, não sombra: fina e simétrica. Deslocada, o alphaTest
    // cortava a sombra mole numa franja preta dura de UM lado só, que
    // girava junto com o disco; em volta toda, lê como adesivo colado em
    // qualquer ângulo
    cc.save()
    cc.shadowColor = 'rgba(0, 0, 0, 0.35)'
    cc.shadowBlur = 3
    cc.shadowOffsetY = 0
    cc.drawImage(papel, cx, cy)
    cc.restore()
    cc.drawImage(arte, cx, cy)

    if (d.foil) {
      cf.save()
      cf.drawImage(arte, cx, cy)
      cf.globalCompositeOperation = 'source-in'
      cf.fillStyle = '#ffffff'
      cf.fillRect(cx, cy, CELULA, CELULA)
      cf.restore()
    }

    celulas[id] = {
      u0: cx / TAMANHO,
      v0: 1 - (cy + CELULA) / TAMANHO,
      u1: (cx + CELULA) / TAMANHO,
      v1: 1 - cy / TAMANHO,
    }
  })

  const mapa = new THREE.CanvasTexture(cor)
  mapa.colorSpace = THREE.SRGBColorSpace
  mapa.anisotropy = 4
  const mascara = new THREE.CanvasTexture(foil)

  return { mapa, mascara, celulas }
}
