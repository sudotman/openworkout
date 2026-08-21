const DAY_MS = 86400000

export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', window: '6–10 AM' },
  { id: 'lunch', label: 'Lunch', window: '11 AM–3 PM' },
  { id: 'snack', label: 'Snack', window: 'Anytime' },
  { id: 'dinner', label: 'Dinner', window: '5–10 PM' },
]

export const FOOD_CATALOG = [
  { id: 'chicken-breast', name: 'Chicken breast', detail: 'Cooked, skinless', serving: '120 g', protein: 37, calories: 198, diets: ['omnivore'] },
  { id: 'greek-yogurt', name: 'Greek yogurt', detail: 'Plain, 2% fat', serving: '200 g', protein: 20, calories: 146, diets: ['omnivore', 'vegetarian'] },
  { id: 'eggs', name: 'Whole eggs', detail: '3 large eggs', serving: '3 eggs', protein: 19, calories: 216, diets: ['omnivore', 'vegetarian'] },
  { id: 'whey', name: 'Whey protein', detail: 'Mixed with water', serving: '1 scoop', protein: 24, calories: 120, diets: ['omnivore', 'vegetarian'] },
  { id: 'paneer', name: 'Paneer', detail: 'Fresh cottage cheese', serving: '100 g', protein: 18, calories: 265, diets: ['omnivore', 'vegetarian'] },
  { id: 'tofu', name: 'Firm tofu', detail: 'Pressed and cooked', serving: '180 g', protein: 24, calories: 216, diets: ['omnivore', 'vegetarian', 'vegan'] },
  { id: 'lentils', name: 'Lentil dal', detail: 'Cooked', serving: '1½ cups', protein: 27, calories: 345, diets: ['omnivore', 'vegetarian', 'vegan'] },
  { id: 'salmon', name: 'Salmon fillet', detail: 'Cooked', serving: '140 g', protein: 31, calories: 291, diets: ['omnivore'] },
  { id: 'tuna', name: 'Tuna', detail: 'Canned in water', serving: '1 can', protein: 29, calories: 132, diets: ['omnivore'] },
  { id: 'cottage-cheese', name: 'Cottage cheese', detail: 'Low fat', serving: '200 g', protein: 25, calories: 164, diets: ['omnivore', 'vegetarian'] },
  { id: 'soy-milk', name: 'Soy milk', detail: 'Unsweetened', serving: '350 ml', protein: 12, calories: 116, diets: ['omnivore', 'vegetarian', 'vegan'] },
  { id: 'chickpeas', name: 'Chickpea bowl', detail: 'Cooked chickpeas', serving: '1½ cups', protein: 22, calories: 404, diets: ['omnivore', 'vegetarian', 'vegan'] },
  { id: 'tempeh', name: 'Tempeh', detail: 'Pan-seared', serving: '150 g', protein: 29, calories: 288, diets: ['omnivore', 'vegetarian', 'vegan'] },
  { id: 'turkey', name: 'Turkey breast', detail: 'Roasted', serving: '120 g', protein: 36, calories: 176, diets: ['omnivore'] },
  { id: 'lean-beef', name: 'Lean beef', detail: 'Cooked, 90% lean', serving: '120 g', protein: 31, calories: 246, diets: ['omnivore'] },
  { id: 'edamame', name: 'Edamame', detail: 'Shelled and cooked', serving: '1½ cups', protein: 25, calories: 282, diets: ['omnivore', 'vegetarian', 'vegan'] },
  { id: 'skyr', name: 'Skyr', detail: 'Plain Icelandic yogurt', serving: '200 g', protein: 22, calories: 126, diets: ['omnivore', 'vegetarian'] },
  { id: 'seitan', name: 'Seitan', detail: 'Cooked wheat protein', serving: '150 g', protein: 36, calories: 210, diets: ['omnivore', 'vegetarian', 'vegan'] },
  { id: 'quinoa', name: 'Quinoa', detail: 'Cooked', serving: '1½ cups', protein: 12, calories: 333, diets: ['omnivore', 'vegetarian', 'vegan'] },
  { id: 'peanut-butter', name: 'Peanut butter', detail: 'Natural', serving: '2 tbsp', protein: 8, calories: 190, diets: ['omnivore', 'vegetarian', 'vegan'] },
]

export function localDateKey(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value + (/^\d{4}-\d{2}-\d{2}$/.test(value) ? 'T12:00:00' : ''))
  if (Number.isNaN(date.getTime())) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function offsetDateKey(days, source = new Date()) {
  const date = new Date(source)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function calculateProteinRecommendation(profile = {}) {
  const weightKg = Math.max(35, Math.min(250, Number(profile.weightKg) || 75))
  const heightCm = Math.max(120, Math.min(230, Number(profile.heightCm) || 175))
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  const goalFactors = { maintain: 1.6, build: 1.8, 'fat-loss': 1.9, performance: 1.7 }
  const baseFactor = goalFactors[profile.goal] || goalFactors.build
  const trainingBump = Number(profile.trainingDays) >= 5 ? 0.1 : 0
  const factor = baseFactor + trainingBump

  // At higher BMIs, adjusted weight avoids inflating a protein target beyond a useful range.
  const referenceWeight = bmi > 30
    ? (25 * heightM * heightM) + 0.25 * (weightKg - (25 * heightM * heightM))
    : weightKg
  const rawTarget = referenceWeight * factor
  const target = Math.max(65, Math.min(240, Math.round(rawTarget / 5) * 5))
  const range = {
    low: Math.max(60, Math.round((referenceWeight * Math.max(1.4, factor - 0.2)) / 5) * 5),
    high: Math.min(250, Math.round((referenceWeight * (factor + 0.2)) / 5) * 5),
  }

  return {
    target: profile.targetMode === 'custom' && Number(profile.customTarget) > 0
      ? Math.round(Number(profile.customTarget))
      : target,
    smartTarget: target,
    range,
    factor,
    bmi: Math.round(bmi * 10) / 10,
    referenceWeight: Math.round(referenceWeight * 10) / 10,
    adjustedForBmi: bmi > 30,
  }
}

export function totalForEntries(entries = []) {
  return entries.reduce((total, entry) => ({
    protein: total.protein + (Number(entry.protein) || 0),
    calories: total.calories + (Number(entry.calories) || 0),
  }), { protein: 0, calories: 0 })
}

export function suggestedMealSlot(now = new Date()) {
  const hour = now.getHours()
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 18) return 'snack'
  return 'dinner'
}

