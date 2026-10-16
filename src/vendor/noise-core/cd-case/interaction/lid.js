// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
/**
 * A tampa numa mola: abre com um pouco de sobra e assenta.
 *
 * Uma mola amortecida de verdade (e não um `damp`, que chega sem passar
 * do ponto) porque a dobradiça de um estojo de CD bate e volta um tico.
 * `x` vai de 0 (fechada) a 1 (aberta); quem converte em graus é a cena.
 */
export function createLid() {
  const s = { x: 0, v: 0, alvo: 0 }
  const RIGIDEZ = 95
  const AMORTECIMENTO = 2 * Math.sqrt(RIGIDEZ) * 0.5   // subamortecida
  return {
    estado: s,
    aberta: () => s.alvo === 1,
    toggle(forcar) {
      s.alvo = forcar === undefined ? (s.alvo ? 0 : 1) : (forcar ? 1 : 0)
    },
    /** Avança a mola; devolve se ainda está em movimento. */
    step(dt) {
      // passos curtos: a mola é rígida e dt de 50 ms a faria explodir
      const n = Math.ceil(dt / (1 / 240))
      const h = dt / n
      for (let i = 0; i < n; i++) {
        const a = RIGIDEZ * (s.alvo - s.x) - AMORTECIMENTO * s.v
        s.v += a * h
        s.x += s.v * h
      }
      const parado = Math.abs(s.alvo - s.x) < 1e-3 && Math.abs(s.v) < 1e-3
      if (parado) { s.x = s.alvo; s.v = 0 }
      return !parado
    },
  }
}
