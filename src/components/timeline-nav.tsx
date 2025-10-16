'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/utilities/cn'

interface Section {
  id: string
  title: string
}

interface TimelineNavProps {
  sections: Section[]
}

export function TimelineNav({ sections }: TimelineNavProps) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      },
    )

    sections.forEach((section) => {
      const element = document.getElementById(section.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [sections])

  const handleClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav className="sticky top-32">
      <div className="space-y-1">
        <h2 className="text-foreground mb-4 px-3 text-sm font-semibold">On This Page</h2>

        <ul className="space-y-0.5">
          {sections.map((section) => {
            const isActive = section.id === activeSection

            return (
              <li key={section.id}>
                <button
                  onClick={() => handleClick(section.id)}
                  className={cn(
                    'group relative flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-all duration-200',
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
