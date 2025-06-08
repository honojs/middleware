// Constants derived from typical core-js patterns for string escaping
// (e.g., related to JS_STRING_ESCAPE or similar proposals)
const FIRST_DIGIT_OR_ASCII = /^[0-9A-Za-z]/
const SYNTAX_SOLIDUS = /[/]/
const OTHER_PUNCTUATORS_AND_WHITESPACES = /[!"#$&'()*+,./:;<=>?@[\]^`{|}~\s]/

// Control characters to escape, mapping to their escape sequence character
const ControlEscape: { [key: string]: string } = {
  '\0': '0', // Null character
  '\b': 'b', // Backspace
  '\t': 't', // Horizontal tab
  '\n': 'n', // Line feed (new line)
  '\v': 'v', // Vertical tab
  '\f': 'f', // Form feed
  '\r': 'r', // Carriage return
  '"': '"', // Double quote
  "'": "'", // Single quote
  '\\': '\\', // Backslash
}

/**
 * Escapes a character for use in a string literal.
 * Primarily handles:
 * - Control characters (0x00-0x1F) -> \u00XX
 * - Unpaired surrogates -> \uDXXX
 * Other characters are returned as is, as their escaping is handled by
 * ControlEscape, SYNTAX_SOLIDUS, or they are passed through.
 */
function _escapeChar(char: string): string {
  const charCode = char.charCodeAt(0)

  if (charCode < 0x20) {
    // ASCII Control characters
    return '\\u' + charCode.toString(16).padStart(4, '0')
  }
  if (charCode >= 0xd800 && charCode <= 0xdfff) {
    // Surrogates (typically unpaired if passed to this function directly)
    return '\\u' + charCode.toString(16).padStart(4, '0')
  }
  // For other characters (printable ASCII, other Unicode symbols) that might
  // be passed via FIRST_DIGIT_OR_ASCII or OTHER_PUNCTUATORS_AND_WHITESPACES,
  // they should remain themselves if they don't require \uXXXX escaping.
  return char
}

/**
 * `RegExp.escape` polyfill inspired by core-js
 */
function $escape(S: string): string {
  const length = S.length
  if (length === 0) {
    return ''
  }
  // Pre-allocate array; join is efficient for this.
  const result = new Array<string>(length)

  for (let i = 0; i < length; i++) {
    const chr = S.charAt(i)

    if (i === 0 && FIRST_DIGIT_OR_ASCII.exec(chr)) {
      result[i] = _escapeChar(chr)
    } else if (Object.prototype.hasOwnProperty.call(ControlEscape, chr)) {
      result[i] = '\\' + ControlEscape[chr]
    } else if (SYNTAX_SOLIDUS.exec(chr)) {
      result[i] = '\\' + chr
    } else if (OTHER_PUNCTUATORS_AND_WHITESPACES.exec(chr)) {
      result[i] = _escapeChar(chr)
    } else {
      const charCode = chr.charCodeAt(0)
      // Single UTF-16 code unit (non-surrogate)
      if ((charCode & 0xf800) !== 0xd800) {
        result[i] = chr
      }
      // Unpaired surrogate
      else if (
        charCode >= 0xdc00 || // Low surrogate (implies it's unpaired if we are here)
        i + 1 >= length || // High surrogate at end of string
        (S.charCodeAt(i + 1) & 0xfc00) !== 0xdc00 // High surrogate not followed by low surrogate
      ) {
        result[i] = _escapeChar(chr)
      }
      // Surrogate pair
      else {
        result[i] = chr // High surrogate
        i++ // Advance to include the low surrogate
        result[i] = S.charAt(i) // Low surrogate
      }
    }
  }

  return result.join('')
}

interface RegExpConstructor {
  escape(str: string): string
}

//@ts-expect-error: RegExp.escape is only included in Node.js v24+ and Deno v2.3+
export const escape = (RegExp.escape as RegExpConstructor['escape']) || $escape
