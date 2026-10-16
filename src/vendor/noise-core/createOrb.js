// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { BAND_COUNT } from './bands.js'
import { fibonacciSeeds, assignCells, voronoiCorners, spreadPick, spikeRig, createBandTexture } from './voronoi.js'
import { SPIKES, createUniforms, createMaterials, skinTuning, MOTION_UNIFORMS } from './orbMaterial.js'
import { createSampler } from './sampler.js'
import { createProcedural } from './procedural.js'
import { paletteSource } from './palette.js'

/**
 * Subdivisão em função de quantos pixels a malha realmente tem para ocupar.
 *
 * O que importa é a área do triângulo na tela, não a contagem. Uma
 * subdivisão fixa que fica boa num tamanho passa do ponto no outro: as
 * arestas ficam mais juntas que o pixel, cada uma some por transparência e
 * o conjunto lê como textura granulada em vez de malha.
 *
 * O icosaedro tem 20·(detail+1)² triângulos e o orbe cobre um círculo de
 * raio ≈0.39·largura, então manter uma área alvo por triângulo dá
 * detail+1 ∝ largura. A constante sai de ~3.7 px² por triângulo: a malha
 * continua fina como a referência, mas cada aresta ainda cai num pixel
 * seu. Na janela de 320 px a subdivisão fixa em 60 dava menos de 1 px².
 *
 * No perfil 'low' a malha perde um nível: metade dos triângulos, o que no
 * detail linear do three é dividir (detail+1) por √2.
 */
export function detailFor(cssWidth, pixelRatio, quality = 'high') {
  const px = cssWidth * pixelRatio
  const high = Math.max(10, Math.min(52, Math.round(0.0800 * px) - 1))
  if (quality !== 'low') return high
  return Math.max(8, Math.round((high + 1) / Math.SQRT2) - 1)
}

/** Teto do devicePixelRatio por perfil. */
const DPR_CAP = { high: 2, low: 1.5 }

/** Duração da troca entre o modo demo e o áudio real. */
const CROSSFADE_S = 0.4

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * O orbe inteiro: cena, câmera, renderer, loop de animação e limpeza.
 *
 *   const orb = createOrb({ container, theme, quality })
 *   orb.setSource(analyserNode)   // ou null para o modo demo procedural
 *   orb.start(); orb.stop()
 *   orb.resize(w, h)
 *   orb.setTheme({ deep, bright })
 *   orb.dispose()
 *
 * Opções:
 *   canvas | container  onde desenhar. Com `container`, o núcleo cria o
 *                       próprio canvas e o remove no dispose.
 *   theme               { deep, bright } ou (segundos) => { deep, bright }
 *   skin                'wire' (padrão), 'hexcore' ou 'sigil'
 *   quality             'high' (padrão) ou 'low'
 *   source              fonte inicial, entra sem crossfade
 *   idle                'procedural' (padrão) ou 'silent': o que desenhar
 *                       sem fonte
 *   reducedMotion       padrão: prefers-reduced-motion
 *   amplitude           multiplica o deslocamento (1 = o do app)
 *   adaptive            cai para 'low' se o FPS ficar abaixo de 40 por 2 s
 *   bpm                 andamento do bumbo do modo demo
 *   onFrame(orb)        chamado depois de cada quadro desenhado — é onde
 *                       quem hospeda desenha a barra, no mesmo quadro
 *   onQualityChange(q)  avisado quando o modo adaptativo troca o perfil
 *
 * Uma fonte é um AnalyserNode ou qualquer objeto { bands, sample() }, em
 * que sample() devolve { level, bass } e, se souber, `lineChangedAt` (o
 * instante, em performance.now(), da última troca de linha da letra — o
 * orbe pulsa nela). O app desktop passa o quadro que todas as skins leem.
 */
