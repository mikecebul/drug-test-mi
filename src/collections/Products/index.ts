import { slugField } from '@/fields/slug'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection?.admin,
    defaultColumns: ['title', 'testType', 'priceInUSD', '_status'],
    livePreview: {
      url: ({ data, req }) => {
        const path = generatePreviewPath({
          slug: typeof data?.slug === 'string' ? data.slug : '',
          collection: 'products',
          req,
        })

        return path
      },
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: typeof data?.slug === 'string' ? data.slug : '',
        collection: 'products',
        req,
      }),
    useAsTitle: 'title',
  },
  defaultPopulate: {
    title: true,
    slug: true,
    testType: true,
    panelType: true,
    priceInUSD: true,
    description: true,
    inventory: true,
    meta: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Product name (e.g., "15-Panel Instant Drug Test")',
      },
    },
    {
      name: 'testType',
      type: 'select',
      required: true,
      options: [
        { label: 'Instant Test', value: 'instant' },
        { label: 'Lab Test', value: 'lab' },
        { label: 'Instant Confirmation', value: 'instant-confirmation' },
        { label: 'Lab Confirmation', value: 'lab-confirmation' },
      ],
      admin: {
        description: 'Type of drug test',
        position: 'sidebar',
      },
    },
    {
      name: 'panelType',
      type: 'select',
      options: [
        { label: '11-Panel', value: '11-panel' },
        { label: '15-Panel', value: '15-panel' },
        { label: 'N/A (Confirmation)', value: 'na' },
      ],
      admin: {
        description: 'Panel type for tests (N/A for confirmations)',
        position: 'sidebar',
        condition: (data) => {
          return data?.testType === 'instant' || data?.testType === 'lab'
        },
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: 'Description',
              required: false,
              admin: {
                description: 'Detailed description of the test',
              },
            },
            {
              name: 'shortDescription',
              type: 'textarea',
              admin: {
                description: 'Short description for product listings',
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Main product image',
              },
            },
            {
              name: 'features',
              type: 'array',
              admin: {
                description: 'Key features and benefits',
              },
              fields: [
                {
                  name: 'feature',
                  type: 'text',
                  required: true,
                },
              ],
            },
          ],
          label: 'Content',
        },
        {
          fields: [
            {
              name: 'priceInUSD',
              type: 'number',
              required: true,
              admin: {
                description: 'Price in cents (e.g., 3500 = $35.00)',
              },
            },
            {
              name: 'inventory',
              type: 'group',
              fields: [
                {
                  name: 'enabled',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Enable inventory tracking for this product',
                  },
                },
              ],
            },
            {
              name: 'relatedProducts',
              type: 'relationship',
              filterOptions: ({ id }) => {
                if (id) {
                  return {
                    id: {
                      not_in: [id],
                    },
                  }
                }

                return {
                  id: {
                    exists: true,
                  },
                }
              },
              hasMany: true,
              relationTo: 'products',
              admin: {
                description:
                  'Related products to display (e.g., show confirmation tests with main tests)',
              },
            },
          ],
          label: 'Product Details',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),
            MetaDescriptionField({}),
            PreviewField({
              hasGenerateFn: true,
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    // {
    //   name: 'categories',
    //   type: 'relationship',
    //   admin: {
    //     position: 'sidebar',
    //     sortOptions: 'title',
    //     description: 'Categories for organizing products',
    //   },
    //   hasMany: true,
    //   relationTo: 'categories',
    // },
    ...slugField('title', {
      slugOverrides: {
        required: true,
      },
    }),
  ],
})
