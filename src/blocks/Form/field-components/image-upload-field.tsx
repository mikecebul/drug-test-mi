'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useFieldContext } from '../hooks/form-context'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Camera, Upload, XCircle, Crop, Check, X } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import Cropper, { type Area } from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'

interface ImageUploadFieldProps {
  label?: string
  description?: string
  accept?: string
  maxSize?: number
  required?: boolean
  aspectRatio?: number
}

// Helper function to create cropped image
const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob> => {
  const image = new Image()
  image.src = imageSrc

  await new Promise((resolve) => {
    image.onload = resolve
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'))
        return
      }
      resolve(blob)
    }, 'image/jpeg', 0.95)
  })
}

export default function ImageUploadField({
  label,
  description,
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  required = false,
  aspectRatio = 1, // Square by default (for headshots)
}: ImageUploadFieldProps) {
  const field = useFieldContext<File | null>()
  const fieldErrors = useStore(field.store, (state) => state.meta.errors)

  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [showCropper, setShowCropper] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [originalFileName, setOriginalFileName] = useState<string>('image.jpg')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileValidate = (file: File): string | null => {
    // Validate file type
    if (accept && !file.type.match(accept.replace('*', '.*'))) {
      return `Please select a valid image file`
    }

    // Validate file size
    if (maxSize && file.size > maxSize) {
      return `File size must be less than ${(maxSize / 1024 / 1024).toFixed(0)}MB`
    }

    return null
  }

  const handleFileSelect = (file: File) => {
    const validationError = handleFileValidate(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setOriginalFileName(file.name)

    // Create preview and open cropper
    const reader = new FileReader()
    reader.onloadend = () => {
      setTempImage(reader.result as string)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropSave = async () => {
    if (!tempImage || !croppedAreaPixels) return

    try {
      const croppedBlob = await createCroppedImage(tempImage, croppedAreaPixels)

      // Convert blob to File
      const croppedFile = new File([croppedBlob], originalFileName, {
        type: 'image/jpeg',
      })

      // Update field value
      field.handleChange(croppedFile)

      // Create preview
      const previewUrl = URL.createObjectURL(croppedBlob)
      setPreview(previewUrl)

      // Close cropper
      setShowCropper(false)
      setTempImage(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    } catch (error) {
      console.error('Error cropping image:', error)
      setError('Failed to crop image. Please try again.')
    }
  }

  const handleCropCancel = () => {
    setShowCropper(false)
    setTempImage(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const handleRemove = () => {
    field.handleChange(null)
    setPreview(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {label && (
        <label className="text-foreground text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      {description && <p className="text-muted-foreground text-sm">{description}</p>}

      {/* Preview */}
      {preview && !showCropper && (
        <div className="relative w-48 h-48 border-2 border-border rounded-lg overflow-hidden bg-muted">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Upload buttons */}
      {!preview && !showCropper && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Camera input (mobile devices) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept={accept}
            capture="environment" // Use rear camera
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
          </Button>

          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>
      )}

      {/* Error messages */}
      {(error || fieldErrors.length > 0) && (
        <Alert variant="destructive">
          <AlertDescription>{error || fieldErrors[0]?.message}</AlertDescription>
        </Alert>
      )}

      {/* Cropper Dialog */}
      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5" />
              Crop Image
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cropper */}
            <div className="relative h-96 bg-muted rounded-lg overflow-hidden">
              {tempImage && (
                <Cropper
                  image={tempImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspectRatio}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            {/* Zoom slider */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Zoom</label>
              <Slider
                value={[zoom]}
                onValueChange={([value]) => setZoom(value)}
                min={1}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCropCancel}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCropSave}
              >
                <Check className="mr-2 h-4 w-4" />
                Apply Crop
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
