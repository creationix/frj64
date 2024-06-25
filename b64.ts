const chars =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_'

export function encode(num: number, sizeOverride?: number): string {
    if (num === 0 && sizeOverride == undefined) return ''
    let numLeft = num

    const size = sizeOverride || sizeNeeded(num)
    const word: string[] = []
    for (let i = 0; i < size; i++) {
        word[i] = chars[numLeft & 0b111111]
        numLeft >>>= 6
    }
    return word.join('')

}

export function sizeNeeded(num: number): number {
    if (num === 0) return 0
    return Math.floor(Math.log(num) / Math.log(64) + 1)
}

export function decode(str: string): number {
    let num = 0
    for (let i = str.length - 1; i >= 0; i--) {
        const val = chars.indexOf(str[i])
        if (val >= 0) {
            num = num * 64 + val
        }
    }
    return num
}

// Sanity check
for (let i = 0; i < 10000; i++) {
    const encoded = encode(i)
    const decoded = decode(encoded)
    if (i !== decoded) throw new Error(`Expected ${i} but got ${decoded} when encoding ${encoded}`)
}
