import {
  Activity,
  Check,
  ChevronRight,
  Database,
  Download,
  Dumbbell,
  FileJson,
  Palette,
  ShieldCheck,
  TimerReset,
  Trash2,
  Upload,
  Volume2,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { normalizeTheme, THEMES } from '../../data/themes.js'
import { formatDate } from '../../lib/format.js'
import { SheetHeading } from './Sheet.jsx'

export function SettingsSheet({
  settings,
  workoutCount,
  changeUnit,
  changeDistanceUnit,
  changeTheme,
  changeRest,
  changeKeepAwake,
  changeTimerSound,
  canInstall,
  installApp,
  exportData,
  exportCsv,
  triggerImport,
  resetData,
}) {
  const [resetArmed, setResetArmed] = useState(false)
  return (
    <div className="sheet-content settings-sheet">
      <SheetHeading
        title="Settings & data"
      />

      <section className="setting-section theme-setting">
        <div className="setting-label">
          <div><Palette size={18} /><span>App theme</span></div>
          <small>Applied everywhere and saved on this device.</small>
        </div>
        <div className="theme-picker" role="radiogroup" aria-label="App theme">
          {THEMES.map((theme) => {
            const selected = normalizeTheme(settings.theme) === theme.id
            return (
              <button
                key={theme.id}
                type="button"
                className={'theme-option ' + (selected ? 'is-active' : '')}
                onClick={() => changeTheme(theme.id)}
                role="radio"
                aria-checked={selected}
              >
                <span className="theme-option-preview" aria-hidden="true">
                  {theme.swatches.map((swatch, index) => (
                    <i key={swatch} style={{ background: swatch, '--swatch-index': index }} />
                  ))}
                </span>
                <span className="theme-option-copy">
                  <strong>{theme.name}</strong>
                  <small>{theme.description}</small>
                </span>
                <span className="theme-option-check" aria-hidden="true">
                  {selected && <Check size={13} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="setting-section">
        <div className="setting-label">
          <div><Dumbbell size={18} /><span>Weight unit</span></div>
          <small>Existing logs are converted automatically.</small>
        </div>
        <div className="segmented-control">
          {['kg', 'lb'].map((unit) => (
            <button
              key={unit}
              className={settings.unit === unit ? 'is-active' : ''}
              onClick={() => changeUnit(unit)}
            >
              {unit.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-section">
        <div className="setting-label">
          <div><Activity size={18} /><span>Running distance</span></div>
          <small>Run data stays precise when you switch display units.</small>
        </div>
        <div className="segmented-control">
          {['km', 'mi'].map((distanceUnit) => (
            <button
              key={distanceUnit}
              className={(settings.distanceUnit || 'km') === distanceUnit ? 'is-active' : ''}
              onClick={() => changeDistanceUnit(distanceUnit)}
            >
              {distanceUnit.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-section setting-toggle-row">
        <div className="setting-label">
          <div><Zap size={18} /><span>Keep screen awake</span></div>
          <small>Useful while a workout is running.</small>
        </div>
        <button
          className={'toggle-switch ' + (settings.keepAwake ? 'is-active' : '')}
          onClick={() => changeKeepAwake(!settings.keepAwake)}
          role="switch"
          aria-checked={Boolean(settings.keepAwake)}
        >
          <span />
        </button>
      </section>

      <section className="setting-section">
        <div className="setting-label">
          <div><TimerReset size={18} /><span>Rest timer</span></div>
          <small>Starts after you complete a set.</small>
        </div>
        <div className="rest-options">
          {[60, 90, 120, 180].map((seconds) => (
            <button
              key={seconds}
              className={settings.restSeconds === seconds ? 'is-active' : ''}
              onClick={() => changeRest(seconds)}
            >
              {seconds < 120 ? seconds + 's' : seconds / 60 + 'm'}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-section setting-toggle-row">
        <div className="setting-label">
          <div><Volume2 size={18} /><span>Timer sound</span></div>
          <small>Play a short cue when rest ends.</small>
        </div>
        <button
          className={'toggle-switch ' + (settings.timerSound ? 'is-active' : '')}
          onClick={() => changeTimerSound(!settings.timerSound)}
          role="switch"
          aria-checked={Boolean(settings.timerSound)}
        >
          <span />
        </button>
      </section>

      {canInstall && (
        <section className="data-section">
          <div className="setting-label">
            <div><Download size={18} /><span>Install OpenWorkout</span></div>
            <small>Use it full-screen like a phone app.</small>
          </div>
          <button className="button button--dark button--wide install-button" onClick={installApp}>
            <Download size={17} /> Add to this device
          </button>
        </section>
      )}

      <section className="data-section">
        <div className="setting-label">
          <div><Database size={18} /><span>Local data</span></div>
          <small>{workoutCount} workouts stored on this device.</small>
        </div>
        <div className="data-actions">
          <button onClick={exportData}>
            <span><Download size={18} /></span>
            <div>
              <strong>Export backup</strong>
              <small>
                {settings.lastBackupAt
                  ? 'Last exported ' + formatDate(settings.lastBackupAt, { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Never exported · JSON with photos'}
              </small>
            </div>
            <ChevronRight size={18} />
          </button>
          <button onClick={exportCsv}>
            <span><FileJson size={18} /></span>
            <div><strong>Export workout CSV</strong><small>Open in Sheets or Excel</small></div>
            <ChevronRight size={18} />
          </button>
          <button onClick={triggerImport}>
            <span><Upload size={18} /></span>
            <div><strong>Import backup</strong><small>Restore from a JSON file</small></div>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <div className="privacy-callout">
        <ShieldCheck size={20} />
        <div>
          <strong>Nothing leaves this device.</strong>
          <p>No account, no server, no analytics. Export a backup to move your data somewhere else.</p>
        </div>
      </div>

      {!resetArmed ? (
        <button className="reset-link" onClick={() => setResetArmed(true)}>
          <Trash2 size={16} /> Reset local data
        </button>
      ) : (
        <div className="reset-confirm">
          <p>Reset all workouts and restore the starter data?</p>
          <div>
            <button onClick={() => setResetArmed(false)}>Cancel</button>
            <button onClick={resetData}>Yes, reset</button>
          </div>
        </div>
      )}
    </div>
  )
}
