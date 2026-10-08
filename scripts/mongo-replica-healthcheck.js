/* global db, rs, quit, print */

// Bootstrap new and existing local volumes once. No application records are changed.
try {
  const status = rs.status()
  if (status.set !== 'rs0') {
    print('Expected the local rs0 replica set.')
    quit(1)
  }
  // A successful initiation does not mean the primary election has finished.
  quit(db.hello().isWritablePrimary ? 0 : 1)
} catch (error) {
  if (error.code !== 94) {
    print(error.codeName || 'Replica set not ready.')
    quit(1)
  }
  rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo:27017' }] })
  quit(1)
}
