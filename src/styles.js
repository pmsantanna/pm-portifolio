const css = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400&family=JetBrains+Mono:wght@300;400&display=swap');

:root {
  --bg: #0a0a0a;
  --ink: #e8e6e1;
  --dim: #83817b;
  --faint: #3d3d3a;
  --line: #1c1c1b;
  --card-bg: rgba(10,10,10,0.82);
  --holo: linear-gradient(115deg, #a7b8ff 0%, #ffb3e2 26%, #b9ffe4 52%, #cdb8ff 74%, #a7d8ff 100%);
  /* cromado: espectro intercalado com pratas, como foil de verdade */
  --holo-chrome: linear-gradient(105deg,
    #8fa6ff 0%, #e9eaf2 16%, #ff9ddb 32%, #f0f1f6 48%,
    #7fe9c3 62%, #e7e7f1 76%, #a894ff 90%, #9cd2ff 100%);
}

/* ── HOLO: foil holográfico sobre pérola fria ── */
.serra.holo {
  --bg: #f0f0f3;
  --ink: #1e1e26;
  --dim: #73737f;
  --faint: #bfbfca;
  --line: #dcdce5;
  --card-bg: rgba(247,247,251,0.82);
}
.serra.holo::before {
  /* brilho de foil pegando luz, entre o 3D e o conteúdo */
  content: "";
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: var(--holo);
  background-size: 280% 280%;
  mix-blend-mode: soft-light;
  opacity: 0.6;
  animation: holo-shift 22s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .serra.holo::before { animation: none; }
}

* { margin: 0; padding: 0; box-sizing: border-box; }

.serra {
  background: var(--bg);
  color: var(--ink);
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 300;
  position: relative;
  -webkit-font-smoothing: antialiased;
  transition: background 0.9s ease, color 0.9s ease;
}
.serra ::selection { background: var(--ink); color: var(--bg); }

.scene-mount {
  position: fixed; inset: 0;
  z-index: 1;
}

.grain-canvas {
  position: fixed; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 60;
  opacity: 0.08;
  mix-blend-mode: screen;
}
.serra.holo .grain-canvas {
  /* neblina prismática: pastéis quase brancos em multiply, bem discretos */
  mix-blend-mode: multiply;
  opacity: 0.3;
}
.scanline {
  position: fixed; left: 0; right: 0; top: 0;
  height: 2px;
  background: rgba(232,230,225,0.045);
  z-index: 61;
  pointer-events: none;
  animation: scan 13s linear infinite;
}
.serra.holo .scanline {
  background: linear-gradient(90deg,
    rgba(143,166,255,0.10), rgba(255,157,219,0.10),
    rgba(127,233,195,0.10), rgba(168,148,255,0.10));
}
@keyframes scan { from { transform: translateY(-2px); } to { transform: translateY(100vh); } }
.vignette {
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 59;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.62) 100%);
  transition: background 0.9s ease;
}
.serra.holo .vignette {
  /* bloom pálido nas bordas, em vez de sombra */
  background: radial-gradient(ellipse at center, transparent 52%, rgba(255,255,255,0.55) 100%);
}
@media (prefers-reduced-motion: reduce) {
  .scanline { animation: none; opacity: 0; }
}

.frame-ui {
  position: fixed; inset: 0;
  z-index: 55;
  pointer-events: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.3em;
  color: var(--faint);
  text-transform: uppercase;
}
.frame-ui .tl { position: absolute; top: 22px; left: 26px; }
.frame-ui .tr { position: absolute; top: 22px; right: 26px; text-align: right; }
.frame-ui .bl { position: absolute; bottom: 22px; left: 26px; }
.frame-ui .br { position: absolute; bottom: 22px; right: 26px; text-align: right; }
.frame-ui .rec { color: var(--dim); }
.frame-ui .rec::before {
  content: "";
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--dim);
  margin-right: 10px;
  vertical-align: 1px;
  animation: blink 2.6s ease-in-out infinite;
}
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.15; } }
@media (prefers-reduced-motion: reduce) { .frame-ui .rec::before { animation: none; } }

