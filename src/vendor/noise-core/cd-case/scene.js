// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'

import { CASE_DIMENSIONS, camadas } from './dimensions.js'
import { VARIANTES } from './variants.js'
import { geometriaBandeja, geometriaFundo } from './geometry/tray.js'
import { geometriaTampa, geometriaDobradica } from './geometry/lid.js'
import { geometriaHub } from './geometry/hub.js'
import { geometriaDisco, geometriaMiolo, geometriaRotulo, geometriaBordaDisco } from './geometry/disc.js'
import { criarPlastico, texturaRiscos } from './materials/plastic.js'
import { criarMaterialDisco, criarMaterialRotulo } from './materials/holoDisc.js'
import { criarRotulo } from './stickers/rotulo.js'
import { criarAtlas } from './stickers/atlas.js'
import { criarEtiqueta } from './stickers/label.js'
import { gerarLayout, SEMENTE_PADRAO } from './stickers/layout.js'
import { geometriaAdesivo, criarMaterialAdesivos, criarMaterialEtiqueta } from './stickers/meshes.js'
import { corDaImagem } from './color.js'
import { criarLuzes } from './environment.js'
import { createLid } from './interaction/lid.js'
import { POSE } from './interaction/drag.js'

const D = CASE_DIMENSIONS
const Z = camadas(D)
const ABERTURA = (D.aberturaGraus * Math.PI) / 180

// tocando: uma volta a cada ~1,8 s; pausado: para em 1,2 s
const GIRO_ALVO = (Math.PI * 2) / 1.8
const FREIO = GIRO_ALVO / 1.2
const TRANCO = 2.6
const TROCA_SAI = 0.28
const TROCA_ENTRA = 0.34

const OPACIDADE_SOMBRA = 0.38
const OPACIDADE_SOMBRA_DISCO = 0.35

/**
 * Leva a matriz de `alvo` (um plano de sombra na cena, sem matrixAutoUpdate)
 * à projeção da peça `fonte` no plano da tela, atrás de tudo (z -0,55),
 * deslocada (ox, oy).
 *
 * Os eixos X e Y da peça projetados em XY viram os eixos do plano: a
 * sombra herda o giro no plano, a inclinação em X e o deslocamento da
 * tampa aberta. De lado, o eixo X projetado encolhe até zero — então soma
 * a espessura projetada (o eixo Z da peça em XY, vezes espessura/largura),
 * e a sombra afina até a espessura do estojo em vez de sumir. Escalar X
 * ou trocar pela cos-escala não pegaria a inclinação em X nem o giro.
 *
 * Devolve a área projetada relativa (0–1) para a opacidade acompanhar: de
 * lado, a sombra é mais fina e mais fraca.
 */
function achatar(alvo, fonte, ox, oy, fracEsp) {
  const e = fonte.matrixWorld.elements
  let ax = e[0]
  let ay = e[1]
  const bx = e[4]
  const by = e[5]
  const lz = Math.hypot(e[8], e[9]) * fracEsp
  const la = Math.hypot(ax, ay)
  if (la > 1e-5) {
    const k = (la + lz) / la
    ax *= k
    ay *= k
  } else {
    ax = lz
    ay = 0
  }
  alvo.matrix.set(
    ax, bx, 0, e[12] + ox,
    ay, by, 0, e[13] + oy,
    0, 0, 1, -0.55,
    0, 0, 0, 1,
  )
  alvo.matrixWorldNeedsUpdate = true
  return Math.min(1, Math.abs(ax * by - ay * bx) / (e[0] * e[0] + e[1] * e[1] + e[2] * e[2]))
}

function malha(geometria, material, props = {}) {
  const m = new THREE.Mesh(geometria, material)
  if (props.position) m.position.set(...props.position)
  if (props.rotation) m.rotation.set(...props.rotation)
  if (props.scale !== undefined) {
    if (Array.isArray(props.scale)) m.scale.set(...props.scale)
    else m.scale.setScalar(props.scale)
  }
  if (props.renderOrder !== undefined) m.renderOrder = props.renderOrder
  if (props.visible === false) m.visible = false
  if (props.userData) m.userData = props.userData
  return m
}

