// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
const GRAU = Math.PI / 180
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
// a pose de repouso: a base mais perto (dominante em X), o lado direito um
// pouco, e um leve giro no plano — o estojo largado na mesa, não alinhado
// na régua. Tirada da silhueta da referência: a aresta de baixo 8% maior
// que a de cima, a da direita 3,5% maior que a da esquerda. A de antes
// (x -9, y -13) era dominante em Y e quase não mostrava as paredes.
export const POSE = { x: -14 * GRAU, y: -7 * GRAU, z: 4 * GRAU }

/* O giro tem limite. Antes, a velocidade da soltura era a da última
 * amostra: 15 px em 8 ms davam 20,6 rad/s, que com atrito 3,2/s rodavam
 * 368° — o estojo virava de costas (o disco por baixo, sem rótulo). Agora:
 * ganho menor, velocidade medida numa janela de 80 ms e presa, atrito
 * mais forte, e Y com uma parede elástica em volta da pose. */
const K = 0.006                 // rad/px (era 0,011: 100 px davam 63°)
const VEL_MAX_Y = 2.6           // rad/s
const VEL_MAX_X = 1.6           // rad/s
const ATRITO = 5.5              // 1/s: o embalo vai no máximo a 2,6/5,5 ≈ 27°
const LIMITE_Y = 55 * GRAU      // elástico, em volta de POSE.y
const FOLGA_Y = 15 * GRAU       // quanto o elástico estica além do limite, no máximo
const LIMITE_X = 25 * GRAU      // duro, absoluto
const JANELA_MS = 80            // amostras que contam para a velocidade da soltura
const INCLINACAO = 3 * GRAU
const VOLTA_MS = 2500
const CLIQUE_PX = 4
const CLIQUE_MS = 350
const DUPLO_MS = 260

/**
 * Gestos do estojo, no elemento do canvas:
 *
 * - clique no estojo: abre ou fecha a tampa;
 * - arrastar: gira em X e Y com inércia; X preso em ±25°, Y até 55° de
 *   cada lado da pose (passou, o arrasto pesa, estica no máximo mais 15°
 *   e, solto, volta como um elástico); 2,5 s parado e ele volta sozinho
 *   à pose;
 * - arrastar o disco com a tampa aberta: scratch — a velocidade do
 *   arrasto vira a velocidade do disco;
 * - duplo clique no disco: embaralha os adesivos;
 * - hover: inclina 3° na direção do cursor;
 * - roda: zoom de 0,9× a 1,15×.
 *
 * `pick(x, y)` diz o que está sob o cursor (`'tampa' | 'bandeja' |
 * 'disco' | null`) e `centroDisco()` onde fica o centro do disco na tela.
 */
