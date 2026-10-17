export type Cell = { text: string; x: number; y: number }
// Fictional in-memory PDFs exercise PDF.js itself, including out-of-order draws
// and repeated headings. They contain no copied report or patient data.
export function makeReportPdf(pages: Cell[][]): Buffer {
  const objects: string[] = ['', '']
  const kids: number[] = []
  const fontId = 3 + pages.length * 2
  for (const cells of pages) {
    const pageId = objects.length + 1,
      streamId = pageId + 1
    kids.push(pageId)
    const stream = [...cells]
      .reverse()
      .map((cell) => `BT /F1 10 Tf 1 0 0 1 ${cell.x} ${cell.y} Tm (${cell.text.replace(/([\\()])/g, '\\$1')}) Tj ET`)
      .join('\n')
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    )
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  let output = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output))
    output += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(output)
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(output)
}
