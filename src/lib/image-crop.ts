import {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
  type PixelCrop,
} from 'react-image-crop'

interface CropImageOptions {
  maxOutputSize?: number
  quality?: number
}

/**
 * Create a centered percent-based crop constrained to a given aspect ratio.
 */
export function createCenteredAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspectRatio: number,
  initialWidthPercent = 90,
): PercentCrop {
  if (!Number.isFinite(mediaWidth) || !Number.isFinite(mediaHeight) || mediaWidth <= 0 || mediaHeight <= 0) {
    return { unit: '%', x: 0, y: 0, width: 100, height: 100 }
  }

  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: Math.min(Math.max(initialWidthPercent, 10), 100),
      },
      aspectRatio,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

/**
 * Render a pixel crop from an HTMLImageElement into a JPEG blob.
 */
export async function cropImageToJpegBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  options: CropImageOptions = {},
): Promise<Blob> {
  const maxOutputSize = options.maxOutputSize ?? 1600
  const quality = options.quality ?? 0.92

  const renderedWidth = image.width || image.naturalWidth
  const renderedHeight = image.height || image.naturalHeight

  if (!renderedWidth || !renderedHeight) {
    throw new Error('Image is not ready for cropping')
  }

  if (pixelCrop.width <= 0 || pixelCrop.height <= 0) {
    throw new Error('Invalid crop selection')
  }

  const scaleX = image.naturalWidth / renderedWidth
  const scaleY = image.naturalHeight / renderedHeight

  const sourceX = Math.max(0, Math.floor(pixelCrop.x * scaleX))
  const sourceY = Math.max(0, Math.floor(pixelCrop.y * scaleY))
  const sourceWidth = Math.min(
    image.naturalWidth - sourceX,
    Math.max(1, Math.floor(pixelCrop.width * scaleX)),
  )
  const sourceHeight = Math.min(
    image.naturalHeight - sourceY,
    Math.max(1, Math.floor(pixelCrop.height * scaleY)),
  )

  const largestDimension = Math.max(sourceWidth, sourceHeight)
  const resizeRatio = largestDimension > maxOutputSize ? maxOutputSize / largestDimension : 1

  const outputWidth = Math.max(1, Math.round(sourceWidth * resizeRatio))
  const outputHeight = Math.max(1, Math.round(sourceHeight * resizeRatio))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to create canvas context')
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, outputWidth, outputHeight)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create cropped image blob'))
          return
        }

        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

export function toJpegFileName(originalFileName: string, fallbackBaseName = 'image'): string {
  const trimmedName = originalFileName.trim()
  const baseName = trimmedName.length > 0 ? trimmedName.replace(/\.[^/.]+$/, '') : fallbackBaseName
  return `${baseName}.jpg`
}
