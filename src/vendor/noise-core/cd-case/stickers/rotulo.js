// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { CASE_DIMENSIONS } from '../dimensions'
import { mulberry32 } from './layout'

const L = 1024
const C = L / 2
const FONTE = "'JetBrains Mono', ui-monospace, Consolas, monospace"

/** Texto em volta de um círculo, no sentido horário, a partir do topo. */
function circular(ctx, texto, raio, px, cor, contorno) {
  ctx.save()
  ctx.translate(C, C)
  ctx.font = `600 ${px}px ${FONTE}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const volta = Math.PI * 2 * raio
  let s = texto
  while (ctx.measureText(s + texto).width < volta) s += texto
  let a = -Math.PI / 2
  for (const ch of s) {
    const w = ctx.measureText(ch).width
    a += w / 2 / raio
    ctx.save()
    ctx.rotate(a + Math.PI / 2)
    ctx.translate(0, -raio)
    if (contorno) {
      ctx.lineWidth = 3
      ctx.strokeStyle = contorno
      ctx.strokeText(ch, 0, 0)
    }
    ctx.fillStyle = cor
    ctx.fillText(ch, 0, 0)
    ctx.restore()
    a += w / 2 / raio
  }
  ctx.restore()
}

/**
 * O rótulo impresso do disco, num canvas 1024²: a capa do álbum, ou o
 * rótulo padrão do Noise quando não há capa.
 *
 * O círculo de fora do rótulo é o inscrito no canvas (a UV é planar, de
 * lado 2·rotulo.fora): capa quadrada toca a borda do papel em quatro
 * pontos, os cantos se perdem — como num picture disc.
 */
export function criarRotulo(D = CASE_DIMENSIONS) {
  const c = document.createElement('canvas')
  c.width = c.height = L
  const textura = new THREE.CanvasTexture(c)
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = 8
  const dentro = (D.disco.rotulo.dentro / D.disco.rotulo.fora) * C

  function padrao(ctx, e, acento) {
    const g = ctx.createRadialGradient(C, C, dentro, C, C, C)
    g.addColorStop(0, e.fundo[0])
    g.addColorStop(1, e.fundo[1])
    ctx.fillStyle = g
    ctx.fillRect(0, 0, L, L)
    // fios de torno: o foil acende neles
    const rnd = mulberry32(31)
    ctx.lineWidth = 1
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.015 + rnd() * 0.03})`
      ctx.beginPath()
      ctx.arc(C, C, dentro + rnd() * (C - dentro), 0, Math.PI * 2)
      ctx.stroke()
    }
    // onda circular: 180 barras em volta, o som impresso
    ctx.save()
    ctx.translate(C, C)
    ctx.fillStyle = e.onda
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2
      const h = 6 + 26 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11 + 1.3))
      ctx.save()
      ctx.rotate(a)
      ctx.fillRect(-2, -(C * 0.8 + h), 4, h)
      ctx.restore()
    }
    ctx.restore()
    ctx.strokeStyle = acento || '#5b57d6'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(C, C, dentro + 16, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(C, C, C - 46, 0, Math.PI * 2)
    ctx.stroke()
    circular(ctx, 'NOISE  ·  LISTENING TO YOUR MACHINE  ·  ', dentro + 40, 14, e.tinta)
  }

  function desenhar({ imagem, titulo, artista, acento, estilo }) {
    const ctx = c.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, L, L)
    if (imagem) {
      const w = imagem.naturalWidth || imagem.width
      const h = imagem.naturalHeight || imagem.height
      const s = Math.max(L / w, L / h)
      ctx.drawImage(imagem, (L - w * s) / 2, (L - h * s) / 2, w * s, h * s)
    } else {
      padrao(ctx, estilo, acento)
    }
    const linha = [artista, titulo].filter(Boolean).join(' — ').toUpperCase()
    circular(ctx, `${linha ? `${linha}  ·  ` : ''}NOISE  ·  SIDE A  ·  `, C - 24, 15,
      imagem ? 'rgba(255,255,255,0.82)' : estilo.tinta, imagem ? 'rgba(0,0,0,0.35)' : null)
    // papel cortado: as paredes do rótulo leem este canto (UV_PAPEL)
    ctx.fillStyle = '#f1eee6'
    ctx.fillRect(L - 32, L - 32, 32, 32)
    textura.needsUpdate = true
  }

  return { textura, desenhar }
}