export function createCaseDrag(opcoes) {
  // as funções de fora mudam (o React recria callbacks); quem as chama lê
  // daqui na hora, então trocar a configuração não exige reanexar nada
  const o = { ...opcoes }
  const pick = (x, y) => o.pick(x, y)
  const centroDisco = () => o.centroDisco()
  const tampaAberta = () => o.tampaAberta()
  const onClique = (parte) => o.onClique(parte)
  const onDuploDisco = () => o.onDuploDisco()
  const onInteracao = () => o.onInteracao()
  const acordar = () => o.acordar()

  const s = {
    rotX: POSE.x, rotY: POSE.y, velX: 0, velY: 0,
    tiltX: 0, tiltY: 0, tiltAlvoX: 0, tiltAlvoY: 0,
    zoom: 1, zoomAlvo: 1,
    apertado: false, arrastou: false, modo: null,
    x0: 0, y0: 0, t0: 0, ultX: 0, ultY: 0, ultT: 0,
    amostras: [],
    angDisco: 0, scratchW: 0, scratchDelta: 0,
    ultimaInteracao: -1e9,
    cliquePendente: null,
  }

  /** Liga os gestos no elemento (o canvas); devolve o desligamento. */
  function attach(el) {
    if (!el) return () => {}

    const agora = () => performance.now()
    const anguloNoDisco = (x, y) => {
      const c = centroDisco()
      return Math.atan2(-(y - c.y), x - c.x)
    }

    const down = (e) => {
      if (e.button !== 0) return
      const parte = pick(e.clientX, e.clientY)
      if (!parte) return
      el.setPointerCapture(e.pointerId)
      Object.assign(s, {
        apertado: true, arrastou: false, parte,
        modo: parte === 'disco' && tampaAberta() ? 'scratch' : 'girar',
        x0: e.clientX, y0: e.clientY, t0: agora(),
        ultX: e.clientX, ultY: e.clientY, ultT: agora(),
        velX: 0, velY: 0,
        amostras: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
      })
      if (s.modo === 'scratch') s.angDisco = anguloNoDisco(e.clientX, e.clientY)
      s.ultimaInteracao = agora()
      acordar()
    }

    const move = (e) => {
      const r = el.getBoundingClientRect()
      if (!s.apertado) {
        // hover: o estojo olha um pouco para o cursor
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1
        s.tiltAlvoY = Math.max(-1, Math.min(1, nx)) * INCLINACAO
        s.tiltAlvoX = Math.max(-1, Math.min(1, ny)) * INCLINACAO
        acordar()
        return
      }
      const t = agora()
      const dt = Math.max(1, t - s.ultT) / 1000
      const dx = e.clientX - s.ultX
      const dy = e.clientY - s.ultY
      if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > CLIQUE_PX) s.arrastou = true

      if (s.modo === 'scratch') {
        const a = anguloNoDisco(e.clientX, e.clientY)
        let d = a - s.angDisco
        if (d > Math.PI) d -= Math.PI * 2
        if (d < -Math.PI) d += Math.PI * 2
        s.angDisco = a
        s.scratchDelta += d
        s.scratchW = d / dt
      } else if (s.arrastou) {
        // só guarda a amostra: a velocidade sai da janela, na soltura
        s.amostras.push({ t: e.timeStamp, x: e.clientX, y: e.clientY })
        while (s.amostras.length > 1 && e.timeStamp - s.amostras[0].t > JANELA_MS) s.amostras.shift()
        /* Além do limite o arrasto pesa (só para fora: voltar é livre), e
         * cada vez mais: o excesso tende a FOLGA_Y sem nunca chegar (de/dp =
         * 0,3·(1 - e/FOLGA_Y), integrado). Com o peso fixo de 0,3, um flick
         * de 300 px ainda punha o estojo de lado (~85° da pose) e um
         * arrasto longo o virava de costas. */
        const d = s.rotY - POSE.y
        const passo = dx * K
        if (passo !== 0 && (d === 0 || Math.sign(passo) === Math.sign(d))) {
          // para fora: ganho cheio até o limite, o resto no elástico
          const cheio = Math.min(Math.abs(passo), Math.max(0, LIMITE_Y - Math.abs(d)))
          const resto = Math.abs(passo) - cheio
          let a = Math.abs(d) + cheio
          if (resto > 0) {
            const excesso = a - LIMITE_Y
            a = Math.max(a, LIMITE_Y + FOLGA_Y - (FOLGA_Y - excesso) * Math.exp((-0.3 * resto) / FOLGA_Y))
          }
          s.rotY = POSE.y + Math.sign(passo) * a
        } else {
          s.rotY += passo
        }
        s.rotX = clamp(s.rotX + dy * K, -LIMITE_X, LIMITE_X)
      }
      s.ultX = e.clientX
      s.ultY = e.clientY
      s.ultT = t
      s.ultimaInteracao = t
      acordar()
    }

    const up = (e) => {
      if (!s.apertado) return
      s.apertado = false
      try { el.releasePointerCapture(e.pointerId) } catch {}
      const rapido = agora() - s.t0 < CLIQUE_MS
      if (!s.arrastou && rapido) {
        // clique no disco espera um instante: pode ser o primeiro de um duplo
        if (s.parte === 'disco' && tampaAberta()) {
          clearTimeout(s.cliquePendente)
          s.cliquePendente = setTimeout(() => { s.cliquePendente = null; onClique(s.parte) }, DUPLO_MS)
        } else {
          onClique(s.parte)
        }
      } else if (s.arrastou) {
        onInteracao()
      }
      /* Inércia: a média das amostras dos últimos 80 ms antes de soltar,
       * presa. Contar até o instante da soltura (e não até a última
       * amostra) faz um dedo que freou antes de soltar sair devagar; se
       * parou mais de 80 ms, nenhuma amostra sobra e não sai rodando. Um
       * clique (nada arrastado) não gira nada. */
      s.velX = 0
      s.velY = 0
      if (s.modo === 'girar' && s.arrastou) {
        const fim = e.timeStamp
        const janela = s.amostras.filter((a) => fim - a.t <= JANELA_MS)
        if (janela.length > 1) {
          const a0 = janela[0]
          const a1 = janela[janela.length - 1]
          const dts = Math.max(16, fim - a0.t) / 1000
          s.velY = clamp(((a1.x - a0.x) * K) / dts, -VEL_MAX_Y, VEL_MAX_Y)
          s.velX = clamp(((a1.y - a0.y) * K) / dts, -VEL_MAX_X, VEL_MAX_X)
        }
        // solto com o elástico esticado, ele só volta: embalo para fora não
        const d = s.rotY - POSE.y
        if (Math.abs(d) > LIMITE_Y && Math.sign(s.velY) === Math.sign(d)) s.velY = 0
      }
      s.amostras = []
      s.modo = null
      s.ultimaInteracao = agora()
      acordar()
    }

    const duplo = (e) => {
      if (pick(e.clientX, e.clientY) !== 'disco') return
      clearTimeout(s.cliquePendente)
      s.cliquePendente = null
      onDuploDisco()
      acordar()
    }

    const roda = (e) => {
      if (!pick(e.clientX, e.clientY)) return
      e.preventDefault()
      s.zoomAlvo = Math.max(0.9, Math.min(1.15, s.zoomAlvo * (1 - e.deltaY * 0.0012)))
      acordar()
    }

    const sair = () => { s.tiltAlvoX = 0; s.tiltAlvoY = 0; acordar() }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('dblclick', duplo)
    el.addEventListener('wheel', roda, { passive: false })
    el.addEventListener('pointerleave', sair)
    return () => {
      clearTimeout(s.cliquePendente)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('dblclick', duplo)
      el.removeEventListener('wheel', roda)
      el.removeEventListener('pointerleave', sair)
    }
  }

  /** Avança inércia, volta à pose, inclinação e zoom; devolve se algo mexe. */
  function step(dt) {
    const t = performance.now()
    let mexe = s.apertado

    if (!s.apertado) {
      if (Math.abs(s.velX) + Math.abs(s.velY) > 1e-3) {
        s.rotY += s.velY * dt
        s.rotX = clamp(s.rotX + s.velX * dt, -LIMITE_X, LIMITE_X)
        const atrito = Math.exp(-dt * ATRITO)
        s.velX *= atrito
        s.velY *= atrito
        mexe = true
      } else {
        s.velX = 0
        s.velY = 0
      }

      // a parede elástica: passou de 55° da pose, o embalo morre rápido e
      // o excesso volta; quase lá, assenta no limite (senão a volta
      // exponencial nunca chegaria e o quadro sob demanda não pararia)
      const d = s.rotY - POSE.y
      if (Math.abs(d) > LIMITE_Y) {
        const excesso = Math.abs(d) - LIMITE_Y
        s.velY *= Math.exp(-dt * 12)
        if (excesso < 1e-4) s.rotY = POSE.y + Math.sign(d) * LIMITE_Y
        else { s.rotY -= Math.sign(d) * excesso * (1 - Math.exp(-dt * 10)); mexe = true }
      }

      if (t - s.ultimaInteracao > VOLTA_MS) {
        // Y não dá mais voltas (o limite segura): volta direto para a pose
        const k = 1 - Math.exp(-dt * 2.4)
        s.rotX += (POSE.x - s.rotX) * k
        s.rotY += (POSE.y - s.rotY) * k
        if (Math.abs(POSE.x - s.rotX) + Math.abs(POSE.y - s.rotY) > 1e-3) mexe = true
        else { s.rotX = POSE.x; s.rotY = POSE.y }
      }
    }

    const kt = 1 - Math.exp(-dt * 6)
    s.tiltX += (s.tiltAlvoX - s.tiltX) * kt
    s.tiltY += (s.tiltAlvoY - s.tiltY) * kt
    s.zoom += (s.zoomAlvo - s.zoom) * kt
    if (Math.abs(s.tiltAlvoX - s.tiltX) + Math.abs(s.tiltAlvoY - s.tiltY) + Math.abs(s.zoomAlvo - s.zoom) > 1e-4) mexe = true

    return mexe
  }

  /** Troca os callbacks sem reanexar os listeners. */
  function configure(proximas) {
    Object.assign(o, proximas)
  }

  return { estado: s, step, attach, configure }
}
