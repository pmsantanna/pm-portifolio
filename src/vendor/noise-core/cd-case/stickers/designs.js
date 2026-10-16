// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
/**
 * Os desenhos dos adesivos, em canvas — set próprio do Noise.
 *
 * Cada desenho pinta dentro de uma célula quadrada (`t` = lado), centrado,
 * e deixa margem para o contorno branco de papel que o atlas acrescenta
 * em volta. `foil: true` marca os que ganham a camada holográfica por
 * cima da arte.
 *
 * Paleta: os tons do próprio app (mercúrio, índigo) e cores de adesivo de
 * caderno — nada copiado de referência nenhuma.
 */

const FONTE_GORDA = "900 {px}px 'Arial Rounded MT Bold', 'Segoe UI Black', 'Arial Black', system-ui, sans-serif"

function fonte(px) {
  return FONTE_GORDA.replace('{px}', String(Math.round(px)))
}

/** "NOISE" em letras infladas: contorno grosso, degradê e brilho. */
function noise(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  ctx.rotate(-0.08)
  ctx.font = fonte(t * 0.27)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  ctx.lineWidth = t * 0.07
  ctx.strokeStyle = '#2b2766'
  ctx.strokeText('NOISE', 0, 0)

  const g = ctx.createLinearGradient(0, -t * 0.14, 0, t * 0.14)
  g.addColorStop(0, '#ffc6f2')
  g.addColorStop(0.5, '#a99bff')
  g.addColorStop(1, '#5fd4ff')
  ctx.fillStyle = g
  ctx.fillText('NOISE', 0, 0)

  // brilho de plástico inflado: uma faixa clara no alto de cada letra
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(0, -t * 0.07, t * 0.42, t * 0.035, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function onda(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  const n = 13
  const w = t * 0.042
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * w * 1.6
    const h = t * (0.08 + 0.28 * Math.abs(Math.sin(i * 0.9 + 0.4)) * (1 - Math.abs(i - 6) / 9))
    const g = ctx.createLinearGradient(0, -h, 0, h)
    g.addColorStop(0, '#7af0c8')
    g.addColorStop(1, '#3e3c82')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(x - w / 2, -h, w, h * 2, w / 2)
    ctx.fill()
  }
  ctx.restore()
}

function raio(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  const s = t / 100
  ctx.beginPath()
  ctx.moveTo(8 * s, -38 * s)
  ctx.lineTo(-20 * s, 6 * s)
  ctx.lineTo(-2 * s, 6 * s)
  ctx.lineTo(-10 * s, 38 * s)
  ctx.lineTo(22 * s, -8 * s)
  ctx.lineTo(4 * s, -8 * s)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -38 * s, 0, 38 * s)
  g.addColorStop(0, '#fff3a6')
  g.addColorStop(1, '#ffb32b')
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 3 * s
  ctx.strokeStyle = '#b8621a'
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}

function estrela(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  const r = t * 0.36
  const i = r * 0.22
  ctx.beginPath()
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2
    const rr = k % 2 === 0 ? r : i
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (k === 0) ctx.moveTo(x, y)
    else ctx.quadraticCurveTo(0, 0, x, y)
  }
  ctx.closePath()
  ctx.fillStyle = '#e8ecff'
  ctx.fill()
  ctx.restore()
}

function fone(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2 + t * 0.04)
  ctx.lineCap = 'round'
  ctx.lineWidth = t * 0.06
  ctx.strokeStyle = '#3e3c82'
  ctx.beginPath()
  ctx.arc(0, 0, t * 0.27, Math.PI * 1.05, Math.PI * 1.95)
  ctx.stroke()
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#ff7aa8'
    ctx.beginPath()
    ctx.roundRect(s * t * 0.27 - t * 0.075, -t * 0.02, t * 0.15, t * 0.22, t * 0.06)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.roundRect(s * t * 0.27 - t * 0.04, t * 0.01, t * 0.03, t * 0.12, t * 0.015)
    ctx.fill()
  }
  ctx.restore()
}

