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
- `Forms` - Dynamic form builder with Stripe integration
- `FormSubmissions` - Form response storage
- `Media` - S3-hosted media files
- `Admins` - Role-based access (super admin, admin)
- `Bookings` - Calcom bookings from webhook
- `Clients` - Auth collection for clients receiving services
- `PrivateMedia` - mostly drug test results as PDf
- `Technicians` - Employees who observe the test collection
- `Resources` - Not yet utilized, but will be link cards for outside recources

**Globals** (`src/globals/`):
- `Header` - Navigation configuration
- `Footer` - Footer content and contact info
- `CompanyInfo` - Business information

### Key Integration Patterns

**Form System**: Uses TanStack Form with custom field components (`src/blocks/Form/field-components/`)

**Media Storage**: S3/Cloudflare R2 storage with PayloadCMS integration.

**Registration Flow**: Clients register so we have info of where durg test reports are sent. This needs to be improved to encourage registration before Calcom embed bookings.

## Environment Requirements

- Node.js ^18.20.2 || >=20.9.0
- pnpm ^9 || ^10
- MongoDB database
- S3-compatible storage (Cloudflare R2)
- Calcom bookings with Stripe payments through Calcom. Will need to add stripe integration later for recurring customers

## Development Notes

- TypeScript with strict null checks enabled
- ESLint config extends Next.js defaults
- Uses Geist Sans font
- Tailwind CSS for styling with custom shadcn/ui components
- Dark/light theme support (currently forced to light mode)
- Docker containerization with Dokploy deployment