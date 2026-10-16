function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const a = hash(xi, yi), b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  const u = smooth(xf), v = smooth(yf)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function serraHeight(x, z) {
  let h = 0
  h += noise2(x * 0.055, z * 0.055) * 3.4
  h += noise2(x * 0.16,  z * 0.16)  * 1.1
  h += noise2(x * 0.5,   z * 0.5)   * 0.28
  return h
}
