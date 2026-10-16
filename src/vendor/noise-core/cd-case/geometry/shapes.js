// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/** Caminho de retângulo com cantos arredondados, centrado na origem. */
export function retangulo(alvo, largura, altura, raio) {
  const x = -largura / 2
  const y = -altura / 2
  const r = Math.min(raio, largura / 2, altura / 2)
  alvo.moveTo(x + r, y)
  alvo.lineTo(x + largura - r, y)
  alvo.quadraticCurveTo(x + largura, y, x + largura, y + r)
  alvo.lineTo(x + largura, y + altura - r)
  alvo.quadraticCurveTo(x + largura, y + altura, x + largura - r, y + altura)
  alvo.lineTo(x + r, y + altura)
  alvo.quadraticCurveTo(x, y + altura, x, y + altura - r)
  alvo.lineTo(x, y + r)
  alvo.quadraticCurveTo(x, y, x + r, y)
  return alvo
}

/** Moldura: retângulo arredondado com um furo retangular dentro. */
export function moldura(largura, altura, raio, espessura) {
  const forma = retangulo(new THREE.Shape(), largura, altura, raio)
  const furo = retangulo(new THREE.Path(), largura - 2 * espessura, altura - 2 * espessura, raio * 0.5)
  forma.holes.push(furo)
  return forma
}

/** Para juntar geometrias, todas precisam ser não indexadas. */
export function semIndice(g) {
  return g.index ? g.toNonIndexed() : g.clone()
}

/**
 * Barra de quinas arredondadas, já posicionada.
 *
 * O RoundedBoxGeometry limita o raio à metade da menor medida; aqui é o
 * contrário: cada medida sobe até 2,1·raio, para o arredondado sair
 * inteiro. Quem quer uma peça mais fina que isso (e com o canto em XY
 * maior que a espessura) usa `placa`.
 */
export function barra(l, a, p, x, y, z, raio = 0.005, rot = 0) {
  const g = new RoundedBoxGeometry(Math.max(l, raio * 2.1), Math.max(a, raio * 2.1), Math.max(p, raio * 2.1), 2, raio)
  if (rot) g.rotateZ(rot)
  g.translate(x, y, z)
  return g
}

/**
 * Contorno de retângulo arredondado, anti-horário, para `varrer`: cada
 * ponto é [x, y, nx, ny], com a normal para fora.
 *
 * Arcos de círculo de verdade, `seg` passos por canto; os lados retos são
 * a aresta entre o fim de um canto e o começo do próximo.
 */
export function contorno(l, a, r, seg = 10) {
  const centros = [[l / 2 - r, a / 2 - r], [-l / 2 + r, a / 2 - r], [-l / 2 + r, -a / 2 + r], [l / 2 - r, -a / 2 + r]]
  const pts = []
  centros.forEach(([cx, cy], k) => {
    for (let i = 0; i <= seg; i++) {
      const t = (k + i / seg) * Math.PI / 2
      const nx = Math.cos(t)
      const ny = Math.sin(t)
      pts.push([cx + nx * r, cy + ny * r, nx, ny])
    }
  })
  return pts
}

/**
 * Varre um perfil ao longo de um contorno fechado: é assim que a borda do
 * estojo ganha degraus (cada degrau, uma linha de luz) em vez de ser uma
 * parede reta.
 *
 * `perfil` é uma lista de [u, z], com u = recuo para dentro a partir do
 * contorno. Regras:
 * - percorrer de baixo para fora, subir pela face de fora, entrar pelo
 *   topo e descer pela face de dentro: essa ordem deixa as normais para
 *   fora (um trecho que sobe dá +n, um topo que entra dá +z);
 * - repetir um ponto faz uma quina viva: o quad degenerado é pulado e as
 *   normais dos dois lados não se misturam no computeVertexNormals;
 * - o raio do contorno tem de ser >= o maior u, senão os cantos de dentro
 *   se dobram sobre si mesmos.
 *
 * UV: x corre pelo comprimento do contorno, y pelo perfil — o merge com
 * Extrude/RoundedBox/Lathe exige os mesmos atributos.
 */
export function varrer(pts, perfil) {
  const n = pts.length
  const m = perfil.length
  const pos = []
  const uv = []
  const idx = []
  let s = 0
  pts.forEach(([x, y, nx, ny], i) => {
    if (i) s += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1])
    perfil.forEach(([u, z], j) => {
      pos.push(x - nx * u, y - ny * u, z)
      uv.push(s * 4, j / (m - 1))
    })
  })
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n
    for (let j = 0; j < m - 1; j++) {
      const [u0, z0] = perfil[j]
      const [u1, z1] = perfil[j + 1]
      if (u0 === u1 && z0 === z1) continue
      const a = i * m + j
      const b = i2 * m + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * Forma em L: a quina em (0, 0), um braço de comprimento `a` em +x e
 * outro de `b` em +y, largura `e`. A quina de fora tem raio `r`; a de
 * dentro acompanha (r − e), sem chegar a zero para não virar bico.
 */
export function formaL(a, b, e, r) {
  const s = new THREE.Shape()
  const ri = Math.max(0.003, r - e)
  s.moveTo(a, 0)
  s.lineTo(r, 0)
  s.quadraticCurveTo(0, 0, 0, r)
  s.lineTo(0, b)
  s.lineTo(e, b)
  s.lineTo(e, e + ri)
  s.quadraticCurveTo(e, e, e + ri, e)
  s.lineTo(a, e)
  s.closePath()
  return s
}

/**
 * Placa arredondada de z = 0 a z = e: retângulo l × a com cantos de raio
 * r em XY e um bisel bv nas quinas de cima e de baixo.
 *
 * Extrude em vez de RoundedBoxGeometry porque este limita o raio à
 * metade da espessura: um canto de 0,05 numa placa de 0,014 viraria
 * 0,007 calado, e os cantos furariam a parede varrida. O bisel cresce
 * para fora da forma, por isso ela sai encolhida de bv.
 */
export function placa(l, a, r, e, bv = 0.003) {
  const forma = retangulo(new THREE.Shape(), l - 2 * bv, a - 2 * bv, Math.max(0.002, r - bv))
  const g = new THREE.ExtrudeGeometry(forma, {
    depth: e - 2 * bv,
    bevelEnabled: true,
    bevelThickness: bv,
    bevelSize: bv,
    bevelSegments: 3,
    curveSegments: 10,
  })
  return g.translate(0, 0, bv)
}
