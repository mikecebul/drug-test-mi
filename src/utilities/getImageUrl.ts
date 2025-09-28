export function getImageThumbnailUrl(media: any): string | undefined {
  if (!media || typeof media !== 'object') {
    return undefined
  }

  const url = media.thumbnailURL || media.url
  return url || undefined
}

export function getImageAlt(media: any, fallback: string = 'image'): string {
  if (!media || typeof media !== 'object') {
    return fallback
  }

  return media.alt || fallback
}