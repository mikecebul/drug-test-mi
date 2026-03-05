'use client'

import React from 'react'
import { useFieldContext } from '../hooks/form-context'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemDelete,
} from '@/components/ui/file-upload'
import { useStore } from '@tanstack/react-form'

interface FileUploadFieldProps {
  label?: string
  description?: string
  accept?: string
  maxFiles?: number
  maxSize?: number
  required?: boolean
}

export default function FileUploadField({
  label,
  description,
  accept = 'application/pdf',
  maxFiles = 1,
  maxSize = 10 * 1024 * 1024, // 10MB default
  required = false,
}: FileUploadFieldProps) {
  const field = useFieldContext<File | null>()
  const fieldErrors = useStore(field.store, (state) => state.meta.errors)
  const [error, setError] = React.useState<string>('')
  const combinedErrors = error ? [error, ...fieldErrors] : fieldErrors
  const hasErrors = combinedErrors.length > 0

  const files = field.state.value ? [field.state.value] : []

  const handleFileValidate = (file: File): string | null => {
    // Validate file type
    if (accept && file.type !== accept) {
      return `Please select a ${accept} file`
    }

    // Validate file size
    if (maxSize && file.size > maxSize) {
      return `File size must be less than ${(maxSize / 1024 / 1024).toFixed(0)}MB`
    }

    return null
  }

  const handleFileReject = (_file: File, message: string) => {
    setError(message)
  }

  const handleFileAccept = (_file: File) => {
    setError('')
  }

  const handleValueChange = (newFiles: File[]) => {
    if (newFiles.length === 0) {
      setError('')
      field.handleChange(null)
    } else {
      field.handleChange(newFiles[0])
    }
  }

  return (
    <Field className="min-h-48" data-invalid={hasErrors}>
      {label ? (
        <FieldLabel>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FieldLabel>
      ) : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}

      <FileUpload
        value={files}
        onValueChange={handleValueChange}
        onFileValidate={handleFileValidate}
        onFileReject={handleFileReject}
        onFileAccept={handleFileAccept}
        accept={accept}
        maxFiles={maxFiles}
        maxSize={maxSize}
      >
        <FileUploadDropzone>
          <div className="flex min-h-32 flex-col items-center justify-center space-y-2 text-center">
            <p className="text-sm font-medium">Click to upload or drag and drop</p>
            <p className="text-muted-foreground text-xs">
              {accept.includes('pdf') ? 'PDF files' : 'Files'} up to {(maxSize / 1024 / 1024).toFixed(0)}MB
            </p>
          </div>
        </FileUploadDropzone>

        <FileUploadList>
          {files.map((file) => (
            <FileUploadItem key={file.name} value={file}>
              <FileUploadItemPreview />
              <FileUploadItemMetadata />
              <FileUploadItemDelete asChild>
                <Button type="button" variant="ghost" size="default">
                  <XCircle className="stroke-destructive size-5" />
                </Button>
              </FileUploadItemDelete>
            </FileUploadItem>
          ))}
        </FileUploadList>
      </FileUpload>

      <FieldError errors={combinedErrors} />
    </Field>
  )
}
