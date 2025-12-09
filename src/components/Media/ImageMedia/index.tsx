'use client'

import type { StaticImageData } from 'next/image'

import { cn } from 'src/utilities/cn'
import NextImage from 'next/image'
import React from 'react'

import type { Props as MediaProps } from '../types'

import cssVariables from '@/cssVariables'

const { breakpoints } = cssVariables

// A base64 encoded image to use as a placeholder while the image is loading
const placeholderBlurFallback = 'data:image/png;base64,LAAeH@of00a#IVayt6ay00ay~oj['

export const ImageMedia: React.FC<MediaProps> = (props) => {
  const {
    alt: altFromProps,
    fill,
    imgClassName,
    onClick,
    onLoad: onLoadFromProps,
    priority,
    resource,
    size: sizeFromProps,
    src: srcFromProps,
  } = props

  const [isLoading, setIsLoading] = React.useState(true)

  let width: number | undefined = 960
  let height: number | undefined = 640
  let alt = altFromProps
  let src: StaticImageData | string = srcFromProps || '/placeholder.svg'
  let blurhash: string | undefined

  if (resource && typeof resource === 'object') {
    const {
      alt: altFromResource,
      blurhash: blurhasFromResource,
      filename: fullFilename,
      height: fullHeight,
      url,
      width: fullWidth,
    } = resource

    width = fullWidth ?? width
    height = fullHeight ?? height
    alt = altFromResource
    blurhash = blurhasFromResource || undefined

    src = url ?? '/placeholder.svg'
  }

  // NOTE: this is used by the browser to determine which image to download at different screen sizes
  const sizes = sizeFromProps
    ? sizeFromProps
    : Object.entries(breakpoints)
        .map(([, value]) => `(max-width: ${value}px) ${value}px`)
        .join(', ')

  return (
    <NextImage
      alt={alt || ''}
      className={cn('rounded-lg', imgClassName)}
      fill={fill}
      height={!fill ? height : 640}
      placeholder="blur"
      blurDataURL={blurhash ?? placeholderBlurFallback}
      onClick={onClick}
      onLoad={() => {
        setIsLoading(false)
        if (typeof onLoadFromProps === 'function') {
          onLoadFromProps()
        }
      }}
      priority={priority}
      quality={90}
      sizes={sizes}
      src={src}
      width={!fill ? width : 960}
    />
  )
}
