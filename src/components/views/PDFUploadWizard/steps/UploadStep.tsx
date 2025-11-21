'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload as UploadIcon, XCircle } from 'lucide-react'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemDelete,
} from '@/components/ui/file-upload'

interface UploadStepProps {
  onNext: (file: File) => void
}

export function UploadStep({ onNext }: UploadStepProps) {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string>('')

  const handleFileValidate = (file: File): string | null => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      return 'Please select a PDF file'
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB'
    }

    return null
  }

  const handleFileReject = (file: File, message: string) => {
    setError(message)
  }

  const handleFileAccept = (file: File) => {
    setError('')
  }

  const handleValueChange = (newFiles: File[]) => {
    setFiles(newFiles)
    if (newFiles.length === 0) {
      setError('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Upload Drug Test PDF</h2>
        <p className="text-muted-foreground">Select a PDF file from your 15-panel instant test</p>
      </div>

      <FileUpload
        value={files}
        onValueChange={handleValueChange}
        onFileValidate={handleFileValidate}
        onFileReject={handleFileReject}
        onFileAccept={handleFileAccept}
        accept="application/pdf"
        maxFiles={1}
        maxSize={10 * 1024 * 1024}
      >
        <FileUploadDropzone>
          <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">PDF files up to 10MB</p>
          </div>
        </FileUploadDropzone>

        <FileUploadList>
          {files.map((file) => (
            <FileUploadItem key={file.name} value={file}>
              <FileUploadItemPreview />
              <FileUploadItemMetadata />
              <FileUploadItemDelete asChild>
                <Button type="button" variant="ghost" size="icon">
                  <XCircle className="h-4 w-4" />
                </Button>
              </FileUploadItemDelete>
            </FileUploadItem>
          ))}
        </FileUploadList>
      </FileUpload>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button disabled={files.length === 0} onClick={() => files[0] && onNext(files[0])}>
          Next: Extract Data
        </Button>
      </div>
    </div>
  )
}
