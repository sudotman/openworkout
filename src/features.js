import { lazy } from 'react'

export const RoutinesView = lazy(() =>
  import('./components/RoutinesView.jsx').then((module) => ({ default: module.RoutinesView })),
)

export const loadProgressPlus = () => import('./components/ProgressPlus.jsx')

export const loadProgressPhotos = () => import('./components/ProgressPhotos.jsx')

export const TrainingCalendar = lazy(() =>
  loadProgressPlus().then((module) => ({ default: module.TrainingCalendar })),
)

export const MeasurementsPanel = lazy(() =>
  loadProgressPlus().then((module) => ({ default: module.MeasurementsPanel })),
)

export const MuscleBreakdown = lazy(() =>
  loadProgressPlus().then((module) => ({ default: module.MuscleBreakdown })),
)

export const ExercisePerformance = lazy(() =>
  loadProgressPlus().then((module) => ({ default: module.ExercisePerformance })),
)

export const ExerciseMuscleMap = lazy(() => import('./components/ExerciseMuscleMap.jsx'))

export const ProgressPhotos = lazy(() =>
  loadProgressPhotos().then((module) => ({ default: module.ProgressPhotos })),
)

export const WorkoutTools = lazy(() =>
  import('./components/WorkoutTools.jsx').then((module) => ({ default: module.WorkoutTools })),
)

export const SetOptions = lazy(() =>
  import('./components/WorkoutTools.jsx').then((module) => ({ default: module.SetOptions })),
)

export const WorkoutShareCard = lazy(() =>
  import('./components/WorkoutShareCard.jsx').then((module) => ({ default: module.WorkoutShareCard })),
)

export const CardioTracker = lazy(() =>
  import('./components/CardioTracker.jsx').then((module) => ({ default: module.CardioTracker })),
)

export const NutritionView = lazy(() =>
  import('./components/NutritionView.jsx').then((module) => ({ default: module.NutritionView })),
)
