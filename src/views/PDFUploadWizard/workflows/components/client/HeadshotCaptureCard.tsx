'use client'

import { useCallback, useRef, useState, type SyntheticEvent } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/utilities/cn'
import { Camera, Check, Crop as CropIcon, Loader2, X } from 'lucide-react'
import { formatDateOnly } from '@/lib/date-utils'
import { toast } from 'sonner'
import { createCenteredAspectCrop, cropImageToJpegBlob, toJpegFileName } from '@/lib/image-crop'
import { uploadHeadshot } from './uploadHeadshot'

interface HeadshotCaptureCardProps {
  client: {
    id: string
    firstName: string
    lastName: string
    middleInitial?: string | null
    email: string
    dob?: string | null
    headshot?: string | null
    headshotId?: string | null
    phone?: string | null
  }
  onHeadshotLinked?: (url: string, docId: string) => void
}

const MAX_HEADSHOT_SIZE_BYTES = 10 * 1024 * 1024
const PAYLOAD_TOO_LARGE_MESSAGE = 'Image too large after processing; retry with a smaller crop/photo.'

/**
 * Client card with custom camera/upload + crop flow for iPad-friendly headshot updates.
 * The cropped image is uploaded immediately and linked to the client record.
 */
export function HeadshotCaptureCard({ client, onHeadshotLinked }: HeadshotCaptureCardProps) {
  const [headshotUrl, setHeadshotUrl] = useState<string | undefined>(client.headshot ?? undefined)
  const [currentHeadshotId, setCurrentHeadshotId] = useState<string | undefined>(client.headshotId ?? undefined)
  const [showCropper, setShowCropper] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [originalFileName, setOriginalFileName] = useState('headshot.jpg')
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const resetCropState = useCallback(() => {
    setShowCropper(false)
    setTempImage(null)
    setCrop(undefined)
    setCompletedCrop(null)
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file.')
      return
    }

    if (file.size > MAX_HEADSHOT_SIZE_BYTES) {
      setErrorMessage('Headshot must be smaller than 10MB.')
      return
    }

    setErrorMessage(null)
    setOriginalFileName(file.name)

    const reader = new FileReader()
    reader.onloadend = () => {
      setTempImage((reader.result as string) ?? null)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }, [])

  const onImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = event.currentTarget
    setCrop(createCenteredAspectCrop(width, height, 1))
  }, [])

  const handleCropSave = useCallback(async () => {
    if (!imageRef.current || !completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0) {
      setErrorMessage('Please choose a crop area before applying.')
      return
    }

    setIsUploading(true)
    setErrorMessage(null)

    try {
      const croppedBlob = await cropImageToJpegBlob(imageRef.current, completedCrop, {
        maxOutputSize: 1600,
        quality: 0.92,
      })

      const croppedFile = new File(
        [croppedBlob],
        toJpegFileName(originalFileName, `${client.firstName}-${client.lastName}-headshot`),
        { type: 'image/jpeg' },
      )

      const arrayBuffer = await croppedFile.arrayBuffer()
      const result = await uploadHeadshot(
        client.id,
        Array.from(new Uint8Array(arrayBuffer)),
        croppedFile.type,
        croppedFile.name,
        currentHeadshotId,
      )

      if (!result.success || !result.id) {
        const uploadError =
          result.errorCode === 'PAYLOAD_TOO_LARGE'
            ? PAYLOAD_TOO_LARGE_MESSAGE
            : result.error || 'Failed to upload and link headshot'
        setErrorMessage(uploadError)
        toast.error(uploadError)
        return
      }

      setCurrentHeadshotId(result.id)
      if (result.url) {
        setHeadshotUrl(result.url)
        onHeadshotLinked?.(result.url, result.id)
        toast.success(currentHeadshotId ? 'Headshot updated successfully' : 'Headshot uploaded successfully')
      } else {
        toast.info('Headshot saved successfully. Preview may take a moment to appear.')
      }
      resetCropState()
    } catch (error) {
      const uploadError = error instanceof Error ? error.message : String(error)
      setErrorMessage(uploadError)
      toast.error(`Upload failed: ${uploadError}`)
    } finally {
      setIsUploading(false)
    }
  }, [
    client.firstName,
    client.id,
    client.lastName,
    completedCrop,
    currentHeadshotId,
    onHeadshotLinked,
    originalFileName,
    resetCropState,
  ])

  const hasImage = Boolean(headshotUrl)

  const openCapturePicker = useCallback(() => {
    cameraInputRef.current?.click()
  }, [])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <>
      <div
        className={cn(
          'relative w-full rounded-lg border p-5 sm:p-6',
          'border-info/40 bg-info/10 text-foreground',
          'flex flex-col gap-4',
        )}
      >
        <div className="space-y-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="relative shrink-0">
              <Avatar className="size-20 sm:size-24">
                <AvatarImage src={headshotUrl} alt={`${client.firstName} ${client.lastName}`} />
                <AvatarFallback className="text-xl">
                  {client.firstName?.charAt(0)}
                  {client.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="min-w-0 space-y-1.5">
              <h3 className="text-2xl leading-[1.1] font-semibold tracking-tight sm:text-3xl">
                {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
                {client.lastName}
              </h3>

              <div className="text-foreground/85 space-y-0.5 text-sm leading-snug sm:text-base">
                <p className="break-words [overflow-wrap:anywhere]">{client.email}</p>
                {client.dob && <p>DOB: {formatDateOnly(client.dob)}</p>}
                {client.phone && <p>Phone: {client.phone}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={openCapturePicker}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Camera className="mr-1.5 size-3.5" />
              )}
              {hasImage ? 'Retake Photo' : 'Take Photo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openFilePicker}
              disabled={isUploading}
              className="w-full"
            >
              Use File Picker
            </Button>
          </div>
        </div>

        {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFileSelect(file)
            event.currentTarget.value = ''
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFileSelect(file)
            event.currentTarget.value = ''
          }}
        />
      </div>

      <Dialog open={showCropper} onOpenChange={(open) => (!open ? resetCropState() : setShowCropper(true))}>
        <DialogContent className="max-h-[94vh] w-[95vw] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="size-5" />
              Crop Headshot
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted max-h-[65vh] overflow-auto rounded-lg p-2">
              {tempImage && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(pixelCrop) =>
                    setCompletedCrop(pixelCrop.width > 0 && pixelCrop.height > 0 ? pixelCrop : null)
                  }
                  aspect={1}
                  keepSelection={true}
                  className="mx-auto w-fit"
                >
                  <img
                    ref={imageRef}
                    src={tempImage}
                    alt="Crop headshot"
                    onLoad={onImageLoad}
                    className="max-h-[60vh] w-auto max-w-full object-contain"
                  />
                </ReactCrop>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetCropState} disabled={isUploading}>
                <X className="mr-2 size-4" />
                Cancel
              </Button>
              <Button type="button" onClick={handleCropSave} disabled={isUploading || !completedCrop}>
                {isUploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                Apply Crop
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
