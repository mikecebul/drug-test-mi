'use client'

import { useState, useCallback, useRef } from 'react'
import { formatDateOnly } from '@/lib/date-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/utilities/cn'
import { Button } from '@/components/ui/button'
import { Camera, Upload, X, Check, Crop, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import Cropper, { type Area } from 'react-easy-crop'
import { toast } from 'sonner'
import type { SimpleClient } from './getClients'
import { uploadHeadshot } from './uploadHeadshot'

interface ClientInfoCardEditableProps {
  client: SimpleClient
  currentNewHeadshot: File | null
  onHeadshotChange: (file: File | null) => void
  /** Called after successful immediate upload with the new headshot URL */
  onHeadshotUploaded?: (url: string) => void
}

const createCroppedImage = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
  const image = new Image()
  image.src = imageSrc

  await new Promise((resolve) => {
    image.onload = resolve
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)

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

export function ClientInfoCardEditable({ client, currentNewHeadshot, onHeadshotChange, onHeadshotUploaded }: ClientInfoCardEditableProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [originalFileName, setOriginalFileName] = useState('headshot.jpg')
  const [isUploading, setIsUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Derive the avatar src: new upload preview > existing headshot URL > null (fallback)
  const avatarSrc = previewUrl ?? client.headshot ?? undefined
  const hasImage = !!avatarSrc

  const handleFileSelect = (file: File) => {
    if (!file.type.match(/image\/.*/)) return
    setOriginalFileName(file.name)
    const reader = new FileReader()
    reader.onloadend = () => {
      setTempImage(reader.result as string)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleCropSave = async () => {
    if (!tempImage || !croppedAreaPixels) return

    try {
      const croppedBlob = await createCroppedImage(tempImage, croppedAreaPixels)
      const croppedFile = new File([croppedBlob], originalFileName, { type: 'image/jpeg' })

      // Show preview immediately
      const localPreviewUrl = URL.createObjectURL(croppedBlob)
      setPreviewUrl(localPreviewUrl)
      setShowCropper(false)
      setTempImage(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)

      // If onHeadshotUploaded is provided, upload immediately (for existing clients)
      if (onHeadshotUploaded && client.id) {
        setIsUploading(true)
        try {
          // Serialize file for server action
          const arrayBuffer = await croppedFile.arrayBuffer()
          const buffer = Array.from(new Uint8Array(arrayBuffer))

          const result = await uploadHeadshot(client.id, buffer, croppedFile.type, croppedFile.name)

          if (result.success && result.url) {
            // Upload succeeded - update form with new URL and clear the file
            onHeadshotUploaded(result.url)
            onHeadshotChange(null)
            toast.success('Headshot uploaded')
          } else {
            // Upload failed - keep file for submission-time fallback
            console.error('Headshot upload failed:', result.error)
            onHeadshotChange(croppedFile)
            toast.error('Failed to upload headshot - will retry on submit')
          }
        } catch (error) {
          console.error('Headshot upload error:', error)
          onHeadshotChange(croppedFile)
          toast.error('Failed to upload headshot - will retry on submit')
        } finally {
          setIsUploading(false)
        }
      } else {
        // No immediate upload callback - just store the file (for new registrations)
        onHeadshotChange(croppedFile)
      }
    } catch {
      console.error('Error cropping headshot image')
      toast.error('Failed to crop image')
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
    onHeadshotChange(null)
    setPreviewUrl(null)
  }

  return (
    <>
      <div
        className={cn(
          'relative w-full rounded-lg border p-6',
          'text-primary bg-info-muted border-info',
          'flex h-full items-center gap-6',
        )}
      >
        {/* Avatar with upload overlay */}
        <div className="relative shrink-0">
          <Avatar className="size-16 lg:size-24">
            <AvatarImage src={avatarSrc} alt={`${client.firstName} ${client.lastName}`} />
            <AvatarFallback className="text-lg">
              {client.firstName?.charAt(0)}
              {client.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>

          {/* Camera/upload trigger button or loading indicator */}
          {isUploading ? (
            <div
              className={cn(
                'absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm',
                'bg-primary text-primary-foreground',
                'size-7 lg:size-8',
              )}
            >
              <Loader2 className="size-3.5 lg:size-4 animate-spin" />
            </div>
          ) : (
            <button
              type="button"
              aria-label="Upload headshot photo"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm',
                'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                hasImage ? 'size-6 lg:size-7' : 'size-7 lg:size-8',
              )}
            >
              <Camera className={hasImage ? 'size-3 lg:size-3.5' : 'size-3.5 lg:size-4'} />
            </button>
          )}

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col space-y-3">
          <h3 className="text-2xl leading-tight font-bold tracking-tight lg:text-3xl">
            {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
            {client.lastName}
          </h3>

          <div className="text-muted-foreground">
            <p>{client.email}</p>
            {client.dob && <p>DOB: {formatDateOnly(client.dob)}</p>}
            {client.phone && <p>Phone: {client.phone}</p>}
          </div>

          {/* Action buttons below details */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading}
            >
              <Camera className="mr-1.5 size-3.5" />
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="mr-1.5 size-3.5" />
              Upload Photo
            </Button>
            {(currentNewHeadshot || previewUrl) && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={isUploading}>
                <X className="mr-1.5 size-3.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Crop Dialog */}
      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="size-5" />
              Crop Headshot
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative h-96 overflow-hidden rounded-lg bg-muted">
              {tempImage && (
                <Cropper
                  image={tempImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCropCancel}>
                <X className="mr-2 size-4" />
                Cancel
              </Button>
              <Button type="button" onClick={handleCropSave}>
                <Check className="mr-2 size-4" />
                Apply Crop
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
