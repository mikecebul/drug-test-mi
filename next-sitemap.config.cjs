const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: baseUrl,
  generateRobotsTxt: false, // Using Next.js robots.ts instead
  // generateIndexSitemap: baseUrl !== 'http://localhost:3000',
  generateIndexSitemap: baseUrl !== 'http://localhost:3000',
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  // exclude: [
  //   '/sitemap.xml', // Exclude our custom dynamic sitemap route
  //   '/*', // Exclude all routes (they're in the dynamic sitemap)
  // ],
  robotsTxtOptions: {
    additionalSitemaps: [`${baseUrl}/sitemap.xml`],
  },
}
