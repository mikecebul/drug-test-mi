'use client'
import { labSteps } from './model'
import { WorkflowProgress } from '../../components/WorkflowProgress'
const labels = { upload: 'Upload', match: 'Match', results: 'Results', review: 'Review' }
const steps = labSteps.map((key) => ({ key, label: labels[key] }))
export function LabProgress({ step, completed = false }: { step: (typeof labSteps)[number]; completed?: boolean }) {
  return <WorkflowProgress steps={steps} activeStep={step} completed={completed} label="Lab result steps" />
}
