import type { CompanyInfo, Hero as HeroType, Page } from '@/payload-types'
import { HeroMedium } from '@/components/Hero/HeroMedium'
import { Hero } from '@/components/Hero'
import { HeroLocationSplit } from '@/components/Hero/HeroLocationSplit'
import { getPayload } from 'payload'
import payloadConfig from '@payload-config'

type Props = Extract<Page['layout'][number], HeroType>

export async function HeroBlock({ type, highImpact, mediumImpact, locationSplit }: Props) {
  let companyInfoAddress: CompanyInfo['contact']['physicalAddress'] | null = null

  if (type === 'locationSplit' && locationSplit) {
    const payload = await getPayload({ config: payloadConfig })
    const companyInfo: CompanyInfo = await payload.findGlobal({
      slug: 'company-info',
      depth: 0,
    })

    companyInfoAddress = companyInfo.contact?.physicalAddress ?? null
  }

  const street = companyInfoAddress?.street?.trim()
  const cityStateZip = companyInfoAddress?.cityStateZip?.trim()
  const resolvedAddressText =
    [street, cityStateZip].filter((value): value is string => Boolean(value && value.length > 0)).join(', ') ||
    ''
  const resolvedLocationText = resolvedAddressText || locationSplit?.locationText || ''
  const resolvedMapSubtitle = resolvedAddressText || locationSplit?.mapSubtitle || ''

  return (
    <>
      {type === 'highImpact' && !!highImpact ? (
        <Hero {...highImpact} />
      ) : type === 'mediumImpact' && !!mediumImpact ? (
        <HeroMedium
          {...mediumImpact}
          description={mediumImpact.description ?? undefined}
          subtitle={mediumImpact.subtitle ?? undefined}
          heading={mediumImpact.heading ?? undefined}
        />
      ) : type === 'locationSplit' && !!locationSplit ? (
        <HeroLocationSplit
          {...locationSplit}
          locationText={resolvedLocationText}
          mapSubtitle={resolvedMapSubtitle}
        />
      ) : null}
    </>
  )
}
