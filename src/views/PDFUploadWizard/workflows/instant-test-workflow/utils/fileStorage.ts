/**
 * Utilities for persisting uploaded files to localStorage
 * Used to maintain file state when navigating away (e.g., to register a new client)
 */

const STORAGE_KEY = 'instant-test-uploaded-file'

interface StoredFile {
  name: string
  type: string
  size: number
  lastModified: number
  dataUrl: string // base64 encoded file data
}

/**
 * Save a File to localStorage as base64
 */
export async function saveFileToStorage(file: File): Promise<void> {
  try {
    const reader = new FileReader()

    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    const storedFile: StoredFile = {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      dataUrl,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedFile))
  } catch (error) {
    console.error('Failed to save file to storage:', error)
  }
}

/**
 * Retrieve a File from localStorage
 */
export async function getFileFromStorage(): Promise<File | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const storedFile: StoredFile = JSON.parse(stored)

    // Convert base64 back to File
    const response = await fetch(storedFile.dataUrl)
    const blob = await response.blob()

    const file = new File([blob], storedFile.name, {
      type: storedFile.type,
      lastModified: storedFile.lastModified,
    })

    return file
  } catch (error) {
    console.error('Failed to retrieve file from storage:', error)
    return null
  }
}

/**
 * Clear the stored file from localStorage
 */
export function clearFileStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear file storage:', error)
  }
}

/**
 * Check if a file is currently stored
 */
export function hasStoredFile(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch (error) {
    return false
  }
}