function fita(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  const w = t * 0.74
  const h = t * 0.48
  ctx.fillStyle = '#2f2c5c'
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, t * 0.04)
  ctx.fill()
  ctx.fillStyle = '#ffd36e'
  ctx.beginPath()
  ctx.roundRect(-w * 0.42, -h * 0.38, w * 0.84, h * 0.42, t * 0.02)
  ctx.fill()
  ctx.fillStyle = '#2f2c5c'
  ctx.font = fonte(t * 0.07)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SIDE A', 0, -h * 0.17)
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#e8ecff'
    ctx.beginPath()
    ctx.arc(s * w * 0.2, h * 0.18, t * 0.06, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2f2c5c'
    ctx.beginPath()
    ctx.arc(s * w * 0.2, h * 0.18, t * 0.025, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function coracao(ctx, t) {
  const mapa = [
    '.XX.XX.',
    'XXXXXXX',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
    '...X...',
  ]
  const p = t * 0.085
  const x0 = t / 2 - (mapa[0].length * p) / 2
  const y0 = t / 2 - (mapa.length * p) / 2
  mapa.forEach((linha, j) => {
    ;[...linha].forEach((c, i) => {
      if (c !== 'X') return
      ctx.fillStyle = (i + j) % 3 === 0 ? '#ff4f7b' : '#ff6f93'
      ctx.fillRect(x0 + i * p, y0 + j * p, p + 0.5, p + 0.5)
    })
  })
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillRect(x0 + p, y0 + p, p, p)
}

function planeta(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  const r = t * 0.2
  const anel = (frente) => {
    ctx.save()
    ctx.rotate(-0.35)
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.75, r * 0.45, 0, frente ? 0 : Math.PI, frente ? Math.PI : Math.PI * 2)
    ctx.lineWidth = t * 0.035
    ctx.strokeStyle = '#ffd36e'
    ctx.stroke()
    ctx.restore()
  }
  anel(false)
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r)
  g.addColorStop(0, '#b8f0ff')
  g.addColorStop(1, '#6a63d8')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  anel(true)
  ctx.restore()
}

/** Balão de fala com "LYRICS": o assunto do app, em adesivo. */
function bolha(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  ctx.rotate(0.12)
  const w = t * 0.74
  const h = t * 0.4
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2 - t * 0.04, w, h, h / 2)
  ctx.moveTo(-w * 0.2, h / 2 - t * 0.06)
  ctx.lineTo(-w * 0.32, h / 2 + t * 0.1)
  ctx.lineTo(-w * 0.04, h / 2 - t * 0.06)
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  g.addColorStop(0, '#ff9ad5')
  g.addColorStop(1, '#ff4fa3')
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = t * 0.018
  ctx.strokeStyle = '#7a1d55'
  ctx.stroke()
  ctx.font = fonte(t * 0.13)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = t * 0.03
  ctx.strokeStyle = '#7a1d55'
  ctx.strokeText('LYRICS', 0, -t * 0.035)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('LYRICS', 0, -t * 0.035)
  ctx.restore()
}

/** Botão ▶ PLAY em pílula, com relevo de plástico. */
function play(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  ctx.rotate(-0.18)
  const w = t * 0.78
  const h = t * 0.3
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  g.addColorStop(0, '#9effc8')
  g.addColorStop(1, '#22b07a')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = '#0f3d2c'
  ctx.beginPath()
  ctx.moveTo(-w * 0.36, -h * 0.26)
  ctx.lineTo(-w * 0.36, h * 0.26)
  ctx.lineTo(-w * 0.2, 0)
  ctx.closePath()
  ctx.fill()
  ctx.font = fonte(t * 0.13)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('PLAY', -w * 0.12, t * 0.005)
  ctx.restore()
}

/** Um vinil com selo colorido. */
function vinil(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  const r = t * 0.38
  ctx.fillStyle = '#141418'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'
  ctx.lineWidth = 1.5
  for (let k = 0.45; k < 0.98; k += 0.06) {
    ctx.beginPath()
    ctx.arc(0, 0, r * k, 0, Math.PI * 2)
    ctx.stroke()
  }
  // reflexo em cunha, como luz batendo no sulco
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, r, -2.4, -1.9)
  ctx.closePath()
  ctx.fill()
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.36)
  g.addColorStop(0, '#ffd36e')
  g.addColorStop(1, '#ff7a3d')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#141418'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Monitor de tubo com o orbe do Noise na tela. */
function monitor(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  ctx.rotate(0.1)
  const w = t * 0.62
  const h = t * 0.5
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2)
  g.addColorStop(0, '#e6e1ff')
  g.addColorStop(1, '#a79cf2')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2 - t * 0.04, w, h, t * 0.05)
  ctx.fill()
  ctx.fillStyle = '#8a7fd6'
  ctx.fillRect(-w * 0.18, h / 2 - t * 0.04, w * 0.36, t * 0.06)
  ctx.fillRect(-w * 0.32, h / 2 + t * 0.02, w * 0.64, t * 0.035)
  const tela = ctx.createRadialGradient(0, -t * 0.04, 0, 0, -t * 0.04, w * 0.42)
  tela.addColorStop(0, '#3a2f8a')
  tela.addColorStop(1, '#120e30')
  ctx.fillStyle = tela
  ctx.beginPath()
  ctx.roundRect(-w * 0.4, -h * 0.4 - t * 0.04, w * 0.8, h * 0.72, t * 0.04)
  ctx.fill()
  // o orbe na tela
  const o = ctx.createRadialGradient(-t * 0.03, -t * 0.08, 2, 0, -t * 0.05, t * 0.1)
  o.addColorStop(0, '#d9fbff')
  o.addColorStop(1, '#5fd4ff')
  ctx.fillStyle = o
  ctx.beginPath()
  ctx.arc(0, -t * 0.05, t * 0.09, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(95, 212, 255, 0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, -t * 0.05, t * 0.13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** Faixa xadrez preto e branco, de bandeira de chegada. */
function xadrez(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  ctx.rotate(-0.5)
  const n = 3
  const m = 7
  const q = t * 0.09
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < m; i++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'
      ctx.fillRect((i - m / 2) * q, (j - n / 2) * q, q + 0.5, q + 0.5)
    }
  }
  ctx.restore()
}

