import { FormatRegistry, Type } from '@sinclair/typebox'
import { fullFormats } from './formats'

if (!FormatRegistry.Has(fullFormats.date)) {
  FormatRegistry.Set(fullFormats.date, (value) => {
    return typeof value === 'string' && fullFormats.date(value)
  })
}

if (!FormatRegistry.Has(fullFormats['date-time'])) {
  FormatRegistry.Set(fullFormats['date-time'], (value) => {
    return typeof value === 'string' && fullFormats['date-time'](value)
  })
}

for (const [formatName, formatValue] of Object.entries(fullFormats)) {
  if (!FormatRegistry.Has(formatName)) {
    if (formatValue instanceof RegExp)
      FormatRegistry.Set(formatName, (value) => formatValue.test(value))
    else if (typeof formatValue === 'function') FormatRegistry.Set(formatName, formatValue)
  }
}

export const T = Type
