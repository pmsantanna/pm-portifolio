// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import { CASE_DIMENSIONS } from '../dimensions'

/** PRNG pequeno e determinístico: a mesma semente, o mesmo layout. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Os adesivos que vão no disco, com o tamanho de cada um (lado maior, em
 * unidades da cena). A etiqueta com o título é retangular.
 */
export const ADESIVOS = [
  { id: 'label', escala: 0.44, proporcao: 0.34 },
  { id: 'noise', escala: 0.493 },
  { id: 'bolha', escala: 0.348 },
  { id: 'play', escala: 0.319 },
  { id: 'monitor', escala: 0.290 },
  { id: 'globo', escala: 0.246 },
  { id: 'vinil', escala: 0.261 },
  { id: 'onda', escala: 0.275 },
  { id: 'fita', escala: 0.261 },
  { id: 'orbe', escala: 0.232 },
  { id: 'planeta', escala: 0.232 },
  { id: 'fone', escala: 0.217 },
  { id: 'xadrez', escala: 0.217 },
  { id: 'notas', escala: 0.189 },
  { id: 'raio', escala: 0.189 },
  { id: 'coracao', escala: 0.160 },
  { id: 'coracao', escala: 0.116 },
  { id: 'estrela', escala: 0.116 },
  { id: 'estrela', escala: 0.094 },
  { id: 'estrela', escala: 0.080 },
  { id: 'estrela', escala: 0.065 },
  { id: 'estrela', escala: 0.058 },
]

/**
 * Layout `{ id, angulo, raio, escala, rotacao }` sobre a área de dados.
 *
 * Amostragem com rejeição: cada adesivo tenta lugares até não se
 * sobrepor demais aos que já foram postos — um disco cheio, como o de quem
 * cola adesivo em tudo. Os grandes vão primeiro — é mais fácil
 * achar fresta para uma estrela do que para o wordmark.
 */
const COM_CAPA = ['label', 'noise', 'play', 'vinil', 'onda', 'raio', 'coracao', 'estrela', 'estrela', 'estrela']

export function gerarLayout(seed, D = CASE_DIMENSIONS, { comCapa = false } = {}) {
  const rnd = mulberry32(seed)
  // com capa no rótulo: menos adesivos, menores, na faixa de fora — a capa aparece
  const fonte = comCapa
    ? COM_CAPA.map((id, i) => ADESIVOS.filter((a) => a.id === id)[COM_CAPA.slice(0, i).filter((x) => x === id).length]).map((a) => ({ ...a, escala: a.escala * 0.85 }))
    : ADESIVOS
  const min = comCapa ? 0.36 : D.disco.rotulo.dentro + 0.04
  const max = D.disco.rotulo.fora - 0.05
  const postos = []

  const ordem = [...fonte].sort((a, b) => b.escala - a.escala)
  for (const a of ordem) {
    let melhor = null
    // teto por adesivo: o papel do adesivo não passa da borda do rótulo
    const teto = Math.max(min, Math.min(max, D.disco.rotulo.fora - 0.004 - a.escala * 0.45))
    for (let tentativa = 0; tentativa < 60; tentativa++) {
      const raio = min + rnd() * (teto - min)
      const angulo = rnd() * Math.PI * 2
      const x = Math.cos(angulo) * raio
      const y = Math.sin(angulo) * raio
      // o raio útil é menor que o lado: a borda branca pode encostar e até
      // sobrepor um pouco a vizinha, como adesivos colados à mão
      const r = a.escala * 0.4
      const folga = postos.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y) - p.r - r), Infinity)
      // o adesivo não pode sair do disco
      if (!melhor || folga > melhor.folga) melhor = { x, y, r, raio, angulo, folga }
      if (folga > 0) break
    }
    postos.push(melhor)
    // etiqueta fica quase reta; o resto, solto
    const rotacao = a.id === 'label' ? (rnd() - 0.5) * 0.4 : (rnd() - 0.5) * 1.6
    Object.assign(melhor, { id: a.id, escala: a.escala, proporcao: a.proporcao || 1, rotacao })
  }

  return postos.map(({ id, angulo, raio, escala, rotacao, proporcao }) => ({ id, angulo, raio, escala, rotacao, proporcao }))
}

export const SEMENTE_PADRAO = 7
