import Container from '@/components/Container'
import { CMSLink } from '@/components/Link'
import { Card, CardFooter, CardHeader } from '@/components/ui/card'
import type { CompanyInfo, HomepageHero as HomepageHeroType, Media } from '@/payload-types'
import { ArrowRight, MapPin, Phone, ShieldCheck } from 'lucide-react'
import Image from 'next/image'
import { getPayload } from 'payload'
import payloadConfig from '@payload-config'
import { Description, Subtitle, Title } from '@/components/Hero/HeroMedium'

type Props = HomepageHeroType

const fallbackMapImageSrc = '/Chx_Website_Image.png'
const fallbackLocationText = 'Clinton St, Charlevoix, Michigan'
const mapTitle = 'MI Drug Test'
const mapFooterText = 'Downtown Charlevoix'
const directionsLabel = 'Get Directions'
const policyNote = 'We do not book appointments without registering or calling first.'

const isExternalUrl = (value: string) => /^https?:\/\//i.test(value)

export async function HomepageHeroBlock(props: Props) {
  const { title, description, mapImage, directionsUrl } = props
  const primaryCta = getPrimaryCta(props)
  const secondaryCta = getSecondaryCta(props)
  const companyInfo = await getCompanyInfo()
  const locationText = getAddressText(companyInfo) || fallbackLocationText
  const uploadedMapImage = typeof mapImage === 'object' ? (mapImage as Media) : null
  const hasUploadedMapImage = Boolean(uploadedMapImage?.url)
  const resolvedMapAlt = uploadedMapImage?.alt || 'Map of MI Drug Test location'
  const directionsTarget = isExternalUrl(directionsUrl) ? '_blank' : undefined
  const directionsRel = isExternalUrl(directionsUrl) ? 'noopener noreferrer' : undefined

  return (
    <section className="relative overflow-hidden">
      <div className="from-background via-muted to-secondary/20 pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br" />

      <Container className="pb-20 pt-16 md:pb-28 md:pt-24">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,34rem)] xl:gap-16">
          <div className="text-left">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <Subtitle
                text="Accepted by Michigan courts"
                className="text-left text-secondary normal-case"
              />
            </div>

            <Title
              heading="h1"
              className="md:text-6xl lg:text-6xl"
              text={<HomepageHeroTitle title={title} />}
            />

            <Description text={description} className="mt-6 max-w-2xl leading-relaxed" />

            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
              <MapPin className="size-4 text-primary" />
              <span>{locationText}</span>
            </div>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {primaryCta && (
                <CMSLink
                  {...primaryCta}
                  size="xl"
                  className="w-full rounded-lg sm:min-w-64 sm:w-auto"
                >
                  <ArrowRight className="size-4" />
                </CMSLink>
              )}
              {secondaryCta && (
                <CMSLink
                  {...secondaryCta}
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
                <p className="text-muted-foreground text-xs">{locationText}</p>
              </div>
            </CardHeader>

            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={hasUploadedMapImage ? (uploadedMapImage?.url as string) : fallbackMapImageSrc}
                alt={resolvedMapAlt}
                fill
                unoptimized
                priority
                loading="eager"
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

function HomepageHeroTitle({ title }: { title: string }) {
  const highlight = 'Charlevoix County'
  const [prefix, suffix] = title.split(highlight)

  if (!title.includes(highlight)) {
    return title
  }

  return (
    <>
      {prefix}
      <span className="bg-gradient-to-r from-primary via-secondary to-primary/70 bg-clip-text text-transparent">
        {highlight}
      </span>
      {suffix}
    </>
  )
}

async function getCompanyInfo() {
  const payload = await getPayload({ config: payloadConfig })

  return payload.findGlobal({
    slug: 'company-info',
    depth: 0,
  }) as Promise<CompanyInfo>
}

function getAddressText(companyInfo: CompanyInfo) {
  const street = companyInfo.contact?.physicalAddress?.street?.trim()
  const cityStateZip = companyInfo.contact?.physicalAddress?.cityStateZip?.trim()

  return [street, cityStateZip]
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join(', ')
}

function getPrimaryCta(props: Props) {
  const legacyLinks = ('links' in props ? props.links : undefined) as
    | Array<{ link?: HomepageHeroType['primaryCta'] }>
    | undefined

  return props.primaryCta || legacyLinks?.[0]?.link
}

function getSecondaryCta(props: Props) {
  const legacyLinks = ('links' in props ? props.links : undefined) as
    | Array<{ link?: HomepageHeroType['secondaryCta'] }>
    | undefined

  return props.secondaryCta || legacyLinks?.[1]?.link
}
