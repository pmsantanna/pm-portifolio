// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CASE_DIMENSIONS } from '../dimensions'

const SEG = 160

/** Canto do canvas do rótulo pintado de papel: as paredes do rótulo leem daqui. */
export const UV_PAPEL = { x: 0.985, y: 0.015 }

/**
 * Torno: perfil (r, h) girado em volta de Z, face de baixo em z = 0.
 * Perfil sempre anti-horário no plano (r, h) — fundo para fora, sobe por
 * fora, topo para dentro, desce por dentro — é o que deixa as normais para
 * fora. `uvRaio` troca a UV do lathe por uma planar: o quadrado de lado
 * 2·uvRaio, centrado, vira [0,1]².
 */
function torno(pontos, { seg = SEG, uvRaio = 0 } = {}) {
  const g = new THREE.LatheGeometry(pontos.map(([r, h]) => new THREE.Vector2(r, h)), seg)
  g.rotateX(Math.PI / 2)
  if (uvRaio) {
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * uvRaio), 0.5 + p.getY(i) / (2 * uvRaio))
  }
  return g
}

function arco(cr, ch, raio, a0, a1, n = 4) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n)
    out.push([cr + Math.cos(a) * raio, ch + Math.sin(a) * raio])
  }
  return out
}

function juntar(partes) {
  const g = mergeGeometries(partes)
  partes.forEach((p) => p.dispose())
  g.computeBoundingSphere()
  return g
}

/** O metal: faixa espelhada, dados e aro — opaco, um material. Peças
 * separadas para as quinas ficarem vivas (normal sem média). */
export function geometriaDisco(D = CASE_DIMENSIONS) {
  const { espessura: T, metal: M } = D.disco
  return juntar([
    torno([[M.dentro, 0], [M.fora, 0]]),
    torno([[M.fora, 0], [M.fora, T]]),
    torno([[M.fora, T], [M.dentro, T]]),
    torno([[M.dentro, T], [M.dentro, 0]]),
  ])
}

/** O rótulo: papel de 0,25 mm colado sobre o metal, com bisel nas duas bordas. */
export function geometriaRotulo(D = CASE_DIMENSIONS) {
  const { espessura: T, rotulo: L } = D.disco
  const z1 = T + L.espessura
  const b = L.bisel
  const face = torno([[L.fora - b, z1], [L.dentro + b, z1]], { uvRaio: L.fora })
  const fora = torno([[L.fora, T], [L.fora, z1 - b], [L.fora - b, z1]])
  const dentro = torno([[L.dentro + b, z1], [L.dentro, z1 - b], [L.dentro, T]])
  for (const g of [fora, dentro]) {
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, UV_PAPEL.x, UV_PAPEL.y)
  }
  return juntar([face, fora, dentro])
}

/** A borda clara: o último 1,2 mm de policarbonato sem metal, com a quina redonda. */
export function geometriaBordaDisco(D = CASE_DIMENSIONS) {
  const { raio: R, espessura: T, quina: q, metal: M } = D.disco
  return torno([
    [M.fora, 0],
    ...arco(R - q, q, q, -Math.PI / 2, 0),
    ...arco(R - q, T - q, q, 0, Math.PI / 2),
    [M.fora, T],
  ])
}

/** O miolo transparente: furo com chanfro e o anel de empilhamento. */
export function geometriaMiolo(D = CASE_DIMENSIONS) {
  const { furo: f, espessura: T, metal: M, empilhar: E } = D.disco
  const c = 0.0012
  const ri = M.dentro - 0.0004
  const conta = []
  for (let i = 0; i <= 6; i++) {
    const t = (i / 6) * Math.PI
    conta.push([E.centro + Math.cos(t) * E.largura / 2, T + Math.sin(t) * E.altura])
  }
  return torno([
    [f + c, 0], [ri, 0],
    [ri, T],
    ...conta,
    [f + c, T], [f, T - c],
    [f, c], [f + c, 0],
  ], { seg: 128 })
}
