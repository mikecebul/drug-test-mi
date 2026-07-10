/**
 * Utilities for persisting uploaded files to localStorage
 * Used to maintain file state when navigating away (e.g., to register a new client)
 */

import type { ParsedPDFData } from '@/views/DrugTestWizard/types'

const STORAGE_KEY = 'instant-test-uploaded-file'
const EXTRACTED_DATA_STORAGE_KEY = 'instant-test-extracted-data'

interface StoredFile {
  name: string
  type: string
  size: number
  lastModified: number
  dataUrl: string // base64 encoded file data
}

type StoredFileFingerprint = Pick<StoredFile, 'name' | 'type' | 'size' | 'lastModified'>

interface StoredExtractedData {
  file: StoredFileFingerprint
  data: ParsedPDFData
}

function getFileFingerprint(file: File): StoredFileFingerprint {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
  }
}

function isSameStoredFile(file: File, storedFile: StoredFileFingerprint) {
  const fingerprint = getFileFingerprint(file)
  return (
    fingerprint.name === storedFile.name &&
    fingerprint.type === storedFile.type &&
    fingerprint.size === storedFile.size &&
    fingerprint.lastModified === storedFile.lastModified
  )
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
    localStorage.removeItem(EXTRACTED_DATA_STORAGE_KEY)
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
  } catch (_error) {
    return false
  }
}

export function saveExtractedDataToStorage(file: File, data: ParsedPDFData): void {
  try {
    const storedData: StoredExtractedData = {
      file: getFileFingerprint(file),
      data,
    }

    localStorage.setItem(EXTRACTED_DATA_STORAGE_KEY, JSON.stringify(storedData))
  } catch (error) {
    console.error('Failed to save extracted data to storage:', error)
  }
}

export function getExtractedDataFromStorage(file: File): ParsedPDFData | null {
  try {
    const stored = localStorage.getItem(EXTRACTED_DATA_STORAGE_KEY)
    if (!stored) return null

    const storedData: StoredExtractedData = JSON.parse(stored)
    if (!storedData?.file || !isSameStoredFile(file, storedData.file)) return null

    return storedData.data
  } catch (error) {
    console.error('Failed to retrieve extracted data from storage:', error)
    return null
  }
}
