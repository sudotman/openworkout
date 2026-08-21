import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Flame,
  Info,
  Minus,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Utensils,
  X,
} from 'lucide-react'
import {
  calculateProteinRecommendation,
  FOOD_CATALOG,
  getSmartFoodSuggestions,
  localDateKey,
  MEAL_SLOTS,
  offsetDateKey,
  suggestedMealSlot,
  totalForEntries,
} from '../lib/nutrition.js'
import '../nutrition.css'

const TABS = [
  { id: 'today', label: 'Day' },
  { id: 'trends', label: 'Patterns' },
  { id: 'goal', label: 'Goal setup' },
]

const GOALS = [
  { id: 'build', label: 'Build muscle', detail: '1.8 g/kg baseline' },
  { id: 'maintain', label: 'Maintain', detail: '1.6 g/kg baseline' },
  { id: 'fat-loss', label: 'Lose fat', detail: '1.9 g/kg baseline' },
  { id: 'performance', label: 'Perform', detail: '1.7 g/kg baseline' },
]

const DIETS = [
  { id: 'omnivore', label: 'Everything' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
]

function makeId(prefix = 'nutrition') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`
}

function dateFromKey(value) {
  return new Date(`${value}T12:00:00`)
}

function friendlyDate(value) {
  const today = localDateKey()
  if (value === today) return 'Today'
  if (value === offsetDateKey(-1)) return 'Yesterday'
  return new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(dateFromKey(value))
}

function fullDate(value) {
  return new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromKey(value))
}

function numberLabel(value) {
  return Math.round(Number(value) || 0).toLocaleString('en')
}

function getMealTotal(entries, meal) {
  return totalForEntries(entries.filter((entry) => entry.meal === meal))
}

function ProteinRail({ total, target, entries }) {
  const percentage = Math.min(100, Math.round((total / target) * 100))
  const slotTotals = MEAL_SLOTS.map((slot) => getMealTotal(entries, slot.id).protein)
  let cumulative = 0

  return (
    <div className="protein-rail" aria-label={`${total} of ${target} grams of protein logged`}>
      <div className="protein-rail-track">
        <motion.span
          className="protein-rail-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
        {Array.from({ length: 20 }, (_, index) => <i key={index} />)}
      </div>
      <div className="protein-rail-stops" aria-hidden="true">
        {MEAL_SLOTS.map((slot, index) => {
          cumulative += slotTotals[index]
          const position = Math.min(98, Math.max(2, (cumulative / target) * 100))
          if (!slotTotals[index]) return null
          return (
            <span key={slot.id} style={{ left: `${position}%` }}>
              <b>{slot.label.slice(0, 1)}</b>
              <small>+{slotTotals[index]}g</small>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function DayHero({ entries, target, recommendation, onLog }) {
  const totals = totalForEntries(entries)
  const remaining = Math.max(0, target - totals.protein)
  const reached = totals.protein >= target

  return (
    <section className={`nutrition-hero ${reached ? 'is-complete' : ''}`}>
      <div className="nutrition-hero-top">
        <div>
          <span className="nutrition-kicker"><Sparkles size={12} /> DAILY PROTEIN</span>
          <div className="protein-score">
            <strong>{numberLabel(totals.protein)}</strong>
            <span>g <i>/ {target}</i></span>
          </div>
        </div>
        <div className="protein-status">
          <span>{reached ? <Check size={15} /> : <Target size={15} />}</span>
          <div>
            <strong>{reached ? 'Target reached' : `${remaining}g to go`}</strong>
            <small>{reached ? 'Anything else is a bonus.' : `Built from ${recommendation.factor.toFixed(1)}g per kg.`}</small>
          </div>
        </div>
      </div>

      <ProteinRail total={totals.protein} target={target} entries={entries} />

      <div className="nutrition-hero-foot">
        <span><Flame size={14} /> {numberLabel(totals.calories)} kcal logged</span>
        <button onClick={() => onLog(suggestedMealSlot())}><Plus size={16} /> Log food</button>
      </div>
    </section>
  )
}

function SmartSuggestions({ remaining, profile, recentFoodIds, onQuickAdd }) {
  const suggestions = getSmartFoodSuggestions(remaining, profile.diet, recentFoodIds)
  return (
    <section className="smart-suggestions">
      <div className="nutrition-section-head">
        <div>
          <span className="nutrition-kicker"><Sparkles size={12} /> SMART PICKS</span>
          <h2>{remaining > 0 ? `Easy ways to close the ${remaining}g gap` : 'Good choices for later'}</h2>
        </div>
        <small>Based on your goal and diet</small>
      </div>
      <div className="suggestion-grid">
        {suggestions.map((food, index) => (
          <button key={food.id} className="suggestion-card" onClick={() => onQuickAdd(food)}>
            <span className="food-monogram">{food.name.slice(0, 2).toUpperCase()}</span>
            <span className="suggestion-copy">
              <strong>{food.name}</strong>
              <small>{food.serving} · {food.calories} kcal</small>
            </span>
            <span className="suggestion-protein"><b>+{food.protein}</b>g</span>
            <Plus size={15} />
            {index === 0 && <i className="best-fit">BEST FIT</i>}
          </button>
        ))}
      </div>
    </section>
  )
}

function MealTimeline({ entries, onLog, onDelete }) {
  return (
    <section className="meal-timeline">
      <div className="nutrition-section-head">
        <div>
          <span className="nutrition-kicker"><Utensils size={12} /> MEALS</span>
          <h2>Your day, meal by meal</h2>
        </div>
        <span>{entries.length} {entries.length === 1 ? 'food' : 'foods'} logged</span>
      </div>

      <div className="meal-groups">
        {MEAL_SLOTS.map((slot) => {
          const items = entries.filter((entry) => entry.meal === slot.id)
          const total = getMealTotal(entries, slot.id)
          return (
            <div className={`meal-group ${items.length ? 'has-food' : ''}`} key={slot.id}>
              <div className="meal-marker"><span /></div>
              <div className="meal-group-content">
                <div className="meal-group-head">
                  <div>
                    <strong>{slot.label}</strong>
                    <small>{slot.window}</small>
                  </div>
                  <div className="meal-group-total">
                    {items.length > 0 && <span>{total.protein}g protein</span>}
                    <button onClick={() => onLog(slot.id)} aria-label={`Add food to ${slot.label}`}><Plus size={16} /></button>
                  </div>
                </div>
                {items.length > 0 ? (
                  <div className="meal-items">
                    {items.map((entry) => (
                      <div className="meal-item" key={entry.id}>
                        <span className="food-monogram food-monogram--small">{entry.name.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{entry.name}</strong>
                          <small>{entry.servings !== 1 ? `${entry.servings} × ` : ''}{entry.serving} · {entry.calories} kcal</small>
                        </div>
                        <b>{entry.protein}g</b>
                        <button className="meal-delete" onClick={() => onDelete(entry.id)} aria-label={`Remove ${entry.name}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button className="meal-empty" onClick={() => onLog(slot.id)}>Nothing logged <span>Add food</span></button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DayView({ date, entries, target, recommendation, nutrition, onLog, onQuickAdd, onDelete, onCopyYesterday }) {
  const totals = totalForEntries(entries)
  const remaining = Math.max(0, target - totals.protein)
  return (
    <div className="nutrition-day-layout">
      <div className="nutrition-day-main">
        <DayHero entries={entries} target={target} recommendation={recommendation} onLog={onLog} />
        {entries.length === 0 && (
          <button className="copy-yesterday" onClick={onCopyYesterday}>
            <CalendarDays size={18} />
            <span><strong>Start from yesterday</strong><small>Copy the same meals, then adjust what changed.</small></span>
            <ChevronRight size={17} />
          </button>
        )}
        <MealTimeline entries={entries} onLog={onLog} onDelete={onDelete} />
      </div>
      <aside className="nutrition-day-aside">
        <SmartSuggestions
          remaining={remaining}
          profile={nutrition.profile}
          recentFoodIds={nutrition.recentFoodIds}
          onQuickAdd={onQuickAdd}
        />
        <div className="nutrition-note">
          <Info size={16} />
          <p><strong>Consistency beats precision.</strong> Portions are estimates; getting within 10g of your target is a strong day.</p>
        </div>
      </aside>
    </div>
  )
}

function PatternsView({ nutrition, target }) {
  const days = Array.from({ length: 14 }, (_, index) => offsetDateKey(index - 13))
  const dayData = days.map((date) => {
    const entries = nutrition.entries.filter((entry) => entry.date === date)
    return { date, ...totalForEntries(entries), logged: entries.length > 0 }
  })
  const loggedDays = dayData.filter((day) => day.logged)
  const hitDays = dayData.filter((day) => day.protein >= target).length
  const average = loggedDays.length
    ? Math.round(loggedDays.reduce((sum, day) => sum + day.protein, 0) / loggedDays.length)
    : 0
  const consistency = loggedDays.length ? Math.round((hitDays / loggedDays.length) * 100) : 0
  const maxValue = Math.max(target, ...dayData.map((day) => day.protein), 1)
  const mealContributions = MEAL_SLOTS.map((slot) => ({
    ...slot,
    protein: nutrition.entries
      .filter((entry) => days.includes(entry.date) && entry.meal === slot.id)
      .reduce((sum, entry) => sum + (Number(entry.protein) || 0), 0),
  }))
  const anchorMeal = [...mealContributions].sort((left, right) => right.protein - left.protein)[0]

  return (
    <div className="patterns-layout">
      <section className="pattern-hero">
        <span className="nutrition-kicker"><TrendingUp size={12} /> LAST 14 DAYS</span>
        <div className="pattern-summary">
          <div><strong>{average}<small>g</small></strong><span>average on logged days</span></div>
          <div><strong>{hitDays}<small> / {loggedDays.length}</small></strong><span>targets reached</span></div>
          <div><strong>{consistency}<small>%</small></strong><span>goal consistency</span></div>
        </div>
        <div className="protein-chart" aria-label={`Protein intake over 14 days. Target ${target} grams.`}>
          <span className="chart-target" style={{ bottom: `${(target / maxValue) * 100}%` }}><i /> {target}g target</span>
          {dayData.map((day) => (
            <div className="protein-chart-day" key={day.date}>
              <div className="protein-chart-track">
                <motion.i
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.protein / maxValue) * 100}%` }}
                  transition={{ duration: 0.45 }}
                  className={day.protein >= target ? 'hit' : ''}
                />
              </div>
              <span>{new Intl.DateTimeFormat('en', { weekday: 'narrow' }).format(dateFromKey(day.date))}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pattern-insight-grid">
        <article>
          <span className="insight-icon"><CircleGauge size={20} /></span>
          <div><small>MOST CONSISTENT</small><strong>{anchorMeal.label} carries the day</strong><p>Your {anchorMeal.label.toLowerCase()} logs contribute the largest share of daily protein. Keep that anchor meal reliable.</p></div>
        </article>
        <article>
          <span className="insight-icon"><Target size={20} /></span>
          <div><small>NEXT EXPERIMENT</small><strong>Front-load 25–35g</strong><p>A stronger breakfast makes the target easier to reach without a large late meal.</p></div>
        </article>
      </section>
    </div>
  )
}

function GoalSetup({ profile, recommendation, onSave, linkedWeight }) {
  const [draft, setDraft] = useState(profile)
  const preview = calculateProteinRecommendation(draft)

  useEffect(() => setDraft(profile), [profile])

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const save = () => onSave({
    ...draft,
    weightKg: Number(draft.weightKg) || profile.weightKg,
    heightCm: Number(draft.heightCm) || profile.heightCm,
    trainingDays: Number(draft.trainingDays) || 0,
    customTarget: Number(draft.customTarget) || preview.smartTarget,
  })

  return (
    <div className="goal-layout">
      <section className="goal-form">
        <div className="nutrition-section-head">
          <div><span className="nutrition-kicker">YOUR BASELINE</span><h2>Make the target fit your life</h2></div>
        </div>
        <div className="goal-fields">
          <label>
            <span>Weight</span>
            <div><input type="number" min="35" max="250" step="0.1" value={draft.weightKg} onChange={(event) => update('weightKg', event.target.value)} /><b>kg</b></div>
            {linkedWeight && <small>Latest body measurement: {linkedWeight} kg</small>}
          </label>
          <label>
            <span>Height</span>
            <div><input type="number" min="120" max="230" value={draft.heightCm} onChange={(event) => update('heightCm', event.target.value)} /><b>cm</b></div>
            <small>Used to keep higher-weight targets sensible.</small>
          </label>
          <label>
            <span>Training days / week</span>
            <div><input type="number" min="0" max="7" value={draft.trainingDays} onChange={(event) => update('trainingDays', event.target.value)} /><b>days</b></div>
            <small>5+ days adds a small recovery buffer.</small>
          </label>
        </div>

        <fieldset className="goal-choice">
          <legend>Primary goal</legend>
          <div>
            {GOALS.map((goal) => (
              <button type="button" className={draft.goal === goal.id ? 'is-active' : ''} key={goal.id} onClick={() => update('goal', goal.id)}>
                <span>{goal.label}</span><small>{goal.detail}</small>{draft.goal === goal.id && <Check size={15} />}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="diet-choice">
          <legend>Food preference</legend>
          <div>{DIETS.map((diet) => <button type="button" key={diet.id} className={draft.diet === diet.id ? 'is-active' : ''} onClick={() => update('diet', diet.id)}>{diet.label}</button>)}</div>
        </fieldset>

        <fieldset className="target-choice">
          <legend>Daily target</legend>
          <label className={draft.targetMode === 'smart' ? 'is-active' : ''}>
            <input type="radio" name="target-mode" checked={draft.targetMode === 'smart'} onChange={() => update('targetMode', 'smart')} />
            <span><strong>Smart target</strong><small>Updates when your profile changes.</small></span><b>{preview.smartTarget}g</b>
          </label>
          <label className={draft.targetMode === 'custom' ? 'is-active' : ''}>
            <input type="radio" name="target-mode" checked={draft.targetMode === 'custom'} onChange={() => update('targetMode', 'custom')} />
            <span><strong>Set my own</strong><small>Keep a fixed daily number.</small></span>
            <div><input aria-label="Custom protein target" type="number" min="40" max="300" value={draft.customTarget} onChange={(event) => update('customTarget', event.target.value)} /><b>g</b></div>
          </label>
        </fieldset>

        <button className="button button--dark goal-save" onClick={save}>Save protein goal</button>
      </section>

      <aside className="recommendation-card">
        <span className="nutrition-kicker"><Sparkles size={12} /> LIVE RECOMMENDATION</span>
        <div className="recommendation-number"><strong>{preview.target}</strong><span>grams<br />per day</span></div>
        <div className="recommendation-range"><span>Useful range</span><strong>{preview.range.low}–{preview.range.high}g</strong></div>
        <div className="formula-stack">
          <div><span>Working weight</span><strong>{preview.referenceWeight} kg</strong></div>
          <i>×</i>
          <div><span>{GOALS.find((goal) => goal.id === draft.goal)?.label || 'Goal'} factor</span><strong>{preview.factor.toFixed(1)} g/kg</strong></div>
          <i>=</i>
          <div><span>Rounded target</span><strong>{preview.smartTarget}g</strong></div>
        </div>
        {preview.adjustedForBmi && <p><Info size={15} /> We used an adjusted working weight so the estimate stays useful for your height.</p>}
        <small className="recommendation-disclaimer">A practical fitness estimate for healthy adults—not medical nutrition advice.</small>
      </aside>
    </div>
  )
}

function FoodLogger({ meal, onClose, onAdd, diet }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [servings, setServings] = useState(1)
  const [manual, setManual] = useState(false)
  const [manualData, setManualData] = useState({ name: '', serving: '1 serving', protein: '', calories: '' })
  const slot = MEAL_SLOTS.find((item) => item.id === meal) || MEAL_SLOTS[0]
  const foods = FOOD_CATALOG.filter((food) => {
    const matchesDiet = food.diets.includes(diet)
    const query = search.trim().toLowerCase()
    return matchesDiet && (!query || food.name.toLowerCase().includes(query) || food.detail.toLowerCase().includes(query))
  })

  const addSelected = () => {
    if (!selected) return
    onAdd({
      foodId: selected.id,
      name: selected.name,
      detail: selected.detail,
      serving: selected.serving,
      servings,
      protein: Math.round(selected.protein * servings),
      calories: Math.round(selected.calories * servings),
    })
  }

  const addManual = () => {
    if (!manualData.name.trim() || !Number(manualData.protein)) return
    onAdd({
      foodId: null,
      name: manualData.name.trim(),
      detail: 'Custom food',
      serving: manualData.serving.trim() || '1 serving',
      servings: 1,
      protein: Math.round(Number(manualData.protein)),
      calories: Math.round(Number(manualData.calories) || 0),
    })
  }

  return (
    <motion.div className="food-logger-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className="food-logger" initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} transition={{ duration: 0.2 }} role="dialog" aria-modal="true" aria-labelledby="food-logger-title">
        <button className="food-logger-close" onClick={onClose} aria-label="Close food logger"><X size={20} /></button>

        {selected ? (
          <div className="food-detail-step">
            <button className="food-logger-back" onClick={() => setSelected(null)}><ArrowLeft size={17} /> All foods</button>
            <span className="food-monogram food-monogram--large">{selected.name.slice(0, 2).toUpperCase()}</span>
            <span className="nutrition-kicker">ADD TO {slot.label.toUpperCase()}</span>
            <h2 id="food-logger-title">{selected.name}</h2>
            <p>{selected.detail} · {selected.serving}</p>
            <div className="serving-stepper">
              <button onClick={() => setServings((value) => Math.max(0.25, value - 0.25))} aria-label="Decrease servings"><Minus size={18} /></button>
              <div><strong>{servings}</strong><span>{servings === 1 ? 'serving' : 'servings'}</span></div>
              <button onClick={() => setServings((value) => Math.min(10, value + 0.25))} aria-label="Increase servings"><Plus size={18} /></button>
            </div>
            <div className="food-detail-macros">
              <div><strong>{Math.round(selected.protein * servings)}g</strong><span>protein</span></div>
              <div><strong>{Math.round(selected.calories * servings)}</strong><span>kcal</span></div>
            </div>
            <button className="button button--accent button--wide" onClick={addSelected}>Add to {slot.label.toLowerCase()}</button>
          </div>
        ) : manual ? (
          <div className="manual-food-step">
            <button className="food-logger-back" onClick={() => setManual(false)}><ArrowLeft size={17} /> Food search</button>
            <span className="nutrition-kicker">CUSTOM FOOD</span>
            <h2 id="food-logger-title">Enter what you know</h2>
            <p>You only need a name and protein amount.</p>
            <label><span>Food name</span><input autoFocus value={manualData.name} onChange={(event) => setManualData((value) => ({ ...value, name: event.target.value }))} placeholder="e.g. Homemade dal" /></label>
            <label><span>Portion</span><input value={manualData.serving} onChange={(event) => setManualData((value) => ({ ...value, serving: event.target.value }))} placeholder="e.g. 1 bowl" /></label>
            <div className="manual-macro-fields">
              <label><span>Protein</span><div><input type="number" min="0" value={manualData.protein} onChange={(event) => setManualData((value) => ({ ...value, protein: event.target.value }))} /><b>g</b></div></label>
              <label><span>Calories</span><div><input type="number" min="0" value={manualData.calories} onChange={(event) => setManualData((value) => ({ ...value, calories: event.target.value }))} /><b>kcal</b></div></label>
            </div>
            <button className="button button--dark button--wide" onClick={addManual} disabled={!manualData.name.trim() || !Number(manualData.protein)}>Add custom food</button>
          </div>
        ) : (
          <>
            <div className="food-logger-head">
              <span className="nutrition-kicker">LOG {slot.label.toUpperCase()}</span>
              <h2 id="food-logger-title">What did you eat?</h2>
              <p>Search common high-protein foods or enter your own.</p>
            </div>
            <label className="food-search"><Search size={18} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search foods" />{search && <button onClick={() => setSearch('')}><X size={15} /></button>}</label>
            <div className="food-results">
              {foods.map((food) => (
                <button key={food.id} onClick={() => { setSelected(food); setServings(1) }}>
                  <span className="food-monogram food-monogram--small">{food.name.slice(0, 2).toUpperCase()}</span>
                  <span><strong>{food.name}</strong><small>{food.detail} · {food.serving}</small></span>
                  <b>{food.protein}g</b>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!foods.length && <div className="food-no-results"><Search size={22} /><strong>No matching foods</strong><span>Add it as a custom food instead.</span></div>}
            </div>
            <button className="manual-food-button" onClick={() => setManual(true)}><Plus size={16} /> Enter a custom food</button>
          </>
        )}
      </motion.section>
    </motion.div>
  )
}

export function NutritionView({ nutrition, updateNutrition, latestWeightKg, notify }) {
  const [tab, setTab] = useState('today')
  const [date, setDate] = useState(localDateKey())
  const [loggerMeal, setLoggerMeal] = useState(null)
  const recommendation = useMemo(() => calculateProteinRecommendation(nutrition.profile), [nutrition.profile])
  const target = recommendation.target
  const dayEntries = useMemo(
    () => nutrition.entries.filter((entry) => entry.date === date),
    [nutrition.entries, date],
  )

  const changeDate = (amount) => {
    const next = new Date(`${date}T12:00:00`)
    next.setDate(next.getDate() + amount)
    const nextKey = localDateKey(next)
    if (nextKey <= localDateKey()) setDate(nextKey)
  }

  const addFood = (food, meal = loggerMeal || suggestedMealSlot()) => {
    const entry = { ...food, id: makeId('food'), date, meal, createdAt: new Date().toISOString() }
    updateNutrition((current) => ({
      ...current,
      entries: [...current.entries, entry],
      recentFoodIds: food.foodId
        ? [food.foodId, ...current.recentFoodIds.filter((id) => id !== food.foodId)].slice(0, 8)
        : current.recentFoodIds,
    }))
    setLoggerMeal(null)
    notify(`${food.name} added`)
  }

  const quickAdd = (food) => addFood({ ...food, foodId: food.id, servings: 1 }, suggestedMealSlot())

  const deleteFood = (id) => {
    updateNutrition((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }))
    notify('Food removed')
  }

  const copyYesterday = () => {
    const previousDate = localDateKey(new Date(dateFromKey(date).getTime() - 86400000))
    const previous = nutrition.entries.filter((entry) => entry.date === previousDate)
    if (!previous.length) {
      notify('No meals logged yesterday')
      return
    }
    const copies = previous.map((entry) => ({ ...entry, id: makeId('food'), date, isSample: false, createdAt: new Date().toISOString() }))
    updateNutrition((current) => ({ ...current, entries: [...current.entries, ...copies] }))
    notify(`${copies.length} foods copied from yesterday`)
  }

  const saveProfile = (profile) => {
    updateNutrition((current) => ({ ...current, profile }))
    notify('Protein goal updated')
  }

  return (
    <div className="nutrition-view content-width">
      <header className="nutrition-header">
        <div>
          <span className="eyebrow">NUTRITION, WITHOUT THE NOISE</span>
          <h1>Protein, on track.</h1>
          <p>Build meals around one useful number and keep the rest refreshingly simple.</p>
        </div>
        <button className="button button--dark nutrition-log-desktop" onClick={() => setLoggerMeal(suggestedMealSlot())}><Plus size={17} /> Log food</button>
      </header>

      <div className="nutrition-toolbar">
        <div className="nutrition-tabs" role="tablist" aria-label="Nutrition sections">
          {TABS.map((item) => <button role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </div>
        {tab === 'today' && (
          <div className="nutrition-date-nav">
            <button onClick={() => changeDate(-1)} aria-label="Previous day"><ChevronLeft size={17} /></button>
            <div><strong>{friendlyDate(date)}</strong><span>{fullDate(date)}</span></div>
            <button onClick={() => changeDate(1)} disabled={date >= localDateKey()} aria-label="Next day"><ChevronRight size={17} /></button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>
          {tab === 'today' && (
            <DayView
              date={date}
              entries={dayEntries}
              target={target}
              recommendation={recommendation}
              nutrition={nutrition}
              onLog={setLoggerMeal}
              onQuickAdd={quickAdd}
              onDelete={deleteFood}
              onCopyYesterday={copyYesterday}
            />
          )}
          {tab === 'trends' && <PatternsView nutrition={nutrition} target={target} />}
          {tab === 'goal' && <GoalSetup profile={nutrition.profile} recommendation={recommendation} onSave={saveProfile} linkedWeight={latestWeightKg} />}
        </motion.div>
      </AnimatePresence>

      <button className="nutrition-fab" onClick={() => setLoggerMeal(suggestedMealSlot())}><Plus size={20} /><span>Log food</span></button>

      <AnimatePresence>
        {loggerMeal && <FoodLogger meal={loggerMeal} diet={nutrition.profile.diet} onClose={() => setLoggerMeal(null)} onAdd={(food) => addFood(food, loggerMeal)} />}
      </AnimatePresence>
    </div>
  )
}