export function getSmartFoodSuggestions(remainingProtein, diet = 'omnivore', recentFoodIds = []) {
  const allowed = FOOD_CATALOG.filter((food) => food.diets.includes(diet))
  const recent = new Set(recentFoodIds.slice(0, 5))
  return [...allowed]
    .sort((left, right) => {
      const leftFit = Math.abs(Math.max(12, remainingProtein) - left.protein) + (recent.has(left.id) ? -7 : 0)
      const rightFit = Math.abs(Math.max(12, remainingProtein) - right.protein) + (recent.has(right.id) ? -7 : 0)
      return leftFit - rightFit
    })
    .slice(0, 3)
}

function sampleEntry(dayOffset, meal, foodId, servings, suffix) {
  const food = FOOD_CATALOG.find((item) => item.id === foodId)
  return {
    id: `nutrition-sample-${Math.abs(dayOffset)}-${suffix}`,
    date: offsetDateKey(dayOffset),
    meal,
    foodId,
    name: food.name,
    detail: food.detail,
    serving: food.serving,
    servings,
    protein: Math.round(food.protein * servings),
    calories: Math.round(food.calories * servings),
    isSample: true,
  }
}

export function createInitialNutritionState() {
  const entries = [
    sampleEntry(0, 'breakfast', 'greek-yogurt', 1, 'a'),
    sampleEntry(0, 'breakfast', 'eggs', 1, 'b'),
    sampleEntry(0, 'lunch', 'chicken-breast', 1, 'c'),
    sampleEntry(0, 'snack', 'whey', 1, 'd'),
    sampleEntry(-1, 'breakfast', 'eggs', 1, 'a'),
    sampleEntry(-1, 'lunch', 'lentils', 1, 'b'),
    sampleEntry(-1, 'snack', 'greek-yogurt', 1, 'c'),
    sampleEntry(-1, 'dinner', 'salmon', 1, 'd'),
    sampleEntry(-2, 'breakfast', 'greek-yogurt', 1, 'a'),
    sampleEntry(-2, 'lunch', 'turkey', 1, 'b'),
    sampleEntry(-2, 'snack', 'whey', 1, 'c'),
    sampleEntry(-2, 'dinner', 'lean-beef', 1.8, 'd'),
    sampleEntry(-3, 'breakfast', 'eggs', 1, 'a'),
    sampleEntry(-3, 'lunch', 'chickpeas', 1, 'b'),
    sampleEntry(-3, 'dinner', 'tofu', 1.25, 'c'),
    sampleEntry(-4, 'breakfast', 'skyr', 1, 'a'),
    sampleEntry(-4, 'lunch', 'chicken-breast', 1, 'b'),
    sampleEntry(-4, 'snack', 'cottage-cheese', 1, 'c'),
    sampleEntry(-4, 'dinner', 'salmon', 1.8, 'd'),
    sampleEntry(-5, 'breakfast', 'greek-yogurt', 1, 'a'),
    sampleEntry(-5, 'lunch', 'paneer', 1.25, 'b'),
    sampleEntry(-5, 'snack', 'whey', 1, 'c'),
    sampleEntry(-5, 'dinner', 'lentils', 1, 'd'),
    sampleEntry(-6, 'breakfast', 'eggs', 1, 'a'),
    sampleEntry(-6, 'lunch', 'turkey', 1, 'b'),
    sampleEntry(-6, 'dinner', 'chicken-breast', 1.2, 'c'),
  ]

  return {
    version: 1,
    profile: {
      weightKg: 75.8,
      heightCm: 178,
      goal: 'build',
      trainingDays: 4,
      diet: 'omnivore',
      targetMode: 'smart',
      customTarget: 145,
    },
    entries,
    recentFoodIds: ['whey', 'chicken-breast', 'greek-yogurt', 'eggs'],
  }
}

export function normalizeNutritionState(value) {
  const fallback = createInitialNutritionState()
  if (!value || typeof value !== 'object') return fallback
  return {
    ...fallback,
    ...value,
    profile: { ...fallback.profile, ...(value.profile || {}) },
    entries: Array.isArray(value.entries) ? value.entries : fallback.entries,
    recentFoodIds: Array.isArray(value.recentFoodIds) ? value.recentFoodIds : [],
  }
}

export const NUTRITION_DAY_MS = DAY_MS
