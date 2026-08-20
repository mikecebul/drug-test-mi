const memoryBackedFiles = new WeakMap<File, Promise<File>>()

/**
 * Copy a browser-selected file into memory before it crosses a server boundary.
 *
 * WebKit bug 319985 can send disk-backed Files with an empty multipart body on
 * iPadOS. Reading the bytes first and wrapping them in a new File avoids that
 * transport bug while preserving the File contract used by TanStack Form.
 *
 * @see https://bugs.webkit.org/show_bug.cgi?id=319985
 */
export async function materializeBrowserFile(file: File): Promise<File> {
  const cachedFile = memoryBackedFiles.get(file)
  if (cachedFile) {
    return cachedFile
  }

  const materializedFile = file.arrayBuffer().then((bytes) => {
    if (bytes.byteLength !== file.size) {
      throw new Error('The browser did not read the entire file. Please select the report again.')
    }

    return new File([bytes], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    })
  })

  memoryBackedFiles.set(file, materializedFile)

  try {
    return await materializedFile
  } catch (error) {
    memoryBackedFiles.delete(file)
    throw error
  }
}
