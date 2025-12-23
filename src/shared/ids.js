export function createId(prefix = 'id') {
  const random = Math.random().toString(16).slice(2)
  const time = Date.now().toString(16)
  return `${prefix}_${time}_${random}`
}
