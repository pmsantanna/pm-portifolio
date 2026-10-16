// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { semIndice } from './shapes'
import { CASE_DIMENSIONS } from '../dimensions'

/**
 * O hub central: uma roseta que mora dentro da parte clara do disco
 * (furo 0,075 até o metal em 0,172) e aparece através dela — botão no
 * meio, dentes que atravessam o furo, platô de apoio com dois sulcos e
 * quatro anéis rebaixados.
 *
 * A regra que manda no perfil: o fundo do disco fica 0,5 mm acima de
 * `altura`, então todo ponto com r >= furo tem h <= altura; só o que está
 * dentro do furo pode subir além do disco.
 *
 * Lathe gira em torno de Y; o resultado é deitado para girar em torno de
 * Z, que é o eixo do disco aqui.
 */
export function geometriaHub(D = CASE_DIMENSIONS) {
  const { altura: h, dentes } = D.hub
  // o topo do disco, medido do fundo do hub
  const topo = h + 0.0005 + D.disco.espessura

  // perfil (raio, altura) anti-horário, como no disco: sobe pela borda de
  // fora e corre o topo para dentro — normais para fora. De fora para
  // dentro: a queda em 0,165 (ainda na parte clara), o platô de apoio com
  // dois sulcos (0,146 e 0,108), o degrau até o furo e o botão do meio,
  // com uma crista 1,5 mm acima do disco (a deixa de profundidade no centro)
  const perfil = [
    [0.165, 0],
    [0.165, 0.003],
    [0.158, h - 0.0015],
    [0.150, h - 0.0015],
    [0.146, h - 0.006],
    [0.142, h - 0.0015],
    [0.112, h - 0.0015],
    [0.108, h - 0.0045],
    [0.104, h - 0.0015],
    [0.080, h - 0.0015],
    [0.078, h],
    [0.050, h],
    [0.048, topo - 0.0025],
    [0.044, topo + 0.0015],
    [0.036, topo + 0.0015],
    [0.030, topo - 0.0045],
    [0, topo - 0.0045],
  ].map(([r, y]) => new THREE.Vector2(r, y))

  const aneis = new THREE.LatheGeometry(perfil, 96)
  aneis.rotateX(Math.PI / 2)

  const partes = [semIndice(aneis)]
  aneis.dispose()
  const add = (g) => { partes.push(semIndice(g)); g.dispose() }

  // dentes: lâminas inclinadas em volta do furo (alcance radial < 0,0735,
  // dentro dele), 3,5 mm acima do topo do disco
  const alto = topo + 0.0035
  for (let i = 0; i < dentes; i++) {
    const dente = new THREE.BoxGeometry(0.010, 0.020, alto)
    dente.rotateZ(0.35)
    dente.translate(0, 0.062, alto / 2)
    dente.rotateZ((i / dentes) * Math.PI * 2)
    add(dente)
  }

  // anéis rebaixados no platô: o topo (0,0117) fica abaixo do fundo do disco (0,0125)
  for (let k = 0; k < 4; k++) {
    const phi = Math.PI / 4 + (k * Math.PI) / 2
    add(new THREE.TorusGeometry(0.013, 0.0022, 6, 20).translate(Math.cos(phi) * 0.125, Math.sin(phi) * 0.125, h - 0.0025))
  }

  partes.forEach((p) => p.deleteAttribute('uv'))
  const g = mergeGeometries(partes)
  partes.forEach((p) => p.dispose())
  return g
}
