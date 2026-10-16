// noise-core @ 28289ac (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'

/**
 * Sementes distribuídas por espiral de Fibonacci: a forma mais barata de
 * espalhar N pontos numa esfera com áreas quase iguais. Áreas iguais
 * importam aqui — células de tamanhos diferentes dariam pesos visuais
 * diferentes para faixas de frequência igualmente importantes.
 *
 * Ordenadas por latitude: a banda de cada célula é a sua altura. Grave no
 * polo sul, agudo no polo norte. O orbe vira um espectro esférico.
 */
export function fibonacciSeeds(n) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const pts = []

  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const th = golden * i
    pts.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r))
  }

  pts.sort((a, b) => a.y - b.y)
  return pts
}

// Quantas faixas cada vértice mistura.
//
// 6 em vez de 4 porque uma faixa forte e estreita — um bumbo, que é
// justamente banda estreita — empurrava só a sua vizinhança imediata e
// levantava um cone. Com a vizinhança mais larga o mesmo pico vira cúpula.
const K = 6

/**
 * Para cada vértice: as K faixas mais próximas e o peso de cada uma.
 *
 * Uma partição dura em células deixa marca. Onde duas células vizinhas
 * carregam energias diferentes, a superfície ganha uma dobra, e o conjunto
 * dessas dobras desenha a malha de contornos que lê como espuma ou ondas
 * sobre o orbe. Misturar só as duas células mais próximas suaviza a
 * fronteira entre elas, mas não os pontos onde três se encontram — e são
 * justamente esses vértices que amarram os contornos numa rede.
 *
 * Aqui o valor de cada vértice é a média ponderada das K faixas mais
 * próximas, com peso
 *
 *     w = (1 - d / dK+1)²
 *
 * onde d é a distância angular até a semente e dK+1 a distância até a
 * primeira semente de fora do conjunto. O peso da K-ésima chega a zero
 * exatamente quando ela empata com a K+1-ésima, que é o instante em que as
 * duas trocam de lugar — então o campo atravessa a troca sem degrau. Sem
 * fronteiras, sem dobras, sem contornos.
 *
 * Roda uma vez, na montagem.
 */
