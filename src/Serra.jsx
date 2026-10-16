import { useState } from 'react';
import SerraScene from './components/SerraScene';
import DataBridgeScene from './components/DataBridgeScene';
import Grain from './components/Grain';
import Timecode from './components/Timecode';
import LangSwitch from './components/LangSwitch';
import ThemeSwitch from './components/ThemeSwitch';
import useReveal from './hooks/useReveal';
import useLocale from './hooks/useLocale';
import css, { switchCss } from './styles';

export default function Serra() {
  const { locale, t, toggle } = useLocale();
  const [visible, setVisible] = useState(true);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('serra-theme') || 'noir';
    } catch {
      return 'noir';
    }
  });

  const [s1, on1] = useReveal();
  const [c1, cOn1] = useReveal();
  const [c2, cOn2] = useReveal();
  const [c3, cOn3] = useReveal();
  const [c4, cOn4] = useReveal();

  // fade out → troca texto → fade in
  const handleToggle = () => {
    setVisible(false);
    setTimeout(() => {
      toggle();
      setVisible(true);
    }, 300);
  };

  const handleTheme = () => {
    const next = theme === 'noir' ? 'holo' : 'noir';
    setTheme(next);
    try {
      localStorage.setItem('serra-theme', next);
    } catch {}
  };

  return (
    <div className={`serra ${theme === 'holo' ? 'holo' : ''}`}>
      <style>
        {css}
        {switchCss}
      </style>

      <SerraScene theme={theme} />
      <Grain theme={theme} />
      <div className="scanline" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <LangSwitch locale={locale} onToggle={handleToggle} />
      <ThemeSwitch theme={theme} onToggle={handleTheme} />

      {/* HUD */}
      <div className="frame-ui" aria-hidden="true">
        <div className="tl rec" style={{ marginLeft: 80 }}>
          REC
        </div>
        <div className="tr">
          <Timecode />
        </div>
        <div className="bl">{t.hud.film}</div>
        <div className="br">{t.hud.location}</div>
      </div>

      <main className={`reel lang-fade ${visible ? 'on' : ''}`}>
        {/* Cartela de título */}
        <section className="title-card">
          <div className="presents">{t.tagline}</div>
          {/* <h1>
            Pedro
            <br />
            Santanna
          </h1> */}
          <div className="role">{t.role}</div>
          <div className="down" aria-hidden="true">
            {t.scrollHint}
          </div>
        </section>

        {/* Cena 001 */}
        <section className="scene">
          <div ref={s1} className={`scene-inner ${on1 ? 'on' : ''}`}>
            <div className="slug">
              <b>{t.scene1.slug}</b>
            </div>
            <p
              className="action"
              dangerouslySetInnerHTML={{ __html: t.scene1.body }}
            />
            <nav className="scene-links">
              <a
                href="https://github.com/pmsantanna"
                target="_blank"
                rel="noreferrer"
              >
                {t.scene1.github}
              </a>
              <a
                href="https://www.linkedin.com/in/pedro-miguel-santanna-8643371b7"
                target="_blank"
                rel="noreferrer"
              >
                {t.scene1.linkedin}
              </a>
            </nav>
          </div>
        </section>

        {/* Cena 002 — DataBridge: terminal com abas + card */}
        <DataBridgeScene lang={locale} t={t} />

        {/* Créditos */}
        <section className="credits">
          <div ref={c1} className={`credit ${cOn1 ? 'on' : ''}`}>
            <div className="k">{t.credits.c1k}</div>
            {/* <div className="v big">Pedro Santanna</div> */}
          </div>
          <div ref={c2} className={`credit ${cOn2 ? 'on' : ''}`}>
            <div className="k">{t.credits.c2k}</div>
            <div className="v">{t.credits.c2v}</div>
          </div>
          <div ref={c3} className={`credit ${cOn3 ? 'on' : ''}`}>
            <div className="k">{t.credits.c3k}</div>
            <div className="v">{t.credits.c3v}</div>
          </div>
          <div ref={c4} className={`credit ${cOn4 ? 'on' : ''}`}>
            <div className="k">{t.credits.c4k}</div>
            <div className="v">{t.credits.c4v}</div>
          </div>
          <div className="fin">{t.credits.fin}</div>
        </section>
      </main>
    </div>
  );
}
