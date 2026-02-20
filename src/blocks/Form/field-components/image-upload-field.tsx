'use client'

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import { useStore } from '@tanstack/react-form'
import { useFieldContext } from '../hooks/form-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Camera, Check, Crop as CropIcon, Upload, X, XCircle } from 'lucide-react'
import {
  createCenteredAspectCrop,
  cropImageToJpegBlob,
  resolvePixelCropForSave,
  toJpegFileName,
} from '@/lib/image-crop'

interface ImageUploadFieldProps {
  label?: string
  description?: string
  accept?: string
  maxSize?: number
  required?: boolean
  aspectRatio?: number
}

export default function ImageUploadField({
  label,
  description,
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024,
  required = false,
  aspectRatio = 1,
}: ImageUploadFieldProps) {
  const field = useFieldContext<File | null>()
  const fieldErrors = useStore(field.store, (state) => state.meta.errors)

  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const combinedErrors = error ? [error, ...fieldErrors] : fieldErrors
  const hasErrors = combinedErrors.length > 0
  const [showCropper, setShowCropper] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [originalFileName, setOriginalFileName] = useState('image.jpg')

  const imageRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  const resetCropState = useCallback(() => {
    setShowCropper(false)
    setTempImage(null)
    setCrop(undefined)
    setCompletedCrop(null)
  }, [])

  const handleFileValidate = useCallback(
    (file: File): string | null => {
      if (accept && !file.type.match(accept.replace('*', '.*'))) {
        return 'Please select a valid image file'
      }

      if (maxSize && file.size > maxSize) {
        return `File size must be less than ${(maxSize / 1024 / 1024).toFixed(0)}MB`
      }

      return null
    },
    [accept, maxSize],
  )

  const handleFileSelect = useCallback(
    (file: File) => {
      const validationError = handleFileValidate(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError('')
      setOriginalFileName(file.name)

      const reader = new FileReader()
      reader.onloadend = () => {
        setTempImage((reader.result as string) ?? null)
        setShowCropper(true)
      }
      reader.readAsDataURL(file)
    },
    [handleFileValidate],
  )

  const onImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = event.currentTarget
      if (aspectRatio > 0) {
        setCrop(createCenteredAspectCrop(naturalWidth, naturalHeight, aspectRatio))
      } else {
        setCrop({ unit: '%', x: 5, y: 5, width: 90, height: 90 })
      }
    },
    [aspectRatio],
  )

  const handleCropSave = useCallback(async () => {
    if (!tempImage || !imageRef.current) return

    const pixelCrop = resolvePixelCropForSave({
      image: imageRef.current,
      crop,
      completedCrop,
    })

    if (!pixelCrop) {
      setError('Please choose a crop area before applying.')
      return
    }

    try {
      const croppedBlob = await cropImageToJpegBlob(imageRef.current, pixelCrop, {
        maxOutputSize: 1600,
        quality: 0.95,
      })

      const croppedFile = new File([croppedBlob], toJpegFileName(originalFileName), {
        type: 'image/jpeg',
      })

      field.handleChange(croppedFile)

      const previewUrl = URL.createObjectURL(croppedBlob)
      setPreview((previousPreview) => {
        if (previousPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(previousPreview)
        }
        return previewUrl
      })

      resetCropState()
    } catch (cropError) {
      console.error('Error cropping image:', cropError)
      setError('Failed to crop image. Please try again.')
    }
  }, [completedCrop, crop, field, originalFileName, resetCropState, tempImage])

  const canApplyCrop = Boolean(
    resolvePixelCropForSave({
      image: imageRef.current,
      crop,
      completedCrop,
    }),
  )

  const handleRemove = useCallback(() => {
    field.handleChange(null)
    setError('')
    setPreview((previousPreview) => {
      if (previousPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(previousPreview)
      }
      return null
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }, [field])

  return (
    <Field className="space-y-4" data-invalid={hasErrors}>
      {label ? (
        <FieldLabel>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FieldLabel>
      ) : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}

      {preview && !showCropper && (
        <div className="bg-muted relative h-48 w-48 overflow-hidden rounded-lg border-2 border-border">
          <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          <Button type="button" size="sm" variant="destructive" className="absolute top-2 right-2" onClick={handleRemove}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!preview && !showCropper && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={cameraInputRef}
            type="file"
            accept={accept}
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFileSelect(file)
              event.currentTarget.value = ''
            }}
          />
          <Button type="button" variant="outline" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFileSelect(file)
              event.currentTarget.value = ''
            }}
          />
          <Button type="button" variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>
      )}

      <FieldError errors={combinedErrors} />

      <Dialog open={showCropper} onOpenChange={(open) => (!open ? resetCropState() : setShowCropper(true))}>
        <DialogContent className="max-h-[94vh] w-[95vw] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="h-5 w-5" />
              Crop Image
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-[65vh] overflow-auto rounded-lg bg-muted p-2">
              {tempImage && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(pixelCrop) =>
                    setCompletedCrop(pixelCrop.width > 0 && pixelCrop.height > 0 ? pixelCrop : null)
                  }
                  aspect={aspectRatio > 0 ? aspectRatio : undefined}
                  keepSelection={true}
                  className="mx-auto w-fit"
                >
                  <img
                    ref={imageRef}
                    src={tempImage}
                    alt="Crop preview"
                    onLoad={onImageLoad}
                    className="max-h-[60vh] w-auto max-w-full object-contain"
                  />
                </ReactCrop>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetCropState}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="button" onClick={handleCropSave} disabled={!canApplyCrop}>
                <Check className="mr-2 h-4 w-4" />
                Apply Crop
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Field>
  )
}
