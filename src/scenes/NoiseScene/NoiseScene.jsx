import { useCallback, useEffect, useRef, useState } from 'react'
import { createOrb } from '../../vendor/noise-core/createOrb.js'
import { drawSpectrum } from '../../vendor/noise-core/spectrum.js'
import { toRGB } from '../../vendor/noise-core/palette.js'
import useReveal from '../../hooks/useReveal'
import useDemoAudio from './useDemoAudio'
import useLyrics from './useLyrics'
import css from './styles'
import track from './assets/demo-track.json'
import lrcText from './assets/demo-track.lrc?raw'
import mp3 from './assets/demo-track.mp3'
import ogg from './assets/demo-track.ogg'
import cover from './assets/demo-cover.svg'

const REPO_URL = 'https://github.com/pmsantanna/noise'
// sem instalador publicado ainda: o botão aparece desabilitado com "em breve"
const DOWNLOAD_URL = null

/* Cores do orbe por tema do site.
 *
 * Noir é sem saturação: cinza claro nos graves, branco quente nos agudos,
 * como o resto da página. Holo percorre o mesmo foil do CSS do site
 * (--holo), devagar, no ritmo da animação holo-shift — as duas pontas a um
 * terço de volta uma da outra para o degradê nunca colapsar numa cor só.
 */
const HOLO = ['#8fa6ff', '#ff9ddb', '#7fe9c3', '#a894ff'].map(toRGB)
const HOLO_PERIOD_S = 22

function holoAt(u) {
  const x = (((u % 1) + 1) % 1) * HOLO.length
  const a = HOLO[Math.floor(x) % HOLO.length]
  const b = HOLO[(Math.floor(x) + 1) % HOLO.length]
  const f = x - Math.floor(x)
  const s = f * f * (3 - 2 * f)
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]
}

const ORB_THEMES = {
  noir: { deep: '#83817b', bright: '#f2eadb' },
  holo: (seconds) => {
    const u = seconds / HOLO_PERIOD_S
    return { deep: holoAt(u), bright: holoAt(u + 0.34) }
  },
}

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/* Perfil de qualidade: celular ou máquina de poucos núcleos começa no
 * leve; no desktop o orbe também cai sozinho se o FPS não segurar. */
function pickQuality() {
  const narrow = window.innerWidth < 768
  const cores = navigator.hardwareConcurrency || 8
  return { quality: narrow || cores <= 4 ? 'low' : 'high', adaptive: !narrow }
}

