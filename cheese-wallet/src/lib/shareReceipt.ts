// Capture an off-screen DOM element and share/download it as JPEG or PDF.
export type ShareFormat = 'jpeg' | 'pdf'

export async function captureAndShare(
  el: HTMLElement,
  format: ShareFormat,
  filename = 'cheese-receipt',
): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(el, {
    backgroundColor: '#141414',
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
  })

  if (format === 'jpeg') {
    return shareAsJpeg(canvas, `${filename}.jpg`)
  }

  // PDF — wrap the JPEG image in a page the same proportions as the receipt
  const { jsPDF } = await import('jspdf')
  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  const pageW = 210 // mm (same as A4 width)
  const pageH = Math.round((canvas.height / canvas.width) * pageW)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, pageH] })
  doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH)
  const blob = doc.output('blob')
  return shareOrDownload(blob, 'application/pdf', `${filename}.pdf`)
}

async function shareAsJpeg(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise<void>((resolve) => {
    canvas.toBlob(
      async (blob) => {
        if (blob) await shareOrDownload(blob, 'image/jpeg', filename)
        resolve()
      },
      'image/jpeg',
      0.92,
    )
  })
}

async function shareOrDownload(blob: Blob, type: string, filename: string): Promise<void> {
  const file = new File([blob], filename, { type })
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof (navigator as unknown as { canShare?: (d: unknown) => boolean }).canShare === 'function' &&
    (navigator as unknown as { canShare: (d: unknown) => boolean }).canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: 'Cheese Pay Receipt' })
      return
    } catch {
      // Share cancelled or user gesture lost — fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
