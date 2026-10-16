import { useEffect, useMemo, useState } from 'react'

/**
 * Lê um .lrc: `[mm:ss.xx]texto`, uma ou mais marcas por linha. Etiquetas
 * de metadado (`[ti:…]`, `[ar:…]`) não têm minutos numéricos e caem fora
 * sozinhas. Devolve as linhas ordenadas por tempo, em ms.
 */
export function parseLrc(text) {
  const out = []
  const marca = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g
  for (const linha of String(text || '').split(/\r?\n/)) {
    const tempos = []
    let m
    let fim = 0
    marca.lastIndex = 0
    while ((m = marca.exec(linha))) {
      tempos.push(Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000))
      fim = marca.lastIndex
    }
    const texto = linha.slice(fim).trim()
    for (const t of tempos) out.push({ t, text: texto })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Índice da última linha que já começou em `ms`; -1 antes da primeira. */
export function lineAt(lines, ms) {
  let lo = 0
  let hi = lines.length - 1
  let achou = -1
  while (lo <= hi) {
    const meio = (lo + hi) >> 1
    if (lines[meio].t <= ms) { achou = meio; lo = meio + 1 }
    else hi = meio - 1
  }
  return achou
}

/**
 * A linha ativa da letra, e as vizinhas.
 *
 * A posição vem do próprio <audio> (`getTime`, em segundos), lida a cada
 * quadro enquanto toca. O `timeupdate` do elemento chega só umas quatro
 * vezes por segundo — até 250 ms de atraso, mais que os 100 ms que a
 * troca de linha pode errar. Ler `currentTime` no quadro dá o mesmo
 * resultado da extrapolação do app (âncora + relógio local), sem
 * precisar dela: aqui o relógio da música está na mão.
 *
 * O estado só muda quando a linha muda; o laço não re-renderiza nada.
 */
export default function useLyrics(lrcText, getTime, playing) {
  const lines = useMemo(() => parseLrc(lrcText), [lrcText])
  const [idx, setIdx] = useState(-1)

  useEffect(() => {
    if (!getTime || lines.length === 0) { setIdx(-1); return undefined }
    const atualiza = () => {
      const i = lineAt(lines, getTime() * 1000)
      setIdx((antes) => (antes === i ? antes : i))
    }
    atualiza()
    if (!playing) return undefined

    let raf = 0
    const passo = () => {
      atualiza()
      raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [lines, getTime, playing])

  const at = (k) => (k >= 0 && k < lines.length ? lines[k] : null)
  return { index: idx, prev: at(idx - 1), current: at(idx), next: at(idx + 1), lines }
}
