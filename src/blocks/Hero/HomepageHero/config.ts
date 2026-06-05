import type { Block } from 'payload'
import { link } from '@/fields/link'
import { createNormalizeEditorUrlHook } from '@/hooks/normalizeEditorUrl'

const normalizeDirectionsUrlHook = createNormalizeEditorUrlHook({
  allowRelative: true,
  errorMessage: 'Directions URL must be a relative path or valid URL.',
})

export const HomepageHero: Block = {
  slug: 'homepageHero',
  interfaceName: 'HomepageHero',
  admin: {
    group: 'Heroes',
    images: {
      icon: '/admin/block-icons/homepage-hero.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/homepage-hero.svg',
        alt: 'Homepage hero with intro copy and location card',
      },
    },
  },
  labels: {
    singular: 'Homepage Hero',
    plural: 'Homepage Heroes',
  },
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      defaultValue: 'Compliant Drug Testing for Charlevoix County',
      required: true,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      defaultValue:
        'Run by recovery coaches who understand the journey. Reliable, affordable drug and alcohol testing.',
      required: true,
    },
    link({
      overrides: {
        name: 'primaryCta',
        label: 'Primary CTA',
        defaultValue: {
          type: 'custom',
          url: '/register',
          label: 'Register',
          appearance: 'default',
          newTab: false,
        },
        admin: {
          hideGutter: false,
        },
      },
    }),
    link({
      overrides: {
        name: 'secondaryCta',
        label: 'Secondary CTA',
        defaultValue: {
          type: 'custom',
          url: 'tel:2313736341',
          label: 'Call',
          appearance: 'outline',
          newTab: false,
        },
        admin: {
          hideGutter: false,
        },
      },
    }),
    {
      name: 'mapImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Map Image',
    },
    {
      name: 'directionsUrl',
      type: 'text',
      defaultValue: 'https://maps.google.com/?q=MI+Drug+Test+Charlevoix+MI',
      required: true,
      hooks: {
        beforeChange: [normalizeDirectionsUrlHook],
      },
    },
  ],
}
