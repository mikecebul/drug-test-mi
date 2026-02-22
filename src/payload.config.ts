import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { resendAdapter } from '@payloadcms/email-resend'

import { sentryPlugin } from '@payloadcms/plugin-sentry'
import * as Sentry from '@sentry/nextjs'

import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { searchPlugin } from '@payloadcms/plugin-search'
import { stripePlugin } from '@payloadcms/plugin-stripe'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage as s3StoragePlugin } from '@payloadcms/storage-s3'
import { S3_PLUGIN_CONFIG } from './plugins/s3'
import {
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  UnorderedListFeature,
  OrderedListFeature,
  lexicalEditor,
  BlocksFeature,
  ParagraphFeature,
  LinkFields,
} from '@payloadcms/richtext-lexical'
import sharp from 'sharp' // editor-import
import { UnderlineFeature } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, TextFieldSingleValidation } from 'payload'
import { fileURLToPath } from 'url'

import { Pages } from './collections/Pages'
import { Footer } from './globals/Footer/config'
import { Header } from './globals/Header/config'
import { revalidateRedirects } from './hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL, GenerateImage } from '@payloadcms/plugin-seo/types'
import { Page } from 'src/payload-types'
import { CompanyInfo } from './globals/CompanyInfo/config'
import { superAdmin } from './access/superAdmin'
import { Bookings } from './collections/Bookings'
import { Media } from './collections/Media'
import { PrivateMedia } from './collections/PrivateMedia'
import { MediaBlock } from './blocks/MediaBlock/config'
import { baseUrl } from './utilities/baseUrl'
import { checkoutSessionCompleted } from './plugins/stripe/webhooks/checkoutSessionCompleted'
import { Forms } from './collections/Forms'
import { FormSubmissions } from './collections/FormSubmissions'
import { Technicians } from './collections/Technicians'
import { Clients } from './collections/Clients'
import { DrugTests } from './collections/DrugTests'
import Admins from './collections/Admins'
import { AdminAlerts } from './collections/AdminAlerts'
import { Employers } from './collections/Employers'
import { Courts } from './collections/Courts'
import { TestTypes } from './collections/TestTypes'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const generateTitle: GenerateTitle<Page> = ({ doc }) => {
  if ('name' in doc) {
    return doc.name ? `${doc.name}` : 'MI Drug Test'
  }
  return doc?.title ? `${doc.title}` : 'MI Drug Test'
}

const generateURL: GenerateURL<Page> = ({ doc }) => {
  if (!doc.slug) return baseUrl
  return `${baseUrl}/${doc.slug}`
}
const generateImage: GenerateImage<Page> = ({ doc }) => {
  if (typeof doc.meta?.metadata?.image === 'object' && doc.meta?.metadata?.image) {
    return doc.meta.metadata.image.url || '/og.png'
  }
  return '/og.png'
}

const isAdminAutoLoginEnabled = process.env.PAYLOAD_ADMIN_AUTOLOGIN_ENABLED === 'true'
const adminAutoLoginEmail = process.env.PAYLOAD_ADMIN_AUTOLOGIN_EMAIL?.trim()
const adminAutoLoginPassword = process.env.PAYLOAD_ADMIN_AUTOLOGIN_PASSWORD?.trim()

const adminAutoLogin =
  isAdminAutoLoginEnabled && adminAutoLoginEmail
    ? {
        email: adminAutoLoginEmail,
        password: adminAutoLoginPassword,
      }
    : false