/**
 * O estojo de CD: geometria, materiais, adesivos, rótulo, sombras e o que
 * acontece a cada quadro — sem renderer, sem câmera, sem React.
 *
 * Quem hospeda põe `objetos` numa cena, dá a ela o ambiente
 * (`criarAmbiente`) e chama `update(dt, quadro, ...)` a cada quadro. O app
 * desktop hospeda dentro do React Three Fiber; a demo web, em
 * `createCdCase`, num renderer próprio. A cena é a mesma.
 *
 * Opções: `qualidade` ('low' | 'medium' | 'high'), `variante` (ver
 * variants.js), `encarte` (mostra a capa atrás da placa do fundo),
 * `semente` (o layout dos adesivos), `tampa` (uma mola de createLid; se
 * não vier, a cena cria a sua) e `invalidar` (pede um quadro quando algo
 * muda fora do laço — uma capa que terminou de carregar, uma fonte que
 * chegou).
 */
export function createCdCaseScene(opcoes = {}) {
  let qualidade = opcoes.qualidade || 'medium'
  let variante = VARIANTES[opcoes.variante] ? opcoes.variante : 'holo'
  let encarte = opcoes.encarte !== false
  let semente = opcoes.semente ?? SEMENTE_PADRAO
  const tampa = opcoes.tampa || createLid()
  const invalidar = () => { if (opcoes.invalidar) opcoes.invalidar() }
  let V = VARIANTES[variante]

  /* geometria: criada uma vez, liberada no dispose. A tampa vem em duas
   * (chapa e detalhes): cada uma vira um mesh, e as duas são liberadas */
  const geoTampa = geometriaTampa(D)
  const geo = {
    bandeja: geometriaBandeja(D),
    fundo: geometriaFundo(D),
    tampaPlaca: geoTampa.placa,
    tampaDetalhes: geoTampa.detalhes,
    dobradica: geometriaDobradica(D),
    hub: geometriaHub(D),
    disco: geometriaDisco(D),
    miolo: geometriaMiolo(D),
    rotulo: geometriaRotulo(D),
    bordaDisco: geometriaBordaDisco(D),
    sombraDisco: new THREE.PlaneGeometry(1.36, 1.36),
    encarte: new THREE.PlaneGeometry(D.encarte.largura, D.encarte.altura),
    // as procurações do hit-test (ver picker.js): a caixa do estojo, a
    // da tampa no espaço do pivô (a placa com folga para o aro) e o disco
    // inteiro, do furo à borda, na altura do rótulo
    proxyEstojo: new THREE.BoxGeometry(D.largura, D.altura, D.espessura),
    proxyTampa: new THREE.BoxGeometry(D.largura, D.altura, D.tampa + 0.006)
      .translate(D.largura / 2, 0, Z.tampaFundo + D.tampa / 2 - Z.dobradicaZ),
    proxyDisco: new THREE.CircleGeometry(D.disco.raio, 48)
      .translate(0, 0, D.disco.espessura + D.disco.rotulo.espessura),
  }
  // as procurações nunca são desenhadas (visible false); o material só
  // existe porque o raycast do Mesh lê o `side` dele
  const matProxy = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })

  /* materiais do plástico: dependem da qualidade. Um shader só para todos;
   * o que muda por peça (alfa mínimo, corpo cinza, sulcos...) é uniform */
  const riscos = texturaRiscos()
  const criarPlasticos = () => ({
    // o fundo engrossa na borda: a placa vista pela espessura
    fundo: criarPlastico({ qualidade, lado: THREE.FrontSide, piso: 0.05, bordaGrossa: 0.22, meia: [D.largura / 2, D.altura / 2], plano: 1 }),
    // a bandeja em dois passes, costas antes da frente: as paredes têm alfa
    // 0,3–0,45, e com DoubleSide num passe só as camadas compunham fora de ordem
    bandejaTras: criarPlastico({ qualidade, lado: THREE.BackSide, piso: 0.02, corpo: 0.30, sulco: 1 }),
    bandeja: criarPlastico({ qualidade, lado: THREE.FrontSide, piso: 0.02, corpo: 0.30, sulco: 1 }),
    hub: criarPlastico({ qualidade, piso: 0.04, corpo: 0.16 }),
    miolo: criarPlastico({ qualidade, piso: 0.03, corpo: 0.06 }),
    bordaDisco: criarPlastico({ qualidade, piso: 0.10, corpo: 0.15 }),
    dobradica: criarPlastico({ qualidade, piso: 0.06, corpo: 0.25 }),
    // a tampa mora no espaço do pivô: deslocZ devolve o Z do estojo aos sulcos
    tampaPlaca: criarPlastico({ qualidade, riscos, piso: 0.025, brilhoTampa: 0.05, deslocZ: Z.dobradicaZ, plano: 1 }),
    tampaDetalhes: criarPlastico({ qualidade, piso: 0.02, corpo: 0.22, sulco: 1, deslocZ: Z.dobradicaZ }),
  })
  let plastico = criarPlasticos()

  /* o disco: material por variante */
  let disco = criarMaterialDisco(V.aro, D)

  /* o rótulo: canvas único (capa ou padrão), material por variante e qualidade */
  const rotulo = criarRotulo(D)
  let matRotulo = criarMaterialRotulo(V.rotulo, rotulo.textura, qualidade, D)

  /* a sombra do disco no fundo da bandeja: um anel desfocado, deitado no
   * topo da placa e puxado para baixo e para a direita (longe da chave).
   * É a principal deixa de espessura do disco em repouso: na referência,
   * o fundo fica 16% mais escuro abaixo e à direita dele */
  const sombraDisco = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')
    ctx.filter = 'blur(3px)'
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(128, 128, 113, 0, Math.PI * 2)
    ctx.arc(128, 128, 34, 0, Math.PI * 2, true)
    ctx.fill('evenodd')
    const t = new THREE.CanvasTexture(c)
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: OPACIDADE_SOMBRA_DISCO, depthWrite: false, color: '#0b0f1e' })
    return { t, m }
  })()

  /* adesivos: atlas único gerado na montagem, layout por semente */
  const atlas = criarAtlas()
  const etiqueta = criarEtiqueta()
  const matAdesivos = criarMaterialAdesivos(atlas)
  const matEtiqueta = criarMaterialEtiqueta(etiqueta.textura)

  /* a sombra: um retângulo desfocado atrás do estojo, deslocado para baixo
   * e para a direita — o estojo flutuando na frente da tela, como na
   * referência. Um plano com textura em vez de ContactShadows: nenhum passe
   * de render a mais, e a sombra de um objeto de frente para a câmera cai
   * atrás dele, não num chão que ninguém vê.
   *
   * Duas: a do estojo e a da tampa (a mesma geometria levada meia largura
   * para a direita, porque a origem da tampa é o eixo da dobradiça). A
   * cada quadro, cada uma vira a projeção da matriz da sua peça — ver
   * `achatar`. Preta pura e com blend MAX: onde as duas se cruzam não
   * escurece em dobro, e com rgb 0 o MAX mantém a saída pré-multiplicada
   * válida na janela transparente (uma cor ali viraria brilho no desktop
   * escuro). */
  const sombra = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')
    ctx.filter = 'blur(22px)'
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.roundRect(48, 48, 160, 160, 18)
    ctx.fill()
    const t = new THREE.CanvasTexture(c)
    const m = new THREE.MeshBasicMaterial({
      map: t,
      color: '#000000',
      transparent: true,
      opacity: OPACIDADE_SOMBRA,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendEquationAlpha: THREE.MaxEquation,
    })
    const mt = m.clone()
    const g = new THREE.PlaneGeometry(D.largura * 1.6, D.altura * 1.6)
    const gt = g.clone().translate(D.largura / 2, 0, 0)
    return { t, m, mt, g, gt }
  })()

  /* ---------------- o grafo ----------------
   *
   * Ordem de desenho dos transparentes, que não escrevem profundidade e
   * por isso pintam na ordem em que chegam: as sombras projetadas (-2, e
   * antes de tudo: o blend MAX delas só fica certo sobre o vazio), o fundo
   * (-1), a sombra do disco deitada nele (0), o hub (1), as costas da
   * bandeja (1,9), a frente dela com o miolo, a borda do disco e a
   * dobradiça (2) e por fim a tampa (3). Com o fundo depois do hub, o véu
   * dele apagava os anéis. */
  const luzes = criarLuzes()

  let arte = null           // a imagem da capa, quando carregou
  let acento = null         // a cor tirada dela
  let adesivos = []
  const adesivoMeshes = []

  // fora da raiz: a matriz delas é montada à mão a cada quadro
  const sombraEstojo = malha(sombra.g, sombra.m, { renderOrder: -2 })
  const sombraTampa = malha(sombra.gt, sombra.mt, { renderOrder: -2 })
  for (const s of [sombraEstojo, sombraTampa]) {
    s.matrixAutoUpdate = false
    s.frustumCulled = false
  }

  const raiz = new THREE.Group()
  const mFundo = malha(geo.fundo, plastico.fundo, { renderOrder: -1 })
  const mBandejaTras = malha(geo.bandeja, plastico.bandejaTras, { renderOrder: 1.9 })
  const mBandeja = malha(geo.bandeja, plastico.bandeja, { renderOrder: 2 })
  const proxyEstojo = malha(geo.proxyEstojo, matProxy, { userData: { parte: 'bandeja' }, visible: false })
  raiz.add(mFundo, mBandejaTras, mBandeja, proxyEstojo)

  // o encarte, atrás da placa do fundo: só com capa (entra em atualizarEncarte)
  let mEncarte = null

  const cx = D.disco.centroX
  const mSombraDisco = malha(geo.sombraDisco, sombraDisco.m, { position: [cx + 0.02, -0.03, Z.baseFrente + 0.0006], renderOrder: 0 })
  const mHub = malha(geo.hub, plastico.hub, { position: [cx, 0, Z.hubFundo], renderOrder: 1 })
  raiz.add(mSombraDisco, mHub)

  const discoGrupo = new THREE.Group()
  discoGrupo.position.set(cx, 0, Z.discoFundo)
  const mDisco = malha(geo.disco, disco.material)
  const proxyDisco = malha(geo.proxyDisco, matProxy, { userData: { parte: 'disco' }, visible: false })
  const mRotulo = malha(geo.rotulo, matRotulo.material)
  const mBordaDisco = malha(geo.bordaDisco, plastico.bordaDisco, { renderOrder: 2 })
  const mMiolo = malha(geo.miolo, plastico.miolo, { renderOrder: 2 })
  discoGrupo.add(mDisco, proxyDisco, mRotulo, mBordaDisco, mMiolo)
  // os adesivos nascem aqui, antes da dobradiça e da tampa, na mesma ordem
  // do JSX do app: o three desempata a ordem de desenho pelo id do objeto
  montarAdesivos()
  raiz.add(discoGrupo)

  // os nós da dobradiça, recuados para dentro da silhueta; o eixo de
  // giro da tampa (o pivô) continua na lateral
  const mDobradica = malha(geo.dobradica, plastico.dobradica, { position: [-D.largura / 2 + D.dobradica.recuo, 0, Z.dobradicaZ], renderOrder: 2 })
  raiz.add(mDobradica)

  const pivo = new THREE.Group()
  pivo.position.set(-D.largura / 2, 0, Z.dobradicaZ)
  const tampaMesh = malha(geo.tampaPlaca, plastico.tampaPlaca, { renderOrder: 3 })
  const mTampaDetalhes = malha(geo.tampaDetalhes, plastico.tampaDetalhes, { renderOrder: 3 })
  const proxyTampa = malha(geo.proxyTampa, matProxy, { userData: { parte: 'tampa' }, visible: false })
  pivo.add(tampaMesh, mTampaDetalhes, proxyTampa)
  raiz.add(pivo)

  /* ---------------- adesivos ---------------- */
  function montarAdesivos() {
    for (const m of adesivoMeshes) discoGrupo.remove(m)
    adesivoMeshes.length = 0
    adesivos.forEach((a) => a.geometria.dispose())
    adesivos = gerarLayout(semente, D, { comCapa: Boolean(arte) }).map((a) => ({
      ...a,
      geometria: a.id === 'label'
        ? geometriaAdesivo(null, etiqueta.proporcao, a.escala)
        : geometriaAdesivo(atlas.celulas[a.id], 1, a.escala),
    }))
    if (!V.adesivos) return
    adesivos.forEach((a, i) => {
      const m = malha(a.geometria, a.id === 'label' ? matEtiqueta : matAdesivos.material, {
        position: [Math.cos(a.angulo) * a.raio, Math.sin(a.angulo) * a.raio, D.disco.espessura + D.disco.rotulo.espessura + 0.0008 + i * 0.0002],
        rotation: [0, 0, a.angulo + a.rotacao - Math.PI / 2],
        scale: a.escala,
        renderOrder: 1,
      })
      adesivoMeshes.push(m)
      discoGrupo.add(m)
    })
  }

  /* ---------------- capa, rótulo e encarte ---------------- */
  let faixa = null          // { title, artist, artworkUrl }
  let capa = null           // textura da capa
  let matEncarte = null
  let ultimoRotulo = null
  let urlPedida = null

  function desenharRotulo() {
    const titulo = faixa ? faixa.title : '—'
    const artista = faixa ? faixa.artist : ''
    const args = { imagem: arte, titulo, artista, acento, estilo: V.rotulo }
    ultimoRotulo = args
    etiqueta.desenhar(args)
    rotulo.desenhar(args)
    matRotulo.uniforms.uFoil.value = arte ? V.rotulo.foilCapa : V.rotulo.foil
    invalidar()
  }

  function atualizarEncarte() {
    if (mEncarte) { raiz.remove(mEncarte); mEncarte = null }
    if (encarte && matEncarte) {
      mEncarte = malha(geo.encarte, matEncarte, { position: [0, 0, Z.encarte] })
      // o encarte entra logo depois da placa do fundo, como no JSX do app
      raiz.add(mEncarte)
      raiz.children.splice(raiz.children.indexOf(mEncarte), 1)
      raiz.children.splice(raiz.children.indexOf(proxyEstojo) + 1, 0, mEncarte)
    }
  }

  function trocarArte(img) {
    arte = img
    acento = img ? corDaImagem(img) : null
    if (capa) capa.dispose()
    if (matEncarte) matEncarte.dispose()
    capa = null
    matEncarte = null
    if (img) {
      capa = new THREE.Texture(img)
      capa.colorSpace = THREE.SRGBColorSpace
      capa.anisotropy = 4
      capa.needsUpdate = true
      // o encarte: a mesma capa, num material próprio, trocado (e liberado) junto com ela
      matEncarte = new THREE.MeshStandardMaterial({ map: capa, roughness: 0.55 })
    }
    atualizarEncarte()
    montarAdesivos()
    desenharRotulo()
  }

  /**
   * A faixa tocando: { title, artist, artworkUrl } ou null. A capa vem por
   * URL e carrega por fora; enquanto não chega, o rótulo usa o desenho
   * padrão com o título. Sem faixa, o estojo fecha.
   */
  function setFaixa(np) {
    if ((np || null) === faixa) return
    const antes = faixa
    faixa = np || null
    const url = faixa && faixa.artworkUrl
    if (url !== urlPedida) {
      urlPedida = url || null
      if (!url) {
        if (arte) trocarArte(null)
      } else {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => { if (urlPedida === url) trocarArte(img) }
        img.onerror = () => { if (urlPedida === url && arte) trocarArte(null) }
        img.src = url
      }
    }
    const nome = (n) => (n ? `${n.title}\u0000${n.artist}` : null)
    if (nome(antes) !== nome(faixa)) desenharRotulo()
    // nada tocando: estojo fechado (só na passagem para o nada, como o
    // efeito do app: com o estojo vazio, quem abre a tampa é a mão)
    if (antes && !faixa) { tampa.toggle(false); invalidar() }
  }

  /* O primeiro desenho dos canvas sai antes da webfont chegar, com a
   * fonte de reserva (ou um negrito sintetizado). Quando os pesos que o
   * rótulo e a etiqueta usam carregam, redesenha uma vez com os últimos
   * argumentos. O `ready` antes é porque a fonte pode vir de um @import:
   * se a cena monta antes dele chegar, o load não acha @font-face nenhuma
   * e resolve vazio na hora. Falhar aqui (offline) só mantém a reserva. */
  let vivo = true
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready.then(() => Promise.all([
      document.fonts.load("600 15px 'JetBrains Mono'"),
      document.fonts.load("700 76px 'JetBrains Mono'"),
    ])).then(() => {
      if (!vivo || !ultimoRotulo) return
      etiqueta.desenhar(ultimoRotulo)
      rotulo.desenhar(ultimoRotulo)
      invalidar()
    }).catch(() => {})
  }

  /* ---------------- trocas que vêm de fora ---------------- */

  function setQualidade(q) {
    if (q === qualidade) return
    qualidade = q
    const velhos = plastico
    plastico = criarPlasticos()
    mFundo.material = plastico.fundo
    mBandejaTras.material = plastico.bandejaTras
    mBandeja.material = plastico.bandeja
    mHub.material = plastico.hub
    mMiolo.material = plastico.miolo
    mBordaDisco.material = plastico.bordaDisco
    mDobradica.material = plastico.dobradica
    tampaMesh.material = plastico.tampaPlaca
    mTampaDetalhes.material = plastico.tampaDetalhes
    Object.values(velhos).forEach((m) => m.dispose())
    trocarMaterialRotulo()
    invalidar()
  }

  function trocarMaterialRotulo() {
    const velho = matRotulo
    matRotulo = criarMaterialRotulo(V.rotulo, rotulo.textura, qualidade, D)
    mRotulo.material = matRotulo.material
    velho.material.dispose()
    desenharRotulo()
  }

  function setVariante(v) {
    if (!VARIANTES[v] || v === variante) return
    variante = v
    V = VARIANTES[v]
    const velho = disco
    disco = criarMaterialDisco(V.aro, D)
    mDisco.material = disco.material
    velho.material.dispose()
    trocarMaterialRotulo()
    montarAdesivos()
  }

  function setEncarte(on) {
    encarte = on !== false
    atualizarEncarte()
    invalidar()
  }

  function setSemente(s) {
    semente = s
    montarAdesivos()
    invalidar()
  }

  /* ---------------- troca de disco ----------------
   * O atual sobe e sai, o novo desce e entra. `trocar(v)` devolve false se
   * não há o que fazer (o mesmo disco, ou uma troca já em curso). */
  const troca = { fase: null, t: 0, proxima: null }
  let aoTrocar = null

  function trocar(v, onAplicar) {
    if (v === variante || troca.fase) return false
    // fechado, o disco sairia atravessando a tampa
    if (!tampa.aberta()) tampa.toggle(true)
    troca.proxima = v
    troca.fase = 'sai'
    troca.t = 0
    aoTrocar = onAplicar || null
    invalidar()
    return true
  }

  /* ---------------- o quadro ---------------- */
  const giro = { w: 0, ultimaFaixa: -1, grave: 0, agudo: 0 }

  /**
   * Um quadro. `quadro` tem o que o áudio e a reprodução dizem agora:
   * { np, playing, level, bass, treble, lineChangedAt, trackChangedAt }.
   * `gesto` é o objeto de createCaseDrag (ou null: estojo parado na pose).
   * Devolve se algo ainda se mexe — quem hospeda usa para decidir se pede
   * o próximo quadro.
   */
  function update(dtBruto, quadro, gesto, pausado = false) {
    const dt = Math.min(0.05, dtBruto)
    const f = quadro
    const g = giro

    const mexeGesto = gesto ? gesto.step(dt) : false
    const mexeTampa = tampa.step(dt)
    const st = gesto ? gesto.estado : POSE_PARADA

    raiz.rotation.set(st.rotX + st.tiltX, st.rotY + st.tiltY, POSE.z)
    raiz.scale.setScalar(st.zoom * 0.92)
    // aberta, a tampa sai para a esquerda: o estojo anda um pouco para a
    // direita (com a câmera mais perto, a borda de lá da tampa aumenta mais)
    raiz.position.x = 0.30 * tampa.estado.x
    pivo.rotation.y = -tampa.estado.x * ABERTURA

    /* as sombras: a projeção das matrizes de agora, então herdam o giro no
     * plano, a inclinação e a tampa aberta, e afinam de lado */
    raiz.updateMatrixWorld(true)
    const esc = st.zoom * 0.92
    const area = achatar(sombraEstojo, raiz, 0.14 * esc, -0.17 * esc, D.espessura / D.largura)
    sombra.m.opacity = OPACIDADE_SOMBRA * (0.3 + 0.7 * area)
    const at = achatar(sombraTampa, tampaMesh, 0.14 * esc, -0.17 * esc, D.tampa / D.largura)
    sombra.mt.opacity = OPACIDADE_SOMBRA * (0.3 + 0.7 * at) * Math.min(1, tampa.estado.x * 3)
    // fechada, a da tampa some debaixo da do estojo: nem desenha
    sombraTampa.visible = tampa.estado.x > 1e-3

    /* giro do disco */
    const tocando = !pausado && (f.np ? f.playing : f.level > 0.02)
    if (f.trackChangedAt !== g.ultimaFaixa) {
      if (g.ultimaFaixa !== -1 && f.np) g.w -= TRANCO     // o tranco da troca de faixa
      g.ultimaFaixa = f.trackChangedAt
    }
    let delta
    if (st.modo === 'scratch') {
      delta = st.scratchDelta
      st.scratchDelta = 0
      g.w = st.scratchW
    } else {
      if (tocando) g.w += (GIRO_ALVO - g.w) * (1 - Math.exp(-dt * 2.2))
      else g.w = Math.sign(g.w) * Math.max(0, Math.abs(g.w) - FREIO * dt)
      delta = g.w * dt
    }
    discoGrupo.rotation.z += delta

    /* reação ao áudio: o grave estica a iridescência, o agudo acende o grão */
    g.grave += ((tocando ? f.bass : 0) - g.grave) * (1 - Math.exp(-dt * 10))
    g.agudo += ((tocando ? f.treble : 0) - g.agudo) * (1 - Math.exp(-dt * 12))
    disco.material.iridescenceThicknessRange[1] = V.aro.faixa[1] + g.grave * 650
    disco.uniforms.uTreble.value = Math.min(1, g.agudo * 2.2)
    disco.uniforms.uGrave.value = g.grave
    matRotulo.uniforms.uGrave.value = g.grave

    /* pulso da troca de linha da letra */
    const pulso = Math.exp(-((performance.now() - f.lineChangedAt) / 1000) * 6)
    matAdesivos.uniforms.uPulso.value = pulso
    matEtiqueta.emissiveIntensity = pulso * 0.35
    matRotulo.uniforms.uPulso.value = pulso

    /* troca de disco: o atual sobe e sai, o novo desce e entra */
    let mexeTroca = false
    if (troca.fase === 'sai' && tampa.estado.x < 0.85) {
      /* A saída espera a tampa: com a mola, o disco chegava ao plano da
       * tampa (~0,12 s) com ela só 35% aberta e passava através dela. Se a
       * fecharam no meio da espera, a troca desiste (senão ficaria
       * esperando, e travando outras trocas, até alguém abrir de novo). */
      if (tampa.aberta()) mexeTroca = true
      else { troca.fase = null; troca.proxima = null }
    } else if (troca.fase) {
      troca.t += dt
      const dur = troca.fase === 'sai' ? TROCA_SAI : TROCA_ENTRA
      const p = Math.min(1, troca.t / dur)
      const e = troca.fase === 'sai' ? p * p : 1 - (1 - p) * (1 - p)
      const fora = troca.fase === 'sai' ? e : 1 - e
      // Z na frente de Y: o disco sobe do poço antes de deslizar, e passa
      // por cima das paredes e nervuras em vez de atravessá-las
      const fz = Math.min(1, fora * 4)
      discoGrupo.position.z = Z.discoFundo + fz * 0.35
      discoGrupo.position.y = fora * 1.7
      sombraDisco.m.opacity = OPACIDADE_SOMBRA_DISCO * (1 - fora)
      if (p >= 1) {
        if (troca.fase === 'sai') {
          troca.fase = 'entra'
          troca.t = 0
          const v = troca.proxima
          setVariante(v)
          if (aoTrocar) aoTrocar(v)
        } else {
          troca.fase = null
          discoGrupo.position.y = 0
          discoGrupo.position.z = Z.discoFundo
          sombraDisco.m.opacity = OPACIDADE_SOMBRA_DISCO
        }
      }
      mexeTroca = true
    }

    return mexeGesto || mexeTampa || mexeTroca || Math.abs(g.w) > 1e-3 || pulso > 0.01
  }

  /** Onde fica o centro do disco na tela, para o scratch medir o ângulo. */
  const _p = new THREE.Vector3()
  function centroDisco(camera, canvas) {
    const r = canvas.getBoundingClientRect()
    discoGrupo.getWorldPosition(_p)
    _p.project(camera)
    return { x: r.left + ((_p.x + 1) / 2) * r.width, y: r.top + ((1 - _p.y) / 2) * r.height }
  }

  function dispose() {
    vivo = false
    Object.values(geo).forEach((g) => g.dispose())
    matProxy.dispose()
    riscos.dispose()
    Object.values(plastico).forEach((m) => m.dispose())
    disco.material.dispose()
    rotulo.textura.dispose()
    matRotulo.material.dispose()
    sombraDisco.t.dispose()
    sombraDisco.m.dispose()
    atlas.mapa.dispose()
    atlas.mascara.dispose()
    etiqueta.textura.dispose()
    matAdesivos.material.dispose()
    matEtiqueta.dispose()
    adesivos.forEach((a) => a.geometria.dispose())
    if (capa) capa.dispose()
    if (matEncarte) matEncarte.dispose()
    sombra.t.dispose()
    sombra.m.dispose()
    sombra.mt.dispose()
    sombra.g.dispose()
    sombra.gt.dispose()
  }

  // a primeira montagem: o rótulo, ainda sem faixa
  desenharRotulo()

  return {
    /** Na ordem em que entram na cena: luzes, sombras, estojo. */
    objetos: [...luzes, sombraEstojo, sombraTampa, raiz],
    /** As procurações do hit-test (picker.js). */
    alvos: () => [proxyEstojo, proxyTampa, proxyDisco],
    tampa,
    troca,
    get variante() { return variante },
    centroDisco,
    setFaixa,
    setQualidade,
    setVariante,
    setEncarte,
    setSemente,
    trocar,
    update,
    dispose,
  }
}

const POSE_PARADA = {
  rotX: POSE.x, rotY: POSE.y, tiltX: 0, tiltY: 0, zoom: 1, modo: null,
}
