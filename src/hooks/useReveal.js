import { useEffect, useRef, useState } from 'react'

// rootMargin abre a janela além da tela: com '100% 0px' o gatilho dispara
// uma altura de tela antes de o elemento aparecer — tempo de baixar um
// chunk lazy sem a cena chegar vazia
export default function useReveal(threshold = 0.25, rootMargin = '0px') {
  const ref = useRef(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true)
          io.disconnect()
        }
      },
      { threshold, rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin])

  return [ref, on]
}
