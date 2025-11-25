import { TimelineNav } from '@/components/timeline-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Clock,
  MapPin,
  FlaskConical,
  FileCheck,
  LayoutDashboard,
  MessageSquare,
  Pill,
  ArrowRight,
  Phone,
} from 'lucide-react'
import Link from 'next/link'

const sections = [
  { id: 'mission', title: 'Our Mission' },
  { id: 'services', title: 'Our Services' },
  { id: 'how-it-works', title: 'How It Works' },
  { id: 'pricing', title: 'Pricing' },
  { id: 'register', title: 'Get Started' },
  { id: 'contact', title: 'Contact & Scheduling' },
]

export function AboutBlock() {
  return (
    <div className="container mx-auto px-4">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[240px_1fr]">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block">
          <TimelineNav sections={sections} />
        </aside>

        {/* Main Content */}
        <main className="space-y-16">
          {/* Mission Section */}
          <section id="mission" className="scroll-mt-8 lg:scroll-mt-32">
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  About Us
                </Badge>
                <h2 className="mb-4 text-3xl font-semibold text-balance">Our Mission</h2>
              </div>
              <Card className="border-l-primary border-l-4 p-6">
                <p className="text-foreground text-lg leading-relaxed">
                  MI Drug Test was founded to continue serving our community&apos;s drug screening needs
                  after BASES concluded their 26-year legacy of service. We&apos;re committed to
                  providing affordable, reliable drug testing for individuals with court
                  requirements, employment obligations, or those seeking personal accountability.
                </p>
              </Card>
            </div>
          </section>

          {/* Services Section */}
          <section id="services" className="scroll-mt-8 lg:scroll-mt-32">
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  What We Offer
                </Badge>
                <h2 className="mb-4 text-3xl font-semibold text-balance">Our Services</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Comprehensive drug testing solutions for court-ordered, employment, and
                  self-referral needs:
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="p-6 transition-shadow hover:shadow-lg">
                  <div className="flex gap-4">
                    <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
                      <FlaskConical className="text-primary h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Instant & Lab Screens</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Choose between immediate instant results or comprehensive lab testing based
                        on your requirements
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 transition-shadow hover:shadow-lg">
                  <div className="flex gap-4">
                    <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
                      <FileCheck className="text-primary h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Court, Employment & Self-Referral</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Testing services for all needs—court orders, employment screening, or
                        personal accountability
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 transition-shadow hover:shadow-lg">
                  <div className="flex gap-4">
                    <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
                      <CheckCircle2 className="text-primary h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Positive Screen Confirmations</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Lab confirmation available for any positive screen results to ensure
                        accuracy
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 transition-shadow hover:shadow-lg">
                  <div className="flex gap-4">
                    <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
                      <LayoutDashboard className="text-primary h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Client Dashboard</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Access your complete testing history and results through your personal
                        dashboard
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 transition-shadow hover:shadow-lg">
                  <div className="flex gap-4">
                    <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
                      <MessageSquare className="text-primary h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Referral Communication</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Direct result reporting to courts, employers, or designated recipients via
                        email
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 transition-shadow hover:shadow-lg">
                  <div className="flex gap-4">
                    <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
                      <Pill className="text-primary h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Medication Documentation</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Declare prescribed medications that may result in expected positive results
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="bg-muted/50 p-6">
                <h4 className="mb-4 text-lg font-semibold">Available Test Panels</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <div className="text-primary font-semibold">15-Panel Test</div>
                    <p className="text-muted-foreground text-sm">Charlevoix County approved</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-primary font-semibold">11-Panel Test</div>
                    <p className="text-muted-foreground text-sm">Emmet District Court approved</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-primary font-semibold">17-Panel SOS</div>
                    <p className="text-muted-foreground text-sm">
                      Secretary of State approved for license reinstatement
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-primary font-semibold">EtG Alcohol Test</div>
                    <p className="text-muted-foreground text-sm">
                      Ideal for ignition interlock compliance
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* How It Works Section */}
          <section id="how-it-works" className="scroll-mt-8 lg:scroll-mt-32">
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  Process
                </Badge>
                <h2 className="mb-4 text-3xl font-semibold text-balance">How It Works</h2>
              </div>

              <div className="space-y-4">
                {[
                  {
                    step: '1',
                    title: 'Register Your Account (First-Time Clients)',
                    description:
                      'Create your account to access our scheduling system, manage your testing history, and receive results. Registration only takes a few minutes and allows you to specify where results should be sent.',
                  },
                  {
                    step: '2',
                    title: 'Schedule Your Appointment',
                    description:
                      'Book your 10-minute appointment online at least 2 hours in advance. A day or more in advance is greatly appreciated. Payment is required at time of booking. Let us know if you need to test regularly so we can create a recurring schedule.',
                  },
                  {
                    step: '3',
                    title: 'Arrive Prepared',
                    description:
                      "We're located beneath Huntington Bank. Strive to meet us at our location 5 minutes before your scheduled time. Park in the back parking lot and text or call to let us know you've arrived so we can let you in. Late arrivals are at risk of forfeiting their booking fee.",
                  },
                  {
                    step: '4',
                    title: 'Quick & Professional Testing',
                    description:
                      'Our certified tester will explain the testing process, supervise sample collection in a private setting, process your results immediately, and email results directly to designated recipients.',
                  },
                  {
                    step: '5',
                    title: 'Results & Follow-up',
                    description:
                      'Access your results through your dashboard and via email. If you need to contest results, we offer laboratory confirmation testing for an additional fee.',
                  },
                ].map((item) => (
                  <Card key={item.step} className="hover:border-primary/50 p-6 transition-colors">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full font-semibold">
                          {item.step}
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-lg font-semibold">{item.title}</h3>
                        <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing" className="scroll-mt-8 lg:scroll-mt-32">
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  Transparent Costs
                </Badge>
                <h2 className="mb-4 text-3xl font-semibold text-balance">Pricing</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-primary border-2 p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="mb-1 text-lg font-semibold">Standard 15-Panel Instant Test</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-primary text-4xl font-bold">$35</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      For all Charlevoix court clients
                    </p>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="mb-1 text-lg font-semibold">11-Panel Lab Test & EtG</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-foreground text-4xl font-bold">$40</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      For court requirements outside Charlevoix County, or EtG alcohol testing for
                      ignition interlock compliance
                    </p>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="mb-1 text-lg font-semibold">SOS 17-Panel Lab Test</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-foreground text-4xl font-bold">$45</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Secretary of State reinstatement testing
                    </p>
                  </div>
                </Card>

                <Card className="bg-muted/50 p-6">
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Lab Confirmation</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">For instant tests:</span>
                        <span className="font-semibold">$30 per substance</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">For lab tests:</span>
                        <span className="font-semibold">$45 per substance</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </section>

          <section id="register" className="scroll-mt-8 lg:scroll-mt-32">
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  Get Started
                </Badge>
                <h2 className="mb-4 text-3xl font-semibold text-balance">Ready to Schedule?</h2>
              </div>

              <Card className="from-primary/10 to-accent/10 border-primary/20 bg-gradient-to-br p-8">
                <div className="mx-auto max-w-2xl space-y-6 text-center">
                  <div className="space-y-3">
                    <h3 className="text-2xl font-semibold text-balance">Create Your Account</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                      Register for an account to schedule appointments, access your testing history,
                      and manage your results all in one place.
                    </p>
                  </div>

                  <div className="flex flex-col justify-center gap-4 pt-4 sm:flex-row">
                    <Button asChild size="lg" className="text-base">
                      <Link href="/register">
                        Register Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="bg-transparent text-base"
                    >
                      <Link href="/sign-in">Already have an account? Sign In</Link>
                    </Button>
                  </div>

                  <div className="border-border/50 border-t pt-6">
                    <p className="text-muted-foreground text-sm">
                      Questions about registration? Contact us and we&apos;ll help you get started.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* Contact Section */}
          <section id="contact" className="scroll-mt-8 lg:scroll-mt-32">
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  Get In Touch
                </Badge>
                <h2 className="mb-4 text-3xl font-semibold text-balance">Contact & Scheduling</h2>
              </div>

              <Card className="from-primary/5 to-accent/5 bg-gradient-to-br p-8">
                <div className="space-y-6">
                  <p className="text-lg leading-relaxed">
                    Need to reschedule or have questions? Contact us directly. We&apos;re here to make
                    the process as smooth and professional as possible.
                  </p>

                  <div className="grid gap-6 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    <a
                      href="tel:+12313736341"
                      className="group border-border hover:border-primary/50 -ml-3 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <div className="bg-primary/10 group-hover:bg-primary/20 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors">
                        <Phone className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="group-hover:text-primary mb-1 font-semibold transition-colors">
                          Phone
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          Call (231) 373-6341 for assistance
                        </p>
                      </div>
                    </a>

                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                        <MapPin className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="mb-1 font-semibold">Location</h4>
                        <p className="text-muted-foreground text-sm">
                          201 State St, Lower Level
                          <br />
                          Charlevoix, MI
                          <br />
                          <span className="text-xs">(Beneath Huntington Bank - Park in back)</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                        <Clock className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="mb-1 font-semibold">Appointments</h4>
                        <p className="text-muted-foreground text-sm">
                          Book at least 2 hours in advance
                          <br />
                          10-minute appointments
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-muted-foreground text-center italic">
                      Serving Michigan with reliable, affordable drug testing services.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
