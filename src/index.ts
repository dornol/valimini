const inspectIssues = Symbol('inspectIssues')

export type ValidationPath = readonly (string | number)[]

interface RuleIssue {
  code: string
  message: string
  path: ValidationPath
}

export type ValidationData = Record<string, unknown>

export interface Rule<Data extends object = ValidationData> {
  readonly code: string
  readonly message: string
  readonly required?: boolean
  readonly test: (value: unknown, data: Readonly<Partial<Data>>) => boolean
  readonly [inspectIssues]?: (value: unknown, data: Readonly<Partial<Data>>) => readonly RuleIssue[]
}

export interface FieldError {
  code: string
  message: string
  path: ValidationPath
  name: string
}

export interface FirstError extends FieldError {
  field: string
}

export type ValidationResult =
  | { valid: true; errors: Record<string, FieldError[]>; firstError: null }
  | { valid: false; errors: Record<string, FieldError[]>; firstError: FirstError }

export type Rules<Data extends object> = Partial<{
  [Key in keyof Data]: readonly Rule<Data>[]
}>

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
}

export function required(message = '필수 입력 항목입니다.'): Rule {
  return { code: 'required', message, required: true, test: value => !isEmpty(value) }
}

const emailLocalPart = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i
const emailDomain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

export function email(message = '이메일 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'email', message,
    test: value => {
      if (typeof value !== 'string' || value.length > 254) return false
      const at = value.indexOf('@')
      return at > 0 && at <= 64 &&
        emailLocalPart.test(value.slice(0, at)) && emailDomain.test(value.slice(at + 1))
    },
  }
}

const koreanMobileNumber = /^(?:0|\+82[- ]?)10([- ]?)[0-9]{4}\1[0-9]{4}$/
const koreanInternetPhone = /^(?:0|\+82[- ]?)70([- ]?)[0-9]{4}\1[0-9]{4}$/
const koreanLandline = /^(?:0|\+82[- ]?)(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4])([- ]?)[0-9]{3,4}\1[0-9]{4}$/
const koreanVirtualFax = /^(?:0|\+82[- ]?)50[0-9]([- ]?)[0-9]{3,4}\1[0-9]{4}$/
const koreanRepresentative = /^(?:14[0-9]{4}|1[568][0-9]{2}[- ]?[0-9]{4})$/

function isKoreanTelephone(value: string): boolean {
  return koreanLandline.test(value) || koreanInternetPhone.test(value)
}

function isKoreanPhone(value: string): boolean {
  return isKoreanTelephone(value) || koreanMobileNumber.test(value)
}

export function koreanTelephone(message = '한국 일반전화 번호 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'koreanTelephone', message,
    test: value => typeof value === 'string' && isKoreanTelephone(value),
  }
}

export function koreanMobile(message = '한국 휴대전화 번호 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'koreanMobile', message,
    test: value => typeof value === 'string' && koreanMobileNumber.test(value),
  }
}

export function koreanPhone(message = '한국 전화번호 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'koreanPhone', message,
    test: value => typeof value === 'string' && isKoreanPhone(value),
  }
}

export function koreanRepresentativeNumber(message = '전국대표번호 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'koreanRepresentativeNumber', message,
    test: value => typeof value === 'string' && koreanRepresentative.test(value),
  }
}

export function koreanTollFreeNumber(message = '수신자부담 번호 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'koreanTollFreeNumber', message,
    test: value => typeof value === 'string' && /^080([- ]?)[0-9]{3,4}\1[0-9]{4}$/.test(value),
  }
}

export function koreanContactNumber(message = '한국 연락처 번호 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'koreanContactNumber', message,
    test: value => typeof value === 'string' && (isKoreanPhone(value) || koreanRepresentative.test(value)),
  }
}

export function koreanFax(message = '한국 팩스 번호 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'koreanFax', message,
    test: value => typeof value === 'string' &&
      (isKoreanTelephone(value) || koreanVirtualFax.test(value)),
  }
}

export function koreanPostalCode(message = '한국 우편번호는 숫자 5자리여야 합니다.'): Rule {
  return {
    code: 'koreanPostalCode', message,
    test: value => typeof value === 'string' && /^[0-9]{5}$/.test(value),
  }
}

const businessRegistrationWeights = [1, 3, 7, 1, 3, 7, 1, 3]

