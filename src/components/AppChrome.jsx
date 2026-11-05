import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Dumbbell,
  History,
  Settings,
  ShieldCheck,
  Utensils,
} from 'lucide-react'

export const NAV_ITEMS = [
  { id: 'train', label: 'Train', icon: Dumbbell },
  { id: 'routines', label: 'Routines', icon: ClipboardList },
  { id: 'history', label: 'History', icon: History },
  { id: 'library', label: 'Exercises', icon: BookOpen },
  { id: 'nutrition', label: 'Protein', icon: Utensils },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
]

export function Brand({ compact = false }) {
  return (
    <div className={'brand ' + (compact ? 'brand--compact' : '')}>
      <span className="brand-mark"><span /></span>
      <span className="brand-copy">
        <strong>OPEN</strong>
        <b>WORKOUT</b>
      </span>
    </div>
  )
}

export function Sidebar({ view, navigate, activeWorkout, openSettings }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav className="side-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const selected = view === item.id
          return (
            <button
              key={item.id}
              className={'side-nav-item ' + (selected ? 'is-active' : '')}
              onClick={() => navigate(item.id)}
            >
              <Icon size={19} strokeWidth={selected ? 2.4 : 1.8} />
              <span>{item.label}</span>
              {item.id === 'train' && activeWorkout && <i className="live-dot" />}
            </button>
          )
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <div>
            <strong>Saved on this device</strong>
            <span>No account, no sync</span>
          </div>
        </div>
        <button className="side-nav-item" onClick={openSettings}>
          <Settings size={19} strokeWidth={1.8} />
          <span>Settings & data</span>
        </button>
        <div className="sidebar-signature">SATYAM.LOL</div>
      </div>
    </aside>
  )
}

export function MobileTopBar({ openSettings, openSession, activeWorkout }) {
  return (
    <header className="mobile-topbar">
      <Brand compact />
      <div className="mobile-topbar-actions">
        {activeWorkout && (
          // Back to the session from any tab, the way a call banner works.
          <button className="mobile-live" onClick={openSession}><i /> In session</button>
        )}
        <button className="icon-button" onClick={openSettings} aria-label="Open settings">
          <Settings size={20} />
        </button>
      </div>
    </header>
  )
}

export function MobileNav({ view, navigate, activeWorkout }) {
  return (
    <nav className="mobile-nav" aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const selected = view === item.id
        return (
          <button
            key={item.id}
            className={selected ? 'is-active' : ''}
            onClick={() => navigate(item.id)}
          >
            <span className="mobile-nav-icon">
              <Icon size={20} strokeWidth={selected ? 2.5 : 1.9} />
              {item.id === 'train' && activeWorkout && <i className="nav-live-dot" />}
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function ViewHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="view-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function EmptyState({ icon: Icon, title, body, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <span><Icon size={27} /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button className="button button--dark" onClick={onAction}>{actionLabel}</button>
    </div>
  )
}

export function FeatureLoader({ compact = false }) {
  return (
    <div className={'feature-loader ' + (compact ? 'feature-loader--compact' : '')} role="status">
      <span />
      <p>Loading…</p>
    </div>
  )
}
