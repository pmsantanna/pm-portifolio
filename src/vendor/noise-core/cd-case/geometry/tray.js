// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CASE_DIMENSIONS, camadas } from '../dimensions'
import { barra, contorno, formaL, placa, semIndice, varrer } from './shapes'

/**
 * A placa do fundo da bandeja, à parte: ela leva um material próprio, que
 * dá corpo ao estojo e não deixa a sombra (que fica atrás) aparecer
 * através dele. Extrude arredondado, com o mesmo raio de canto da parede
 * varrida — com RoundedBox o canto ficaria de 0,007 e furaria a parede.
 */
export function geometriaFundo(D = CASE_DIMENSIONS) {
  const z = camadas(D)
  return placa(D.largura, D.altura, D.raioCanto, D.base).translate(0, 0, z.fundo)
}

/**
 * A bandeja: parede de fora e a estrutura de dentro (o fundo é à parte).
 *
 * O que faz um estojo de CD parecer um estojo de CD é a quantidade de
 * arestas: cada degrau do plástico vira uma linha contra o fundo. Então:
 * - a parede é um perfil em degraus varrido pelo contorno (seis quinas,
 *   escalonadas em z), não uma moldura extrudada de três linhas;
 * - quatro canais em L de nervura dupla nos cantos de dentro;
 * - quatro abas radiais sobre a borda do disco, em pé em colunas;
 * - os dois dedos em J dos cantos de baixo;
 * - o anel do poço do disco, a segunda linha concêntrica logo fora dele.
 *
 * Tudo numa geometria só: um draw call, um material.
 */