.reel { position: relative; z-index: 10; }

.title-card {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  text-align: center;
  padding-bottom: 16vh;
}
.title-card .presents {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 34px;
}
.title-card h1 {
  font-size: clamp(2.6rem, 7.5vw, 6rem);
  font-weight: 300;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  line-height: 1.1;
  text-indent: 0.28em;
  color: var(--ink);
  text-shadow: 0 0 60px rgba(0,0,0,0.9);
}
.serra.holo .title-card h1 {
  /* cromado iridescente — a assinatura do modo holo */
  background: var(--holo-chrome);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: none;
  filter: drop-shadow(0 2px 22px rgba(140,140,190,0.35));
  animation: holo-shift 11s ease-in-out infinite;
}
@keyframes holo-shift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@media (prefers-reduced-motion: reduce) { .serra.holo .title-card h1 { animation: none; } }
.title-card .role {
  margin-top: 30px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.46em;
  text-transform: uppercase;
  color: var(--dim);
  text-indent: 0.46em;
}
.title-card .down {
  margin-top: 9vh;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--faint);
  animation: sink 4s ease-in-out infinite;
}
@keyframes sink { 0%,100% { transform: translateY(0); opacity: 0.55; } 50% { transform: translateY(8px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .title-card .down { animation: none; } }

.scene {
  min-height: 88vh;
  display: flex;
  align-items: center;
  padding: 12vh 8vw;
}
.scene-inner {
  max-width: 640px;
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 1.6s ease, transform 1.6s ease;
}
.scene-inner.on { opacity: 1; transform: translateY(0); }
@media (prefers-reduced-motion: reduce) {
  .scene-inner { opacity: 1; transform: none; transition: none; }
}
.scene.right { justify-content: flex-end; }

.slug {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--dim);
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 34px;
}
.slug b { font-weight: 400; color: var(--ink); }

.action {
  font-size: 16px;
  line-height: 2;
  color: var(--dim);
  letter-spacing: 0.01em;
}
.action strong { font-weight: 400; color: var(--ink); }

.scene-links {
  display: flex;
  gap: 40px;
  margin-top: 44px;
}
.scene-links a {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink);
  text-decoration: none;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--faint);
  transition: border-color 0.6s ease;
}
.scene-links a:hover, .scene-links a:focus-visible { border-color: var(--ink); outline: none; }

.still {
  border: 1px solid var(--line);
  background: var(--card-bg);
  backdrop-filter: blur(2px);
  padding: 50px 54px;
  position: relative;
  transition: border-color 0.9s ease, background 0.9s ease;
}
.still:hover { border-color: var(--faint); }
.serra.holo .still::after {
  /* fio de foil só no topo — border-image pintava os 4 lados */
  content: "";
  position: absolute;
  top: -1px; left: -1px; right: -1px;
  height: 1px;
  background: linear-gradient(90deg, #8fa6ff, #ff9ddb, #7fe9c3, #a894ff);
}
.serra.holo .still:hover {
  border-color: var(--faint);
  box-shadow: 0 18px 50px rgba(150,150,200,0.16);
}
.still .take {
  position: absolute;
  top: 18px; right: 22px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.3em;
  color: var(--faint);
}
.still h3 {
  font-size: clamp(1.8rem, 3.4vw, 2.6rem);
  font-weight: 300;
  letter-spacing: -0.02em;
}
.still p {
  margin-top: 20px;
  font-size: 15px;
  line-height: 1.9;
  color: var(--dim);
}
.tags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
.tags span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--dim);
  border: 1px solid var(--line);
  padding: 7px 14px;
}

.credits {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 16vh 8vw;
  gap: 52px;
}
.credit {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 1.8s ease, transform 1.8s ease;
}
.credit.on { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .credit { opacity: 1; transform: none; transition: none; } }
.credit .k {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.44em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 14px;
}
.credit .v {
  font-size: 15px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink);
}
.credit .v.big { font-size: clamp(1.4rem, 3vw, 2rem); letter-spacing: 0.3em; }
.credits .fin {
  margin-top: 6vh;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.6em;
  color: var(--dim);
  text-indent: 0.6em;
}