export function assignCells(geometry, seeds) {
  const pos = geometry.attributes.position
  const n = pos.count

  // seis faixas não cabem num atributo só: vão em dois vec4, com as duas
  // últimas casas do segundo zeradas
  const cellsA = new Float32Array(n * 4)
  const cellsB = new Float32Array(n * 4)
  const weightsA = new Float32Array(n * 4)
  const weightsB = new Float32Array(n * 4)

  const plateCell = new Float32Array(n)
  const plateCenter = new Float32Array(n * 3)
  const plateRoom = new Float32Array(n)

  const v = new THREE.Vector3()

  /* Espaço disponível para o furo de cada célula.
   *
   * Um teto único para todas rompe a malha. A espiral de Fibonacci
   * distribui bem, mas não uniformemente: algumas sementes ficam mais
   * juntas que a média, e um teto calculado pela média deixa dois furos
   * desses se encontrarem, comendo a trave entre eles.
   *
   * Aqui cada célula guarda metade da distância até a sua vizinha mais
   * próxima. É o limite absoluto: dois furos vizinhos nesse raio se
   * encostam exatamente no meio do caminho. A meia-trave que se quer
   * deixar é subtraída no shader, e não aqui, porque cada pele quer uma
   * espessura diferente — a Hexcore quer trave visível, a Sigil quer
   * quase nada.
   */
  const espaco = new Float32Array(seeds.length)
  for (let i = 0; i < seeds.length; i++) {
    let maisPerto = -2
    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue
      const d = seeds[i].dot(seeds[j])
      if (d > maisPerto) maisPerto = d
    }
    const ang = Math.acos(Math.min(1, Math.max(-1, maisPerto)))
    espaco[i] = ang * 0.5
  }

  /* Centro da célula por triângulo, não por vértice.
   *
   * O furo da pele Hexcore é medido no fragment pelo ângulo até este
   * centro. Guardado por vértice, um triângulo que cruza a fronteira
   * interpola entre duas sementes e entrega um centro que não existe — o
   * ângulo sai errado e a beirada do furo acende ao longo de toda a
   * divisa, desenhando um serrilhado sobre as traves.
   *
   * Constante no triângulo, o centro nunca é interpolado. A geometria vem
   * não indexada, então cada triângulo já tem os seus vértices e isso não
   * custa duplicação nenhuma.
   */
  const centroide = new THREE.Vector3()
  for (let t = 0; t < n; t += 3) {
    centroide.set(0, 0, 0)
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, t + k)
      centroide.add(v)
    }
    centroide.normalize()

    let melhor = -2
    let dono = 0
    for (let s = 0; s < seeds.length; s++) {
      const d = centroide.dot(seeds[s])
      if (d > melhor) { melhor = d; dono = s }
    }

    const c = seeds[dono]
    for (let k = 0; k < 3; k++) {
      plateCell[t + k] = dono
      plateCenter[(t + k) * 3] = c.x
      plateCenter[(t + k) * 3 + 1] = c.y
      plateCenter[(t + k) * 3 + 2] = c.z
      plateRoom[t + k] = espaco[dono]
    }
  }

  // K+1 mais próximas, em ordem decrescente de produto escalar
  const dots = new Float64Array(K + 1)
  const idx = new Int32Array(K + 1)

  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).normalize()

    dots.fill(-2)
    idx.fill(0)

    for (let s = 0; s < seeds.length; s++) {
      const d = v.dot(seeds[s])
      if (d <= dots[K]) continue
      let j = K
      while (j > 0 && dots[j - 1] < d) {
        dots[j] = dots[j - 1]
        idx[j] = idx[j - 1]
        j--
      }
      dots[j] = d
      idx[j] = s
    }

    // produto escalar vira ângulo: o peso precisa cair com a distância real
    const cut = Math.acos(Math.min(1, Math.max(-1, dots[K])))
    let sum = 0

    const w = new Float64Array(K)
    for (let k = 0; k < K; k++) {
      const ang = Math.acos(Math.min(1, Math.max(-1, dots[k])))
      const t = cut > 0 ? Math.max(0, 1 - ang / cut) : 1
      w[k] = t * t
      sum += w[k]
    }

    // normaliza: o deslocamento é média, não soma — senão vértices com mais
    // vizinhas próximas inchariam sozinhos
    const inv = sum > 0 ? 1 / sum : 0
    for (let k = 0; k < K; k++) {
      const target = k < 4 ? cellsA : cellsB
      const wTarget = k < 4 ? weightsA : weightsB
      const slot = i * 4 + (k % 4)
      target[slot] = idx[k]
      wTarget[slot] = w[k] * inv
    }
    if (sum === 0) weightsA[i * 4] = 1
  }

  geometry.setAttribute('aCells', new THREE.BufferAttribute(cellsA, 4))
  geometry.setAttribute('aCellsB', new THREE.BufferAttribute(cellsB, 4))
  geometry.setAttribute('aWeights', new THREE.BufferAttribute(weightsA, 4))
  geometry.setAttribute('aWeightsB', new THREE.BufferAttribute(weightsB, 4))
  geometry.setAttribute('aPlate', new THREE.BufferAttribute(plateCell, 1))
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(plateCenter, 3))
  geometry.setAttribute('aRoom', new THREE.BufferAttribute(plateRoom, 1))
}

/**
 * Os vértices do diagrama de Voronoi: os pontos onde três células se
 * encontram.
 *
 * É onde os espinhos nascem, e não por gosto. O vértice de Voronoi é, por
 * definição, o ponto localmente mais distante de todas as sementes — o
 * meio da junção de três traves, o lugar mais grosso da treliça e o único
 * garantidamente fora de qualquer furo. Espinho posto em qualquer outro
 * lugar sairia de dentro de um buraco.
 *
 * Cada vértice é o circuncentro de um triângulo de Delaunay, e sai do
 * produto vetorial: o vetor perpendicular ao plano dos três é equidistante
 * dos três na esfera. Vale se nenhuma outra semente estiver mais perto —
 * é isso que separa os triângulos de Delaunay dos outros.
 *
 * Força bruta sobre as combinações. Com 64 sementes são 42 mil triplas, e
 * roda uma vez na montagem.
 */
