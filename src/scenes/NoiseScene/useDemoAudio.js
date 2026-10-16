import { useCallback, useEffect, useRef, useState } from 'react'

const FFT = 2048

/**
 * As fontes de áudio da cena: a faixa demo, um arquivo do visitante e o
 * microfone. Um AudioContext, um AnalyserNode; quem desenha só vê o
 * analisador.
 *
 * Nada aqui toca sozinho. O contexto nasce no primeiro clique — política
 * de autoplay dos navegadores, e também a regra da cena: rolar a página
 * nunca faz barulho. Nada sai da máquina: o arquivo é decodificado em
 * memória e o microfone vai só para o analisador, nunca para os
 * alto-falantes (sem eco).
 *
 * `mode` diz qual fonte está carregada; `playing`, se ela está soando
 * agora. O orbe recebe o analisador só quando `playing` — pausado, ele
 * volta ao modo demo procedural em vez de ficar parado.
 */
export default function useDemoAudio({ mp3, ogg }) {
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const demoRef = useRef(null)      // <audio> da faixa demo
  const bufferRef = useRef(null)    // AudioBufferSourceNode do arquivo
  const streamRef = useRef(null)    // MediaStream do microfone
  const micNodeRef = useRef(null)

  const [mode, setMode] = useState('idle')       // 'idle' | 'demo' | 'file' | 'mic'
  const [playing, setPlaying] = useState(false)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [analyser, setAnalyser] = useState(null)
  const [duration, setDuration] = useState(0)

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) throw Object.assign(new Error('no web audio'), { code: 'noAudio' })
      const ctx = new Ctx()
      const a = ctx.createAnalyser()
      a.fftSize = FFT
      a.smoothingTimeConstant = 0.72
      ctxRef.current = ctx
      analyserRef.current = a
      setAnalyser(a)
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }, [])

  /** O elemento da faixa demo, criado e ligado ao grafo uma vez só. */
  const demoElement = useCallback(() => {
    if (demoRef.current) return demoRef.current
    const ctx = ensureContext()
    const el = new Audio()
    el.preload = 'auto'
    // mp3 primeiro; ogg só onde mp3 não toca. A faixa só é baixada aqui,
    // no primeiro Play — nunca no carregamento da página
    el.src = el.canPlayType('audio/mpeg') ? mp3 : ogg
    const node = ctx.createMediaElementSource(el)
    node.connect(analyserRef.current)
    node.connect(ctx.destination)
    el.addEventListener('loadedmetadata', () => setDuration(el.duration || 0))
    el.addEventListener('ended', () => setPlaying(false))
    demoRef.current = el
    return el
  }, [ensureContext, mp3, ogg])

  /** Solta o arquivo e o microfone; a faixa demo só pausa, para retomar. */
  const release = useCallback(() => {
    if (bufferRef.current) {
      try { bufferRef.current.stop() } catch {}
      bufferRef.current.disconnect()
      bufferRef.current = null
    }
    if (micNodeRef.current) {
      micNodeRef.current.disconnect()
      micNodeRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (demoRef.current) demoRef.current.pause()
  }, [])

  const fail = useCallback((code) => {
    setError(code)
    setPlaying(false)
  }, [])

  const playDemo = useCallback(async () => {
    setError('')
    try {
      if (mode !== 'demo') release()
      const el = demoElement()
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') await ctx.resume()
      if (el.ended) el.currentTime = 0
      setMode('demo')
      setLabel('')
      await el.play()
      setPlaying(true)
    } catch (err) {
      fail(err && err.code === 'noAudio' ? 'noAudio' : 'fileError')
    }
  }, [mode, release, demoElement, fail])

  const playFile = useCallback(async (file) => {
    setError('')
    try {
      const ctx = ensureContext()
      if (ctx.state === 'suspended') await ctx.resume()
      const bytes = await file.arrayBuffer()
      // a versão de callback cobre o Safari antigo, que não devolve Promise
      const buffer = await new Promise((ok, no) => ctx.decodeAudioData(bytes, ok, no))
      release()
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.connect(analyserRef.current)
      src.connect(ctx.destination)
      src.start()
      bufferRef.current = src
      setMode('file')
      setLabel(file.name.replace(/\.[^.]+$/, ''))
      setDuration(buffer.duration)
      setPlaying(true)
    } catch (err) {
      fail(err && err.code === 'noAudio' ? 'noAudio' : 'fileError')
    }
  }, [ensureContext, release, fail])

  const startMic = useCallback(async () => {
    setError('')
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail('micMissing')
      return
    }
    try {
      const ctx = ensureContext()
      // o pedido de permissão só sai daqui, de um clique explícito
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      if (ctx.state === 'suspended') await ctx.resume()
      release()
      const node = ctx.createMediaStreamSource(stream)
      node.connect(analyserRef.current)   // e só nele: nada volta aos alto-falantes
      streamRef.current = stream
      micNodeRef.current = node
      setMode('mic')
      setLabel('')
      setDuration(0)
      setPlaying(true)
    } catch (err) {
      if (err && err.code === 'noAudio') fail('noAudio')
      else fail(err && (err.name === 'NotAllowedError' || err.name === 'SecurityError') ? 'micDenied' : 'micMissing')
    }
  }, [ensureContext, release, fail])

  /** Volta ao idle: solta tudo, a faixa demo fica pausada onde estava. */
  const stop = useCallback(() => {
    release()
    if (ctxRef.current && ctxRef.current.state === 'suspended') ctxRef.current.resume()
    setMode('idle')
    setLabel('')
    setPlaying(false)
  }, [release])

  /**
   * Play/Pause da moldura, para a fonte carregada.
   *
   * O arquivo não tem pausa própria (AudioBufferSourceNode só toca uma
   * vez), então pausar é suspender o contexto — o relógio dele para junto
   * e o loop retoma do mesmo ponto. O microfone não pausa: para.
   */
  const toggle = useCallback(async () => {
    if (mode === 'idle' || mode === 'demo') {
      if (playing) {
        demoRef.current.pause()
        setPlaying(false)
      } else {
        await playDemo()
      }
    } else if (mode === 'file') {
      const ctx = ctxRef.current
      if (playing) {
        await ctx.suspend()
        setPlaying(false)
      } else {
        await ctx.resume()
        setPlaying(true)
      }
    } else if (mode === 'mic') {
      stop()
    }
  }, [mode, playing, playDemo, stop])

  /**
   * A cena saiu da tela: o som para, a fonte fica carregada. Voltar só
   * retoma o visual; para ouvir de novo, outro clique.
   */
  const pauseForExit = useCallback(() => {
    if (!playing) return
    if (mode === 'demo') demoRef.current.pause()
    else if (mode === 'file') ctxRef.current.suspend()
    else if (mode === 'mic') { stop(); return }
    setPlaying(false)
  }, [mode, playing, stop])

  // posição da faixa demo, lida pelo laço da letra a cada quadro
  const getTime = useCallback(() => (demoRef.current ? demoRef.current.currentTime : 0), [])

  useEffect(() => () => {
    release()
    if (demoRef.current) demoRef.current.removeAttribute('src')
    if (ctxRef.current) ctxRef.current.close()
  }, [release])

  return {
    mode,
    playing,
    label,
    error,
    duration,
    analyser,
    getTime,
    playDemo,
    playFile,
    startMic,
    toggle,
    stop,
    pauseForExit,
  }
}
