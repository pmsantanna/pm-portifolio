// noise-core @ 28289ac (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import { BAND_COUNT } from './bands.js'

/**
 * Faixas falsas para quando não há áudio nenhum.
 *
 * Fora do app, numa página que ninguém autorizou a tocar som, o orbe
 * parado numa esfera lisa não conta nada. Isto é o mínimo que o faz
 * parecer vivo sem fingir ser música: um ruído lento e baixo em todas as
 * faixas e um pulso de bumbo nos graves, no andamento pedido.
 *
 * O bumbo cai nos graves e o chimbal nos agudos pelo mesmo motivo que na
 * música de verdade — as células estão ordenadas por latitude, então o
 * pulso incha o polo sul e o chimbal arrepia a coroa, e quem olha aprende
 * o mapa antes de apertar Play.
 *
 * Mesmo ataque e queda do bands.js, para a troca para o áudio real não
 * mudar a "textura" do movimento, só o desenho.
 */
export function createProcedural({ count = BAND_COUNT, bpm = 118, gain = 1 } = {}) {
  const values = new Float32Array(count)
  const metrics = { level: 0, bass: 0, tone: 0.5, peak: 0 }

  /** Preenche as faixas para o instante `seconds` (relógio absoluto). */
  function sample(seconds) {
    const beat = seconds * bpm / 60
    const kick = Math.exp(-(beat % 1) * 6.5)          // 1 na batida, cai rápido
    const hat = Math.exp(-((beat + 0.5) % 1) * 16)    // contratempo, mais seco

    let sum = 0
    for (let i = 0; i < count; i++) {
      const x = i / (count - 1)

      // duas senoides lentas com fases por faixa: deriva, não oscilação
      const drift = 0.5 + 0.5 * Math.sin(seconds * 0.71 + i * 0.45) * Math.sin(seconds * 0.23 + i * 0.17)

      let target = 0.05 + 0.09 * drift
      target += kick * 0.40 * Math.exp(-x * 8)
      target += hat * 0.16 * Math.max(0, (x - 0.62) / 0.38)
      target = Math.min(1, target * gain)

      const cur = values[i]
      values[i] = cur + (target - cur) * (target > cur ? 0.55 : 0.12)
      sum += values[i]
    }

    metrics.level = sum / count * 0.5
    metrics.bass = kick * 0.30 * gain
    return metrics
  }

  function silence() {
    values.fill(0)
    metrics.level = 0
    metrics.bass = 0
  }

  return { count, values, metrics, sample, silence }
}
