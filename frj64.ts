// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-bitwise */

import { colorize } from "./colorize"
import { sizeNeeded, encode as b64 } from "./b64"

function strlen(str: string): number {
  return new TextEncoder().encode(str).byteLength
}

function sameShape(expected: unknown, actual: unknown): boolean {
  if (expected === actual) return true
  const et = typeof expected
  const at = typeof actual
  if (et !== at || expected === null || actual === null) return false
  if (expected instanceof RegExp && actual instanceof RegExp) {
    return expected.source === actual.source && expected.flags === actual.flags
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || et.length !== at.length) return false
    for (let i = 0; i < expected.length; i++) {
      if (!sameShape(expected[i], actual[i])) return false
    }
    return true
  }
  if (et === 'object') {
    const eKeys = Object.keys(expected as object)
    const aKeys = Object.keys(actual as object)
    if (eKeys.length !== aKeys.length) return false
    for (let i = 1, l = eKeys.length; i < l; i++) {
      if (eKeys[i] !== aKeys[i]) return false
    }
    for (const [key, value] of Object.entries(expected as object)) {
      if (!sameShape(value, (actual as Record<string, unknown>)[key])) return false
    }
    return true
  }
  return false
}

const defaultOptions = {
  indexThreshold: Infinity,
  columnThreshold: Infinity,
  deepSearch: false,
  stringSplit: false
}

