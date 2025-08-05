export function getUTCRange() {
  const now = new Date()
  const utcStart = now.toISOString()
  const utcEnd = new Date(now.getTime() + (24 * 60 * 60 * 1000*5)).toISOString() // +1 day
  return { utcStart, utcEnd }
}