export function voronoiCorners(seeds) {
  const cantos = []
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const cc = new THREE.Vector3()

  for (let i = 0; i < seeds.length; i++) {
    for (let j = i + 1; j < seeds.length; j++) {
      for (let k = j + 1; k < seeds.length; k++) {
        ab.subVectors(seeds[j], seeds[i])
        ac.subVectors(seeds[k], seeds[i])
        cc.crossVectors(ab, ac)
        if (cc.lengthSq() < 1e-12) continue
        cc.normalize()

        // dos dois polos do plano, o do lado dos três
        if (cc.dot(seeds[i]) < 0) cc.negate()

        const alcance = cc.dot(seeds[i])
        let vazio = true
        for (let m = 0; m < seeds.length; m++) {
          if (m === i || m === j || m === k) continue
          if (cc.dot(seeds[m]) > alcance + 1e-9) { vazio = false; break }
        }
        if (vazio) cantos.push(cc.clone())
      }
    }
  }
  return cantos
}

/**
 * Escolhe `quantos` pontos bem espalhados entre os candidatos.
 *
 * Ponto mais distante primeiro: começa num e a cada passo pega o que está
 * mais longe de tudo que já foi escolhido. Sorteio simples daria espinhos
 * encostados uns nos outros e regiões inteiras pelados — os vértices de
 * Voronoi vêm em trincas próximas, então sorteá-los cai nisso com
 * facilidade.
 */
export function spreadPick(pontos, quantos) {
  if (pontos.length <= quantos) return pontos.slice()

  const escolhidos = [pontos[0]]
  const dist = pontos.map((p) => p.dot(pontos[0]))

  while (escolhidos.length < quantos) {
    let melhor = 0
    for (let i = 1; i < pontos.length; i++) {
      if (dist[i] < dist[melhor]) melhor = i   // menor produto = mais longe
    }
    const novo = pontos[melhor]
    escolhidos.push(novo)
    for (let i = 0; i < pontos.length; i++) {
      dist[i] = Math.max(dist[i], pontos[i].dot(novo))
    }
  }
  return escolhidos
}

/**
 * Prepara os espinhos para se comportarem como líquido.
 *
 * Para cada ponta devolve três coisas:
 *
 * - `band`: a faixa que ela escuta. As sementes estão ordenadas por
 *   latitude, então o índice da célula já é a frequência; a ponta fica
 *   entre três células e toma a média delas. É o mesmo mapa que rege a
 *   superfície — grave embaixo, agudo em cima —, agora regendo as pontas.
 *
 * - `neighbours`: as pontas vizinhas. É por elas que a perturbação viaja:
 *   acoplar cada ponta às vizinhas transforma um punhado de molas
 *   independentes na equação de onda discretizada, e uma batida num ponto
 *   se espalha pela casca em vez de ficar presa onde nasceu.
 *
 * - `t1`, `t2`: base tangente, para o eixo balançar sem sair da esfera.
 */
export function spikeRig(spikes, seeds, vizinhas = 3) {
  const banda = new Float32Array(spikes.length)
  const viz = []
  const t1 = []
  const t2 = []

  for (let i = 0; i < spikes.length; i++) {
    const s = spikes[i]

    // três células mais próximas: a faixa da ponta é a média dos índices
    const perto = seeds
      .map((c, idx) => ({ idx, d: s.dot(c) }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 3)
    banda[i] = perto.reduce((soma, p) => soma + p.idx, 0) / perto.length

    const outras = spikes
      .map((p, idx) => ({ idx, d: s.dot(p) }))
      .filter((p) => p.idx !== i)
      .sort((a, b) => b.d - a.d)
      .slice(0, vizinhas)
    viz.push(outras.map((p) => p.idx))

    const eixo = Math.abs(s.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
    const a = new THREE.Vector3().crossVectors(eixo, s).normalize()
    t1.push(a)
    t2.push(new THREE.Vector3().crossVectors(s, a).normalize())
  }

  return { band: banda, neighbours: viz, t1, t2 }
}

/**
 * Uma textura de N×1 pixels carrega as amplitudes para a GPU. É o caminho
 * mais portátil: array de uniforms com índice variável depende da versão
 * de GLSL, textura funciona em qualquer lugar.
 */
export function createBandTexture(count) {
  const data = new Uint8Array(count * 4)
  const tex = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter   // sem borrar entre faixas vizinhas
  tex.magFilter = THREE.NearestFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return { tex, data }
}
