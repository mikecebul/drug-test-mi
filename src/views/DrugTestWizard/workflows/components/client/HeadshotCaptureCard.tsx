'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/utilities/cn'
import { Camera, Check, Crop as CropIcon, Loader2, Upload, X } from 'lucide-react'
import { formatDobInput } from '@/lib/date-utils'
import { toast } from 'sonner'
import {
  createCenteredAspectCrop,
  cropImageToJpegBlob,
  resolvePixelCropForSave,
  toJpegFileName,
} from '@/lib/image-crop'
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
  const [localHeadshot, setLocalHeadshot] = useState<{
    clientId: string
    id?: string
    url?: string
  } | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [originalFileName, setOriginalFileName] = useState('headshot.jpg')
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sourceImageSize, setSourceImageSize] = useState<{ width: number; height: number } | null>(null)
  const [cropViewportSize, setCropViewportSize] = useState<{ width: number; height: number } | null>(null)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const cropViewportObserverRef = useRef<ResizeObserver | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const activeLocalHeadshot = localHeadshot?.clientId === client.id ? localHeadshot : null
  const headshotUrl = activeLocalHeadshot?.url ?? client.headshot ?? undefined
  const currentHeadshotId = activeLocalHeadshot?.id ?? client.headshotId ?? undefined

  const resetCropState = useCallback(() => {
    setShowCropper(false)
    setTempImage(null)
    setCrop(undefined)
    setCompletedCrop(null)
    setSourceImageSize(null)
    setCropViewportSize(null)
  }, [])

  const observeCropViewport = useCallback((viewport: HTMLDivElement | null) => {
    cropViewportObserverRef.current?.disconnect()
    if (!viewport) return

    const updateViewportSize = (width: number, height: number) => {
      setCropViewportSize({
        width: Math.max(0, width),
        height: Math.max(0, height),
      })
    }

    const initialRect = viewport.getBoundingClientRect()
    updateViewportSize(initialRect.width, initialRect.height)

    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateViewportSize(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(viewport)
    cropViewportObserverRef.current = observer
  }, [])

  useEffect(() => () => cropViewportObserverRef.current?.disconnect(), [])

  const displayedImageSize = useMemo(() => {
    if (!sourceImageSize || !cropViewportSize || !cropViewportSize.width || !cropViewportSize.height) {
      return null
    }

    const scale = Math.min(
      cropViewportSize.width / sourceImageSize.width,
      cropViewportSize.height / sourceImageSize.height,
      1,
    )

    return {
      width: Math.max(1, Math.floor(sourceImageSize.width * scale)),
      height: Math.max(1, Math.floor(sourceImageSize.height * scale)),
    }
  }, [cropViewportSize, sourceImageSize])

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
    const { naturalWidth, naturalHeight } = event.currentTarget
    setSourceImageSize({ width: naturalWidth, height: naturalHeight })
    setCrop(createCenteredAspectCrop(naturalWidth, naturalHeight, 1))
  }, [])

  const handleCropSave = useCallback(async () => {
    const pixelCrop = resolvePixelCropForSave({
      image: imageRef.current,
      crop,
      completedCrop,
    })

    if (!imageRef.current || !pixelCrop) {
      setErrorMessage('Please choose a crop area before applying.')
      return
    }

    setIsUploading(true)
    setErrorMessage(null)

    try {
      const croppedBlob = await cropImageToJpegBlob(imageRef.current, pixelCrop, {
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

      if (result.url) {
        setLocalHeadshot({
          clientId: client.id,
          id: result.id,
          url: result.url,
        })
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
    crop,
    completedCrop,
    currentHeadshotId,
    onHeadshotLinked,
    originalFileName,
    resetCropState,
  ])

  const hasImage = Boolean(headshotUrl)
  const canApplyCrop = Boolean(completedCrop || crop)

  const openCapturePicker = useCallback(() => {
    cameraInputRef.current?.click()
  }, [])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const isHeadshotActionDisabled = isUploading

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
                <p className="wrap-break-word">{client.email}</p>
                {client.dob && <p>DOB: {formatDobInput(client.dob)}</p>}
                {client.phone && <p>Phone: {client.phone}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={openCapturePicker}
              disabled={isHeadshotActionDisabled}
              className="h-10 w-full"
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
              disabled={isHeadshotActionDisabled}
              className="h-10 w-full"
            >
              <Upload className="mr-1.5 size-3.5" />
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
          aria-label="Take headshot photo"
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
          aria-label="Choose headshot image"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFileSelect(file)
            event.currentTarget.value = ''
          }}
        />
      </div>

      <Dialog open={showCropper} onOpenChange={(open) => (!open ? resetCropState() : setShowCropper(true))}>
        <DialogContent className="grid h-[calc(100dvh-16px)] max-h-[864px] w-[min(896px,calc(100vw-16px))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="border-border border-b p-4 pr-12">
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="size-5" />
              Crop Headshot
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 overflow-hidden p-4">
            <div className="bg-muted h-full min-h-0 overflow-hidden rounded-lg p-2">
              <div
                ref={observeCropViewport}
                className="flex h-full min-h-0 items-center justify-center overflow-hidden"
              >
                {tempImage && (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(pixelCrop) =>
                      setCompletedCrop(pixelCrop.width > 0 && pixelCrop.height > 0 ? pixelCrop : null)
                    }
                    aspect={1}
                    keepSelection={true}
                    className="mx-auto max-w-full"
                  >
                    <img
                      ref={imageRef}
                      src={tempImage}
                      alt="Crop headshot"
                      onLoad={onImageLoad}
                      className="block max-w-none object-contain"
                      style={
                        displayedImageSize
                          ? { width: displayedImageSize.width, height: displayedImageSize.height }
                          : { width: 1, height: 1, visibility: 'hidden' }
                      }
                    />
                  </ReactCrop>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-border border-t p-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={resetCropState} disabled={isUploading}>
              <X className="mr-2 size-4" />
              Cancel
            </Button>
            <Button type="button" onClick={handleCropSave} disabled={isUploading || !canApplyCrop}>
              {isUploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
              Apply Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
