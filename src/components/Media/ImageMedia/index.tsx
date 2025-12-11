'use client'

import type { StaticImageData } from 'next/image'

import { cn } from 'src/utilities/cn'
import NextImage from 'next/image'
import React from 'react'

import type { Props as MediaProps } from '../types'

import cssVariables from '@/cssVariables'

const { breakpoints } = cssVariables

// A base64 encoded image to use as a placeholder while the image is loading
const placeholderBlurFallback = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEtklEQVR4nJ1WbUxbVRh+SRN+uBRraQPdEDazjS1ItkydOlgKNLT0C1booNpCK0sJMEZgwtrKx8pHU7JRdYA4oONCYTY2rQwcdxDSTSdIdEzd4kdMTBb/+Mtf/uDXTM17Wyi9vf2I5Ak599xz3+ec533enheAUxYGVxpCaFwWNRMDez/fHQcHDNEThuNGLYje3y6SjchNGjSmuBJJw+DJIEMBfHkIPFnMuDStmCWiIV0KqaUAQoAiCkJ4QczAwY0MFZYo/gn4coxebrETK6Yxn2nMZydWQWHCScZz0CWKno0WJ7UUCptXNp6A/ArIrtx9+BMUNuMkX544JczMNAK2BI5oeiYWMSir1DS+AIc1OBmHIJ1GEAd8BbDFkKsddfupTcgd82uQqw0RMGRiZ1thieLYlEeZB4Rnmhzne6bgmBayVNVdzsKLH2KqMxQxCegSxUlAmgRyqmaX1yFbDeLLcEwHWZX4eEiNr/YegpEsQYYzcPu11ulcvQ240rcbh2GfBED4VuNHuv4Z6hDKmN8Gw8ZVX45+zzfccPsPaK6eM02ApBMylZiVo9Xj3geQr8cFfEVEVhlOEGf7KSKj/bMLNtezv/4OBAL/bG8/ePT7/Ue/bf36rME222S/DSwRLvs/OQjWV0Fz3+TSrTvfBAKB58//DVB/wQGxtNHnXISzLcBiqrjEBKh+Mai67QQ54CTvbfzi9f/g9T/2+h971rbIjZ9tBDnkIqGyB5fFOQTz3oMEPBkIKi45PNfmVvoJ0kbcG3SStluknVgZdJLX51c7RjywvwKX8RUUGF1Ee06TQEoJfsMqxfpiieAlGeTVoSlzqiCvFnLfxcFRDfqVLUEZ0yQ4ACEujkeQTkU/UvPqe0PojXIL/uCI29E2ggpR6+jrxmEkLmhWWabgZD2cqEfifD28dgGOaw0DLlCYgRNlp4iaYhVDYcv29jacNDz9488qy6SNICFLBUVtLnLznGmyzeF5f8TX4nBfm1vpGPFB+Qds9VW91dV1c6GgyaG3TsPLlbjL2AQiEF7yrH1vJ+7OketvNAz3Ob9ElUWXa63TkKmc8H1tGltY/faJoX+m0jKVquoGpbnn5mLf5BIcUk96H0K+AYPsNVVEblNKoLi1umvKPH5H0flJnsHWaL8NAiWcMi5+9eP1+VWBxqqyTL2i7a/pdUJJ243P/aPu+3C2pabXaSfI1c2nKBdLFPErSy/uTCUcUKGFBEpM5nEd/s+uQtHPNOGa/RWY3oNqyKrAcKeNqAlHiuOcKgYjRfUHFLjUHXlCP0SQs8vrAo21xeFuss9DcauyY2zAuXRYN5j9jnVuedM05kNrsSXoC2Qqi2h2ElRySkkGFRp4Ms/als46C3l19QMz5vEv8GpLKcErqNyM1uDJwrpzkieAon3q3osON6RJkKB3Gt5sAIWpzjrtWfsOWKXmcR/IkClCdNoNHxF0r4WDtXbayDnfDS9KFZ2fGu0uELcf1Pa3f+wVaKzAEmXp+uBUPf1yTvYEQT62ONQ9sESIYG0jqKDBMk7ceNFec8rCR+HtiLvbb+12YMHJWNdACNGdHU1BTtIt5d44Eb1pBEEMmqSQsHWkvWDsNWNxR/fuO4//AWteTM9JomvpAAAAAElFTkSuQmCC'

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
