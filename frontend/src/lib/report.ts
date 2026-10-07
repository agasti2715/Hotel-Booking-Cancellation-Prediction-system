import type { PredictionResponse } from './api'
import { ALL_FIELDS } from './fields'
import { formatRisk } from './tones'

type RGB = [number, number, number]
const NAVY: RGB = [15, 23, 42]
const TEAL: RGB = [15, 118, 110]
const GREY: RGB = [100, 116, 139]
const LEVEL_COLOR: Record<string, RGB> = { Low: [22, 163, 74], Medium: [217, 119, 6], High: [220, 38, 38] }

/** Build and download a one-page PDF report for a prediction. jsPDF is loaded only when needed. */
export async function downloadReport(result: PredictionResponse, bookingName: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 16
  let y = 0

  // Header band
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('Hotel Booking Cancellation Report', M, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text('Hotel Booking Cancellation Prediction & Guest Experience Analytics Platform', M, 21)
  doc.text(`Generated ${new Date().toLocaleString()}`, W - M, 21, { align: 'right' })
  y = 42

  const heading = (text: string) => {
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(text, M, y)
    doc.setDrawColor(226, 232, 240)
    doc.line(M, y + 2, W - M, y + 2)
    y += 8
  }

  // Summary boxes
  const risk = result.probabilities.Cancelled
  const level = LEVEL_COLOR[result.risk_level]
  const boxes: [string, string, RGB][] = [
    ['Cancellation risk', formatRisk(risk), level],
    ['Risk level', result.risk_level, level],
    ['Guest satisfaction', `${result.guest.satisfaction}/100`, TEAL],
    ['Repeat likelihood', `${result.guest.repeat_likelihood}%`, TEAL],
  ]
  const boxW = (W - 2 * M - 9) / 4
  doc.setFontSize(9)
  doc.setTextColor(...GREY)
  doc.text(`Booking: ${bookingName}`, M, y - 4)
  boxes.forEach(([label, value, color], i) => {
    const x = M + i * (boxW + 3)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(x, y, boxW, 22, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GREY)
    doc.text(label, x + 4, y + 7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...color)
    doc.text(value, x + 4, y + 17)
  })
  y += 32

  heading('Prediction')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...NAVY)
  const verdict = result.outcome === 'Cancelled' ? 'Likely to cancel' : 'Likely to be honoured'
  doc.text(`Classification: ${verdict} (${result.risk_level} risk)`, M, y)
  y += 6
  doc.text(
    `Cancellation probability ${risk.toFixed(2)}%  |  Confirmation probability ${result.probabilities.Confirmed.toFixed(2)}%`,
    M,
    y,
  )
  y += 6
  doc.text(`Loyalty tier: ${result.guest.loyalty_tier}`, M, y)
  y += 10

  heading('Booking details')
  const fields = ALL_FIELDS.filter((f) => result.booking[f.name] !== undefined)
  const colW = (W - 2 * M) / 2
  doc.setFontSize(9.5)
  fields.forEach((f, i) => {
    const x = M + (i % 2) * colW
    const rowY = y + Math.floor(i / 2) * 6
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GREY)
    doc.text(f.label.replace(/ \(.*\)/, ''), x, rowY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(result.booking[f.name], x + colW - 6, rowY, { align: 'right' })
  })
  y += Math.ceil(fields.length / 2) * 6 + 6

  if (result.drivers.length) {
    heading('Why this risk (compared with a typical booking)')
    doc.setFontSize(9.5)
    result.drivers.forEach((d) => {
      const up = d.impact > 0
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...NAVY)
      doc.text(`${d.label}: ${d.value} (typical ${d.typical})`, M, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...(up ? LEVEL_COLOR.High : LEVEL_COLOR.Low))
      doc.text(`${up ? '+' : ''}${d.impact.toFixed(1)} pts`, W - M, y, { align: 'right' })
      y += 6
    })
    y += 4
  }

  heading('Recommended actions')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...NAVY)
  result.tips.forEach((tip, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${tip}`, W - 2 * M)
    doc.text(lines, M, y)
    y += lines.length * 5 + 1.5
  })

  doc.setFontSize(8)
  doc.setTextColor(...GREY)
  doc.text(
    'Satisfaction and repeat likelihood are rule-based indicators derived from booking signals. Predictions come from a machine learning model trained on 119,390 hotel bookings.',
    M,
    287,
    { maxWidth: W - 2 * M },
  )

  doc.save(`booking-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}