export default buildConfig({
  // serverURL: baseUrl,
  admin: {
    autoLogin: adminAutoLogin,
    autoRefresh: true,
    avatar: 'default',
    components: {
      beforeDashboard: ['@/views/beforeDashboard/DrugTestStats'],
      afterDashboard: ['@/views/afterDashboard/Analytics'],
      beforeNavLinks: [
        '@/views/beforeNavLinks/DrugTestCollectorLink',
        '@/views/beforeNavLinks/DrugTestTrackerLink',
      ],
      afterNavLinks: ['@/views/afterNavLinks/LinkToAnalyticsDefaultRootView'],
      graphics: {
        Icon: '@/graphics/Icon',
        Logo: '@/components/Logo/Graphic',
      },
      views: {
        CustomRootView: {
          Component: '@/views/Analytics',
          path: '/analytics',
        },
        DrugTestTracker: {
          Component: '@/views/DrugTestTracker',
          path: '/drug-test-tracker',
        },
        DrugTestWizard: {
          Component: '@/views/DrugTestWizard',
          path: '/drug-test-upload',
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      icons: [{ url: '/favicon.ico' }],
      titleSuffix: ' | MI Drug Test',
    },
    user: Admins.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: lexicalEditor({
    features: () => {
      return [
        FixedToolbarFeature(),
        InlineToolbarFeature(),
        ParagraphFeature(),
        HeadingFeature({ enabledHeadingSizes: ['h1', 'h2'] }),
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        UnorderedListFeature(),
        OrderedListFeature(),
        BlocksFeature({
          blocks: [MediaBlock],
        }),
        LinkFeature({
          enabledCollections: ['pages'],
          fields: ({ defaultFields }) => {
            const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
              if ('name' in field && field.name === 'url') return false
              return true
            })

            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: (_data, siblingData) => siblingData?.linkType !== 'internal',
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
                validate: ((value, options) => {
                  if ((options?.siblingData as LinkFields)?.linkType === 'internal') {
                    return true // no validation needed, as no url should exist for internal links
                  }
                  return value ? true : 'URL is required'
                }) as TextFieldSingleValidation,
              },
            ]
          },
        }),
      ]
    },
  }),
  db: mongooseAdapter({
    url: process.env.DATABASE_URI!,
  }),
  collections: [
    Pages,
    Bookings,
    Forms,
    FormSubmissions,
    Media,
    PrivateMedia,
    Admins,
    AdminAlerts,
    Technicians,
    TestTypes,
    Courts,
    Employers,
    Clients,
    DrugTests,
  ],
  cors: [baseUrl].filter(Boolean),
  csrf: [baseUrl].filter(Boolean),
  email:
    process.env.NODE_ENV === 'production'
      ? resendAdapter({
          apiKey: process.env.RESEND_API_KEY || '',
          defaultFromAddress: 'website@midrugtest.com',
          defaultFromName: 'MI Drug Test',
        })
      : nodemailerAdapter({
          defaultFromAddress: 'website@midrugtest.com',
          defaultFromName: 'MI Drug Test',
          transportOptions: {
            host: process.env.EMAIL_HOST || 'localhost',
            port: process.env.EMAIL_PORT || 1025,
            auth: {
              user: process.env.EMAIL_USER || 'user',
              pass: process.env.EMAIL_PASSWORD || 'password',
            },
          },
        }),
  endpoints: [],
  globals: [Header, Footer, CompanyInfo],
  graphQL: { disable: true },
  plugins: [
    searchPlugin({
      collections: ['clients'],
      defaultPriorities: {
        clients: 10,
      },
      beforeSync: ({ originalDoc, searchDoc }) => {
        // Sync client name fields to search title for better searching
        const firstName = originalDoc?.firstName || ''
        const middleInitial = originalDoc?.middleInitial || ''
        const lastName = originalDoc?.lastName || ''
        const fullName = [firstName, middleInitial, lastName].filter(Boolean).join(' ')

        return {
          ...searchDoc,
          title: fullName,
        }
      },
    }),
    importExportPlugin({
      collections: [
        {
          slug: 'form-submissions',
          export: {
            disableJobsQueue: true,
          },
          import: {
            disableJobsQueue: true,
          },
        },
      ],
      overrideExportCollection: ({ collection }) => {
        return {
          ...collection,
          admin: {
            ...(typeof collection.admin === 'object' ? collection.admin : {}),
            group: 'Admin',
          },
          upload:
            typeof collection.upload === 'object'
              ? {
                  ...collection.upload,
                  staticDir: path.resolve(dirname, 'uploads'),
                }
              : {
                  staticDir: path.resolve(dirname, 'uploads'),
                },
        }
      },
    }),
    sentryPlugin({
      enabled: false,
      options: {
        captureErrors: [400, 401, 403],
        context: ({ defaultContext, req }) => {
          return {
            ...defaultContext,
            tags: {
              locale: req.locale,
            },
          }
        },
        debug: true,
      },
      Sentry,
    }),
    stripePlugin({
      isTestKey: process.env.STRIPE_SECRET_KEY?.includes('sk_test') ?? false,
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
      stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET,
      webhooks: {
        'checkout.session.completed': checkoutSessionCompleted,
      },
      logs: false,
    }),
    redirectsPlugin({
      collections: ['pages'],
      overrides: {
        access: {
          admin: (args) => !superAdmin(args),
          read: superAdmin,
          delete: superAdmin,
          update: superAdmin,
          create: superAdmin,
        },
        admin: {
          group: 'Admin',
        },
        // @ts-expect-error
        fields: ({ defaultFields }) => {
          return defaultFields.map((field) => {
            if ('name' in field && field.name === 'from') {
              return {
                ...field,
                admin: {
                  description: 'You will need to rebuild the website when changing this field.',
                },
              }
            }
            return field
          })
        },
        hooks: {
          afterChange: [revalidateRedirects],
        },
      },
    }),
    seoPlugin({
      generateTitle,
      generateURL,
      generateImage,
    }),
    s3StoragePlugin({
      ...S3_PLUGIN_CONFIG,
      collections: {
        media: {
          disableLocalStorage: true,
          generateFileURL: ({ filename, prefix }) => {
            if (typeof filename !== 'string') return null as unknown as string
            return `https://${process.env.NEXT_PUBLIC_S3_HOSTNAME}/${prefix}/${filename}`
          },
          prefix: process.env.NEXT_PUBLIC_UPLOAD_PREFIX,
        },
        'private-media': {
          disableLocalStorage: true,
          prefix: 'private',
          signedDownloads: {
            shouldUseSignedURL: () => true, // Always use signed URLs for private media
          },
        },
      },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET!,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
