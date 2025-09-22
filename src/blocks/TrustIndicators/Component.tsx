import Container from '@/components/Container'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Shield, Scale, Clock, Users } from 'lucide-react'

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
    title: 'Instant Results',
    description: 'Initial screen test resutls sent the same day.',
  },
]
export function TrustIndicatorsBlock() {
  return (
    <Container>
      <div className="mb-10 text-center">
        <div className="bg-primary/10 mb-3 inline-flex items-center justify-center rounded-full p-2">
          <Shield className="text-primary h-5 w-5" />
        </div>
        <h2 className="text-foreground mb-3 text-2xl font-bold">Why Choose MI Drug Test?</h2>
        <p className="text-muted-foreground mx-auto max-w-2xl">
          Trusted testing provider with official pre-approval from local courts
        </p>
      </div>

      {/* Court Approvals - Single Card */}
      <div className="mx-auto mb-10 max-w-xl">
        <div className="from-primary/5 to-background border-primary/20 rounded-lg border bg-gradient-to-br p-6 transition-shadow duration-200 hover:shadow-md">
          <div className="flex items-start space-x-4">
            <div className="bg-background flex-shrink-0 rounded-lg border p-3 shadow-sm">
              <Scale className="text-primary h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-foreground mb-2 font-semibold">Court Approved Provider</h3>
              <div className="text-muted-foreground space-y-1 text-sm">
                <p>• 33rd Circuit Court</p>
                <p>• 90th District Court</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Features - Simple Row */}
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
    </Container>
  )
}
