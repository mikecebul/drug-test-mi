export type RedwoodDevAction = 'import-inline' | 'import-queue' | 'headshot-inline' | 'headshot-queue'

export type RedwoodDevActionConfig = {
  kind: 'import' | 'headshot'
  mode: 'inline' | 'queue'
  label: string
  task: 'redwood-import-client' | 'redwood-sync-headshot'
}

export const REDWOOD_DEV_ACTION_CONFIG: Record<RedwoodDevAction, RedwoodDevActionConfig> = {
  'import-inline': {
    kind: 'import',
    mode: 'inline',
    label: 'Import Inline',
    task: 'redwood-import-client',
  },
  'import-queue': {
    kind: 'import',
    mode: 'queue',
    label: 'Import Queue',
    task: 'redwood-import-client',
  },
  'headshot-inline': {
    kind: 'headshot',
    mode: 'inline',
    label: 'Headshot Inline',
    task: 'redwood-sync-headshot',
  },
  'headshot-queue': {
    kind: 'headshot',
    mode: 'queue',
    label: 'Headshot Queue',
    task: 'redwood-sync-headshot',
  },
}

export const REDWOOD_DEV_ACTIONS = Object.entries(REDWOOD_DEV_ACTION_CONFIG).map(([action, config]) => ({
  action: action as RedwoodDevAction,
  ...config,
}))

export function isRedwoodDevAction(value: string): value is RedwoodDevAction {
  return value in REDWOOD_DEV_ACTION_CONFIG
}