/** Globo espelhado: grade de facetas com brilhos coloridos. */
function globo(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  const r = t * 0.34
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
  g.addColorStop(0, '#f5f7ff')
  g.addColorStop(0.6, '#9aa6c8')
  g.addColorStop(1, '#3c4466')
  ctx.fillStyle = g
  ctx.fillRect(-r, -r, 2 * r, 2 * r)
  const cores = ['#ff7ab8', '#7af0c8', '#ffd36e', '#a99bff', '#5fd4ff']
  const passo = r / 5
  for (let y = -r; y < r; y += passo) {
    const larg = Math.sqrt(Math.max(0, r * r - (y + passo / 2) ** 2))
    const k = Math.max(3, Math.round((larg * 2) / passo))
    for (let i = 0; i < k; i++) {
      const x = -larg + (i * 2 * larg) / k
      const c = (i * 7 + Math.round(y)) % 9
      if (c < 3) {
        ctx.fillStyle = cores[(i + Math.round(y / passo) + 5) % cores.length]
        ctx.globalAlpha = 0.55
        ctx.fillRect(x + 1, y + 1, (2 * larg) / k - 2, passo - 2)
        ctx.globalAlpha = 1
      }
      ctx.strokeStyle = 'rgba(30, 34, 60, 0.45)'
      ctx.lineWidth = 1.2
      ctx.strokeRect(x, y, (2 * larg) / k, passo)
    }
  }
  ctx.restore()
}

/** Duas colcheias ligadas. */
function notas(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  ctx.rotate(-0.15)
  const g = ctx.createLinearGradient(0, -t * 0.3, 0, t * 0.3)
  g.addColorStop(0, '#5fd4ff')
  g.addColorStop(1, '#3e3c82')
  ctx.fillStyle = g
  ctx.strokeStyle = g
  ctx.lineWidth = t * 0.045
  ctx.beginPath()
  ctx.moveTo(-t * 0.12, t * 0.18)
  ctx.lineTo(-t * 0.12, -t * 0.2)
  ctx.lineTo(t * 0.2, -t * 0.27)
  ctx.lineTo(t * 0.2, t * 0.12)
  ctx.stroke()
  ctx.lineWidth = t * 0.07
  ctx.beginPath()
  ctx.moveTo(-t * 0.12, -t * 0.17)
  ctx.lineTo(t * 0.2, -t * 0.24)
  ctx.stroke()
  for (const [x, y] of [[-t * 0.19, t * 0.19], [t * 0.13, t * 0.13]]) {
    ctx.beginPath()
    ctx.ellipse(x, y, t * 0.085, t * 0.065, -0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** O orbe de cromo do Noise: a esfera de Voronoi, em miniatura. */
function orbe(ctx, t) {
  ctx.save()
  ctx.translate(t / 2, t / 2)
  const r = t * 0.33
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.35, '#c9d3e6')
  g.addColorStop(0.75, '#5c6488')
  g.addColorStop(1, '#2a2f4a')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  // células: pontos de Fibonacci projetados, ligados aos vizinhos próximos
  const pts = []
  const n = 40
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const rr = Math.sqrt(1 - y * y)
    const a = i * 2.39996
    const z = Math.sin(a) * rr
    if (z < 0) continue
    pts.push([Math.cos(a) * rr * r, y * r])
  }
  ctx.strokeStyle = 'rgba(90, 70, 200, 0.55)'
  ctx.lineWidth = 1.6
  for (const [x, y] of pts) {
    for (const [x2, y2] of pts) {
      const d = Math.hypot(x - x2, y - y2)
      if (d > 0 && d < r * 0.42) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

export const DESENHOS = {
  noise: { desenhar: noise, foil: true },
  onda: { desenhar: onda, foil: false },
  raio: { desenhar: raio, foil: true },
  estrela: { desenhar: estrela, foil: true },
  fone: { desenhar: fone, foil: false },
  fita: { desenhar: fita, foil: false },
  coracao: { desenhar: coracao, foil: false },
  planeta: { desenhar: planeta, foil: true },
  bolha: { desenhar: bolha, foil: false },
  play: { desenhar: play, foil: false },
  vinil: { desenhar: vinil, foil: false },
  monitor: { desenhar: monitor, foil: false },
  xadrez: { desenhar: xadrez, foil: false },
  globo: { desenhar: globo, foil: true },
  notas: { desenhar: notas, foil: true },
  orbe: { desenhar: orbe, foil: true },
}
