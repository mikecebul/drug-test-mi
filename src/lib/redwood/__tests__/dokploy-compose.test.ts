import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Dokploy Redwood runtime configuration', () => {
  const compose = readFileSync(resolve(process.cwd(), 'docker-compose.dokploy.yml'), 'utf8')

  it('forces automation on for both branch-test containers', () => {
    expect(compose.match(/REDWOOD_AUTOMATION_ENABLED: ['"]true['"]/g) || []).toHaveLength(2)
    expect(compose).not.toContain('${REDWOOD_AUTOMATION_ENABLED')
  })

  it('requires credentials for both branch-test containers', () => {
    expect(compose.match(/REDWOOD_USERNAME: ['"]\$\{REDWOOD_USERNAME:\?/g) || []).toHaveLength(2)
    expect(compose.match(/REDWOOD_PASSWORD: ['"]\$\{REDWOOD_PASSWORD:\?/g) || []).toHaveLength(2)
  })
})
