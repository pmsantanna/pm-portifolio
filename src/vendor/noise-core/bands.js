// noise-core @ 28289ac (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
export const BAND_COUNT = 64

const LOW_HZ = 30
const HIGH_HZ = 16000

/**
 * Divide o espectro em faixas de largura logarítmica.
 *
 * Em escala linear, tudo que se ouve como "música" fica espremido no
 * primeiro décimo dos bins: 0–2 kHz ocupa 10% do array e 18–22 kHz, onde
 * quase nunca há energia, ocupa outros 10%. Em log, cada faixa cobre
 * aproximadamente o mesmo intervalo percebido.
 */
export function createBands(count = BAND_COUNT) {
  const values = new Float32Array(count)
  let ranges = null
  let cachedBins = 0
  let cachedRate = 0

  function buildRanges(binCount, sampleRate) {
    const binHz = (sampleRate / 2) / binCount
    const hi = Math.min(HIGH_HZ, sampleRate / 2)
    const r = new Int32Array(count + 1)

    for (let i = 0; i <= count; i++) {
      const hz = LOW_HZ * Math.pow(hi / LOW_HZ, i / count)
      r[i] = Math.round(hz / binHz)
    }
    // nenhuma faixa pode ficar vazia, nem passar do fim do array
    for (let i = 1; i <= count; i++) {
      if (r[i] <= r[i - 1]) r[i] = r[i - 1] + 1
    }
    for (let i = 0; i <= count; i++) {
      r[i] = Math.max(0, Math.min(binCount, r[i]))
    }

    ranges = r
    cachedBins = binCount
    cachedRate = sampleRate
  }

  /** Preenche `values` com o pico de cada faixa, 0..1. */
  function read(freq, sampleRate) {
    if (!ranges || cachedBins !== freq.length || cachedRate !== sampleRate) {
      buildRanges(freq.length, sampleRate)
    }

    for (let i = 0; i < count; i++) {
      let peak = 0
      for (let j = ranges[i]; j < ranges[i + 1]; j++) {
        if (freq[j] > peak) peak = freq[j]
      }
      const target = peak / 255
      const cur = values[i]
      // ataque rápido, queda lenta — o transiente aparece, a cauda persiste
      values[i] = cur + (target - cur) * (target > cur ? 0.55 : 0.12)
    }
    return values
  }

  function silence() {
    values.fill(0)
  }

  return { count, values, read, silence }
}
