'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/utilities/cn'

interface Section {
  id: string
  title: string
}

interface TimelineNavProps {
  className?: string
  sections: Section[]
  title?: string
}

export function TimelineNav({ className, sections, title = 'On This Page' }: TimelineNavProps) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || '')

  const updateActiveSection = useCallback(() => {
    let currentSection = sections[0]?.id || ''

    sections.forEach((section) => {
      const element = document.getElementById(section.id)
      if (!element) return

      if (element.getBoundingClientRect().top <= 180) {
        currentSection = section.id
      }
    })

    setActiveSection(currentSection)
  }, [sections])

  useEffect(() => {
    updateActiveSection()

    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)

    return () => {
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [updateActiveSection])

  const handleClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav className={cn('sticky top-32', className)}>
      <div className="space-y-1 pt-2">
        <h2 className="border-border/70 text-muted-foreground mb-3 border-b px-2 pb-3 text-xs font-semibold tracking-wider uppercase">
          {title}
        </h2>

        <ul className="space-y-0.5">
          {sections.map((section) => {
            const isActive = section.id === activeSection

            return (
              <li key={section.id}>
                <button
                  onClick={() => handleClick(section.id)}
                  className={cn(
                    'group relative flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="bg-primary absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full" />
                  )}

                  <span className="leading-snug text-balance">{section.title}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