export default function NoiseScene({ t, theme = 'noir' }) {
  const L = t.noise
  const [revealRef, revealed] = useReveal(0.2)

  const screenRef = useRef(null)
  const orbMountRef = useRef(null)
  const barsRef = useRef(null)
  const progressRef = useRef(null)
  const clockRef = useRef(null)
  const fileRef = useRef(null)
  const orbRef = useRef(null)

  const audio = useDemoAudio({ mp3, ogg })
  const { mode, playing, error } = audio
  const lyrics = useLyrics(lrcText, audio.getTime, playing && mode === 'demo')

  const [inView, setInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)
  const [dropping, setDropping] = useState(false)
  const [peak, setPeak] = useState(0)
  const [noGL, setNoGL] = useState(false)
  const dragDepth = useRef(0)

  // a fonte e o tema mais recentes, para quem cria o orbe depois
  const sourceRef = useRef(null)
  sourceRef.current = playing ? audio.analyser : null
  const themeRef = useRef(theme)
  themeRef.current = theme
  const modeRef = useRef(mode)
  modeRef.current = mode
  const pauseRef = useRef(audio.pauseForExit)
  pauseRef.current = audio.pauseForExit

  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ── a barra, desenhada dentro do quadro do orbe ── */
  const onFrame = useCallback((orb) => {
    const c = barsRef.current
    if (c) {
      const w = c.clientWidth
      const h = c.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      const ctx = c.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // mesmas faixas, mesmo degradê, mesmo quadro: barra 40 = célula 40
      drawSpectrum(ctx, w, h, orb.bands.values, orb.palette)
    }
  }, [])

  /* ── progresso da faixa demo: direto no DOM, sem re-render ── */
  useEffect(() => {
    if (!(playing && mode === 'demo')) return undefined
    const dur = track.durationMs / 1000
    let raf = 0
    const passo = () => {
      const now = audio.getTime()
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${Math.min(1, now / dur)})`
      if (clockRef.current) clockRef.current.textContent = `${fmtTime(now)} / ${fmtTime(dur)}`
      raf = requestAnimationFrame(passo)
    }
    passo()
    return () => cancelAnimationFrame(raf)
  }, [playing, mode, audio.getTime])

  /* ── visibilidade: na tela, na aba ── */
  useEffect(() => {
    const el = screenRef.current
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    const onVis = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // saiu da tela: o som para. Voltar só traz o visual em idle
  useEffect(() => {
    if (!inView) pauseRef.current()
  }, [inView])

  /* ── ciclo de vida do orbe ──
   *
   * Na tela e com a aba visível: desenha. Fora da tela: zero quadros. Fora
   * por mais de 5 s: dispose, que solta o contexto WebGL — o navegador tem
   * um teto de contextos e o terreno do site já usa um. Voltando, recria.
   */
  useEffect(() => {
    if (!inView) return undefined
    let orb = orbRef.current
    if (!orb && noGL) return undefined
    if (!orb) {
      const { quality, adaptive } = pickQuality()
      try {
        orb = createOrb({
          container: orbMountRef.current,
          theme: ORB_THEMES[themeRef.current] || ORB_THEMES.noir,
          quality,
          adaptive,
          reducedMotion: reduced,
          // reduced motion: o app já corta o deslocamento; metade disso dá
          // ~30% do normal, sem rotação e com a esfera parada em idle
          amplitude: reduced ? 0.5 : 1,
          onFrame,
        })
      } catch {
        // sem WebGL: a cena continua de pé, com som, letra e a capa no
        // lugar do orbe
        setNoGL(true)
        return undefined
      }
      orb.setSource(sourceRef.current)
      orbRef.current = orb
    }
    if (pageVisible) orb.start()
    return () => orb.stop()
  }, [inView, pageVisible, onFrame, reduced, noGL])

  useEffect(() => {
    if (inView || !orbRef.current) return undefined
    const id = setTimeout(() => {
      if (orbRef.current) orbRef.current.dispose()
      orbRef.current = null
    }, 5000)
    return () => clearTimeout(id)
  }, [inView])

  useEffect(() => () => {
    if (orbRef.current) orbRef.current.dispose()
    orbRef.current = null
  }, [])

  // fonte e tema mudam no orbe vivo, sem recriar a cena
  useEffect(() => {
    if (orbRef.current) orbRef.current.setSource(playing ? audio.analyser : null)
  }, [playing, audio.analyser])

  useEffect(() => {
    if (orbRef.current) orbRef.current.setTheme(ORB_THEMES[theme] || ORB_THEMES.noir)
  }, [theme])

  // a leitura de Hz não precisa de 60 fps — 6 bastam e o texto para de tremer
  useEffect(() => {
    if (!playing) { setPeak(0); return undefined }
    const id = setInterval(() => setPeak(orbRef.current ? orbRef.current.metrics.peak : 0), 160)
    return () => clearInterval(id)
  }, [playing])

  /* ── arquivo: botão ou arrastar ── */
  const takeFile = (file) => {
    if (!file) return
    const audioLike = (file.type && file.type.startsWith('audio')) || /\.(mp3|ogg|oga|wav|flac|m4a|aac|opus|webm)$/i.test(file.name)
    if (audioLike) audio.playFile(file)
  }
  const onDragEnter = (e) => { e.preventDefault(); dragDepth.current++; setDropping(true) }
  const onDragOver = (e) => { e.preventDefault() }
  const onDragLeave = (e) => {
    e.preventDefault()
    if (--dragDepth.current <= 0) { dragDepth.current = 0; setDropping(false) }
  }
  const onDrop = (e) => {
    e.preventDefault()
    dragDepth.current = 0
    setDropping(false)
    takeFile(e.dataTransfer.files && e.dataTransfer.files[0])
  }

  // Espaço com a moldura em foco: Play/Pause. Nos botões, o Espaço é deles
  const onWidgetKey = (e) => {
    if ((e.code === 'Space' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault()
      audio.toggle()
    }
  }

  /* ── textos ── */
  const playLabel = mode === 'mic'
    ? L.stop
    : playing ? L.pause
    : (mode === 'demo' || mode === 'file') ? L.resume
    : L.play

  const name = mode === 'demo' ? `${track.title} — ${track.artist}`
    : mode === 'file' ? audio.label
    : mode === 'mic' ? L.micLabel
    : ''

  const showLyrics = mode === 'idle' || mode === 'demo'
  const notice = error ? L[error] : mode === 'idle' && !playing ? L.idle : ''

  return (
    <div ref={revealRef} className={`scene-inner noise-wrap ${revealed ? 'on' : ''}`}>
      <style>{css}</style>

      <div className="slug">
        {L.slug.split('·')[0].trim()} · <b>{L.slug.split('·').slice(1).join('·').trim()}</b>
      </div>

      <div className="noise-dock">
        {/* ── o texto ── */}
        <div className="noise-copy">
          <h3 className="noise-title">{L.title}</h3>
          <p className="noise-tagline">{L.tagline}</p>
          <p className="action" dangerouslySetInnerHTML={{ __html: L.body }} />
          <ul className="noise-notes">
            <li>{L.desktopOnly}</li>
            <li>{L.privacy}</li>
          </ul>
          <nav className="scene-links">
            <a href={REPO_URL} target="_blank" rel="noreferrer">{L.repo}</a>
            {DOWNLOAD_URL
              ? <a href={DOWNLOAD_URL}>{L.download}</a>
              : <span className="noise-soon" aria-disabled="true">{L.download} · {L.soon}</span>}
          </nav>
          <div className="tags">
            <span>Three.js</span>
            <span>GLSL</span>
            <span>Web Audio</span>
            <span>Electron</span>
          </div>
        </div>

        {/* ── a tela: um desktop escuro com o widget no canto ── */}
        <div
          ref={screenRef}
          className={`noise-screen${dropping ? ' dropping' : ''}`}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <p className="sr-only">{L.alt}</p>

          <div className="noise-side">
            <div className="noise-np">
              {mode === 'demo' || mode === 'idle'
                ? <img className="noise-cover" src={cover} alt="" width="52" height="52" />
                : <div className="noise-cover noise-cover-blank" aria-hidden="true">{mode === 'mic' ? '◉' : '♪'}</div>}
              <div className="noise-np-text">
                <span className="noise-np-title">{mode === 'file' ? audio.label : mode === 'mic' ? L.micLabel : track.title}</span>
                <span className="noise-np-sub">{mode === 'file' || mode === 'mic' ? L.noLyrics : `${track.artist} · ${track.album}`}</span>
                {(mode === 'demo' || mode === 'idle') && (
                  <span className="noise-np-meta" aria-hidden="true">
                    <span className="noise-np-bar">
                      <span className="noise-np-fill" ref={progressRef} />
                    </span>
                    <span className="noise-np-clock" ref={clockRef}>0:00 / {fmtTime(track.durationMs / 1000)}</span>
                  </span>
                )}
              </div>
              {mode !== 'demo' && mode !== 'idle' && (
                <button className="noise-np-back" onClick={audio.playDemo}>{L.play}</button>
              )}
            </div>

            {showLyrics && (
              <div className="noise-lyrics" aria-hidden="true">
                <p className="lyr-linha">{lyrics.prev ? lyrics.prev.text || '♪' : ' '}</p>
                <p className="lyr-linha lyr-ativa">{lyrics.current ? lyrics.current.text || '♪' : '♪'}</p>
                <p className="lyr-linha">{lyrics.next ? lyrics.next.text || '♪' : ' '}</p>
              </div>
            )}
          </div>

          <div
            className="noise-widget"
            tabIndex={0}
            role="group"
            aria-label={`${L.title} — ${L.tagline}`}
            onKeyDown={onWidgetKey}
          >
            <div className="noise-stage">
              <div className="noise-orb" ref={orbMountRef} aria-hidden="true">
                {noGL && <img className="noise-fallback" src={cover} alt="" />}
              </div>
              {(notice || dropping) && (
                <p className="noise-notice" role={error ? 'alert' : undefined}>{dropping ? L.drop : notice}</p>
              )}
            </div>

            <div className="noise-readout">
              <span className="name">{name || '—'}</span>
              <span className="hz">{peak ? `${peak} Hz` : '—'}</span>
            </div>
            <canvas className="noise-bars" ref={barsRef} aria-hidden="true" />

            <div className="noise-skin">
              <label htmlFor="noise-skin-select">{L.skin}</label>
              <select id="noise-skin-select" disabled aria-describedby="noise-skin-soon">
                <option>Wireframe</option>
              </select>
              <span id="noise-skin-soon">{L.soon}</span>
            </div>

            <div className="noise-controls">
              <button className="noise-btn" onClick={audio.toggle} aria-pressed={playing && mode !== 'mic'}>
                {playLabel}
              </button>
              <button className="noise-btn" onClick={() => fileRef.current && fileRef.current.click()}>
                {L.file}
              </button>
              <button
                className="noise-btn"
                aria-pressed={mode === 'mic'}
                onClick={mode === 'mic' ? audio.stop : audio.startMic}
              >
                {L.mic}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                hidden
                onChange={(e) => { takeFile(e.target.files && e.target.files[0]); e.target.value = '' }}
              />
            </div>
          </div>

          <div className="noise-taskbar" aria-hidden="true">
            <span className="noise-tray">
              <i /><i /><i />
            </span>
          </div>
        </div>
      </div>

      <p className="noise-credit">{L.credit}</p>
    </div>
  )
}
