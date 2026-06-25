// 9-box strike-zone grid (3x3). The grid is shown from the pitcher's / center-field (TV)
// view: looking in at the plate, a RIGHT-handed hitter stands on the right, so his INSIDE
// is the right column. The main-screen Righty/Lefty toggle flips inside/outside.

export const ZONE_ROWS = [0, 1, 2] // 0 top, 1 middle, 2 bottom
export const ZONE_COLS = [0, 1, 2] // 0 left, 1 center, 2 right

function terms(row, col, hand) {
  const vert = ['up', '', 'down'][row]
  let horiz = ''
  if (col !== 1) {
    // RHB inside = right column (col 2); LHB inside = left column (col 0).
    const inside = hand === 'R' ? col === 2 : col === 0
    horiz = inside ? 'in' : 'away'
  }
  return { vert, horiz }
}

/** Spoken location for a zone, e.g. "up and in", "inside", "down", "middle". */
export function zoneSpoken(row, col, hand) {
  const { vert, horiz } = terms(row, col, hand)
  if (vert && horiz) return `${vert} and ${horiz}`
  if (vert) return vert
  if (horiz) return horiz === 'in' ? 'inside' : 'outside'
  return 'middle'
}

/** Short label for the on-screen box, e.g. "Up & In", "Inside", "Middle". */
export function zoneLabel(row, col, hand) {
  const { vert, horiz } = terms(row, col, hand)
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)
  if (vert && horiz) return `${cap(vert)} & ${horiz === 'in' ? 'In' : 'Away'}`
  if (vert) return cap(vert)
  if (horiz) return horiz === 'in' ? 'Inside' : 'Outside'
  return 'Middle'
}
