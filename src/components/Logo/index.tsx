import { FlaskConical, LandPlot } from 'lucide-react'
import Link from 'next/link'

export const Logo = ({ name }: { name: string }) => {
  return (
    <Link href="/" className="text-default flex items-center">
      <FlaskConical className="size-4 shrink-0 stroke-3 md:size-5 xl:size-6" />
      <p className="ml-2 max-w-2xs text-xl font-bold text-balance md:text-2xl xl:text-3xl">
        {name}
      </p>
    </Link>
  )
}
export const SheetLogo = ({ name }: { name: string }) => {
  return (
    <Link href="/" className="mt-8 flex flex-col items-center justify-center gap-2">
      <FlaskConical className="text-primary h-8 w-8 shrink-0" />
      <span className="text-primary text-center text-xl font-bold text-balance">{name}</span>
    </Link>
  )
}

export const DashboardLogo = ({ name }: { name: string }) => {
  return <p className="text-white">{name}</p>
}
