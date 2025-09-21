import { Card, CardContent } from '@/components/ui/card'
import { Shield, Clock, Users } from 'lucide-react'

const features = [
  {
    icon: Shield,
    title: 'Certified Professionals',
    description:
      'All our testers are certified and experienced in professional drug screening procedures.',
  },
  {
    icon: Clock,
    title: 'Flexible Scheduling',
    description: 'Morning and evening appointments available 7 days a week to fit your schedule.',
  },
  {
    icon: Users,
    title: 'Gender Options',
    description: 'Choose from male or female testers based on your comfort and preference.',
  },
]

export function FeatureGridBlock() {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="text-center">
                <CardContent className="pt-6">
                  <Icon className="text-primary mx-auto mb-4 h-12 w-12" />
                  <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
