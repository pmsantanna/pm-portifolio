// estilos da cena do Noise: viajam no chunk lazy, junto com a cena
const css = `
.noise-scene { justify-content: center; padding: 12vh 5vw; min-height: 100vh; }
.noise-wrap { max-width: 1120px; width: 100%; }

.noise-dock {
  display: grid;
  grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.5fr);
  gap: 56px;
  align-items: center;
}

/* ── texto ── */
.noise-title {
  font-size: clamp(2.2rem, 4.4vw, 3.4rem);
  font-weight: 300;
  letter-spacing: -0.02em;
  line-height: 1;
}
.noise-tagline {
  margin: 14px 0 26px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink);
}
.noise-copy .action { font-size: 15px; line-height: 1.9; }
.noise-notes {
  list-style: none;
  margin-top: 24px;
  display: grid;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  line-height: 1.7;
  color: var(--dim);
}
.noise-notes li::before { content: "— "; color: var(--faint); }
.noise-copy .scene-links { flex-wrap: wrap; row-gap: 18px; margin-top: 34px; }
.noise-soon {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--faint);
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--line);
  cursor: default;
}
.noise-copy .tags { margin-top: 30px; }
.noise-credit {
  margin-top: 26px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  line-height: 1.8;
  color: var(--dim);
  opacity: 0.8;
}

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ── a tela: um desktop escuro, o widget no canto como no Windows ──
   escura nos dois temas: é um monitor, não a página */
.noise-screen {
  --void: #0b0c0e;
  --hairline: rgba(220, 230, 234, 0.10);
  --ash: #6f7479;
  --mercury: #dce6ea;

  position: relative;
  height: 560px;
  border-radius: 12px;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 18% 12%, #17181b 0%, transparent 60%),
    radial-gradient(90% 80% at 90% 100%, #121316 0%, transparent 70%),
    #08090a;
  /* no Noir o fundo do site é quase o da tela: o fio claro é o que separa */
  box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(232,230,225,0.09);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 300;
  color: var(--mercury);
  transition: box-shadow 0.9s ease;
}
.serra.holo .noise-screen {
  box-shadow: 0 24px 64px rgba(60,58,80,0.24), 0 0 0 0.5px rgba(0,0,0,0.08);
}
.serra.holo .noise-screen::after {
  /* o mesmo fio de foil dos cards, no topo do monitor */
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, #8fa6ff, #ff9ddb, #7fe9c3, #a894ff);
}
.noise-screen.dropping { box-shadow: inset 0 0 0 1px rgba(220, 230, 234, 0.4), 0 24px 64px rgba(0,0,0,0.7); }

.noise-taskbar {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 30px;
  background: rgba(20, 21, 24, 0.86);
  border-top: 1px solid rgba(220, 230, 234, 0.06);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 14px;
}
.noise-tray { display: flex; gap: 8px; }
.noise-tray i {
  display: block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(220, 230, 234, 0.22);
}
.noise-tray i:last-child { background: rgba(220, 230, 234, 0.5); }

/* ── now playing + letra, à esquerda do widget ── */
.noise-side {
  position: absolute;
  left: 20px;
  top: 20px;
  right: 356px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.noise-np {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--hairline);
  border-radius: 10px;
  background: rgba(16, 17, 20, 0.72);
}
.noise-cover {
  width: 52px; height: 52px;
  flex-shrink: 0;
  border-radius: 6px;
  display: block;
}
.noise-cover-blank {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hairline);
  color: var(--ash);
  font-size: 18px;
}
.noise-np-text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.noise-np-title {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--mercury);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.noise-np-sub {
  font-size: 8.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ash);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.noise-np-bar {
  display: block;
  height: 2px;
  margin-top: 3px;
  background: var(--hairline);
  overflow: hidden;
}
.noise-np-fill {
  display: block;
  height: 100%;
  background: var(--mercury);
  transform-origin: left;
  transform: scaleX(0);
}
.noise-np-meta { display: flex; align-items: center; gap: 10px; margin-top: 3px; }
.noise-np-meta .noise-np-bar { flex: 1; margin-top: 0; }
.noise-np-clock {
  font-size: 8.5px;
  letter-spacing: 0.08em;
  color: var(--ash);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.noise-np-back {
  align-self: center;
  appearance: none;
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  color: var(--ash);
  font: inherit;
  font-size: 8px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.noise-np-back:hover { color: var(--mercury); }
.noise-np-back:focus-visible { outline: 1px solid var(--mercury); outline-offset: 2px; }

/* a letra: a mesma janela fixa do app, a ativa sempre na mesma altura */
.noise-lyrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 6px;
}
.noise-lyrics .lyr-linha {
  /* duas linhas de altura fixa: uma frase longa quebra sem empurrar as
     outras de lugar a cada troca */
  min-height: 2.9em;
  font-size: 12.5px;
  line-height: 1.45;
  letter-spacing: 0.02em;
  color: var(--ash);
  opacity: 0.45;
  transition: opacity 0.25s ease, color 0.25s ease;
}
.noise-lyrics .lyr-ativa {
  color: var(--mercury);
  opacity: 1;
  font-weight: 400;
  font-size: 15px;
}

/* ── o widget: réplica da janela do app ── */
.noise-widget {
  position: absolute;
  right: 18px;
  bottom: 46px;
  width: 320px;
  height: 440px;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(11, 12, 14, 0.55);
  box-shadow: 0 0 0 1px rgba(220, 230, 234, 0.05), 0 18px 40px rgba(0, 0, 0, 0.45);
  outline: none;
  overflow: hidden;
}
.noise-widget:focus-visible { box-shadow: 0 0 0 1px var(--mercury), 0 18px 40px rgba(0, 0, 0, 0.45); }

.noise-stage { position: relative; flex: 1; min-height: 0; display: flex; }
.noise-orb { flex: 1; min-width: 0; }
.noise-orb canvas { display: block; }
.noise-fallback { display: block; width: 62%; margin: 12% auto 0; opacity: 0.8; border-radius: 50%; }

.noise-notice {
  /* no pé do palco do orbe, acima da leitura: sobre a esfera o texto se
     mistura com a malha */
  position: absolute;
  left: 0; right: 0;
  bottom: 4px;
  padding: 0 30px;
  text-align: center;
  font-size: 9.5px;
  line-height: 1.9;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ash);
  pointer-events: none;
}

.noise-readout {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  padding: 0 16px 8px;
  font-size: 9px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ash);
}
.noise-readout .name {
  color: var(--mercury);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.noise-readout .hz { flex-shrink: 0; font-variant-numeric: tabular-nums; }

.noise-bars { display: block; height: 34px; width: calc(100% - 32px); margin: 0 16px; }

.noise-skin {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 0;
  font-size: 8px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ash);
}
.noise-skin select {
  appearance: none;
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  color: var(--ash);
  font: inherit;
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 3px 8px;
  opacity: 0.6;
}
.noise-skin span { margin-left: auto; opacity: 0.6; }

.noise-controls {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--hairline);
}
.noise-btn {
  flex: 1;
  appearance: none;
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  color: var(--ash);
  font: inherit;
  font-size: 8.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 7px 0;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.18s ease, border-color 0.18s ease;
}
.noise-btn:hover { color: var(--mercury); border-color: rgba(220, 230, 234, 0.28); }
.noise-btn:focus-visible { outline: 1px solid var(--mercury); outline-offset: 2px; }
.noise-btn[aria-pressed='true'] { color: var(--mercury); border-color: rgba(220, 230, 234, 0.34); }

@media (max-width: 1180px) {
  .noise-dock { grid-template-columns: 1fr; gap: 40px; }
}

/* ── celular: o widget no meio, a 280 px; letra embaixo; texto depois ── */
@media (max-width: 767px) {
  .noise-scene { padding: 10vh 16px; }
  .noise-dock { gap: 34px; }
  .noise-screen {
    order: -1;
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 18px 14px 44px;
  }
  .noise-widget {
    position: relative;
    right: auto; bottom: auto;
    width: 280px;
    height: 390px;
  }
  .noise-side {
    position: static;
    width: 100%;
    max-width: 320px;
    order: 2;
    gap: 12px;
  }
  .noise-lyrics { text-align: center; }
  .noise-lyrics .lyr-ativa { font-size: 13.5px; }
  .noise-btn { font-size: 7.5px; letter-spacing: 0.1em; }
  .noise-readout { font-size: 8px; letter-spacing: 0.18em; padding: 0 12px 7px; }
  .noise-bars { height: 28px; width: calc(100% - 24px); margin: 0 12px; }
  .noise-notice { font-size: 8.5px; padding: 0 22px; }
}

@media (prefers-reduced-motion: reduce) {
  .noise-lyrics .lyr-linha, .noise-btn { transition: none; }
}
`

export default css