export function koreanBusinessRegistrationNumber(message = '사업자등록번호 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'koreanBusinessRegistrationNumber', message,
    test: value => {
      if (typeof value !== 'string' || !/^[0-9]{3}(-?)[0-9]{2}\1[0-9]{5}$/.test(value)) return false
      const digits = value.replaceAll('-', '')
      if (digits === '0000000000') return false
      const weightedSum = businessRegistrationWeights.reduce((sum, weight, index) => sum + Number(digits[index]) * weight, 0)
      const lastProduct = Number(digits[8]) * 5
      const checksumSum = weightedSum + Math.floor(lastProduct / 10) + lastProduct % 10
      return (checksumSum + Number(digits[9])) % 10 === 0
    },
  }
}

export interface KoreanCorporateRegistrationOptions {
  readonly legacyChecksum?: boolean
}

export function koreanCorporateRegistrationNumber(
  options: KoreanCorporateRegistrationOptions | string = {},
  message = '법인등록번호 형식이 올바르지 않습니다.',
): Rule {
  const legacyChecksum = typeof options !== 'string' && options.legacyChecksum === true
  return {
    code: 'koreanCorporateRegistrationNumber',
    message: typeof options === 'string' ? options : message,
    test: value => {
      if (typeof value !== 'string' || !/^[0-9]{6}-?[0-9]{7}$/.test(value)) return false
      const digits = value.replace('-', '')
      if (digits === '0000000000000') return false
      if (!legacyChecksum) return true

      let weightedSum = 0
      for (let index = 0; index < 12; index++) {
        weightedSum += Number(digits[index]) * (index % 2 + 1)
      }
      return (weightedSum + Number(digits[12])) % 10 === 0
    },
  }
}

function lengthRule(code: string, limit: number, message: string, compare: (size: number) => boolean): Rule {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError('길이는 0 이상의 안전한 정수여야 합니다.')
  }
  return {
    code, message,
    test: value => (typeof value === 'string' || Array.isArray(value)) && compare(value.length),
  }
}

export function minLength(limit: number, message = `${limit}자 이상 입력해주세요.`): Rule {
  return lengthRule('minLength', limit, message, size => size >= limit)
}

export function maxLength(limit: number, message = `${limit}자 이하로 입력해주세요.`): Rule {
  return lengthRule('maxLength', limit, message, size => size <= limit)
}

