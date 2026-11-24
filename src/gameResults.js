import { impGame } from './api'

// Builds the results spreadsheet (Summary, Rounds, Students) and saves it. The Excel library is loaded only
// when someone downloads, so it never slows the game down.
export async function downloadResults({ gameId, hostToken }) {
  const data = await impGame({ action: 'game_results', game_id: gameId, host_token: hostToken })
  const XLSX = await import('xlsx')

  const book = XLSX.utils.book_new()
  const addSheet = (name, rows, widths) => {
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'Nothing to show yet.' }])
    sheet['!cols'] = widths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(book, sheet, name)
    return sheet
  }

  addSheet('Summary', data.summary ?? [], [24, 8, 8, 10, 14])
  const rounds = data.rounds ?? []
  const sheet = addSheet('Rounds', rounds, [7, 16, 26, 26, 22, 18, 18, 28, 20, 50, 60, 14])

  // Excel files made in the browser can't hold pictures, so a question's picture is a clickable link
  const columns = Object.keys(rounds[0] ?? {})
  const pictureColumn = columns.indexOf('Picture')
  if (pictureColumn >= 0) {
    rounds.forEach((row, i) => {
      if (!row.Picture) return
      const cell = sheet[XLSX.utils.encode_cell({ r: i + 1, c: pictureColumn })]
      cell.v = 'View picture'
      cell.l = { Target: row.Picture, Tooltip: 'Open the question picture' }
    })
  }

  addSheet('Students', data.students ?? [], [22, 16, 8, 13, 14, 10, 22])

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(book, `PLTL-Imposter-results-${today}.xlsx`)
}
