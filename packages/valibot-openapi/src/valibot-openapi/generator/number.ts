import type { GenericSchema } from 'valibot'

import type { ValidationAction } from '../guard/index'
import { findValidation, hasValidation, inputValidations } from '../pipe/index'
import type { MapNullableType, NumberBounds, NumberCheck } from '../types/index'

function numberChecks(validations: readonly ValidationAction[]) {
  return validations.flatMap<NumberCheck>((action) => {
    const value =
      typeof action.requirement === 'number' || typeof action.requirement === 'bigint'
        ? Number(action.requirement)
        : undefined
    if (value === undefined) {
      return []
    }
    switch (action.type) {
      case 'min_value':
        return [{ kind: 'min_value', value }]
      case 'max_value':
        return [{ kind: 'max_value', value }]
      case 'gt_value':
        return [{ kind: 'gt_value', value }]
      case 'lt_value':
        return [{ kind: 'lt_value', value }]
      default:
        return []
    }
  })
}

/**
 * `v.number()` with integer / bounds / multipleOf validations.
 *
 * @example
 * numberSchema(v.pipe(v.number(), v.integer(), v.minValue(1)), mapNullableType, getNumberChecks)
 * // { type: 'integer', minimum: 1 }
 */
export function numberSchema(
  schema: GenericSchema,
  mapNullableType: MapNullableType,
  getNumberChecks: (checks: readonly NumberCheck[]) => NumberBounds
) {
  const validations = inputValidations(schema)
  const isInteger =
    hasValidation(validations, 'integer') || hasValidation(validations, 'safe_integer')
  const multipleOf = findValidation(validations, 'multiple_of')?.requirement
  return {
    ...mapNullableType(isInteger ? 'integer' : 'number'),
    ...getNumberChecks(numberChecks(validations)),
    ...(typeof multipleOf === 'number' ? { multipleOf } : {}),
  }
}

/**
 * `v.bigint()` — represented as a decimal string, as JSON has no bigint.
 */
export function bigintSchema(mapNullableType: MapNullableType) {
  return {
    ...mapNullableType('string'),
    pattern: '^\\d+$',
  }
}

/**
 * `v.date()` — represented as an RFC 3339 date-time string.
 */
export function dateSchema(mapNullableType: MapNullableType) {
  return {
    ...mapNullableType('string'),
    format: 'date-time',
  }
}
