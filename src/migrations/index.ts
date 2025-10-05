import * as migration_20251005_184859_migration from './20251005_184859_migration'

export const migrations = [
  {
    up: migration_20251005_184859_migration.up,
    down: migration_20251005_184859_migration.down,
    name: '20251005_184859_migration',
  },
]
