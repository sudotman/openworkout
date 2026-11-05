import { ChevronRight, Plus, Search, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { EmptyState, ViewHeader } from '../components/AppChrome.jsx'
import { equipmentOptions, muscleGroups } from '../data/exercises.js'

export function LibraryView({ allExercises, openExercise, openCreate }) {
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('All')
  const [equipment, setEquipment] = useState('All')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allExercises.filter((exercise) => {
      const matchesQuery =
        !query ||
        exercise.name.toLowerCase().includes(query) ||
        exercise.primaryMuscle.toLowerCase().includes(query) ||
        exercise.equipment.toLowerCase().includes(query) ||
        exercise.pattern.toLowerCase().includes(query)
      return (
        matchesQuery &&
        (muscle === 'All' || exercise.primaryMuscle === muscle) &&
        (equipment === 'All' || exercise.equipment === equipment)
      )
    })
  }, [allExercises, search, muscle, equipment])

  return (
    <div className="content-width">
      <ViewHeader
        title="Exercise library"
        subtitle={allExercises.length + ' exercises, each with setup steps and cues.'}
        action={
          <button className="button button--dark library-create" onClick={openCreate}>
            <Plus size={17} /> Custom exercise
          </button>
        }
      />

      <div className="library-tools">
        <label className="search-box">
          <Search size={19} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exercise, muscle, or equipment"
            aria-label="Search exercises"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>

        <div className="filter-scroller" aria-label="Filter by muscle group">
          {['All', ...muscleGroups].map((group) => (
            <button
              key={group}
              className={'filter-chip ' + (muscle === group ? 'is-active' : '')}
              onClick={() => setMuscle(group)}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="equipment-filter">
          <label htmlFor="equipment-filter">Equipment</label>
          <select id="equipment-filter" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
            {['All', ...equipmentOptions].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <span>{filtered.length} results</span>
        </div>
      </div>

      {filtered.length ? (
        <div className="exercise-directory">
          {filtered.map((exercise, index) => (
            <motion.button
              className="directory-row"
              key={exercise.id}
              onClick={() => openExercise(exercise.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.012, 0.2) }}
              layout
            >
              <span className="directory-monogram">{exercise.name.split(' ').slice(0, 2).map((word) => word[0]).join('')}</span>
              <span className="directory-main">
                <strong>{exercise.name}</strong>
                <small>{exercise.custom ? 'Custom · ' : ''}{exercise.pattern} · {exercise.equipment}</small>
              </span>
              <span className="muscle-label">{exercise.primaryMuscle}</span>
              <span className={'difficulty difficulty--' + exercise.difficulty.toLowerCase()}>{exercise.difficulty}</span>
              <ChevronRight size={19} />
            </motion.button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No matching exercises"
          body="Try a different name, muscle group, or equipment filter."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch('')
            setMuscle('All')
            setEquipment('All')
          }}
        />
      )}
    </div>
  )
}
