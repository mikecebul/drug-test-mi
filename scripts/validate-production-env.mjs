import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const inventoryPath = path.join(root, 'env/production.env.example')
const dockerfilePath = path.join(root, 'Dockerfile')
const deployWorkflowPath = path.join(root, '.github/workflows/deploy.yml')

const BUILD_AND_RUNTIME_HEADER = '# Build + runtime'
const RUNTIME_ONLY_HEADER = '# Runtime only today'
const EXCLUDED_HEADER = '# Not production app runtime secrets'

function parseInventory(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const build = new Set()
  const runtime = new Set()
  const excluded = new Set()
  let section = ''

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()

    if (line === BUILD_AND_RUNTIME_HEADER) {
      section = 'build'
      continue
    }

    if (line === RUNTIME_ONLY_HEADER) {
      section = 'runtime'
      continue
    }

    if (line === EXCLUDED_HEADER) {
      section = 'excluded'
      continue
    }

    const match = line.match(/^([A-Z0-9_]+)=/)
    if (!match) continue

    const key = match[1]

    if (section === 'build') build.add(key)
    if (section === 'runtime') runtime.add(key)
    if (section === 'excluded') excluded.add(key)
  }

  return { build, runtime, excluded }
}

function parseDockerBuildSecrets(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const matches = content.matchAll(/--mount=type=secret,id=([A-Z0-9_]+),env=/g)
  return new Set(Array.from(matches, (match) => match[1]))
}

function parseDeployWorkflowSecrets(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const jobMatches = content.matchAll(/build-and-push-dockerfile-image-[\w-]+:[\s\S]*?secrets:\s*\|([\s\S]*?)(?:\n\s*\n|\n\s{2}[A-Za-z0-9_-]+:|\n$)/g)
  const jobs = []

  for (const jobMatch of jobMatches) {
    const secretsBlock = jobMatch[1]
    const secrets = new Set()

    for (const line of secretsBlock.split('\n')) {
      const match = line.trim().match(/^([A-Z0-9_]+)=\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}$/)
      if (match) secrets.add(match[1])
    }

    jobs.push(secrets)
  }

  return jobs
}

function diffSet(left, right) {
  return Array.from(left).filter((item) => !right.has(item)).sort()
}

function fail(message, details = []) {
  console.error(`\n[validate-production-env] ${message}`)
  for (const detail of details) {
    console.error(`- ${detail}`)
  }
  process.exitCode = 1
}

const inventory = parseInventory(inventoryPath)
const dockerSecrets = parseDockerBuildSecrets(dockerfilePath)
const workflowSecretsByJob = parseDeployWorkflowSecrets(deployWorkflowPath)

if (workflowSecretsByJob.length === 0) {
  fail('Could not find any Docker build secret blocks in deploy workflow.')
}

const buildInventory = inventory.build
const disallowedBuildSecrets = new Set([...inventory.runtime, ...inventory.excluded])

const dockerMissing = diffSet(buildInventory, dockerSecrets)
const dockerExtra = diffSet(dockerSecrets, buildInventory)

if (dockerMissing.length > 0 || dockerExtra.length > 0) {
  fail('Dockerfile build secret mounts are out of sync with env/production.env.example.', [
    ...(dockerMissing.length > 0 ? [`Missing in Dockerfile: ${dockerMissing.join(', ')}`] : []),
    ...(dockerExtra.length > 0 ? [`Unexpected in Dockerfile: ${dockerExtra.join(', ')}`] : []),
  ])
}

workflowSecretsByJob.forEach((jobSecrets, index) => {
  const missing = diffSet(buildInventory, jobSecrets)
  const extra = diffSet(jobSecrets, buildInventory)

  if (missing.length > 0 || extra.length > 0) {
    fail(`Deploy workflow job #${index + 1} build secrets are out of sync with env/production.env.example.`, [
      ...(missing.length > 0 ? [`Missing in workflow: ${missing.join(', ')}`] : []),
      ...(extra.length > 0 ? [`Unexpected in workflow: ${extra.join(', ')}`] : []),
    ])
  }
})

const explicitlyDisallowedInDocker = Array.from(dockerSecrets).filter((key) => disallowedBuildSecrets.has(key)).sort()
const explicitlyDisallowedInWorkflow = workflowSecretsByJob.flatMap((jobSecrets, index) =>
  Array.from(jobSecrets)
    .filter((key) => disallowedBuildSecrets.has(key))
    .sort()
    .map((key) => `job #${index + 1}: ${key}`),
)

if (explicitlyDisallowedInDocker.length > 0) {
  fail('Dockerfile includes runtime-only or excluded secrets in build mounts.', explicitlyDisallowedInDocker)
}

if (explicitlyDisallowedInWorkflow.length > 0) {
  fail('Deploy workflow includes runtime-only or excluded secrets in build secret blocks.', explicitlyDisallowedInWorkflow)
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}

console.log('[validate-production-env] Production env inventory, Dockerfile, and deploy workflow are aligned.')
