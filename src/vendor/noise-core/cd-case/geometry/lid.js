// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CASE_DIMENSIONS, camadas } from '../dimensions'
import { barra, contorno, moldura, placa, semIndice, varrer } from './shapes'

/**
 * A tampa, em duas geometrias:
 * - `placa`: a chapa lisa (é ela que leva os riscos e o brilho da tampa);
 * - `detalhes`: a casca da borda (saia, aro, sulco e filete), a trava do
 *   lado da dobradiça e as abas do encarte do lado oposto.
 *
 * Antes era uma chapa com uma moldura chata no mesmo plano do contorno:
 * de frente, lia como uma folha de papel. A casca varrida dá à borda
 * volume e linhas próprias, que somam às da parede da bandeja por baixo.
 *
 * Tudo é montado no espaço do estojo e só no fim levado ao espaço do pivô
 * — a origem no eixo da dobradiça, na lateral esquerda — para a abertura
 * ser só uma rotação em Y.
 */
export function geometriaTampa(D = CASE_DIMENSIONS) {
  const z = camadas(D)
  const L = D.largura
  const A = D.altura

  // recuada 0,006: quem desenha a silhueta é a casca da borda
  const chapa = placa(L - 0.012, A - 0.012, D.raioCanto - 0.006, D.tampa).translate(0, 0, z.tampaFundo)

  const partes = []
  const add = (g) => { partes.push(semIndice(g)); g.dispose() }

  /* a casca da borda, de dentro da saia para o centro: face de dentro da
   * saia e o lábio de baixo (0,028 de saia, 0,002 de folga para o degrau
   * da parede em u 0,010), face de fora, quina de cima arredondada, o aro
   * 0,004 acima da chapa, um sulco e um filete fino em u 0,038–0,046.
   * O maior u (0,048) fica abaixo do raio do canto (0,05). Nada mais
   * estreito que 0,008: 0,004 é ~1 px e serrilha em tracejado. */
  const T = z.tampaFrente
  const t = z.tampaFundo
  const s = z.ombro
  const perfilTampa = [
    [0.008, t], [0.008, s + 0.0015], [0.0065, s],
    [0.0065, s], [0.001, s + 0.003], [0, s + 0.008],
    [0, s + 0.008], [0, T - 0.004], [0.002, T + 0.001], [0.006, T + 0.004], [0.024, T + 0.004],
    [0.024, T + 0.004], [0.026, T],
    [0.026, T], [0.036, T],
    [0.036, T], [0.038, T + 0.002], [0.046, T + 0.002], [0.048, T],
  ]
  add(varrer(contorno(L, A, D.raioCanto, 10), perfilTampa))

  /* a trava, na face de dentro da tampa, no meio da esquerda: laço de
   * fora, laço de dentro colado nele pela esquerda e duas pontes. O topo
   * encosta na chapa; ela vai e volta com a tampa e, fechada, passa por
   * cima da borda do disco, como na referência. */
  const C = D.trava
  const zc = z.tampaFundo - C.profundidade + 0.002
  const ext = (forma) => new THREE.ExtrudeGeometry(forma, {
    depth: C.profundidade - 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 8,
  })
  add(ext(moldura(C.largura, C.altura, C.raio, C.barra)).translate(-L / 2 + 0.004 + C.largura / 2, 0, zc))
  add(ext(moldura(C.interno.largura, C.interno.altura, C.interno.raio, C.barra * 0.8)).translate(-L / 2 + 0.014 + C.interno.largura / 2, 0, zc))
  for (const sy of [-1, 1]) {
    add(barra(0.088, C.barra * 0.8, C.profundidade, -L / 2 + 0.168, sy * 0.03, z.tampaFundo - C.profundidade / 2, 0.004))
  }

  /* as abas do encarte, do lado oposto à dobradiça, penduradas na chapa */
  for (const y of D.abas.y) {
    add(barra(D.abas.largura, D.abas.altura, D.abas.profundidade, L / 2 - 0.036 - D.abas.largura / 2, y, t - D.abas.profundidade / 2, 0.004))
  }

  const detalhes = mergeGeometries(partes)
  partes.forEach((p) => p.dispose())

  // para o espaço do pivô: dobradiça na origem
  for (const g of [chapa, detalhes]) {
    g.translate(L / 2, 0, -z.dobradicaZ)
    g.computeBoundingSphere()
  }
  return { placa: chapa, detalhes }
}

/**
 * Os dois cilindros curtos da dobradiça, em pé. O centro fica `recuo`
 * para dentro da lateral esquerda (quem posiciona é a cena), então eles
 * moram dentro da silhueta em vez de saltar dela.
 */
export function geometriaDobradica(D = CASE_DIMENSIONS) {
  const partes = [-1, 1].map((s) => {
    const c = new THREE.CylinderGeometry(D.dobradica.raio, D.dobradica.raio, D.dobradica.comprimento, 20)
    c.translate(0, s * D.dobradica.y, 0)
    const p = semIndice(c)
    c.dispose()
    return p
  })
  const g = mergeGeometries(partes)
  partes.forEach((p) => p.dispose())
  return g
}
