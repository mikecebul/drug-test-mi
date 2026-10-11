import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CircleAlert, CircleCheck, CircleMinus, Clock4, FileText, type LucideIcon } from 'lucide-react'
import sharp from 'sharp'
import { colors } from '../src/emails/drug-tests/utils/theme'

// Lucide SVGs are rasterized for email clients that do not support inline SVG.
// 3x assets stay sharp while every icon is displayed at the same 24px size.
const icons: Array<{ name: string; icon: LucideIcon; color: string; fill?: string; circleStroke?: string }> = [
  { name: 'circle-alert-red', icon: CircleAlert, color: '#ffffff', fill: colors.red, circleStroke: colors.red },
  { name: 'circle-check-green', icon: CircleCheck, color: colors.green },
  { name: 'circle-alert-amber', icon: CircleAlert, color: colors.amber },
  { name: 'circle-minus-gray', icon: CircleMinus, color: colors.muted },
  { name: 'clock-amber', icon: Clock4, color: colors.amber },
  { name: 'circle-check-gray', icon: CircleCheck, color: colors.muted },
  { name: 'file-text-gray', icon: FileText, color: colors.muted },
]
async function generateIcons() {
  const dir = path.resolve(import.meta.dirname, '../public/email-icons')
  await mkdir(dir, { recursive: true })
  for (const { name, icon, color, fill = 'none', circleStroke } of icons) {
    let svg = renderToStaticMarkup(createElement(icon, { color, fill, size: 72, strokeWidth: 2 }))
    // Keep the filled alert's outer stroke red so it has the same visible diameter
    // as the outlined Lucide circles. Its exclamation mark retains the white stroke.
    if (circleStroke) svg = svg.replace('<circle ', `<circle stroke="${circleStroke}" `)
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(dir, `${name}.png`))
  }
}

generateIcons().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
