import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

type DuplicateJobRunGroup = {
  _id: string
  count: number
  keepId: unknown
  rowIds: unknown[]
}

const JOB_ID_INDEX_NAME = 'jobId_1'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const model = payload.db.collections['job-runs']
  await model.createCollection()

  const duplicateGroups = await model
    .aggregate<DuplicateJobRunGroup>([
      {
        $match: {
          jobId: { $type: 'string' },
        },
      },
      {
        $addFields: {
          _jobRunAttemptRank: { $ifNull: ['$attemptCount', -1] },
          _jobRunStatusRank: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'cancelled'] }, then: 6 },
                { case: { $eq: ['$status', 'succeeded'] }, then: 5 },
                { case: { $eq: ['$status', 'manual-review'] }, then: 5 },
                { case: { $eq: ['$status', 'failed'] }, then: 4 },
                { case: { $eq: ['$status', 'running'] }, then: 3 },
                { case: { $eq: ['$status', 'queued'] }, then: 1 },
              ],
              default: 0,
            },
          },
        },
      },
      {
        $sort: {
          jobId: 1,
          _jobRunAttemptRank: -1,
          _jobRunStatusRank: -1,
          updatedAt: -1,
        },
      },
      {
        $group: {
          _id: '$jobId',
          count: { $sum: 1 },
          keepId: { $first: '$_id' },
          rowIds: { $push: '$_id' },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ])
    .exec()

  let removedCount = 0
  for (const group of duplicateGroups) {
    const duplicateIds = group.rowIds.filter((id) => String(id) !== String(group.keepId))
    if (duplicateIds.length === 0) continue

    const result = await model.deleteMany({ _id: { $in: duplicateIds } })
    removedCount += result.deletedCount
  }

  const existingIndex = (await model.collection.indexes()).find((index) => index.name === JOB_ID_INDEX_NAME)
  if (existingIndex && !existingIndex.unique) {
    await model.collection.dropIndex(JOB_ID_INDEX_NAME)
  }

  await model.collection.createIndex({ jobId: 1 }, { name: JOB_ID_INDEX_NAME, unique: true })
  payload.logger.info(`Job run uniqueness migration complete. Removed ${removedCount} duplicate row(s).`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const model = payload.db.collections['job-runs']
  await model.createCollection()
  const existingIndex = (await model.collection.indexes()).find((index) => index.name === JOB_ID_INDEX_NAME)

  if (existingIndex) {
    await model.collection.dropIndex(JOB_ID_INDEX_NAME)
  }

  await model.collection.createIndex({ jobId: 1 }, { name: JOB_ID_INDEX_NAME })
  payload.logger.info('Restored the non-unique jobId index for job run history.')
}
