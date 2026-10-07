// Small CSV helpers for the batch upload and the history/results export.

/** Parse CSV text into objects keyed by the header row. Handles quoted values and commas inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length < 2) return []
  const header = nonEmpty[0].map((h) => h.trim().replace(/^﻿/, ''))
  return nonEmpty.slice(1).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])),
  )
}

function escape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => escape(r[c])).join(','))]
  // The byte-order mark makes Excel open the file as UTF-8.
  return '﻿' + lines.join('\r\n')
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const BATCH_TEMPLATE = [
  'lead_time,adr,deposit_type,is_repeated_guest,previous_cancellations,total_of_special_requests,hotel,market_segment',
  '12,95,No Deposit,1,0,2,Resort Hotel,Direct',
  '280,120,Non Refund,0,1,0,City Hotel,Online TA',
  '30,110,No Deposit,1,0,1,City Hotel,Corporate',
  '150,130,No Deposit,0,0,0,City Hotel,Online TA',
  '5,160,No Deposit,0,0,1,City Hotel,Online TA',
  '200,75,Refundable,0,0,0,Resort Hotel,Offline TA/TO',
].join('\r\n')
