# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `pnpm dev` (uses Turbo for faster builds)
- **Build**: `pnpm build` (includes post-build sitemap generation)
- **Lint**: `pnpm lint` (with `pnpm lint:fix` for auto-fixes)
- **Production build and start**: `pnpm build:dev`
- **PayloadCMS commands**:
  - `pnpm generate:types` - Generate TypeScript types from Payload collections
  - `pnpm generate:importmap` - Generate import map for admin panel
  - `pnpm payload` - Access Payload CLI

## Core Architecture

This is a Next.js 15 application with deeply integrated PayloadCMS 3.x for content management.

### Application Structure

**Frontend App** (`src/app/(frontend)/`):
- Dynamic pages via `[slug]/page.tsx` 
- Uses block-based architecture with `RenderBlocks` component
- Global layout with Header/Footer components

**Admin Panel** (`src/app/(payload)/admin/`):
- PayloadCMS admin interface at `/admin`
- Custom analytics view at `/admin/analytics`

### Block System

Pages are built using a flexible block system (`src/blocks/`):
- `RenderBlocks.tsx` - Central block renderer
- Block types: Hero, Form, MediaBlock, TwoColumnLayout, EventCards, etc.
- Blocks support nesting (see `TwoColumnLayout`)

### Collections & Globals

**Collections** (`src/collections/`):
- `Pages` - Dynamic page content
- `Events` - Event management
- `Forms` - Dynamic form builder with Stripe integration
- `FormSubmissions` - Form response storage
- `Media` - S3-hosted media files
- `Users` - Role-based access (super admin, admin, editor)
- `Registrations` - Automated registration creation from paid form submissions

**Globals** (`src/globals/`):
- `Header` - Navigation configuration
- `Footer` - Footer content and contact info
- `CompanyInfo` - Business information

### Key Integration Patterns

**Form System**: Uses TanStack Form with custom field components (`src/blocks/Form/field-components/`) and Stripe checkout integration.

**Media Storage**: S3/Cloudflare R2 storage with PayloadCMS integration.

**Registration Flow**: Automated - when a form submission payment status changes to 'paid', registrations are automatically created for all players in the submission.

## Environment Requirements

- Node.js ^18.20.2 || >=20.9.0
- pnpm ^9 || ^10
- MongoDB database
- S3-compatible storage (Cloudflare R2)
- Stripe account for payments

## Development Notes

- TypeScript with strict null checks enabled
- ESLint config extends Next.js defaults
- Uses Geist Sans font
- Tailwind CSS for styling with custom shadcn/ui components
- Dark/light theme support (currently forced to light mode)
- Docker containerization with Dokploy deployment