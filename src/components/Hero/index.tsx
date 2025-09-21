import Image from 'next/image'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/Icons'
import Link from 'next/link'
import { cn } from '@/utilities/cn'
import type { CompanyInfo, Hero as HeroType } from '@/payload-types'
import { CMSLink } from '../Link'
import { getCachedGlobal } from '@/utilities/getGlobals'

type Props = NonNullable<HeroType['highImpact']>

export async function Hero({ title, description, links }: Props) {

  return (
    <section className="grid lg:gap-8 lg:grid-cols-12 2xl:px-0 2xl:container gap-12">
      <div className="flex flex-col mr-auto lg:col-span-6">
        <h1 className="max-w-2xl pb-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:pb-8 xl:text-6xl 2xl:text-7xl">
          {title}
        </h1>
        <p className="max-w-xl pb-8 text-lg text-muted-foreground">{description}</p>
        <div className="flex flex-col space-y-4 md:mr-4 xl:flex-row xl:space-x-0 xl:items-start">
          {links != null &&
            links.map(({ link, id }) => (
              <CMSLink
                key={id}
                {...link}
                size="xl"
                className="hidden rounded-lg xl:flex lg:min-w-64"
              />
            ))}
        </div>
      </div>
    </section>
  )
}