import { TrustBlock as TrustBlockType } from '@/payload-types'
import { CheckCircle, Scale } from 'lucide-react'
import { Icon } from '@/components/Icons/Icon'
import { Card, CardContent } from '@/components/ui/card'
import { HeroMedium } from '@/components/Hero/HeroMedium'

const defaultFeatures = [
  {
    title: 'Certified Professionals',
    description:
      'All our testers are certified and experienced in professional drug screening procedures.',
    icon: 'Shield',
  },
  {
    title: 'Flexible Scheduling',
    description: 'Morning and evening appointments available 7 days a week to fit your schedule.',
    icon: 'Calendar',
  },
  {
    title: 'Gender Options',
    description:
      'Choose a male or female technician for your screening to support trauma-informed care and comply with court requirements.',
    icon: 'Users',
  },
]

export function TrustBlock({ heading, description, features }: TrustBlockType) {
  const displayFeatures = features && features.length > 0 ? features : defaultFeatures

  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <HeroMedium
            title={heading || 'Why Choose MI Drug Test?'}
            description={
              description || 'Trusted testing provider with official approval from local courts'
            }
          />
        </div>

        {/* Court Approvals - Expanded Card */}
        <div className="mx-auto mb-16 max-w-4xl">
          <div className="from-primary/5 to-background border-primary/20 rounded-xl border bg-gradient-to-br p-8 transition-shadow duration-200 hover:shadow-lg">
            <div className="text-center">
              <div className="bg-primary/10 mx-auto mb-6 inline-flex items-center justify-center rounded-full p-4">
                <Scale className="text-primary h-8 w-8" />
              </div>
              <h3 className="text-foreground mb-4 text-xl font-bold">Court Approved Provider</h3>
              <p className="text-muted-foreground mb-6 text-base">
                Officially recognized and approved by local courts for reliable drug testing
                services
              </p>
              <div className="flex flex-col items-center justify-center gap-6 text-sm sm:flex-row">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-foreground font-medium">33rd Circuit Court</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-foreground font-medium">
                    90th District Court, Charlevoix and Emmet County
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Features - FeatureGrid Cards */}
        <div className="grid gap-8 md:grid-cols-3">
          {displayFeatures.map((feature: any, index: number) => (
            <Card key={index} className="text-center">
              <CardContent className="pt-6">
                <Icon
                  name={feature.icon ?? 'Trophy'}
                  className="text-primary mx-auto mb-4 h-12 w-12"
                />
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">
                  {feature.description ||
                    `Experience ${feature.title.toLowerCase()} service with our professional testing approach.`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
