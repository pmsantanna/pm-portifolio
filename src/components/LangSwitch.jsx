export default function LangSwitch({ locale, onToggle }) {
  return (
    <div className="lang-switch" role="group" aria-label="Language switch">
      <button
        className={locale === 'pt' ? 'active' : 'inactive'}
        onClick={() => locale !== 'pt' && onToggle()}
        aria-pressed={locale === 'pt'}
      >
        PT
      </button>
      <span className="sep">───</span>
      <button
        className={locale === 'en' ? 'active' : 'inactive'}
        onClick={() => locale !== 'en' && onToggle()}
        aria-pressed={locale === 'en'}
      >
        EN
      </button>
    </div>
  )
}
