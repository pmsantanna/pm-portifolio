export default function ThemeSwitch({ theme, onToggle }) {
  return (
    <div className="theme-switch" role="group" aria-label="Theme switch">
      <button
        className={theme === 'noir' ? 'active' : 'inactive'}
        onClick={() => theme !== 'noir' && onToggle()}
        aria-pressed={theme === 'noir'}
      >
        Noir
      </button>
      <span className="sep">───</span>
      <button
        className={theme === 'holo' ? 'active' : 'inactive'}
        onClick={() => theme !== 'holo' && onToggle()}
        aria-pressed={theme === 'holo'}
      >
        Holo
      </button>
    </div>
  )
}
