export function getImageThumbnailUrl(media: any): string {
  if (!media || typeof media !== 'object') {
    return ""
  }

  return media.thumbnailURL || media.url || ""
}

export function getImageAlt(media: any, fallback: string = 'image'): string {
  if (!media || typeof media !== 'object') {
    return fallback
  }

  return media.alt || fallback
}