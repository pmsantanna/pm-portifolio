// noise-core @ 28289ac (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import { createBands } from './bands.js'

/**
 * Lê um AnalyserNode uma vez por quadro: as 64 faixas e as métricas
 * globais que o orbe usa (nível, grave, centroide, pico).
 *
 * As métricas ficam num objeto mutável, não num estado: mudam 60x por
 * segundo e quem lê é o loop de render. Uma única divisão de faixas
 * alimenta o orbe e a barra de espectro — é o que garante que a célula e a
 * barra acendam juntas.
 *
 * O analisador pode chegar depois (o app só cria o AudioContext no
 * primeiro clique); até lá, sample() devolve as métricas paradas.
 */
export function createSampler(analyser = null, bands = createBands()) {
  let a = null
  let freq = null

  const metrics = {
    level: 0,   // energia média, 0..1
    bass: 0,    // 20–200 Hz, 0..1
    tone: 0.5,  // centroide espectral normalizado, 0..1
    peak: 0,    // frequência dominante em Hz
  }

  function setAnalyser(next) {
    a = next || null
    freq = a ? new Uint8Array(a.frequencyBinCount) : null
  }
  setAnalyser(analyser)

  function sample() {
    const m = metrics
    if (!a) return m

    if (freq.length !== a.frequencyBinCount) freq = new Uint8Array(a.frequencyBinCount)
    a.getByteFrequencyData(freq)

    const sampleRate = a.context.sampleRate
    bands.read(freq, sampleRate)

    const nyquist = sampleRate / 2
    const binHz = nyquist / freq.length

    let sum = 0
    let weighted = 0
    let bassSum = 0
    let bassBins = 0
    let peakVal = 0
    let peakBin = 0

    for (let i = 0; i < freq.length; i++) {
      const v = freq[i]
      sum += v
      weighted += v * i
      if (v > peakVal) { peakVal = v; peakBin = i }
      const hz = i * binHz
      if (hz >= 20 && hz <= 200) { bassSum += v; bassBins++ }
    }

    const level = sum / (freq.length * 255)
    const bass = bassBins ? bassSum / (bassBins * 255) : 0

    // centroide: onde está o "centro de massa" do espectro
    const centroidBin = sum > 0 ? weighted / sum : freq.length * 0.25
    const centroidHz = centroidBin * binHz
    const tone = Math.min(1, Math.max(0,
      (Math.log2(Math.max(centroidHz, 200)) - Math.log2(200)) / (Math.log2(8000) - Math.log2(200))
    ))

    m.level += (level - m.level) * 0.25
    m.bass += (bass - m.bass) * 0.35
    m.tone += (tone - m.tone) * 0.06
    m.peak = Math.round(peakBin * binHz)

    return m
  }

  /** Zera faixas e métricas — o orbe volta a ser esfera no mesmo quadro. */
  function silence() {
    bands.silence()
    metrics.level = 0
    metrics.bass = 0
  }

  return { bands, metrics, sample, setAnalyser, silence }
}