@media (max-width: 700px) {
  .scene { padding: 12vh 7vw; }
  .still { padding: 34px 26px; }
  .frame-ui .bl, .frame-ui .tr { display: none; }
}

/* ─────────── DataBridge dock (terminal + card, estilo documentação) ─────────── */

.db-scene { justify-content: center; padding: 12vh 5vw; }
.db-wrap { max-width: 1120px; width: 100%; }

.db-dock {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
  gap: 44px;
  align-items: start;
}
.db-rail {
  position: sticky;
  top: 10vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* take secundário: mesmo vocabulário, hierarquia menor */
.db-card.sub { padding: 32px 36px; }
.db-card.sub h3 { font-size: clamp(1.2rem, 2vw, 1.5rem); }
.db-card.sub p { font-size: 13.5px; margin-top: 14px; }
.db-card.sub .tags { margin-top: 22px; }
.db-card.sub .tags span { padding: 5px 11px; }

.card-link {
  display: inline-block;
  margin-top: 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid var(--faint);
  padding-bottom: 2px;
  transition: border-color 0.6s ease;
}
.card-link:hover, .card-link:focus-visible { border-color: var(--ink); outline: none; }

@media (max-width: 980px) {
  .db-dock { grid-template-columns: 1fr; gap: 30px; }
  .db-rail { order: -1; position: static; }
}

/* janela */
.db-term {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.07);
}
.serra.holo .db-term {
  box-shadow: 0 24px 64px rgba(60,58,80,0.22), 0 0 0 0.5px rgba(0,0,0,0.08);
}

