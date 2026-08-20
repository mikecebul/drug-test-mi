import { describe, expect, test, vi } from 'vitest'
import { materializeBrowserFile } from '../materializeBrowserFile'

describe('materializeBrowserFile', () => {
  test('creates a memory-backed File with the original bytes and metadata', async () => {
    const original = new File([new Uint8Array([37, 80, 68, 70])], 'report.pdf', {
      type: 'application/pdf',
      lastModified: 1_723_456_789,
    })

    const materialized = await materializeBrowserFile(original)

    expect(materialized).not.toBe(original)
    expect(materialized).toBeInstanceOf(File)
    expect(materialized.name).toBe(original.name)
    expect(materialized.type).toBe(original.type)
    expect(materialized.size).toBe(original.size)
    expect(materialized.lastModified).toBe(original.lastModified)
    expect(new Uint8Array(await materialized.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]))
  })

  test('reads each selected File only once', async () => {
    const original = new File(['pdf'], 'report.pdf', { type: 'application/pdf' })
    const arrayBufferSpy = vi.spyOn(original, 'arrayBuffer')

    const [first, second] = await Promise.all([materializeBrowserFile(original), materializeBrowserFile(original)])

    expect(first).toBe(second)
    expect(arrayBufferSpy).toHaveBeenCalledTimes(1)
  })

  test('rejects a partial browser read and allows a later retry', async () => {
    const original = new File(['pdf'], 'report.pdf', { type: 'application/pdf' })
    const arrayBufferSpy = vi
      .spyOn(original, 'arrayBuffer')
      .mockResolvedValueOnce(new ArrayBuffer(0))
      .mockResolvedValueOnce(new TextEncoder().encode('pdf').buffer)

    await expect(materializeBrowserFile(original)).rejects.toThrow('did not read the entire file')
    await expect(materializeBrowserFile(original)).resolves.toBeInstanceOf(File)
    expect(arrayBufferSpy).toHaveBeenCalledTimes(2)
  })
})
