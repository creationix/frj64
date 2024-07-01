import { decode as parseB64 } from "./b64"

const fallback = "38;5;253"
const reference = "38;5;247"
const nil = "38;5;244"
const index = "38;5;240" // grey
const boolean = "38;5;220" // yellow-orange
const number = "38;5;202" // orange
const quotes = "38;5;40"  // green
const escape = "38;5;46"  // bright green
const regexp = "38;5;199" // pink
const map = "38;5;27"  // blue
const list = "38;5;39"  // blue2
const string = "38;5;120;48;5;22"  // bright green on dark green
const regex = "38;5;199;48;5;53"  // pink on dark pink
const float = "38;5;202;48;5;236"  // orange on dark grey

const colors = {
  "]": `\x1b[${list}m`,
  "}": `\x1b[${map}m`,
  "&": `\x1b[${reference}m`,
  "/": `\x1b[${escape}m`,
  "$": `\x1b[0m\x1b[${quotes}m`,
  "^": `\x1b[0m\x1b[${regexp}m`,
  "!": `\x1b[${boolean}m`,
  "@": `\x1b[${boolean}m`,
  "%": `\x1b[${nil}m`,
  "+": `\x1b[${number}m`,
  "~": `\x1b[${number}m`,
  "*": `\x1b[${number}m`,
  ".": `\x1b[0m\x1b[${number}m`,
  "_": `\x1b[${fallback}m`,
}

const indexColor = `\x1b[${index}m`

const sepdot = `\x1b[0m`
const literals = {
  "$": `\x1b[${string}m`,
  "^": `\x1b[${regex}m`,
  // "/": `\x1b[${string}m`,
  ".": `\x1b[${float}m`,
}

// This function is used to determine if a byte is a valid base64 character.
// It returns -1 if the byte is not a valid base64 character.
function toNum(b: number): number {
  if (b >= 48 && b <= 57) return b - 48
  if (b >= 65 && b <= 90) return b - 55
  if (b >= 97 && b <= 122) return b - 61
  if (b === 45) return 62
  if (b === 95) return 63
  return -1
}

export function colorize(line: string): string {
  const bytes = new TextEncoder().encode(line)
  let offset = bytes.length
  const tags: number[] = []

  function readB64() {
    let value = 0
    let digit: number
    while ((digit = toNum(bytes[offset])) >= 0) {
      value = value * 64 + digit
      offset--
    }
    return value
  }

  while (offset > 0) {
    const num = readB64()
    let tag = String.fromCharCode(bytes[offset--])
    while (tag === ':') {
      readB64()
      tag = String.fromCharCode(bytes[offset--])
    }

    const color = colors[m[1]] || colors._
    const literalColor = literals[m[1]]
    if (m[3]) {
      const width = parseB64(m[2])
      const count = parseB64(m[3])
      const firstOffset = Math.max(0, newOffset - width * count)
      tags.push(firstOffset, newOffset, color.length)
    }
    offset = newOffset
  }
}
