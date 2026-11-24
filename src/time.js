// 125 -> "2:05"
export const clock = (total) => {
  const seconds = Math.max(0, Math.ceil(total))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
