import { useEffect, useState } from 'react'

export default function Timecode() {
  const [s, setS] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setS((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')

  return <span>TC 00:{mm}:{ss}:00</span>
}