export function createOrb(options = {}) {
  const {
    canvas,
    container,
    skin: initialSkin = 'wire',
    idle = 'procedural',
    amplitude = 1,
    adaptive = false,
    bpm = 118,
    autoResize = true,
    onFrame,
    onQualityChange,
  } = options
  const reduced = options.reducedMotion ?? prefersReducedMotion()
  let quality = options.quality === 'low' ? 'low' : 'high'
  let palette = paletteSource(options.theme)

  const count = BAND_COUNT
  const mount = container || (canvas && canvas.parentElement) || null

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 0, 5.4)

  let dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP[quality])
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(dpr)
  renderer.setClearColor(0x000000, 0)
  const ownCanvas = !canvas
  if (ownCanvas && container) container.appendChild(renderer.domElement)

  const seeds = fibonacciSeeds(count)

  // os espinhos nascem nas junções de três células, o ponto da treliça
  // mais distante de qualquer semente — e portanto fora de todo furo
  const cantos = spreadPick(voronoiCorners(seeds), SPIKES)
  const rig = spikeRig(cantos, seeds)

  // estado da física de cada ponta: comprimento e velocidade
  const bicoLen = new Float32Array(SPIKES)
  const bicoVel = new Float32Array(SPIKES)
  const bicoPrev = new Float32Array(SPIKES)
  const eixoBico = cantos.map((c) => c.clone())
  const { tex, data } = createBandTexture(count)

  const shellU = createUniforms({ tex, count, spikes: eixoBico, reduced })
  const AJUSTES = skinTuning(reduced)

  // `amplitude` reduz o quanto a superfície se mexe, não o que ela lê: a
  // barra e as cores continuam acompanhando o som inteiro
  const scaleMotion = (u) => {
    if (amplitude === 1) return
    for (const k of MOTION_UNIFORMS) u[k].value *= amplitude
  }
  scaleMotion(shellU)

  const mats = createMaterials(shellU)

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55 * 0.86, 4), mats.core)
  core.renderOrder = 2

  // o raio deixa folga para a ondulação: mesmo no pico o blob não fura a
  // casca, que ainda encolhe com uShrink quando as agulhas estão fora
  const liquid = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55 * 0.66, 5), mats.liquid)

  // 4.6 cobre o campo de visão em z=0 sem a franja encostar na borda da
  // janela, onde ela seria cortada em reta
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), mats.aura)
  aura.renderOrder = -1

  const group = new THREE.Group()
  scene.add(group)

  let skin = initialSkin
  let geo = null
  let shell = null
  let depthPass = null
  let plates = null
  let sigil = null
  let sigilInner = null
  let detail = 0

  const applySkin = () => {
    const hex = skin === 'hexcore'
    const sig = skin === 'sigil'

    // as pontas passam do raio do orbe e sairiam pela borda da janela;
    // a agulha da Sigil é mais longa ainda que o espinho da Hexcore
    camera.position.z = sig ? 8.2 : hex ? 6.9 : 5.4

    if (shell) shell.visible = !hex && !sig
    if (depthPass) depthPass.visible = !hex && !sig
    if (plates) plates.visible = hex
    if (sigil) sigil.visible = sig
    if (sigilInner) sigilInner.visible = sig
    core.visible = hex          // cromo não tem miolo aceso
    liquid.visible = sig        // o miolo da Sigil é líquido, não luz
    aura.visible = hex          // nem halo: a referência é contraste seco

    const ajuste = AJUSTES[skin]
    if (ajuste) {
      for (const k in ajuste) {
        shellU[k].value = MOTION_UNIFORMS.includes(k) ? ajuste[k] * amplitude : ajuste[k]
      }
    }
  }

  const buildGeometry = (next) => {
    detail = next
    if (shell) {
      group.remove(shell, depthPass, plates, sigil, sigilInner)
      geo.dispose()
    }
    // detail é subdivisão linear: 20·(detail+1)² triângulos
    geo = new THREE.IcosahedronGeometry(1.55, detail)
    assignCells(geo, seeds)

    depthPass = new THREE.Mesh(geo, mats.depth)
    shell = new THREE.Mesh(geo, mats.shell)
    plates = new THREE.Mesh(geo, mats.hex)     // a casca furada, mesma malha
    sigil = new THREE.Mesh(geo, mats.sigil)    // idem, com material de cromo

    /* A parede interna: a espessura de verdade.
     *
     * A mesma malha, o mesmo material, encolhida uns por cento. Os furos
     * são abertos por direção, então os das duas cascas se alinham por
     * construção, e o que se vê pela abertura é a segunda parede um pouco
     * atrás — a paralaxe entre as duas é o que lê como parede com
     * espessura, em vez de folha de papel cromada.
     */
    sigilInner = new THREE.Mesh(geo, mats.sigil)
    sigilInner.scale.setScalar(0.94)

    depthPass.renderOrder = 0   // profundidade antes das linhas
    shell.renderOrder = 1
    group.add(depthPass, shell, plates, sigil, sigilInner)
    applySkin()
  }

  const cssWidth = () => (mount && mount.clientWidth) || renderer.domElement.clientWidth || 0

  buildGeometry(detailFor(cssWidth() || 320, dpr, quality))
  group.add(core, liquid)
  scene.add(aura)   // fora do grupo: a aura não gira com o orbe

  function applySize(w, h) {
    const width = w ?? ((mount && mount.clientWidth) || 1)
    const height = h ?? ((mount && mount.clientHeight) || 1)
    // atualiza também o CSS do canvas — sem isso, em telas com
    // devicePixelRatio > 1 o canvas estoura o contêiner e o orbe
    // aparece deslocado para a direita
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    // remalhar custa uns centésimos e só acontece na troca de tamanho
    const next = detailFor(width, dpr, quality)
    if (next !== detail) buildGeometry(next)
  }

  function resize(w, h) {
    applySize(w, h)
    redraw()
  }

  let ro = null
  if (autoResize && mount && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => resize())
    ro.observe(mount)
  }

  /* Fontes.
   *
   * O que vai para a GPU é sempre `out`: a fonte real misturada com o modo
   * demo por `mix`, que anda de 0 a 1 em 400 ms quando uma fonte entra e
   * volta quando ela sai. Com mix em 1 a soma é exatamente a fonte — o app
   * desktop, que nasce com fonte, desenha os mesmos números de antes.
   */
  const out = new Float32Array(count)
  const outBands = { count, values: out }
  const metrics = { level: 0, bass: 0, tone: 0.5, peak: 0, lineChangedAt: -1e9 }
  const procedural = createProcedural({ count, bpm })

  const asSource = (x) => {
    if (!x) return null
    if (typeof x.getByteFrequencyData === 'function') return createSampler(x)
    return x
  }

  let source = asSource(options.source)
  let previous = null   // fonte que está saindo, enquanto o crossfade a leva
  let mix = source ? 1 : 0

  function setSource(next) {
    const s = asSource(next)
    if (s === source) return
    // trocar uma fonte real por outra não passa pelo modo demo: o mix
    // continua em 1 e a nova fonte assume no quadro seguinte
    if (!s && source) previous = source
    source = s
    if (s) previous = null
    redraw()
  }

  const clock = new THREE.Clock()
  let raf = 0
  let running = false
  let live = 0
  let lastNow = 0
  let startedAt = 0
  let slowSince = 0
  let frameEma = 16.7
  let still = false   // reduced motion parado: nada muda até haver fonte
  let dirty = false   // algo mudou por fora do som e precisa de um quadro

  function blendSources(t, dt) {
    const target = source ? 1 : 0
    if (mix !== target) {
      const step = dt / CROSSFADE_S
      mix = target > mix ? Math.min(1, mix + step) : Math.max(0, mix - step)
    }

    const real = source || previous
    let rm = null
    if (real) rm = real.sample()
    if (!source && mix === 0) previous = null

    // o modo demo só é calculado quando aparece; com reduced motion ele é
    // uma esfera parada, como pede a preferência
    let pv = null
    let pm = null
    if (mix < 1 && idle === 'procedural' && !reduced) {
      pm = procedural.sample(t)
      pv = procedural.values
    }

    const rv = real ? real.bands.values : null
    for (let i = 0; i < count; i++) {
      const p = pv ? pv[i] : 0
      const r = rv ? rv[i] : 0
      out[i] = p * (1 - mix) + r * mix
    }
    const pl = pm ? pm.level : 0
    const pb = pm ? pm.bass : 0
    metrics.level = pl * (1 - mix) + (rm ? rm.level : 0) * mix
    metrics.bass = pb * (1 - mix) + (rm ? rm.bass : 0) * mix
    metrics.tone = rm ? rm.tone : 0.5
    metrics.peak = rm && mix > 0.5 ? rm.peak : 0
    // a troca de linha da letra vem da fonte, se ela souber (o app sabe)
    metrics.lineChangedAt = rm && rm.lineChangedAt !== undefined ? rm.lineChangedAt : -1e9

    still = reduced && !real && mix === 0
  }

  let current = { deep: [1, 1, 1], bright: [1, 1, 1] }

  function frame() {
    const t = clock.getElapsedTime()
    const now = performance.now()
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60
    lastNow = now

    blendSources(now / 1000, dt)
    const m = metrics

    // troca de linha da letra: um pulso que some em meio segundo
    const desdeLinha = (performance.now() - (m.lineChangedAt || -1e9)) / 1000
    const pulsoLetra = reduced ? 0 : Math.exp(-desdeLinha * 7)

    // envia as faixas para a GPU, e de quebra descobre a mais forte
    const v = out
    let loudest = 0
    for (let i = 0; i < count; i++) {
      data[i * 4] = Math.min(255, Math.round(v[i] * 255))
      if (v[i] > loudest) loudest = v[i]
    }
    tex.needsUpdate = true

    // A porta do noise sai do pico das faixas, não do nível médio: as
    // faixas já vêm normalizadas em 0..1, então qualquer áudio real abre
    // a porta sem precisar de constante de calibração, e o silêncio a
    // fecha por completo. Sobe rápido para não perder o primeiro
    // compasso, desce devagar para a superfície não estalar entre notas.
    live += (loudest - live) * (loudest > live ? 0.30 : 0.05)
    // a troca de linha acende as células um instante, como um compasso
    shellU.uLive.value = Math.min(1, live + 0.25 * pulsoLetra)

    // relógio absoluto, o mesmo que o espectro usa: com o tempo desde a
    // montagem os dois divergiriam assim que um deles remontasse
    current = palette(now / 1000)
    shellU.uDeep.value.setRGB(current.deep[0], current.deep[1], current.deep[2])
    shellU.uBright.value.setRGB(current.bright[0], current.bright[1], current.bright[2])

    shellU.uTime.value = t

    if (!reduced) {
      const push = 1 + m.level * 1.8
      group.rotation.y += 0.0020 * push
      group.rotation.x += 0.0008 * push
    }
    group.scale.setScalar(1 + m.bass * 0.05)

    /* Física das pontas: mola amortecida, acoplada às vizinhas.
     *
     * A mola sozinha já muda tudo — em vez de a ponta copiar a faixa
     * quadro a quadro, ela é puxada para lá e chega com inércia, passa
     * do ponto e volta. É o chicote de um jato de líquido, não uma
     * barra crescendo.
     *
     * O acoplamento com as vizinhas é o que faz virar onda: uma mola
     * puxada pela vizinha é a equação de onda discretizada, então uma
     * batida numa ponta se propaga pela casca em vez de morrer onde
     * nasceu. As vizinhas são lidas de uma cópia do quadro anterior —
     * lendo o array vivo, as primeiras pontas já veriam o valor novo das
     * outras e a perturbação atravessaria a esfera num quadro só, o que
     * não é propagação, é teletransporte.
     */
    bicoPrev.set(bicoLen)
    let somaBico = 0
    for (let i = 0; i < SPIKES; i++) {
      const faixa = v[Math.min(count - 1, Math.round(rig.band[i]))] || 0
      let acel = (faixa - bicoPrev[i]) * 0.115
      for (const j of rig.neighbours[i]) acel += (bicoPrev[j] - bicoPrev[i]) * 0.055
      bicoVel[i] = (bicoVel[i] + acel) * 0.905
      bicoLen[i] = Math.max(0, Math.min(1.7, bicoLen[i] + bicoVel[i]))
      shellU.uSpikeAmp.value[i] = 0.14 + bicoLen[i]

      somaBico += bicoLen[i]

      // o eixo balança devagar: ponta de líquido não fica a prumo
      const b = eixoBico[i]
      b.copy(cantos[i])
       .addScaledVector(rig.t1[i], 0.055 * Math.sin(t * 0.61 + i * 1.7))
       .addScaledVector(rig.t2[i], 0.055 * Math.cos(t * 0.47 + i * 2.3))
       .normalize()
    }

    // quanto a casca encolhe: o que sobe nas pontas sai daqui
    const mediaBico = somaBico / SPIKES
    shellU.uSpikeMean.value = mediaBico

    // o núcleo pulsa no grave e respira devagar quando não há nada tocando
    shellU.uPulse.value = m.bass * 0.9 + 0.06 * (1 + Math.sin(t * 0.9)) + 0.35 * pulsoLetra
    core.scale.setScalar(1 + m.bass * 0.10 - 0.26 * mediaBico)

    // o líquido acompanha: incha no grave e cede quando a casca encolhe
    // atrás das agulhas — o volume parece conservado, e a cessão tem de
    // ganhar da ondulação, senão uma crista atravessa a casca encolhida
    liquid.scale.setScalar(1 + m.bass * 0.06 - 0.16 * mediaBico)

    renderer.render(scene, camera)
    if (onFrame) onFrame(api)
  }

  /* Queda automática de qualidade.
   *
   * Só depois do primeiro segundo, que é onde os shaders compilam e o
   * quadro sempre engasga; e quadros de mais de 250 ms não contam — são
   * a aba voltando de segundo plano, não lentidão. */
  function watchFps(now, dtMs) {
    if (!adaptive || quality === 'low') return
    if (now - startedAt < 1000 || dtMs > 250) return
    frameEma += (dtMs - frameEma) * 0.1
    if (frameEma > 25) {           // < 40 fps
      if (!slowSince) slowSince = now
      else if (now - slowSince > 2000) {
        setQuality('low')
        if (onQualityChange) onQualityChange('low')
      }
    } else {
      slowSince = 0
    }
  }

  let prevTick = 0
  const tick = () => {
    const now = performance.now()
    if (prevTick) watchFps(now, now - prevTick)
    prevTick = now

    // parado de verdade: com reduced motion e sem som, a esfera já está
    // desenhada e nada nela muda — não há por que gastar a GPU
    if (dirty || !(still && live < 1e-4)) {
      dirty = false
      frame()
    }
    raf = requestAnimationFrame(tick)
  }

  /** Pede um quadro: na hora, se o loop está parado; no próximo, se não. */
  function redraw() {
    if (disposed) return
    if (running) dirty = true
    else frame()
  }

  function start() {
    if (running || disposed) return
    running = true
    startedAt = performance.now()
    prevTick = 0
    lastNow = 0
    slowSince = 0
    tick()
  }

  function stop() {
    running = false
    cancelAnimationFrame(raf)
    raf = 0
  }

  function setTheme(theme) {
    palette = paletteSource(theme)
    redraw()
  }

  function setSkin(next) {
    skin = next
    applySkin()
    redraw()
  }

  function setQuality(next) {
    const q = next === 'low' ? 'low' : 'high'
    if (q === quality) return
    quality = q
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP[quality])
    renderer.setPixelRatio(dpr)
    resize()
  }

  let disposed = false
  function dispose() {
    if (disposed) return
    stop()
    disposed = true
    if (ro) ro.disconnect()
    geo.dispose()
    tex.dispose()
    core.geometry.dispose()
    liquid.geometry.dispose()
    aura.geometry.dispose()
    for (const k in mats) mats[k].dispose()
    renderer.dispose()
    // dispose() devolve os buffers mas deixa o contexto WebGL vivo até o
    // coletor passar; o navegador tem um teto de contextos por página, e
    // quem recria o orbe ao voltar à tela chegaria nele
    renderer.forceContextLoss()
    if (ownCanvas && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
  }

  const api = {
    get bands() { return outBands },
    get metrics() { return metrics },
    get palette() { return current },
    get quality() { return quality },
    get canvas() { return renderer.domElement },
    setSource,
    start,
    stop,
    resize,
    setTheme,
    setSkin,
    setQuality,
    dispose,
  }

  applySize()
  return api
}
