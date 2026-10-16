#!/usr/bin/env node
/**
 * Gera a faixa demo da cena do Noise: áudio, letra sincronizada e
 * metadados, todos da mesma partitura.
 *
 *   node scripts/make-demo-track.mjs        (precisa de ffmpeg no PATH)
 *
 * A música é "Drunken Sailor", cantiga de marinheiro tradicional do
 * século XIX — melodia e letra em domínio público. O arranjo (bumbo
 * reto a 118 BPM, baixo no contratempo, pad, melodia sintetizada) é
 * gerado aqui, sem amostra de ninguém, e é dedicado ao domínio público
 * sob CC0 1.0.
 *
 * Por que gerar em vez de baixar: a cena precisa de grave claro perto de
 * 118 BPM, para o polo sul do orbe inchar no bumbo, e de uma letra de
 * verdade em .lrc. Gerando, a letra cai exatamente nas notas — cada
 * linha do .lrc é o instante da primeira nota da frase, calculado da
 * mesma partitura que toca — e o arquivo é refeito igual sempre (ruído
 * de semente fixa).
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenes', 'NoiseScene', 'assets')
const SR = 44100
const BPM = 118
const BEAT = 60 / BPM
const BAR = BEAT * 4
const EIGHTH = BEAT / 2

/* ─────────────── partitura ─────────────── */

// [nota MIDI, duração em colcheias]; Ré dórico, como se canta
const VERSE = [
  [[69, 2], [69, 1], [69, 1], [69, 2], [69, 1], [69, 1]],
  [[69, 2], [62, 2], [65, 2], [69, 2]],
  [[67, 2], [67, 1], [67, 1], [67, 2], [67, 1], [67, 1]],
  [[67, 2], [60, 2], [64, 2], [67, 2]],
  [[69, 2], [69, 1], [69, 1], [69, 2], [69, 1], [69, 1]],
  [[69, 2], [71, 2], [72, 2], [74, 2]],
  [[72, 2], [69, 2], [67, 2], [64, 2]],
  [[62, 4], [62, 4]],
]
const CHORUS = [
  [[69, 4], [69, 3], [69, 1]],
  [[69, 2], [62, 2], [65, 2], [69, 2]],
  [[67, 4], [67, 3], [67, 1]],
  [[67, 2], [60, 2], [64, 2], [67, 2]],
  [[69, 4], [69, 3], [69, 1]],
  [[69, 2], [71, 2], [72, 2], [74, 2]],
  [[72, 2], [69, 2], [67, 2], [64, 2]],
  [[62, 4], [62, 4]],
]
// acorde por compasso da frase de oito: Rém, Rém, Dó, Dó, Rém, Rém, Dó, Rém
const PROG = ['Dm', 'Dm', 'C', 'C', 'Dm', 'Dm', 'C', 'Dm']
const CHORDS = { Dm: [50, 53, 57], C: [48, 52, 55] }
const ROOT = { Dm: 38, C: 36 }

const LINES = {
  verse1: [
    'What will we do with a drunken sailor?',
    'What will we do with a drunken sailor?',
    'What will we do with a drunken sailor?',
    'Early in the morning!',
  ],
  chorus: [
    'Way hay and up she rises',
    'Way hay and up she rises',
    'Way hay and up she rises',
    'Early in the morning!',
  ],
  verse2: [
    "Put him in the longboat till he's sober",
    "Put him in the longboat till he's sober",
    "Put him in the longboat till he's sober",
    'Early in the morning!',
  ],
}

// a forma: introdução, verso, refrão, verso, refrão, saída
const FORM = [
  { kind: 'intro', bars: 4 },
  { kind: 'verse', melody: VERSE, lyrics: LINES.verse1 },
  { kind: 'chorus', melody: CHORUS, lyrics: LINES.chorus },
  { kind: 'verse', melody: VERSE, lyrics: LINES.verse2 },
  { kind: 'chorus', melody: CHORUS, lyrics: LINES.chorus },
  { kind: 'outro', bars: 4 },
]

/* ─────────────── utilitários ─────────────── */

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)

// ruído de semente fixa: a faixa sai idêntica a cada geração
let seed = 0x5eed
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296 * 2 - 1
}

// serra com PolyBLEP: sem o serrilhado de alias que a serra ingênua tem
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1 }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1 }
  return 0
}