/* barra de título com abas (macOS Terminal) */
.db-titlebar {
  background: #2a2a2a;
  height: 40px;
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #1a1a1a;
}
.db-lights {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  flex-shrink: 0;
}
.db-lights span {
  width: 12px; height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.5px rgba(0,0,0,0.25);
}
.db-tabs {
  display: flex;
  align-items: stretch;
  flex: 1;
  min-width: 0;
}
.db-tabs button {
  flex: 1;
  min-width: 0;
  border: none;
  background: #242424;
  color: #666;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  font-size: 11.5px;
  letter-spacing: 0.01em;
  cursor: pointer;
  border-left: 1px solid #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 14px;
  transition: background 0.25s ease, color 0.25s ease;
}
.db-tabs button:hover { color: #999; }
.db-tabs button.active {
  background: #1e1e1e;
  color: #c9c6bf;
}

/* corpo */
.db-body {
  background: #1e1e1e;
  padding: 16px 20px 20px;
  height: 380px;
  overflow-y: auto;
  overscroll-behavior: contain;
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  font-size: 12px;
  line-height: 1.65;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: #3d3d3d transparent;
}
/* WebKit/Blink */
.db-body::-webkit-scrollbar {
  width: 8px;
}
.db-body::-webkit-scrollbar-track {
  background: transparent;
}
.db-body::-webkit-scrollbar-thumb {
  background: #3d3d3d;
  border-radius: 4px;
  border: 2px solid #1e1e1e; /* respiro, deixa o thumb mais fino */
}
.db-body::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* rodapé */
.db-footer {
  background: #252525;
  border-top: 1px solid #1a1a1a;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.db-footer button {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 11px;
  background: #3a3a3a;
  border: none;
  color: #aaa;
  padding: 5px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.db-footer button:disabled { opacity: 0.4; cursor: default; }
.db-footer .db-shell {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 11px;
  color: #444;
  margin-left: auto;
}

/* cores compartilhadas do terminal */
.tc-g { color: #28c840; }
.tc-b { color: #85B7EB; }
.tc-y { color: #ffbd2e; }
.tc-r { color: #ff5f57; }
.tc-d { color: #555; }
.tc-m { color: #888; }
.tc-w { color: #e8e6e1; }
.pq-d { color: #555; }
.pq-c { color: #c9c6bf; }
.tc-line { display: block; white-space: pre-wrap; min-height: 1em; }

/* ─────────── HOLO · Terminal claro (perfil Basic do macOS) ─────────── */

.db-titlebar, .db-tabs button, .db-body, .db-footer, .db-footer button {
  transition: background 0.9s ease, color 0.9s ease, border-color 0.9s ease;
}

.serra.holo .db-titlebar {
  background: linear-gradient(#eeeef0, #dfdfe3);
  border-bottom: 1px solid #c6c6cc;
}
.serra.holo .db-tabs button {
  background: #d7d7dc;
  color: #7c7c85;
  border-left: 1px solid #c6c6cc;
}
.serra.holo .db-tabs button:hover { color: #55555e; }
.serra.holo .db-tabs button.active {
  background: #ffffff;
  color: #26262c;
}
.serra.holo .db-body {
  background: #ffffff;
  scrollbar-color: #c9c9d0 transparent;
}
.serra.holo .db-body::-webkit-scrollbar-thumb {
  background: #c9c9d0;
  border-color: #ffffff;
}
.serra.holo .db-body::-webkit-scrollbar-thumb:hover { background: #a9a9b2; }
.serra.holo .db-footer {
  background: #ececef;
  border-top: 1px solid #d3d3d9;
}
.serra.holo .db-footer button {
  background: #ffffff;
  color: #444;
  box-shadow: 0 0 0 1px #cfcfd6;
}
.serra.holo .db-footer .db-shell { color: #9a9aa2; }

/* cores do texto: tinta escura sobre papel */
.serra.holo .tc-w { color: #1e1e26; }
.serra.holo .tc-g { color: #1e9e33; }
.serra.holo .tc-y { color: #b07800; }
.serra.holo .tc-r { color: #e0443e; }
.serra.holo .tc-b { color: #2f6bbf; }
.serra.holo .tc-m { color: #6e6d78; }
.serra.holo .tc-d { color: #9a99a3; }
.serra.holo .pq-c { color: #1e1e26; }
.serra.holo .pq-d { color: #9a99a3; }
.serra.holo .tc-cursor { background: #1e1e26; }

@keyframes tc-blink { 0%,100%{opacity:1} 50%{opacity:0} }
.tc-cursor {
  display: inline-block;
  width: 7px; height: 12px;
  background: #e8e6e1;
  vertical-align: middle;
  animation: tc-blink 1.1s step-end infinite;
}
`

export default css

export const switchCss = `
.lang-switch {
  position: fixed;
  top: 19px;
  left: 26px;
  z-index: 70;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  pointer-events: auto;
}
.lang-switch button {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  transition: color 0.4s ease;
  line-height: 1;
}
.lang-switch button.active { color: var(--ink); }
.lang-switch button.inactive { color: var(--faint); }
.lang-switch button:hover { color: var(--dim); }
.lang-switch .sep { color: var(--faint); user-select: none; }

.theme-switch {
  position: fixed;
  top: 19px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  pointer-events: auto;
}
.theme-switch button {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  transition: color 0.4s ease;
  line-height: 1;
}
.theme-switch button.active { color: var(--ink); }
.theme-switch button.inactive { color: var(--faint); }
.theme-switch button:hover { color: var(--dim); }
.theme-switch .sep { color: var(--faint); user-select: none; }
.serra.holo .theme-switch button.active {
  color: var(--ink);
  padding-bottom: 4px;
  background: linear-gradient(90deg, #8fa6ff, #ff9ddb, #7fe9c3, #a894ff) bottom / 100% 1px no-repeat;
}
@media (max-width: 700px) {
  .theme-switch { top: auto; bottom: 52px; }
}

.lang-fade {
  opacity: 0;
  transition: opacity 0.5s ease;
}
.lang-fade.on {
  opacity: 1;
}
`
