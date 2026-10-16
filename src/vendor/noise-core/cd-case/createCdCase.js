// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { createCdCaseScene } from './scene.js'
import { criarAmbiente } from './environment.js'
import { createCaseDrag } from './interaction/drag.js'
import { createPicker } from './interaction/picker.js'

const NIVEIS = ['low', 'medium', 'high']
const DPR = { low: [1, 1], medium: [1, 1.5], high: [1, 2] }
// qualidade automática: média de 90 quadros seguidos; acima de 24 ms desce
// um nível, abaixo de 12 ms sobe um, e entre duas mudanças, no mínimo 5 s.
// Os mesmos números da skin do app
const MONITOR = { quadros: 90, tetoMs: 250, desceMs: 24, sobeMs: 12, esperaMs: 5000 }

function dprPara(q) {
  const [min, max] = DPR[q] || DPR.medium
  return Math.min(Math.max(min, window.devicePixelRatio || 1), max)
}

/**
 * O estojo de CD num canvas próprio, sem React: o que o <Canvas> do React
 * Three Fiber faz na skin do app, para uma página qualquer.
 *
 *   const cd = createCdCase({ container, frame: () => quadro })
 *   cd.start(); cd.stop()
 *   cd.setFaixa({ title, artist, artworkUrl })
 *   cd.trocar('prata')                // troca animada de disco
 *   cd.dispose()                      // inclui o contexto WebGL
 *
 * `frame()` devolve o quadro de agora: { np, playing, level, bass, treble,
 * lineChangedAt, trackChangedAt } — os mesmos campos que o app passa.
 *
 * Desenha sob demanda, como o app: só quando algo mexe, quando a música
 * toca ou logo depois de uma troca de linha ou de faixa.
 */
