import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const migrationsDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url))

describe('Payload migration discovery', () => {
  it('keeps helper modules out of the migrations directory', () => {
    const migrationFiles = readdirSync(migrationsDirectory).filter(
      (filename) => filename.endsWith('.ts') && filename !== 'index.ts',
    )

    expect(migrationFiles.length).toBeGreaterThan(0)

    for (const filename of migrationFiles) {
      const source = readFileSync(`${migrationsDirectory}/${filename}`, 'utf8')

      expect(source, `${filename} must export an up migration`).toMatch(/export\s+async\s+function\s+up\b/)
      expect(source, `${filename} must export a down migration`).toMatch(/export\s+async\s+function\s+down\b/)
    }
  })
})