export function pattern(expression: RegExp, message = '입력 형식이 올바르지 않습니다.'): Rule {
  // Keep lastIndex and subsequent mutations of the caller's RegExp isolated.
  const regex = new RegExp(expression.source, expression.flags)
  return {
    code: 'pattern', message,
    test: value => {
      regex.lastIndex = 0
      return typeof value === 'string' && regex.test(value)
    },
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export interface NumericOptions {
  readonly allowString?: boolean
  readonly thousandsSeparator?: ','
}

export interface IntegerOptions extends NumericOptions {
  readonly safe?: boolean
}

export interface RangeOptions extends NumericOptions {
  readonly exactDecimal?: boolean
}

type NumericArgument = NumericOptions | string

function numericRule(
  code: string,
  argument: NumericArgument,
  defaultMessage: string,
  compare: (value: number, decimalText?: string) => boolean,
  message?: string,
): Rule {
  const options = typeof argument === 'string' ? {} : { ...argument }
  if (options.thousandsSeparator !== undefined && options.thousandsSeparator !== ',') {
    throw new TypeError('현재 천 단위 구분자는 콤마만 지원합니다.')
  }
  const format = options.thousandsSeparator === ','
    ? /^[+-]?(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:\.[0-9]+)?$/
    : /^[+-]?[0-9]+(?:\.[0-9]+)?$/
  return {
    code,
    message: typeof argument === 'string' ? argument : message ?? defaultMessage,
    test: value => {
      if (typeof value === 'string' && options.allowString) {
        const text = value.trim()
        if (!format.test(text)) return false
        const decimalText = text.replaceAll(',', '')
        const numeric = Number(decimalText)
        return isFiniteNumber(numeric) && compare(numeric, decimalText)
      }
      return isFiniteNumber(value) && compare(value)
    },
  }
}

export function number(options: NumericArgument = {}, message?: string): Rule {
  return numericRule('number', options, '숫자를 입력해주세요.', () => true, message)
}

export function integer(options: IntegerOptions | string = {}, message?: string): Rule {
  const isInteger = typeof options !== 'string' && options.safe ? Number.isSafeInteger : Number.isInteger
  return numericRule('integer', options, '정수를 입력해주세요.', (value, decimalText) =>
    isInteger(value) && (decimalText === undefined || !/\.[0-9]*[1-9]/.test(decimalText)), message)
}

function decimalParts(text: string) {
  const [mantissa, exponent = '0'] = text.split('e')
  const [whole, fraction = ''] = mantissa.replace(/^[+-]/, '').split('.')
  const allDigits = whole + fraction
  const significant = allDigits.replace(/^0+/, '')
  if (significant === '') return { sign: 0, decimalPosition: 0, digits: '' }
  return {
    sign: mantissa.startsWith('-') ? -1 : 1,
    decimalPosition: whole.length - (allDigits.length - significant.length) + Number(exponent),
    digits: significant.replace(/([1-9])0+$/, '$1'),
  }
}

function compareDecimals(value: ReturnType<typeof decimalParts>, limit: ReturnType<typeof decimalParts>): number {
  if (value.sign !== limit.sign) return value.sign - limit.sign
  // Compare magnitude by the decimal point position, then by the significant digits.
  const positions = value.decimalPosition - limit.decimalPosition
  if (positions !== 0) return positions * value.sign
  if (value.digits === limit.digits) return 0
  return value.digits > limit.digits ? value.sign : -value.sign
}

function rangeRule(
  code: string, limit: number, options: RangeOptions | string, defaultMessage: string,
  withinRange: (comparison: number) => boolean, message?: string,
): Rule {
  if (!isFiniteNumber(limit)) throw new RangeError('범위는 유한한 숫자여야 합니다.')
  const decimalLimit = typeof options !== 'string' && options.exactDecimal ? decimalParts(String(limit)) : undefined
  return numericRule(code, options, defaultMessage, (value, decimalText) => {
    if (decimalLimit && decimalText !== undefined) {
      return withinRange(compareDecimals(decimalParts(decimalText), decimalLimit))
    }
    return withinRange(value - limit)
  }, message)
}

export function min(limit: number, options: RangeOptions | string = {}, message?: string): Rule {
  return rangeRule('min', limit, options, `${limit} 이상 입력해주세요.`, comparison => comparison >= 0, message)
}

export function max(limit: number, options: RangeOptions | string = {}, message?: string): Rule {
  return rangeRule('max', limit, options, `${limit} 이하로 입력해주세요.`, comparison => comparison <= 0, message)
}

export function url(message = 'URL 형식이 올바르지 않습니다.'): Rule {
  return {
    code: 'url', message,
    test: value => {
      if (typeof value !== 'string' || /[\s\\\u0000-\u001f\u007f-\u009f]/.test(value) ||
        !/^https?:\/\/[^/?#]/i.test(value)) return false
      try {
        const parsed = new URL(value)
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname !== ''
      } catch {
        return false
      }
    },
  }
}

export function oneOf(values: readonly unknown[], message = '허용된 값 중에서 선택해주세요.'): Rule {
  const allowed = new Set(values)
  return { code: 'oneOf', message, test: value => allowed.has(value) }
}

export function matchesField<Data extends object = ValidationData>(
  field: keyof Data & string,
  message = '입력값이 일치하지 않습니다.',
): Rule<Data> {
  return {
    code: 'matchesField', message,
    test: (value, data) => Object.hasOwn(data, field) && value === data[field],
  }
}

export function accepted(message = '동의가 필요합니다.'): Rule {
  return { code: 'accepted', message, required: true, test: value => value === true }
}

export function notOneOf(values: readonly unknown[], message = '사용할 수 없는 값입니다.'): Rule {
  const denied = new Set(values)
  return { code: 'notOneOf', message, test: value => !denied.has(value) }
}

export function notMatchesField<Data extends object = ValidationData>(
  field: keyof Data & string,
  message = '다른 값을 입력해주세요.',
): Rule<Data> {
  return {
    code: 'notMatchesField', message,
    test: (value, data) => !Object.hasOwn(data, field) || value !== data[field],
  }
}

export function requiredIf<Data extends object = ValidationData>(
  predicate: (data: Readonly<Partial<Data>>) => boolean,
  message = '필수 입력 항목입니다.',
): Rule<Data> {
  return {
    code: 'requiredIf', message, required: true,
    test: (value, data) => {
      const mandatory = predicate(data)
      if (typeof mandatory !== 'boolean') throw new TypeError('requiredIf 조건은 boolean을 반환해야 합니다.')
      return !mandatory || !isEmpty(value)
    },
  }
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

export function date(message = '유효한 날짜를 YYYY-MM-DD 형식으로 입력해주세요.'): Rule {
  return { code: 'date', message, test: isDate }
}

export function before(limit: string, message = `${limit} 이전 날짜를 입력해주세요.`): Rule {
  if (!isDate(limit)) throw new RangeError('기준 날짜는 유효한 YYYY-MM-DD 문자열이어야 합니다.')
  return { code: 'before', message, test: value => isDate(value) && value < limit }
}

export function after(limit: string, message = `${limit} 이후 날짜를 입력해주세요.`): Rule {
  if (!isDate(limit)) throw new RangeError('기준 날짜는 유효한 YYYY-MM-DD 문자열이어야 합니다.')
  return { code: 'after', message, test: value => isDate(value) && value > limit }
}

export interface TimeOptions {
  readonly seconds?: boolean
}

type TimeArgument = TimeOptions | string

function timeParts(argument: TimeArgument, message: string | undefined, fallback: string) {
  return {
    seconds: typeof argument === 'string' ? false : argument.seconds === true,
    message: typeof argument === 'string' ? argument : message ?? fallback,
  }
}

function isTime(value: unknown, seconds: boolean): value is string {
  return typeof value === 'string' && (seconds
    ? /^(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/
    : /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/).test(value)
}

export function time(options: TimeArgument = {}, message?: string): Rule {
  const settings = timeParts(options, message, '유효한 시간을 입력해주세요.')
  return { code: 'time', message: settings.message, test: value => isTime(value, settings.seconds) }
}

function timeRangeRule(
  code: string, limit: string, options: TimeArgument, message: string | undefined,
  fallback: string, compare: (value: string) => boolean,
): Rule {
  const settings = timeParts(options, message, fallback)
  if (!isTime(limit, settings.seconds)) throw new RangeError('기준 시간 형식이 올바르지 않습니다.')
  return {
    code, message: settings.message,
    test: value => isTime(value, settings.seconds) && compare(value),
  }
}

export function beforeTime(limit: string, options: TimeArgument = {}, message?: string): Rule {
  return timeRangeRule('beforeTime', limit, options, message, `${limit} 이전 시간을 입력해주세요.`, value => value < limit)
}

export function afterTime(limit: string, options: TimeArgument = {}, message?: string): Rule {
  return timeRangeRule('afterTime', limit, options, message, `${limit} 이후 시간을 입력해주세요.`, value => value > limit)
}

function itemsRule(code: string, limit: number, message: string, compare: (size: number) => boolean): Rule {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('항목 수는 0 이상의 안전한 정수여야 합니다.')
  return {
    code, message, required: true,
    // Missing optional values are skipped, but an existing empty array has a length to check.
    test: value => Array.isArray(value) ? compare(value.length) : isEmpty(value),
  }
}

export function minItems(limit: number, message = `${limit}개 이상 선택해주세요.`): Rule {
  return itemsRule('minItems', limit, message, size => size >= limit)
}

export function maxItems(limit: number, message = `${limit}개 이하로 선택해주세요.`): Rule {
  return itemsRule('maxItems', limit, message, size => size <= limit)
}

export function uniqueItems(message = '중복된 항목이 있습니다.'): Rule {
  return {
    code: 'uniqueItems', message,
    test: value => Array.isArray(value) && new Set(value).size === value.length,
  }
}

export function custom<Data extends object = ValidationData>(
  test: (value: unknown, data: Readonly<Partial<Data>>) => boolean,
  message: string,
  code = 'custom',
): Rule<Data> {
  return { code, message, test }
}

export interface Validator<Data extends object = ValidationData> {
  validate(data: Partial<Data>): ValidationResult
}

/** Convert a path into the exact input name expected by the HTML integration. */
export function pathToName(path: ValidationPath): string {
  return path.map((segment, index) => {
    if (typeof segment === 'number') return `[${segment}]`
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) return `${index === 0 ? '' : '.'}${segment}`
    return `[${JSON.stringify(segment)}]`
  }).join('')
}

function runRules<Data extends object>(
  rules: readonly Rule<Data>[], value: unknown, data: Readonly<Partial<Data>>,
): readonly RuleIssue[] {
  for (const rule of rules) {
    if (isEmpty(value) && !rule.required) continue
    if (rule[inspectIssues]) {
      const issues = rule[inspectIssues](value, data)
      if (issues.length) return issues
      continue
    }
    const passed = rule.test(value, data)
    if (typeof passed !== 'boolean') {
      throw new TypeError('검증 규칙은 boolean을 반환해야 합니다. 비동기 규칙은 지원하지 않습니다.')
    }
    if (!passed) return [{ code: rule.code, message: rule.message, path: [] }]
  }
  return []
}

export function anyOf<Data extends object = ValidationData>(
  rules: readonly Rule<Data>[],
  message = '허용된 형식 중 하나에 맞게 입력해주세요.',
): Rule<Data> {
  if (rules.length === 0) throw new RangeError('anyOf에는 하나 이상의 검증 룰이 필요합니다.')
  const alternatives = rules.map(rule => ({ ...rule }))
  return {
    code: 'anyOf', message,
    required: alternatives.every(rule => rule.required === true),
    test: (value, data) => alternatives.some(rule => runRules([rule], value, data).length === 0),
  }
}

function inspectObject<Data extends object>(validator: Validator<Data>, value: unknown, message: string): RuleIssue[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [{ code: 'object', message, path: [] }]
  }
  const result = validator.validate(value as Partial<Data>)
  return Object.values(result.errors).flatMap(errors =>
    errors.map(({ code, message, path }) => ({ code, message, path })))
}

export function object<Data extends object = ValidationData>(
  validator: Validator<Data>,
  message = '객체를 입력해주세요.',
): Rule {
  const inspect = (value: unknown) => inspectObject(validator, value, message)
  return {
    code: 'object', message,
    test: value => inspect(value).length === 0,
    [inspectIssues]: inspect,
  }
}

export function each<Data extends object = ValidationData>(
  item: readonly Rule[] | Validator<Data>,
  message = '배열을 입력해주세요.',
): Rule {
  const rules = Array.isArray(item) ? (item as readonly Rule[]).map(rule => ({ ...rule })) : null
  const validator = rules ? null : item as Validator<Data>
  const inspect = (value: unknown, data: Readonly<Partial<ValidationData>>): RuleIssue[] => {
    if (!Array.isArray(value)) return [{ code: 'each', message, path: [] }]
    const issues: RuleIssue[] = []
    // Use an index loop so holes also receive required validation.
    for (let index = 0; index < value.length; index++) {
      const entry: unknown = Object.hasOwn(value, index) ? value[index] : undefined
      if (rules) {
        for (const issue of runRules(rules, entry, data)) {
          issues.push({ ...issue, path: [index, ...issue.path] })
        }
      } else {
        for (const issue of inspectObject(validator!, entry, '객체를 입력해주세요.')) {
          issues.push({ ...issue, path: [index, ...issue.path] })
        }
      }
    }
    return issues
  }
  return {
    code: 'each', message,
    test: (value, data) => inspect(value, data).length === 0,
    [inspectIssues]: inspect,
  }
}

export function createValidator<Data extends object = ValidationData>(rules: Rules<Data>): Validator<Data> {
  const fields = Object.entries(rules)
    .filter(([, entries]) => entries !== undefined)
    .map(([field, entries]) => [
      field, (entries as readonly Rule<Data>[]).map(rule => ({ ...rule })),
    ] as const)

  return {
    validate(data: Partial<Data>): ValidationResult {
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new TypeError('validate에는 객체를 전달해주세요.')
      }
      const errors: Record<string, FieldError[]> = {}
      let firstError: FirstError | null = null

      for (const [field, entries] of fields) {
        const value = Object.hasOwn(data, field) ? (data as Record<string, unknown>)[field] : undefined
        const issues = runRules(entries, value, data)
        if (!issues.length) continue
        const fieldErrors = issues.map(issue => {
          const path = [field, ...issue.path]
          return { code: issue.code, message: issue.message, path, name: pathToName(path) }
        })
        Object.defineProperty(errors, field, {
          value: fieldErrors, enumerable: true, configurable: true, writable: true,
        })
        firstError ??= { field, ...fieldErrors[0] }
      }

      return firstError
        ? { valid: false, errors, firstError }
        : { valid: true, errors, firstError: null }
    },
  }
}
