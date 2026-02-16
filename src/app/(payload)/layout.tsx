/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* MODIFIED: Added QueryClientProvider for TanStack Query */
import type { ServerFunctionClient } from 'payload'
import configPromise from '@payload-config'
import '@payloadcms/next/css'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'

import './custom.scss'
import { importMap } from './admin/importMap'
import { QueryClientProvider } from './QueryClientProvider'

type Args = {
  children: React.ReactNode
}

const serverFunctions: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config: configPromise,
    importMap,
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout importMap={importMap} config={configPromise} serverFunction={serverFunctions}>
    <QueryClientProvider>{children}</QueryClientProvider>
  </RootLayout>
)

export default Layout