/* ─────────────── barramentos ─────────────── */

const bars = FORM.reduce((n, s) => n + (s.bars || 8), 0)
const TAIL = 2.0
const N = Math.ceil((bars * BAR + TAIL) * SR)
const dry = new Float32Array(N)
const send = new Float32Array(N)   // vai para o eco e a reverb
const pumped = new Float32Array(N) // baixo e pad: sofrem o sidechain do bumbo
const duck = new Float32Array(N).fill(1)

/* ─────────────── instrumentos ─────────────── */

function kick(t0, vel = 1) {
  const s0 = Math.round(t0 * SR)
  const len = Math.round(0.5 * SR)
  let ph = 0
  for (let i = 0; i < len && s0 + i < N; i++) {
    const t = i / SR
    const f = 46 + 110 * Math.exp(-t * 28)
    ph += f / SR
    const env = Math.exp(-t * 9)
    const click = i < 90 ? rand() * 0.25 * (1 - i / 90) : 0
    dry[s0 + i] += (Math.sin(2 * Math.PI * ph) * env + click) * 0.95 * vel
  }
  // o bumbo empurra o resto para baixo: é o que faz a faixa respirar
  for (let i = 0; i < Math.round(0.4 * SR) && s0 + i < N; i++) {
    duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.6 * Math.exp(-(i / SR) * 9))
  }
}

function hat(t0, vel = 1, open = false) {
  const s0 = Math.round(t0 * SR)
  const decay = open ? 22 : 70
  const len = Math.round((open ? 0.22 : 0.07) * SR)
  let p1 = 0
  let p2 = 0
  for (let i = 0; i < len && s0 + i < N; i++) {
    const x = rand()
    const h1 = x - p1; p1 = x            // duas derivadas: só sobra agudo
    const h2 = h1 - p2; p2 = h1
    dry[s0 + i] += h2 * Math.exp(-(i / SR) * decay) * 0.07 * vel
  }
}

function clap(t0) {
  const s0 = Math.round(t0 * SR)
  const len = Math.round(0.3 * SR)
  let lp = 0
  let prev = 0
  for (let i = 0; i < len && s0 + i < N; i++) {
    const t = i / SR
    // três estalos curtos e uma cauda, como mãos que não batem juntas
    const burst = t < 0.03 ? Math.exp(-((t % 0.01) * 300)) : Math.exp(-(t - 0.03) * 16)
    const x = rand()
    lp += (x - lp) * 0.35
    const bp = lp - prev; prev = lp
    const v = bp * burst * 0.5
    dry[s0 + i] += v
    send[s0 + i] += v * 0.35
  }
}

function bass(t0, midi, dur) {
  const s0 = Math.round(t0 * SR)
  const len = Math.round(dur * SR)
  const f = hz(midi)
  let ph = 0
  let lp1 = 0
  let lp2 = 0
  for (let i = 0; i < len + 400 && s0 + i < N; i++) {
    const t = i / SR
    ph = (ph + f / SR) % 1
    const saw = 2 * ph - 1 - polyblep(ph, f / SR)
    const cut = 140 + 700 * Math.exp(-t * 18)
    const a = 1 - Math.exp(-2 * Math.PI * cut / SR)
    lp1 += (saw - lp1) * a
    lp2 += (lp1 - lp2) * a
    const sub = Math.sin(2 * Math.PI * ph)
    const env = Math.min(1, i / 60) * (i < len ? 1 : Math.max(0, 1 - (i - len) / 400))
    pumped[s0 + i] += (lp2 * 0.55 + sub * 0.45) * env * 0.42
  }
}

function pad(t0, notes, dur) {
  const s0 = Math.round(t0 * SR)
  const len = Math.round(dur * SR)
  const fade = Math.round(0.06 * SR)
  for (const m of notes) {
    for (const det of [-0.07, 0.07]) {
      const f = hz(m) * Math.pow(2, det / 12)
      let ph = rand() * 0.5 + 0.5
      let lp1 = 0
      let lp2 = 0
      const a = 1 - Math.exp(-2 * Math.PI * 900 / SR)
      for (let i = 0; i < len && s0 + i < N; i++) {
        ph = (ph + f / SR) % 1
        const saw = 2 * ph - 1 - polyblep(ph, f / SR)
        lp1 += (saw - lp1) * a
        lp2 += (lp1 - lp2) * a
        const env = Math.min(1, i / fade, (len - i) / fade)
        const v = lp2 * env * 0.035
        pumped[s0 + i] += v
        send[s0 + i] += v * 0.6
      }
    }
  }
}

