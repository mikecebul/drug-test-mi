import * as migration_20251005_184859_migration from './20251005_184859_migration';
import * as migration_20251017_145316_migration from './20251017_145316_migration';
import * as migration_20251211_191941_migration from './20251211_191941_migration';

export const migrations = [
  {
    up: migration_20251005_184859_migration.up,
    down: migration_20251005_184859_migration.down,
    name: '20251005_184859_migration',
  },
  {
    up: migration_20251017_145316_migration.up,
    down: migration_20251017_145316_migration.down,
    name: '20251017_145316_migration',
  },
  {
    up: migration_20251211_191941_migration.up,
    down: migration_20251211_191941_migration.down,
    name: '20251211_191941_migration'
  },
];
