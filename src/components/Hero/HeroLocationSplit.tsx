import Container from '@/components/Container'
import { CMSLink } from '@/components/Link'
import { Card, CardFooter, CardHeader } from '@/components/ui/card'
import type { Hero as HeroType, Media } from '@/payload-types'
import { ArrowRight, MapPin, Phone, ShieldCheck } from 'lucide-react'
import Image from 'next/image'
import { Description, Subtitle, Title } from './HeroMedium'

type Props = NonNullable<HeroType['locationSplit']>

const fallbackMapImageSrc = '/Chx_Website_Image.png'

const isExternalUrl = (value: string) => /^https?:\/\//i.test(value)

export function HeroLocationSplit({
  badgeText,
  headingPrefix,
  headingHighlight,
  description,
  locationText,
  policyNote,
  registerCta,
  callCta,
  mapTitle,
  mapSubtitle,
  mapImage,
  mapImageAlt,
  mapFooterText,
  directionsLabel,
  directionsUrl,
}: Props) {
  const uploadedMapImage = typeof mapImage === 'object' ? (mapImage as Media) : null
  const hasUploadedMapImage = Boolean(uploadedMapImage?.url)
  const resolvedMapAlt = mapImageAlt || uploadedMapImage?.alt || 'Map of MI Drug Test location'

  const directionsTarget = isExternalUrl(directionsUrl) ? '_blank' : undefined
  const directionsRel = isExternalUrl(directionsUrl) ? 'noopener noreferrer' : undefined

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-gradient-to-br from-secondary/30 via-primary/15 to-transparent blur-3xl" />
        <div className="absolute -left-16 top-24 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent blur-3xl" />
      </div>

      <Container className="pb-20 pt-16 md:pb-28 md:pt-24">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,34rem)] xl:gap-16">
          <div className="text-left">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <Subtitle text={badgeText} className="text-left text-secondary normal-case" />
            </div>

            <Title
              heading="h1"
              className="md:text-6xl lg:text-6xl"
              text={
                <>
                  {headingPrefix}{' '}
                  <span className="bg-gradient-to-r from-primary via-secondary to-primary/70 bg-clip-text text-transparent">
                    {headingHighlight}
                  </span>
                </>
              }
            />

            <Description text={description} className="mt-6 max-w-2xl leading-relaxed" />

            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
              <MapPin className="size-4 text-primary" />
              <span>{locationText}</span>
            </div>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {registerCta && (
                <CMSLink
                  {...registerCta}
                  size="xl"
                  className="w-full rounded-lg sm:min-w-64 sm:w-auto"
                >
                  <ArrowRight className="size-4" />
                </CMSLink>
              )}
              {callCta && (
                <CMSLink
                  {...callCta}
                  size="xl"
                  className="w-full rounded-lg sm:min-w-64 sm:w-auto"
                >
                  <Phone className="size-4" />
                </CMSLink>
              )}
            </div>

            <p className="text-muted-foreground mt-4 text-sm">{policyNote}</p>
          </div>

          <Card className="mx-auto w-full max-w-[34rem] overflow-hidden rounded-lg border border-border bg-card shadow-xl lg:mx-0 lg:max-w-[20rem] lg:justify-self-end xl:max-w-[34rem]">
            <CardHeader className="flex-row items-center gap-3 border-b border-border px-5 py-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{mapTitle}</p>
                <p className="text-muted-foreground text-xs">{mapSubtitle}</p>
              </div>
            </CardHeader>

            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={hasUploadedMapImage ? (uploadedMapImage?.url as string) : fallbackMapImageSrc}
                alt={resolvedMapAlt}
                fill
                unoptimized
                className="h-full w-full object-cover"
                sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 33vw, 540px"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/70 to-transparent" />
            </div>

            <CardFooter className="flex items-center justify-between border-t border-border bg-card px-5 py-3">
              <p className="text-muted-foreground text-xs">{mapFooterText}</p>
              <a
                href={directionsUrl}
                target={directionsTarget}
                rel={directionsRel}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                {directionsLabel}
                <ArrowRight className="size-3" />
              </a>
            </CardFooter>
          </Card>
        </div>
      </Container>
    </section>
  )
}
