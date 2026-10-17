import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const mongoose = createRequire(require.resolve('@payloadcms/db-mongodb'))('mongoose')
let connection

try {
  const uri = process.env.DATABASE_URI
  if (!uri) throw new Error('Set DATABASE_URI in this repo’s .env.')
  const url = new URL(uri)
  const database = url.pathname.slice(1)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/^drug-test-mi[\w-]*$/.test(database))
    throw new Error('This check is only for a local drug-test-mi development database.')

  connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise()
  const hello = await connection.db.admin().command({ hello: 1 })
  if (!hello.setName || !hello.isWritablePrimary)
    throw new Error(
      'MongoDB must be a writable replica-set primary for payment transactions. Run docker compose up -d --wait and check DATABASE_URI.',
    )
  if (hello.setName !== 'drug-test-mi-payments')
    throw new Error('DATABASE_URI points to a different replica set; expected drug-test-mi-payments.')
  console.log(`Development database ready: ${database}, replica set ${hello.setName}, port ${url.port || '27017'}.`)
} catch (error) {
  // Driver errors can include connection details. Only expose our configuration guidance.
  const message =
    error instanceof Error && error.name === 'Error'
      ? error.message
      : 'Cannot connect to the development database. Start Docker, run docker compose up -d --wait, and check DATABASE_URI.'
  console.error(message)
  process.exitCode = 1
} finally {
  await connection?.close()
}
