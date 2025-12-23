/**
 * Type guard to check if a value is a Payload document (not an ID)
 * @param doc - Value that could be a document, ID, or undefined
 * @returns true if doc is a document object with an id property
 */
function isDoc<T extends { id: unknown }>(doc: T | number | string | undefined | null): doc is T {
  return doc != null && typeof doc === 'object' && 'id' in doc
}

export default isDoc
