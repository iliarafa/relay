import type { ThreadMessage } from '@/lib/storage/db'
import { threadToMarkdown } from '@/lib/threadMarkdown'
import { buildBriefingHtml, exportFilename } from './briefing'

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportMarkdownFile(messages: ThreadMessage[]): void {
  const filename = exportFilename(new Date(), 'md')
  const content = threadToMarkdown(messages)
  downloadBlob(filename, new Blob([content], { type: 'text/markdown;charset=utf-8' }))
}

export function exportHtmlFile(messages: ThreadMessage[]): void {
  const now = new Date()
  const filename = exportFilename(now, 'html')
  const content = buildBriefingHtml(messages, { now })
  downloadBlob(filename, new Blob([content], { type: 'text/html;charset=utf-8' }))
}

export async function exportPdfFile(messages: ThreadMessage[]): Promise<void> {
  const now = new Date()
  const filename = exportFilename(now, 'pdf')
  const html = buildBriefingHtml(messages, { now })
  await downloadBriefingPdf(html, filename)
}

async function downloadBriefingPdf(html: string, filename: string): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '800px',
    height: '1200px',
    border: '0',
    visibility: 'hidden',
  })
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    if (!doc) throw new Error('PDF frame unavailable')
    doc.open()
    doc.write(html)
    doc.close()
    await waitForPaint()

    const article = doc.querySelector('.briefing')
    if (!article) throw new Error('Briefing document missing')

    const { default: html2canvas } = await import('html2canvas')
    const { jsPDF } = await import('jspdf')

    const canvas = await html2canvas(article as HTMLElement, {
      scale: 2,
      backgroundColor: '#f6f1e8',
      windowWidth: 800,
    })

    const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const imgData = canvas.toDataURL('image/png')

    let remaining = imgHeight
    let position = 0
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    remaining -= pageHeight
    while (remaining > 0) {
      position = remaining - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      remaining -= pageHeight
    }
    pdf.save(filename)
  } finally {
    iframe.remove()
  }
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}
