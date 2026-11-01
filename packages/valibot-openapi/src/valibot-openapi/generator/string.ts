import type { GenericSchema } from 'valibot'

import type { ValidationAction } from '../guard/index'
import { findValidation, inputValidations, requirementNumber } from '../pipe/index'
import type { MapNullableType } from '../types/index'

/**
 * Maps valibot string format validations to OpenAPI `format` values. Values follow the
 * OpenAPI format registry (https://spec.openapis.org/registry/format/) where one exists.
 */
const STRING_FORMATS: { readonly [actionType: string]: string } = {
  uuid: 'uuid',
  email: 'email',
  rfc_email: 'email',
  url: 'uri',
  iso_date: 'date',
  iso_date_time: 'date-time',
  iso_date_time_second: 'date-time',
  iso_timestamp: 'date-time',
  iso_time: 'time',
  iso_time_second: 'time',
  ipv4: 'ipv4',
  ipv6: 'ipv6',
  ip: 'ip',
  base64: 'byte',
  decimal: 'decimal',
  cuid2: 'cuid2',
  ulid: 'ulid',
  nanoid: 'nanoid',
  emoji: 'emoji',
}

function stringFormat(validations: readonly ValidationAction[]) {
  return validations
    .map((action) => STRING_FORMATS[action.type])
    .find((format) => format !== undefined)
}

/**
 * `v.string()` with its length / pattern / format validations.
 *
 * @example
 * stringSchema(v.pipe(v.string(), v.minLength(1), v.email()), mapNullableType)
 * // { type: 'string', minLength: 1, format: 'email' }
 */
export function stringSchema(schema: GenericSchema, mapNullableType: MapNullableType) {
  const validations = inputValidations(schema)
  const regex = findValidation(validations, 'regex')?.requirement
  const pattern = regex instanceof RegExp ? regex.source : undefined
  const length = requirementNumber(validations, 'length')
  const nonEmpty = findValidation(validations, 'non_empty') === undefined ? undefined : 1
  const minLength = length ?? requirementNumber(validations, 'min_length') ?? nonEmpty
  const maxLength = length ?? requirementNumber(validations, 'max_length')
  return {
    ...mapNullableType('string'),
    minLength,
    maxLength,
    format: stringFormat(validations),
    pattern,
  }
}