function lead(t0, midi, dur) {
  const s0 = Math.round(t0 * SR)
  const len = Math.round(dur * 0.88 * SR)
  const rel = Math.round(0.09 * SR)
  const f0 = hz(midi)
  let ph = 0
  let ph2 = 0.3
  let lp1 = 0
  let lp2 = 0
  for (let i = 0; i < len + rel && s0 + i < N; i++) {
    const t = i / SR
    // vibrato só depois do ataque, como uma voz que se firma na nota
    const vib = t > 0.16 ? Math.sin(2 * Math.PI * 5.2 * t) * 0.12 * Math.min(1, (t - 0.16) * 5) : 0
    const f = f0 * Math.pow(2, vib / 12)
    ph = (ph + f / SR) % 1
    ph2 = (ph2 + f * 1.004 / SR) % 1
    const saw = 2 * ph - 1 - polyblep(ph, f / SR)
    const saw2 = 2 * ph2 - 1 - polyblep(ph2, f / SR)
    const cut = 900 + 2600 * Math.exp(-t * 7)
    const a = 1 - Math.exp(-2 * Math.PI * cut / SR)
    const x = saw * 0.6 + saw2 * 0.4
    lp1 += (x - lp1) * a
    lp2 += (lp1 - lp2) * a
    const atk = Math.min(1, i / (0.006 * SR))
    const dec = 0.62 + 0.38 * Math.exp(-t * 6)
    const off = i < len ? 1 : 1 - (i - len) / rel
    const v = lp2 * atk * dec * off * 0.34
    dry[s0 + i] += v
    send[s0 + i] += v * 0.55
  }
}

/* ─────────────── arranjo ─────────────── */

const lrc = []
let bar = 0
for (const sec of FORM) {
  const n = sec.bars || 8
  for (let b = 0; b < n; b++) {
    const t = (bar + b) * BAR
    const chord = sec.kind === 'outro' ? ['Dm', 'C', 'Dm', 'Dm'][b] : PROG[b % 8]
    const full = sec.kind === 'verse' || sec.kind === 'chorus'

    // o bumbo entra no primeiro tempo e só some nos dois últimos compassos
    const kickOn = !(sec.kind === 'outro' && b >= 2)
    for (let k = 0; k < 4; k++) {
      if (kickOn) kick(t + k * BEAT, sec.kind === 'intro' && b < 2 ? 0.85 : 1)
      const hatsOn = full || (sec.kind === 'intro' && b >= 2) || (sec.kind === 'outro' && b < 2)
      if (hatsOn) {
        hat(t + k * BEAT + EIGHTH, 1, sec.kind === 'chorus' && k % 2 === 1)
        if (sec.kind === 'chorus') {
          hat(t + k * BEAT + EIGHTH / 2, 0.45)
          hat(t + k * BEAT + EIGHTH * 1.5, 0.45)
        }
      }
      if (sec.kind === 'chorus' && (k === 1 || k === 3)) clap(t + k * BEAT)
      // baixo no contratempo: o bumbo fica com o tempo, o baixo com o "e"
      const bassOn = full || (sec.kind === 'intro' && b >= 2) || (sec.kind === 'outro' && b < 3)
      if (bassOn) bass(t + k * BEAT + EIGHTH, ROOT[chord], EIGHTH * 0.8)
    }
    pad(t, CHORDS[chord], BAR)

    if (sec.melody) {
      let at = t
      for (const [m, d] of sec.melody[b]) {
        lead(at, m, d * EIGHTH)
        at += d * EIGHTH
      }
      // uma linha a cada dois compassos, no instante da primeira nota
      if (b % 2 === 0) lrc.push({ t, text: sec.lyrics[b / 2] })
    }
  }
  if (sec.kind === 'outro') lrc.push({ t: bar * BAR, text: '' })
  bar += n
}
const END = bar * BAR

/* ─────────────── efeitos e mixagem ─────────────── */

