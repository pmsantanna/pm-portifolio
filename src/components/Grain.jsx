import { useEffect, useRef } from 'react'

// poeira iridescente do modo holo — pastéis quase brancos que, em multiply,
// mal roçam o fundo pérola: neblina prismática, não glitter
const HOLO_DUST = [
  [220, 227, 255], // periwinkle
  [255, 224, 243], // rosa
  [224, 255, 243], // menta
  [235, 226, 255], // lilás
  [223, 240, 255], // céu
  [255, 248, 226], // ouro pálido
]

export default function Grain({ theme = 'noir' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const holo = theme === 'holo'

    const size = () => {
      canvas.width  = Math.ceil(window.innerWidth  / 2.5)
      canvas.height = Math.ceil(window.innerHeight / 2.5)
    }
    size()
    window.addEventListener('resize', size)

    const draw = () => {
      const img = ctx.createImageData(canvas.width, canvas.height)
      const d = img.data
      if (holo) {
        for (let i = 0; i < d.length; i += 4) {
          const r = Math.random()
          if (r < 0.88) {
            // véu de filme: cinza claríssimo, quase invisível no multiply
            const v = 244 + ((Math.random() * 11) | 0)
            d[i] = v; d[i + 1] = v; d[i + 2] = v
          } else {
            // poeira prismática esparsa
            const c = HOLO_DUST[(Math.random() * HOLO_DUST.length) | 0]
            d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]
          }
          d[i + 3] = 255
        }
      } else {
        for (let i = 0; i < d.length; i += 4) {
          const v = (Math.random() * 255) | 0
          d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    }

    draw()
    let interval
    if (!reduced) interval = setInterval(draw, holo ? 150 : 90)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', size)
    }
  }, [theme])

  return <canvas ref={ref} className="grain-canvas" aria-hidden="true" />
}
