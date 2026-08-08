import { useMemo } from 'react'
import { motion } from 'motion/react'
import Body from 'react-muscle-highlighter'
import '../muscle-map.css'

const GROUP_TO_SLUGS = {
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Biceps: ['biceps'],
  Calves: ['calves'],
  Chest: ['chest'],
  Core: ['abs', 'obliques', 'lower-back'],
  Forearms: ['forearm'],
  'Full Body/Cardio': [
    'chest',
    'deltoids',
    'upper-back',
    'abs',
    'gluteal',
    'quadriceps',
    'hamstring',
    'calves',
  ],
  Glutes: ['gluteal'],
  'Hip Flexors': ['quadriceps', 'abs'],
  Legs: ['quadriceps', 'hamstring', 'calves', 'adductors', 'tibialis'],
  Shoulders: ['deltoids'],
  Traps: ['trapezius'],
  Triceps: ['triceps'],
  'Upper Back': ['upper-back', 'trapezius'],
}

function slugsFor(groups) {
  return [...new Set(groups.flatMap((group) => GROUP_TO_SLUGS[group] || []))]
}

function createMuscleData(exercise) {
  const primary = slugsFor([exercise.primaryMuscle])
  const primarySet = new Set(primary)
  const secondary = slugsFor(exercise.secondaryMuscles || []).filter((slug) => !primarySet.has(slug))

  return [
    ...secondary.map((slug) => ({ slug, intensity: 1 })),
    ...primary.map((slug) => ({ slug, intensity: 2 })),
  ]
}

function Figure({ side, data }) {
  return (
    <figure className="muscle-map-figure">
      <div aria-hidden="true">
        <Body
          data={data}
          side={side}
          gender="male"
          colors={['#8c956f', '#d9ff4f']}
          defaultFill="#31342d"
          defaultStroke="#131510"
          defaultStrokeWidth={1.4}
          border="#6c7163"
        />
      </div>
      <figcaption>{side}</figcaption>
    </figure>
  )
}

export default function ExerciseMuscleMap({ exercise }) {
  const data = useMemo(() => createMuscleData(exercise), [exercise])
  const secondaryLabel = exercise.secondaryMuscles?.length
    ? exercise.secondaryMuscles.join(', ')
    : 'None listed'

  return (
    <motion.section
      className="muscle-map"
      aria-labelledby={'muscle-map-' + exercise.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="muscle-map-head">
        <div>
          <span>TARGET MAP</span>
          <h3 id={'muscle-map-' + exercise.id}>Muscles worked</h3>
        </div>
        <p>Front + back</p>
      </header>

      <div className="muscle-map-body">
        <div className="muscle-map-figures">
          <Figure side="front" data={data} />
          <Figure side="back" data={data} />
        </div>

        <div className="muscle-map-key">
          <div>
            <i className="muscle-map-swatch muscle-map-swatch--primary" />
            <span>PRIMARY</span>
            <strong>{exercise.primaryMuscle}</strong>
          </div>
          <div>
            <i className="muscle-map-swatch muscle-map-swatch--secondary" />
            <span>ASSISTS</span>
            <strong>{secondaryLabel}</strong>
          </div>
        </div>
      </div>

      <p className="muscle-map-note">
        Simplified training reference—not a diagnostic or medical illustration.
      </p>
    </motion.section>
  )
}
