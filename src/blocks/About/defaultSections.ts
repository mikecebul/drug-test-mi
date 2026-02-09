import type { RichTextContent } from '@/components/RichText'

const createTextNode = (value: string) => ({
  type: 'text' as const,
  text: value,
  detail: 0,
  format: 0,
  mode: 'normal' as const,
  style: '',
  version: 1,
})

const createParagraphNode = (value: string) => ({
  type: 'paragraph' as const,
  children: [createTextNode(value)],
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0,
  textFormat: 0,
  textStyle: '',
  version: 1,
})

export const makeRichText = (text: string): RichTextContent => ({
  root: {
    type: 'root' as const,
    children: [createParagraphNode(text)],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
}) as RichTextContent

export const DEFAULT_ABOUT_SECTIONS = [
  {
    blockType: 'aboutMission',
    anchorId: 'mission',
    navLabel: 'Our Mission',
    badge: 'About Us',
    heading: 'Our Mission',
    intro: makeRichText(
      "MI Drug Test was founded to continue serving our community's drug screening needs after BASES concluded their 26-year legacy of service. We're committed to providing affordable, reliable drug testing for individuals with court requirements, employment obligations, or those seeking personal accountability.",
    ),
  },
  {
    blockType: 'aboutServices',
    anchorId: 'services',
    navLabel: 'Our Services',
    badge: 'What We Offer',
    heading: 'Our Services',
    intro: makeRichText(
      'Comprehensive drug testing solutions for court-ordered, employment, and self-referral needs:',
    ),
    services: [
      {
        title: 'Instant & Lab Screens',
        description:
          'Choose between immediate instant results or comprehensive lab testing based on your requirements',
        icon: 'FlaskConical',
      },
      {
        title: 'Court, Employment & Self-Referral',
        description:
          'Testing services for all needs - court orders, employment screening, or personal accountability',
        icon: 'FileCheck',
      },
      {
        title: 'Positive Screen Confirmations',
        description: 'Lab confirmation available for any positive screen results to ensure accuracy',
        icon: 'CheckCircle2',
      },
      {
        title: 'Client Dashboard',
        description: 'Access your complete testing history and results through your personal dashboard',
        icon: 'LayoutDashboard',
      },
      {
        title: 'Referral Communication',
        description:
          'Direct result reporting to courts, employers, or designated recipients via email',
        icon: 'MessageSquare',
      },
      {
        title: 'Medication Documentation',
        description:
          'Declare prescribed medications that may result in expected positive results',
        icon: 'Pill',
      },
    ],
    testPanels: [
      {
        title: '15-Panel Test',
        description: 'Charlevoix County approved',
      },
      {
        title: '11-Panel Test',
        description: 'Emmet District Court approved',
      },
      {
        title: '17-Panel SOS',
        description: 'Secretary of State approved for license reinstatement',
      },
      {
        title: 'EtG Alcohol Test',
        description: 'Ideal for ignition interlock compliance',
      },
    ],
  },
  {
    blockType: 'aboutProcess',
    anchorId: 'how-it-works',
    navLabel: 'How It Works',
    badge: 'Process',
    heading: 'How It Works',
    steps: [
      {
        title: 'Register Your Account (First-Time Clients)',
        description:
          'Create your account to access our scheduling system, manage your testing history, and receive results. Registration only takes a few minutes and allows you to specify where results should be sent.',
      },
      {
        title: 'Schedule Your Appointment',
        description:
          'Book your 10-minute appointment online at least 2 hours in advance. A day or more in advance is greatly appreciated. Payment is required at time of booking. Let us know if you need to test regularly so we can create a recurring schedule.',
      },
      {
        title: 'Arrive Prepared',
        description:
          "We're located beneath Huntington Bank. Strive to meet us at our location 5 minutes before your scheduled time. Park in the back parking lot and text or call to let us know you've arrived so we can let you in. Late arrivals are at risk of forfeiting their booking fee.",
      },
      {
        title: 'Quick & Professional Testing',
        description:
          'Our certified tester will explain the testing process, supervise sample collection in a private setting, process your results immediately, and email results directly to designated recipients.',
      },
      {
        title: 'Results & Follow-up',
        description:
          'Access your results through your dashboard and via email. If you need to contest results, we offer laboratory confirmation testing for an additional fee.',
      },
    ],
  },
  {
    blockType: 'aboutPricing',
    anchorId: 'pricing',
    navLabel: 'Pricing',
    badge: 'Transparent Costs',
    heading: 'Pricing',
    pricingCards: [
      {
        title: 'Standard 15-Panel Instant Test',
        price: '$35',
        description: 'For all Charlevoix court clients',
        featured: true,
      },
      {
        title: '11-Panel Lab Test & EtG',
        price: '$40',
        description:
          'For court requirements outside Charlevoix County, or EtG alcohol testing for ignition interlock compliance',
      },
      {
        title: 'SOS 17-Panel Lab Test',
        price: '$45',
        description: 'Secretary of State reinstatement testing',
      },
    ],
    confirmation: {
      title: 'Lab Confirmation',
      rows: [
        {
          label: 'For instant tests:',
          value: '$30 per substance',
        },
        {
          label: 'For lab tests:',
          value: '$45 per substance',
        },
      ],
    },
  },
  {
    blockType: 'aboutContact',
    anchorId: 'contact',
    navLabel: 'Contact & Availability',
    badge: 'Get In Touch',
    heading: 'Contact & Availability',
    intro: makeRichText(
      "Review our current appointment windows below. For questions, rescheduling, or general help, contact us directly and we'll make the process as smooth and professional as possible.",
    ),
    availability: {
      title: 'Current Scheduling Availability',
      times: [
        {
          text: 'Monday-Friday: 6:00 p.m. - 7:00 p.m.',
        },
        {
          text: 'Saturday-Sunday: 10:50 a.m. - 11:30 a.m.',
        },
      ],
      notes: [
        {
          text: 'Open seven days a week.',
        },
        {
          text: 'Closed on Christmas Day and Thanksgiving Day.',
        },
      ],
    },
    contactItems: [
      {
        title: 'Phone',
        description: 'Call (231) 373-6341 for assistance',
        href: 'tel:+12313736341',
        icon: 'Phone',
      },
      {
        title: 'Location',
        description: '201 State St, Lower Level\nCharlevoix, MI\n(Beneath Huntington Bank - Park in back)',
        icon: 'MapPin',
      },
      {
        title: 'Appointments',
        description: 'Book at least 2 hours in advance\n10-minute appointments',
        icon: 'Clock',
      },
    ],
    footerText: "Questions about registration? Contact us and we'll help you get started.",
  },
  {
    blockType: 'aboutRegister',
    anchorId: 'register',
    navLabel: 'Get Started',
    badge: 'Get Started',
    heading: 'Ready to Schedule?',
    title: 'Create Your Account',
    body: makeRichText(
      'Register for an account to schedule appointments, access your testing history, and manage your results all in one place.',
    ),
    links: [
      {
        link: {
          type: 'custom',
          url: '/register',
          label: 'Register Now',
          appearance: 'default',
          newTab: false,
        },
      },
      {
        link: {
          type: 'custom',
          url: '/sign-in',
          label: 'Already have an account? Sign In',
          appearance: 'outline',
          newTab: false,
        },
      },
    ],
    footerText: 'Serving Michigan with reliable, affordable drug testing services.',
  },
]