export function geometriaBandeja(D = CASE_DIMENSIONS) {
  const z = camadas(D)
  const L = D.largura
  const A = D.altura
  const partes = []
  const add = (g) => { partes.push(semIndice(g)); g.dispose() }

  /* a parede, em degraus: bisel de baixo, face de fora até o ombro (onde a
   * saia da tampa encosta), o degrau mais estreito que sobe até a tampa,
   * o topo, e por dentro a face que desce até o patamar (u 0,022 → 0,034)
   * onde o encarte apoia. Quinas em u 0,002 · 0,010 · 0,012 · 0,020 ·
   * 0,022 · 0,034: vistas pelo plástico com a tampa por cima, viram a
   * faixa de 6–8 linhas da referência. Ponto repetido = quina viva. */
  const f = z.fundo
  const b = z.baseFrente
  const t = z.tampaFundo
  const s = z.ombro
  const perfilParede = [
    [0.014, f], [0.004, f + 0.001], [0.002, f + 0.004],
    [0.002, f + 0.004], [0.002, s],
    [0.002, s], [0.010, s],
    [0.010, s], [0.010, t - 0.003], [0.012, t], [0.020, t], [0.022, t - 0.003],
    [0.022, t - 0.003], [0.022, b + 0.03],
    [0.022, b + 0.03], [0.034, b + 0.03],
    [0.034, b + 0.03], [0.034, b],
  ]
  add(varrer(contorno(L, A, D.raioCanto, 10), perfilParede))

  /* os canais em L: duas nervuras arredondadas (tubos de 0,018 com o
   * bisel) do fundo até z +0,017, e uma alma baixa por baixo das duas que
   * faz deles um canal, não duas peças soltas */
  const I = D.interno
  const off = I.nervura + I.vao
  const ext = (forma, depth, bevel) => new THREE.ExtrudeGeometry(forma, bevel
    ? { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 8 }
    : { depth, bevelEnabled: false, curveSegments: 8 })
  const cantoL = (a, bb) => [
    // nervura de fora
    ext(formaL(a, bb, I.nervura, I.raio), I.altura - 0.008, true).translate(0, 0, z.baseFrente + 0.004),
    // nervura de dentro
    ext(formaL(a - off, bb - off, I.nervura, Math.max(0.006, I.raio - off)), I.altura - 0.008, true).translate(off, off, z.baseFrente + 0.004),
    // a alma
    ext(formaL(a, bb, 2 * I.nervura + I.vao + 0.006, I.raio), 0.012, false).translate(0, 0, z.baseFrente),
  ]
  // braços: a em +x e b em +y antes de girar; os da esquerda (lombada)
  // são mais longos e param logo acima e abaixo da trava da tampa
  const cantos = [
    { rot: 0, x: -L / 2 + I.recuo, y: -A / 2 + I.recuo, a: I.braco, b: I.bracoLombada },
    { rot: Math.PI / 2, x: L / 2 - I.recuo, y: -A / 2 + I.recuo, a: I.braco, b: I.braco },
    { rot: Math.PI, x: L / 2 - I.recuo, y: A / 2 - I.recuo, a: I.braco, b: I.braco },
    { rot: -Math.PI / 2, x: -L / 2 + I.recuo, y: A / 2 - I.recuo, a: I.bracoLombada, b: I.braco },
  ]
  for (const c of cantos) {
    for (const g of cantoL(c.a, c.b)) {
      g.rotateZ(c.rot)
      g.translate(c.x, c.y, 0)
      add(g)
    }
  }

  /* abas do disco: um chapéu radial que cobre a borda clara (r 0,587 →
   * 0,600) 1,5 mm acima do disco, sobre uma coluna logo fora dele. Paradas:
   * o disco gira por baixo. O chapéu é `placa`, não `barra`: com o canto
   * de 0,0096 a barra engrossaria para 0,020 e afundaria no disco. */
  const AD = D.abasDisco
  const cx = D.disco.centroX
  const baixoChapeu = z.discoFrente + 0.0015
  for (const graus of AD.angulos) {
    const a = (graus * Math.PI) / 180
    const chapeu = placa(AD.largura, AD.comprimento, AD.largura * 0.48, 0.012)
    chapeu.rotateZ(a - Math.PI / 2)   // eixo comprido na direção do raio
    chapeu.translate(cx + Math.cos(a) * AD.raio, Math.sin(a) * AD.raio, baixoChapeu)
    add(chapeu)

    const rc = AD.raio + 0.016
    const coluna = barra(AD.largura, AD.largura, baixoChapeu - z.baseFrente, 0, 0, 0, AD.largura * 0.45)
    coluna.rotateZ(a - Math.PI / 2)
    coluna.translate(cx + Math.cos(a) * rc, Math.sin(a) * rc, (baixoChapeu + z.baseFrente) / 2)
    add(coluna)
  }

  /* dedos em J nos cantos de baixo: sobem do canal e dobram para dentro
   * em 45°; a ponta da diagonal fica em r 0,62, fora do disco (0,60) */
  const F = D.dedos
  const zf = z.baseFrente + F.altura / 2
  for (const sx of [-1, 1]) {
    add(barra(F.largura, F.yTopo - F.yBase, F.altura, sx * F.x, (F.yBase + F.yTopo) / 2, zf, F.largura * 0.48))
    add(barra(F.largura, 0.052, F.altura, sx * (F.x - 0.0184), F.yTopo + 0.0184, zf, F.largura * 0.48, (sx * Math.PI) / 4))
  }

  /* o poço do disco: um anel baixo logo fora da borda. Perfil anti-horário
   * (sobe por fora, topo para dentro, desce por dentro), como no disco:
   * normais para fora */
  const poco = new THREE.LatheGeometry([[0.624, 0], [0.624, 0.004], [0.616, 0.004], [0.616, 0]].map(([r, h]) => new THREE.Vector2(r, h)), 128)
  poco.rotateX(Math.PI / 2)
  poco.translate(cx, 0, z.baseFrente)
  add(poco)

  const g = mergeGeometries(partes)
  partes.forEach((p) => p.dispose())
  g.computeBoundingSphere()
  return g
}