export function frb64Encode(root: unknown, options = {}): string {
  const { indexThreshold, deepSearch, stringSplit, columnThreshold } = { ...defaultOptions, ...options }
  const seen = new Map<unknown, [number, number]>()
  const parts: string[] = []
  let offset = 0
  let columnStart = 0
  writeAny(root)
  return parts.join('')

  function write(str: string): void {
    parts.push(str)
    offset += strlen(str)
  }
  function writeAny(val: typeof root): void {
    let seenEntry = seen.get(val)
    if (seenEntry === undefined && deepSearch) {
      // Check all entries in the set using deep equality
      for (const key of seen.keys()) {
        if (sameShape(key, val)) {
          // console.log("Reusing", key)
          seenEntry = seen.get(key)
          break
        }
      }
    }

    if (seenEntry !== undefined) {
      const [seenOffset, seenSize] = seenEntry
      const encoded = `&${b64(offset - seenOffset)}`

      if (encoded.length * 2 <= seenSize) {
        // console.log({ encoded, val })
        // console.log("Reused", [encoded.length, seenSize], "with", encoded)
        write(encoded)
        const column = offset - columnStart
        if (column > columnThreshold) {
          write("\n")
          columnStart = offset
        }
        return
      }
    }
    const start = offset
    writeAnyInner(val)
    const size = offset - start
    const column = offset - columnStart
    if (column > columnThreshold) {
      write("\n")
      columnStart = offset
    }
    if (size > 2) {
      seen.set(val, [offset, size])
    }
  }
  function writeAnyInner(val: typeof root): void {
    if (Array.isArray(val)) {
      return writeArray(val)
    }
    if (typeof val === 'number') {
      if (Math.floor(val) === val) {
        if (val >= 0) {
          return write(`+${b64(val)}`)
        }
        return write(`~${b64(-val)}`)

      }
      // Multiply by 120 and round to a sane number of digits to avoid floating point errors
      const inner = (Math.round(val * 1200000000000) / 10000000000).toString()
      if (inner.indexOf('.') < 0) {
        // Use compact `*` mode for even multiples of 120
        return write(`*${b64(parseInt(inner))}`)
      }
      // Write out as decimal string otherwise
      write(inner)
      return write(`.${b64(strlen(inner))}`)
    }
    if (typeof val === 'string') {
      const len = strlen(val)
      if (len > 8 && stringSplit) {
        const segments = val.match(/[^a-zA-Z0-9]*[a-zA-Z0-9_-]+[^a-zA-Z0-9]*/g)
        if (segments && segments.length > 1) {
          return writeArray(segments, '/')
        }
      }
      write(val)
      return write(`$${b64(len)}`)
    }
    if (val instanceof RegExp) {
      if (val.flags === '' && val.source.startsWith('^')) {
        const inner = val.source.substring(1).replace(/\\\//g, '/')
        write(inner)
        return write(`^${b64(strlen(inner))}`)
      }
      throw new TypeError(`Unsupported regex ${val}`)
    }
    if (val && typeof val === 'object') {
      return writeObject(val)
    }
    if (val === null) {
      return write('%')
    }
    if (val === true) {
      return write('@')
    }
    if (val === false) {
      return write('!')
    }
    throw new TypeError(`Invalid type ${typeof val}`)
  }

  function writeObject(obj: object): void {
    const entries: [string, unknown][] = Object.entries(obj)
    const start = offset
    for (let i = entries.length - 1; i >= 0; i--) {
      const [key, value] = entries[i]
      writeAny(value)
      writeAny(key)
    }
    return write(`}${b64(offset - start)}`)
  }

  function writeArray(arr: unknown[], tag = ']'): void {
    const start = offset
    const count = arr.length
    const offsets = new Array<number>(count)
    for (let i = count - 1; i >= 0; i--) {
      writeAny(arr[i])
      offsets[i] = offset
    }
    const size = offset - start
    if (tag !== ']' || count < indexThreshold) {
      return write(`${tag}${b64(size)}`)
    }
    const startIndex = offset
    const biggest = startIndex - offsets[count - 1] || 0
    const width = sizeNeeded(biggest)
    for (let i = count - 1; i >= 0; i--) {
      const ptr = startIndex - offsets[i]
      write(b64(ptr, width))
    }
    write(`]${b64(width)}:${b64(count)}`)
    return write(`:${b64(offset - start)}`)
  }
}

function test(doc: unknown, options): string {
  const encodedDoc = frb64Encode(doc, options)
  let trunc = encodedDoc
  console.log()
  for (const line of encodedDoc.split("\n")) {
    console.log(colorize(line))
  }
  return encodedDoc
}



test([[], [[]], [[[]]], [[[[]]]], [100, 200, 300, 400, 500]])
test({ hello: "world" })
test([true, false, null, 0, 100, 0.1, 1.234])
const obj = { hello: "world" }
let arr = [obj, obj, obj, obj, obj]
test(arr)
arr = JSON.parse(JSON.stringify(arr))
test(arr)
test(arr, { deepSearch: true })
test([
  {
    "State": "Alabama",
    "Year": 1978,
    "Data": {
      "DHS Denominator": 972627,
      "Number of Firms": 54597,
      "Calculated": {
        "Net Job Creation": 74178,
        "Net Job Creation Rate": 7.627,
        "Reallocation Rate": 29.183
      },
      "Establishments": {
        "Entered": 10457,
        "Entered Rate": 16.375,
        "Exited": 7749,
        "Exited Rate": 12.135,
        "Physical Locations": 65213
      },
      "Firm Exits": {
        "Count": 5248,
        "Establishment Exit": 5329,
        "Employments": 28257
      },
      "Job Creation": {
        "Births": 76167,
        "Continuers": 139930,
        "Count": 216097,
        "Rate": 22.218,
        "Rate/Births": 7.831
      },
      "Job Destruction": {
        "Continuers": 81829,
        "Count": 141919,
        "Deaths": 60090,
        "Rate": 14.591,
        "Rate/Deaths": 6.178
      }
    }
  },
  {
    "State": "Alabama",
    "Year": 1979,
    "Data": {
      "DHS Denominator": 1037995,
      "Number of Firms": 55893,
      "Calculated": {
        "Net Job Creation": 58099,
        "Net Job Creation Rate": 5.597,
        "Reallocation Rate": 31.251
      },
      "Establishments": {
        "Entered": 9668,
        "Entered Rate": 14.701,
        "Exited": 7604,
        "Exited Rate": 11.562,
        "Physical Locations": 66797
      },
      "Firm Exits": {
        "Count": 5234,
        "Establishment Exit": 5294,
        "Employments": 29467
      },
      "Job Creation": {
        "Births": 76618,
        "Continuers": 143675,
        "Count": 220293,
        "Rate": 21.223,
        "Rate/Births": 7.381
      },
      "Job Destruction": {
        "Continuers": 101842,
        "Count": 162194,
        "Deaths": 60352,
        "Rate": 15.626,
        "Rate/Deaths": 5.814
      }
    }
  },
  {
    "State": "Alabama",
    "Year": 1980,
    "Data": {
      "DHS Denominator": 1064141,
      "Number of Firms": 54838,
      "Calculated": {
        "Net Job Creation": -7253,
        "Net Job Creation Rate": -0.682,
        "Reallocation Rate": 32.464
      },
      "Establishments": {
        "Entered": 8714,
        "Entered Rate": 13.168,
        "Exited": 8871,
        "Exited Rate": 13.406,
        "Physical Locations": 66095
      },
      "Firm Exits": {
        "Count": 6058,
        "Establishment Exit": 6128,
        "Employments": 32427
      },
      "Job Creation": {
        "Births": 65734,
        "Continuers": 106998,
        "Count": 172732,
        "Rate": 16.232,
        "Rate/Births": 6.177
      },
      "Job Destruction": {
        "Continuers": 120563,
        "Count": 179985,
        "Deaths": 59422,
        "Rate": 16.914,
        "Rate/Deaths": 5.584
      }
    }
  },
])
test([[1, 2, 3], [1, 2, 3], [1, 2, 3]])
test([
  { hello: "world" }, { hello: "world" },
  { goodbye: "world" }, { goodbye: "world" },
  { hello: "world" }
])
test([/^this is a regex/, /^this is a regex/, /^this is another regex/, /^this is a global regex/], { deepSearch: true })
for await (const file of [
]) {
  const doc = await fetch(`file://${file}`).then(r => r.json())
  const encoded = test(doc, {
    deepSearch: true,
    stringSplit: true,
    indexThreshold: 100,
    columnThreshold: 120
  })
  Bun.write(file.replace(/json$/, 'frj64'), encoded)
}

