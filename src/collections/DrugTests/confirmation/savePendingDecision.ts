import type { PayloadRequest } from 'payload'
import type { DrugTest } from '@/payload-types'

/** An unpaid decision changes one test, never the ledger or client credit. */
export async function savePendingDecision(req: PayloadRequest, test: DrugTest, changes: Partial<DrugTest>) {
  const collection = req.payload.collections['drug-tests'].config
  // The caller already checked admin access. Read the same version internally so masked
  // read-only fields (such as the cached client name) are never written back as false.
  const stored = (await req.payload.db.findOne({
    collection: 'drug-tests',
    where: { and: [{ id: { equals: test.id } }, { updatedAt: { equals: test.updatedAt } }] },
    req,
  })) as unknown as DrugTest | null
  if (!stored) throw new Error('This test changed while saving the decision. Review it and try again.')
  let data: Record<string, unknown> = { ...stored, ...changes }
  delete data.id
  // Run the collection's classification, payer and confirmation hooks just as a normal update does.
  for (const hook of collection.hooks?.beforeChange || []) {
    data =
      (await hook({ data, originalDoc: stored, req, collection, operation: 'update', context: req.context })) || data
  }
  data.updatedAt = new Date(Math.max(Date.now(), Date.parse(test.updatedAt) + 1)).toISOString()
  // Compare the version in the write itself. A concurrent payment or another technician's edit must win intact.
  const saved = (await req.payload.db.updateOne({
    collection: 'drug-tests',
    where: { and: [{ id: { equals: test.id } }, { updatedAt: { equals: test.updatedAt } }] },
    data,
    req,
  })) as unknown as DrugTest | null
  if (!saved) throw new Error('This test changed while saving the decision. Review it and try again.')
  let doc: DrugTest = saved
  for (const hook of collection.hooks?.afterChange || []) {
    doc =
      (await hook({ doc, data, previousDoc: stored, req, collection, operation: 'update', context: req.context })) ||
      doc
  }
  return doc
}
