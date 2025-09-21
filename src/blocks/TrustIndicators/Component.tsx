import { CheckCircle, Shield, Scale } from 'lucide-react'

const trustFeatures = ['Fast Results', 'Confidential', 'Professional']

export function TrustIndicatorsBlock() {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
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
                <h3 className="text-foreground mb-2 font-semibold">Court Pre-Approved Provider</h3>
                <div className="text-muted-foreground space-y-1 text-sm">
                  <p>• 33rd Circuit Court</p>
                  <p>• 90th District Court, Charlevoix County</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Features - Simple Row */}
        <div className="flex items-center justify-center space-x-8">
          {trustFeatures.map((feature, index) => (
            <div key={index} className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-foreground">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