// eco de colcheia pontuada, com agudo amortecido a cada volta
const fx = new Float32Array(N)
{
  const d = Math.round(EIGHTH * 1.5 * SR)
  const buf = new Float32Array(N)
  let lp = 0
  for (let i = 0; i < N; i++) {
    const back = i >= d ? buf[i - d] : 0
    lp += (back - lp) * 0.45
    buf[i] = send[i] + lp * 0.38
    fx[i] += lp * 0.5
  }
}
// reverb pequena: quatro pentes e dois passa-tudo (Schroeder)
{
  const combs = [1557, 1617, 1491, 1422].map((n) => ({ n, buf: new Float32Array(n), i: 0, lp: 0 }))
  const aps = [225, 556].map((n) => ({ n, buf: new Float32Array(n), i: 0 }))
  for (let i = 0; i < N; i++) {
    const x = send[i] * 0.3
    let y = 0
    for (const c of combs) {
      const o = c.buf[c.i]
      c.lp += (o - c.lp) * 0.3
      c.buf[c.i] = x + c.lp * 0.82
      c.i = (c.i + 1) % c.n
      y += o
    }
    for (const a of aps) {
      const o = a.buf[a.i]
      const v = y + o * 0.5
      a.buf[a.i] = v
      a.i = (a.i + 1) % a.n
      y = o - v * 0.5
    }
    fx[i] += y * 0.35
  }
}

const mix = new Float32Array(N)
let peak = 0
for (let i = 0; i < N; i++) {
  const t = i / SR
  // entra e sai em fade: 1,5 s no começo, os dois últimos compassos no fim
  const fadeIn = Math.min(1, t / 1.5)
  const fadeOut = t < END - BAR * 2 ? 1 : Math.max(0, 1 - (t - (END - BAR * 2)) / (BAR * 2 + TAIL * 0.5))
  const v = (dry[i] + pumped[i] * duck[i] + fx[i]) * fadeIn * fadeOut
  mix[i] = Math.tanh(v * 1.15)
  peak = Math.max(peak, Math.abs(mix[i]))
}
const gain = 0.89 / peak   // -1 dBFS

/* ─────────────── arquivos ─────────────── */

mkdirSync(OUT, { recursive: true })
const wavPath = join(OUT, 'demo-track.wav')
{
  const pcm = Buffer.alloc(44 + N * 2)
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 2, 4); pcm.write('WAVE', 8)
  pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22)
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34)
  pcm.write('data', 36); pcm.writeUInt32LE(N * 2, 40)
  for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * gain)) * 32767), 44 + i * 2)
  writeFileSync(wavPath, pcm)
}

const meta = ['-metadata', 'title=Drunken Sailor', '-metadata', 'artist=Trad. — arr. Noise demo',
  '-metadata', 'album=Noise · demo', '-metadata', 'copyright=CC0 1.0 — public domain']
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', ...meta, join(OUT, 'demo-track.mp3')])
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-c:a', 'libvorbis', '-q:a', '3', ...meta, join(OUT, 'demo-track.ogg')])
rmSync(wavPath)

const stamp = (t) => {
  const cs = Math.round(t * 100)
  const mm = String(Math.floor(cs / 6000)).padStart(2, '0')
  const ss = String(Math.floor((cs % 6000) / 100)).padStart(2, '0')
  return `[${mm}:${ss}.${String(cs % 100).padStart(2, '0')}]`
}
const lrcText = [
  '[ti:Drunken Sailor]',
  '[ar:Traditional]',
  '[al:Noise · demo]',
  `[length:${stamp(N / SR).slice(1, -1)}]`,
  ...lrc.map((l) => `${stamp(l.t)}${l.text}`),
  '',
].join('\n')
writeFileSync(join(OUT, 'demo-track.lrc'), lrcText)

writeFileSync(join(OUT, 'demo-track.json'), JSON.stringify({
  title: 'Drunken Sailor',
  artist: 'Traditional',
  album: 'Noise · demo',
  durationMs: Math.round((N / SR) * 1000),
  bpm: BPM,
  cover: 'demo-cover.svg',
  lrc: 'demo-track.lrc',
  license: 'Melody and lyrics: traditional, public domain. Arrangement and recording: CC0 1.0.',
}, null, 2) + '\n')

console.log(`${bars} compassos, ${(N / SR).toFixed(2)} s, ${lrc.length} linhas de letra`)
