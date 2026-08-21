import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Flame,
  Info,
  Leaf,
  Minus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingUp,
  Utensils,
  X,
} from 'lucide-react'
import {
  calculateProteinRecommendation,
  FOOD_CATALOG,
  getNutritionFoods,
  getSmartFoodSuggestions,
  localDateKey,
  MEAL_SLOTS,
  NUTRIENT_TARGETS,
  offsetDateKey,
  suggestedMealSlot,
  totalForEntries,
  totalNutrientsForEntries,
} from '../lib/nutrition.js'
import '../nutrition.css'

const TABS = [
  { id: 'today', label: 'Day' },
  { id: 'trends', label: 'Patterns' },
  { id: 'foods', label: 'Foods' },
  { id: 'goal', label: 'Goal' },
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
          <span className="nutrition-kicker"><CircleGauge size={12} /> DAILY PROTEIN</span>
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

function nutrientValue(value, unit) {
  if (unit === 'g') return `${Math.round(value * 10) / 10}g`
  return `${value < 10 ? Math.round(value * 10) / 10 : Math.round(value)}mg`
}

function NutrientLens({ entries, foods }) {
  const [expanded, setExpanded] = useState(false)
  const totals = totalNutrientsForEntries(entries, foods)
  const fiber = NUTRIENT_TARGETS.find((nutrient) => nutrient.id === 'fiber')

  return (
    <section className={`nutrient-lens ${expanded ? 'is-open' : ''}`}>
      <button className="nutrient-lens-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="nutrient-lens-icon"><Leaf size={16} /></span>
        <span>
          <strong>Micronutrients</strong>
          <small>Fiber {nutrientValue(totals.fiber, fiber.unit)} · and more</small>
        </span>
        <span className="nutrient-lens-action">{expanded ? 'Hide' : 'View'} <ChevronDown size={15} /></span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="nutrient-lens-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="nutrient-lens-grid">
              {NUTRIENT_TARGETS.map((nutrient) => {
                const value = totals[nutrient.id] || 0
                const progress = Math.min(100, (value / nutrient.target) * 100)
                return (
                  <div className="nutrient-meter" key={nutrient.id}>
                    <div><strong>{nutrient.label}</strong><span>{nutrientValue(value, nutrient.unit)} <i>/ {nutrient.target}{nutrient.unit}</i></span></div>
                    <span className="nutrient-meter-track"><i style={{ width: `${progress}%` }} /></span>
                  </div>
                )
              })}
            </div>
            <p>General daily reference values. Foods without nutrient details simply leave these estimates incomplete.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function SmartSuggestions({ remaining, profile, recentFoodIds, foods, onQuickAdd }) {
  const suggestions = getSmartFoodSuggestions(remaining, profile.diet, recentFoodIds, foods)
  return (
    <section className="smart-suggestions">
      <div className="nutrition-section-head">
        <div>
          <span className="nutrition-kicker"><Target size={12} /> SMART PICKS</span>
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

function DayView({ date, entries, foods, target, recommendation, nutrition, onLog, onQuickAdd, onDelete, onCopyYesterday }) {
  const totals = totalForEntries(entries)
  const remaining = Math.max(0, target - totals.protein)
  return (
    <div className="nutrition-day-layout">
      <div className="nutrition-day-main">
        <DayHero entries={entries} target={target} recommendation={recommendation} onLog={onLog} />
        <NutrientLens entries={entries} foods={foods} />
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
          foods={foods}
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

function FoodsView({ foods, recentFoodIds, onCreate, onEdit, onQuickLog }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const recent = new Set(recentFoodIds)
  const visibleFoods = [...foods]
    .filter((food) => {
      const query = search.trim().toLowerCase()
      const matchesSearch = !query || food.name.toLowerCase().includes(query) || food.detail?.toLowerCase().includes(query)
      const matchesFilter = filter === 'all' || food.custom || food.modified
      return matchesSearch && matchesFilter
    })
    .sort((left, right) => {
      const leftRank = left.custom ? 3 : left.modified ? 2 : recent.has(left.id) ? 1 : 0
      const rightRank = right.custom ? 3 : right.modified ? 2 : recent.has(right.id) ? 1 : 0
      return rightRank - leftRank || left.name.localeCompare(right.name)
    })

  return (
    <div className="foods-workspace">
      <section className="foods-intro">
        <div>
          <span className="nutrition-kicker"><SlidersHorizontal size={12} /> YOUR FOOD PRESETS</span>
          <h2>List of meals, just remember to eat.</h2>
          <p>Edit any serving or nutrition value here for preset or custom foods.</p>
        </div>
        <button className="button button--accent" onClick={onCreate}><Plus size={17} /> Add food</button>
      </section>

      <div className="foods-tools">
        <label className="food-search foods-search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your foods" />
          {search && <button onClick={() => setSearch('')} aria-label="Clear food search"><X size={15} /></button>}
        </label>
        <div className="foods-filters">
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All foods</button>
          <button className={filter === 'personal' ? 'is-active' : ''} onClick={() => setFilter('personal')}>Personalized</button>
        </div>
      </div>

      <div className="foods-list-head"><span>{visibleFoods.length} presets</span><span>Serving nutrition</span></div>
      <div className="foods-list">
        {visibleFoods.map((food) => (
          <article className="food-preset-row" key={food.id}>
            <span className="food-monogram">{food.name.slice(0, 2).toUpperCase()}</span>
            <div className="food-preset-main">
              <div><strong>{food.name}</strong>{food.custom && <i>CUSTOM</i>}{food.modified && <i>EDITED</i>}</div>
              <small>{food.detail} · {food.serving}</small>
            </div>
            <div className="food-preset-values">
              <strong>{food.protein}g <span>protein</span></strong>
              <small>{food.calories} kcal{Number(food.fiber) > 0 ? ` · ${food.fiber}g fiber` : ''}</small>
            </div>
            <button className="food-preset-log" onClick={() => onQuickLog(food)} aria-label={`Log ${food.name} today`}><Plus size={16} /><span>Log</span></button>
            <button className="food-preset-edit" onClick={() => onEdit(food)} aria-label={`Edit ${food.name}`}><Pencil size={15} /></button>
          </article>
        ))}
        {!visibleFoods.length && (
          <div className="foods-empty"><Search size={22} /><strong>No foods found</strong><span>Try another search or add your own food.</span><button onClick={onCreate}>Add food</button></div>
        )}
      </div>
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
        <span className="nutrition-kicker"><CircleGauge size={12} /> LIVE RECOMMENDATION</span>
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

function FoodEditor({ food, onClose, onSave, onDelete, onReset }) {
  const dietLevel = food?.diets?.includes('vegan')
    ? 'vegan'
    : food?.diets?.includes('vegetarian')
      ? 'vegetarian'
      : 'omnivore'
  const [draft, setDraft] = useState({
    name: food?.name || '',
    detail: food?.detail || '',
    serving: food?.serving || '1 serving',
    protein: food?.protein ?? '',
    calories: food?.calories ?? '',
    fiber: food?.fiber ?? '',
    calcium: food?.calcium ?? '',
    iron: food?.iron ?? '',
    potassium: food?.potassium ?? '',
    dietLevel,
  })
  const [showNutrients, setShowNutrients] = useState(Boolean(food && NUTRIENT_TARGETS.some((nutrient) => Number(food[nutrient.id]) > 0)))
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const save = () => {
    const diets = draft.dietLevel === 'vegan'
      ? ['omnivore', 'vegetarian', 'vegan']
      : draft.dietLevel === 'vegetarian'
        ? ['omnivore', 'vegetarian']
        : ['omnivore']
    onSave({
      ...(food || {}),
      name: draft.name.trim(),
      detail: draft.detail.trim() || 'Personal food',
      serving: draft.serving.trim() || '1 serving',
      protein: Math.max(0, Number(draft.protein) || 0),
      calories: Math.max(0, Number(draft.calories) || 0),
      fiber: Math.max(0, Number(draft.fiber) || 0),
      calcium: Math.max(0, Number(draft.calcium) || 0),
      iron: Math.max(0, Number(draft.iron) || 0),
      potassium: Math.max(0, Number(draft.potassium) || 0),
      diets,
    })
  }

  return (
    <motion.div className="food-logger-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className="food-logger food-editor" initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} role="dialog" aria-modal="true" aria-labelledby="food-editor-title">
        <button className="food-logger-close" onClick={onClose} aria-label="Close food editor"><X size={20} /></button>
        <div className="food-logger-head">
          <span className="nutrition-kicker">{food ? 'EDIT FOOD PRESET' : 'NEW FOOD PRESET'}</span>
          <h2 id="food-editor-title">{food ? `Tune ${food.name}` : 'Add food once. Reuse it.'}</h2>
          <p>{food?.builtIn ? 'Your changes only affect future logs; previous days stay intact.' : 'Use the values on the package or recipe.'}</p>
        </div>

        <div className="food-editor-fields">
          <label className="food-editor-wide"><span>Food name</span><input autoFocus value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Impact whey" /></label>
          <label className="food-editor-wide"><span>Brand or detail</span><input value={draft.detail} onChange={(event) => update('detail', event.target.value)} placeholder="e.g. Chocolate smooth" /></label>
          <label className="food-editor-wide"><span>Serving</span><input value={draft.serving} onChange={(event) => update('serving', event.target.value)} placeholder="e.g. 1 scoop (30 g)" /></label>
          <label><span>Protein</span><div><input type="number" min="0" step="0.1" value={draft.protein} onChange={(event) => update('protein', event.target.value)} /><b>g</b></div></label>
          <label><span>Calories</span><div><input type="number" min="0" value={draft.calories} onChange={(event) => update('calories', event.target.value)} /><b>kcal</b></div></label>
        </div>

        <fieldset className="food-editor-diet">
          <legend>Fits</legend>
          <div>{DIETS.map((diet) => <button type="button" key={diet.id} className={draft.dietLevel === diet.id ? 'is-active' : ''} onClick={() => update('dietLevel', diet.id)}>{diet.label}</button>)}</div>
        </fieldset>

        <button className="food-editor-nutrient-toggle" onClick={() => setShowNutrients((value) => !value)} aria-expanded={showNutrients}>
          <span><Leaf size={16} /><span><strong>Fiber & micronutrients</strong><small>Optional—add them when the label provides them.</small></span></span>
          <ChevronDown size={17} />
        </button>
        <AnimatePresence initial={false}>
          {showNutrients && (
            <motion.div className="food-editor-nutrients" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              {NUTRIENT_TARGETS.map((nutrient) => (
                <label key={nutrient.id}><span>{nutrient.label}</span><div><input type="number" min="0" step="0.1" value={draft[nutrient.id]} onChange={(event) => update(nutrient.id, event.target.value)} /><b>{nutrient.unit}</b></div></label>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="food-editor-actions">
          {food?.custom && <button className="food-editor-danger" onClick={() => onDelete(food.id)}><Trash2 size={15} /> Delete preset</button>}
          {food?.modified && <button className="food-editor-reset" onClick={() => onReset(food.id)}>Restore default</button>}
          <button className="button button--dark" onClick={save} disabled={!draft.name.trim() || draft.protein === ''}>Save food</button>
        </div>
      </motion.section>
    </motion.div>
  )
}

function FoodLogger({ meal, onClose, onAdd, onManageFoods, diet, foods }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [servings, setServings] = useState(1)
  const slot = MEAL_SLOTS.find((item) => item.id === meal) || MEAL_SLOTS[0]
  const visibleFoods = foods.filter((food) => {
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
      fiber: Math.round((Number(selected.fiber) || 0) * servings * 10) / 10,
      calcium: Math.round((Number(selected.calcium) || 0) * servings),
      iron: Math.round((Number(selected.iron) || 0) * servings * 10) / 10,
      potassium: Math.round((Number(selected.potassium) || 0) * servings),
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
        ) : (
          <>
            <div className="food-logger-head">
              <span className="nutrition-kicker">LOG {slot.label.toUpperCase()}</span>
              <h2 id="food-logger-title">What did you eat?</h2>
              <p>Search your foods, or tune the list whenever a label differs.</p>
            </div>
            <button className="food-logger-manage" onClick={onManageFoods}><SlidersHorizontal size={16} /><span><strong>Add or edit foods</strong><small>Brands, servings and nutrition values</small></span><ChevronRight size={16} /></button>
            <label className="food-search"><Search size={18} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search foods" />{search && <button onClick={() => setSearch('')}><X size={15} /></button>}</label>
            <div className="food-results">
              {visibleFoods.map((food) => (
                <button key={food.id} onClick={() => { setSelected(food); setServings(1) }}>
                  <span className="food-monogram food-monogram--small">{food.name.slice(0, 2).toUpperCase()}</span>
                  <span><strong>{food.name}</strong><small>{food.detail} · {food.serving}</small></span>
                  <b>{food.protein}g</b>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!visibleFoods.length && <div className="food-no-results"><Search size={22} /><strong>No matching foods</strong><span>Create a reusable preset in Foods.</span></div>}
            </div>
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
  const [foodEditor, setFoodEditor] = useState(null)
  const recommendation = useMemo(() => calculateProteinRecommendation(nutrition.profile), [nutrition.profile])
  const foods = useMemo(() => getNutritionFoods(nutrition), [nutrition])
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

  const addFood = (food, meal = loggerMeal || suggestedMealSlot(), entryDate = date) => {
    const entry = { ...food, id: makeId('food'), date: entryDate, meal, createdAt: new Date().toISOString() }
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

  const quickLogPreset = (food) => {
    const today = localDateKey()
    addFood({ ...food, foodId: food.id, servings: 1 }, suggestedMealSlot(), today)
    setDate(today)
    setTab('today')
  }

  const saveFoodPreset = (food) => {
    const id = food.id || makeId('food-preset')
    const { builtIn, custom, modified, ...savedFood } = { ...food, id }
    const isBuiltIn = FOOD_CATALOG.some((item) => item.id === id)
    updateNutrition((current) => isBuiltIn
      ? {
          ...current,
          foodOverrides: { ...current.foodOverrides, [id]: savedFood },
        }
      : {
          ...current,
          customFoods: current.customFoods.some((item) => item.id === id)
            ? current.customFoods.map((item) => item.id === id ? savedFood : item)
            : [savedFood, ...current.customFoods],
        })
    setFoodEditor(null)
    notify(isBuiltIn ? `${food.name} updated for future logs` : `${food.name} saved to your foods`)
  }

  const resetFoodPreset = (id) => {
    const name = foods.find((food) => food.id === id)?.name || 'Food'
    updateNutrition((current) => {
      const foodOverrides = { ...current.foodOverrides }
      delete foodOverrides[id]
      return { ...current, foodOverrides }
    })
    setFoodEditor(null)
    notify(`${name} restored to default`)
  }

  const deleteFoodPreset = (id) => {
    updateNutrition((current) => ({
      ...current,
      customFoods: current.customFoods.filter((food) => food.id !== id),
      recentFoodIds: current.recentFoodIds.filter((foodId) => foodId !== id),
    }))
    setFoodEditor(null)
    notify('Food preset deleted; past logs were kept')
  }

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
        <button
          className="button button--dark nutrition-log-desktop"
          onClick={() => tab === 'foods' ? setFoodEditor({ food: null }) : setLoggerMeal(suggestedMealSlot())}
        >
          <Plus size={17} /> {tab === 'foods' ? 'Add food' : 'Log food'}
        </button>
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
              foods={foods}
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
          {tab === 'foods' && (
            <FoodsView
              foods={foods}
              recentFoodIds={nutrition.recentFoodIds}
              onCreate={() => setFoodEditor({ food: null })}
              onEdit={(food) => setFoodEditor({ food })}
              onQuickLog={quickLogPreset}
            />
          )}
          {tab === 'goal' && <GoalSetup profile={nutrition.profile} recommendation={recommendation} onSave={saveProfile} linkedWeight={latestWeightKg} />}
        </motion.div>
      </AnimatePresence>

      <button className="nutrition-fab" onClick={() => setLoggerMeal(suggestedMealSlot())}><Plus size={20} /><span>Log food</span></button>

      <AnimatePresence>
        {loggerMeal && (
          <FoodLogger
            meal={loggerMeal}
            diet={nutrition.profile.diet}
            foods={foods}
            onClose={() => setLoggerMeal(null)}
            onAdd={(food) => addFood(food, loggerMeal)}
            onManageFoods={() => { setLoggerMeal(null); setTab('foods') }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {foodEditor && (
          <FoodEditor
            key={foodEditor.food?.id || 'new-food'}
            food={foodEditor.food}
            onClose={() => setFoodEditor(null)}
            onSave={saveFoodPreset}
            onDelete={deleteFoodPreset}
            onReset={resetFoodPreset}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