export function createCdCase(opcoes = {}) {
  const {
    container,
    frame = () => QUADRO_VAZIO,
    variante = 'holo',
    encarte = true,
    semente,
    adaptive = false,
    reducedMotion = false,
    onInteracao,
    onQualidade,
  } = opcoes
  let qualidade = NIVEIS.includes(opcoes.quality) ? opcoes.quality : 'medium'
  let teto = NIVEIS.length - 1
  let pausado = Boolean(reducedMotion)

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: qualidade !== 'low', powerPreference: 'default' })
  // o vazio continua vazio: o que está atrás do estojo é a página
  renderer.setClearColor(0x000000, 0)
  /* Neutral no lugar do ACES: o ACES leva 1,0 a ~0,8 e puxa os matizes —
   * acinzentava a borda dos adesivos e tiraria a capa do álbum do tom no
   * rótulo. O plástico nem passa por aqui (toneMapped: false). */
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.setPixelRatio(dprPara(qualidade))
  container.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30)
  camera.position.set(0, 0.05, 4.4)
  camera.lookAt(0, 0, 0)

  const cena = new THREE.Scene()
  let pedido = true
  const invalidar = () => { pedido = true }

  const caso = createCdCaseScene({ qualidade, variante, encarte, semente, invalidar })
  for (const o of caso.objetos) cena.add(o)

  let ambiente = criarAmbiente(renderer, qualidade)
  cena.environment = ambiente.textura

  const pick = createPicker({ canvas: () => renderer.domElement, camera: () => camera, alvos: caso.alvos })
  const avisar = (o) => { if (onInteracao) onInteracao(o) }
  const drag = createCaseDrag({
    pick,
    centroDisco: () => caso.centroDisco(camera, renderer.domElement),
    tampaAberta: () => caso.tampa.aberta(),
    onClique: () => { caso.tampa.toggle(); avisar('abrir'); invalidar() },
    onDuploDisco: () => { caso.setSemente((Math.random() * 2 ** 32) >>> 0); avisar('embaralhar') },
    onInteracao: () => avisar('girar'),
    acordar: invalidar,
  })
  const soltar = drag.attach(renderer.domElement)

  function resize(w, h) {
    const width = w ?? (container.clientWidth || 1)
    const height = h ?? (container.clientHeight || 1)
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    invalidar()
  }
  resize()
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null
  if (ro) ro.observe(container)

  function setQualidade(q) {
    if (!NIVEIS.includes(q) || q === qualidade) return
    qualidade = q
    renderer.setPixelRatio(dprPara(q))
    resize()
    caso.setQualidade(q)
    ambiente.dispose()
    ambiente = criarAmbiente(renderer, q)
    cena.environment = ambiente.textura
    if (onQualidade) onQualidade(q)
  }

  /* ---------------- o laço ---------------- */
  const relogio = new THREE.Clock(false)
  let raf = 0
  let rodando = false
  let animando = true
  const monitor = { ult: 0, soma: 0, n: 0, mudou: performance.now() }

  function medir() {
    const agora = performance.now()
    const iv = agora - monitor.ult
    if (animando && iv < MONITOR.tetoMs) { monitor.soma += iv; monitor.n++ }
    monitor.ult = agora
    if (monitor.n < MONITOR.quadros) return
    const ms = monitor.soma / monitor.n
    if (agora - monitor.mudou > MONITOR.esperaMs) {
      const i = NIVEIS.indexOf(qualidade)
      // um nível que não aguentou vira teto: não sobe de novo para ele
      if (ms > MONITOR.desceMs && i > 0) { teto = i - 1; setQualidade(NIVEIS[i - 1]); monitor.mudou = agora }
      else if (ms < MONITOR.sobeMs && i < teto) { setQualidade(NIVEIS[i + 1]); monitor.mudou = agora }
    }
    monitor.soma = 0
    monitor.n = 0
  }

  function desenhar() {
    const f = frame()
    if (adaptive) medir()
    animando = caso.update(relogio.getDelta(), f, drag, pausado)
    renderer.render(cena, camera)
  }

  const tick = () => {
    const f = frame()
    const agora = performance.now()
    if (pedido || animando
        || (f.playing && !pausado)
        || agora - f.lineChangedAt < 900
        || agora - f.trackChangedAt < 1500) {
      pedido = false
      desenhar()
    }
    raf = requestAnimationFrame(tick)
  }

  function start() {
    if (rodando || descartado) return
    rodando = true
    relogio.start()
    relogio.getDelta()
    pedido = true
    tick()
  }

  function stop() {
    rodando = false
    cancelAnimationFrame(raf)
    raf = 0
  }

  let descartado = false
  function dispose() {
    if (descartado) return
    stop()
    descartado = true
    soltar()
    if (ro) ro.disconnect()
    caso.dispose()
    ambiente.dispose()
    renderer.dispose()
    // o navegador tem um teto de contextos por página: quem recria o
    // estojo ao voltar à tela chegaria nele sem isso
    renderer.forceContextLoss()
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }

  return {
    get canvas() { return renderer.domElement },
    get quality() { return qualidade },
    get variante() { return caso.variante },
    get aberta() { return caso.tampa.aberta() },
    start,
    stop,
    resize,
    setFaixa: (np) => caso.setFaixa(np),
    setEncarte: (on) => caso.setEncarte(on),
    setPausado: (p) => { pausado = Boolean(p); invalidar() },
    setQuality: setQualidade,
    /** Troca animada de disco; devolve false se não havia o que trocar. */
    trocar: (v, aoAplicar) => caso.trocar(v, aoAplicar),
    abrir: (forcar) => { caso.tampa.toggle(forcar); invalidar() },
    embaralhar: () => caso.setSemente((Math.random() * 2 ** 32) >>> 0),
    hitTest: (x, y) => pick(x, y),
    dispose,
  }
}

const QUADRO_VAZIO = {
  np: null, playing: false, level: 0, bass: 0, treble: 0,
  lineChangedAt: -1e9, trackChangedAt: -1e9,
}
