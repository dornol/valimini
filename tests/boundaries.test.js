// Boundary, exhaustive, and composition checks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as v from '../dist/valimini.js'

const { createValidator, required } = v
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index)
const pad = (number, width = 2) => String(number).padStart(width, '0')

test('formatted values reject any leading or trailing characters', () => {
  for (const [rule, values] of [
    [v.email(), ['a@example.com']],
    [v.koreanTelephone(), ['02-123-4567', '070-1234-5678']],
    [v.koreanMobile(), ['010-1234-5678']],
    [v.koreanFax(), ['0504-123-4567']],
    [v.koreanRepresentativeNumber(), ['142234', '1588-1234']],
    [v.koreanTollFreeNumber(), ['080-123-4567']],
    [v.koreanPostalCode(), ['12345']],
    [v.koreanBusinessRegistrationNumber(), ['1234567891']],
    [v.koreanCorporateRegistrationNumber(), ['1101110000010']],
    [v.date(), ['2026-01-01']],
    [v.time(), ['09:00']],
    [v.time({ seconds: true }), ['09:00:00']],
  ]) {
    for (const value of values) {
      assert.equal(rule.test(value, {}), true, value)
      for (const broken of [` ${value}`, `${value} `, `(${value}`, `${value})`, `${value}\n`, `\n${value}`]) {
        assert.equal(rule.test(broken, {}), false, `${rule.code} ${JSON.stringify(broken)}`)
      }
    }
  }
})

test('international prefix allows an optional single space or hyphen', () => {
  for (const [rule, rest] of [
    [v.koreanTelephone(), '2-123-4567'], [v.koreanTelephone(), '70-1234-5678'],
    [v.koreanMobile(), '10-1234-5678'], [v.koreanFax(), '504-123-4567'],
  ]) {
    for (const separator of ['', ' ', '-']) assert.equal(rule.test(`+82${separator}${rest}`, {}), true, separator + rest)
    assert.equal(rule.test(`+82  ${rest}`, {}), false)
  }
})

test('every two and three digit area prefix is classified exactly', () => {
  const areas = new Set(['02', ...['3', '4', '5', '6'].flatMap(region =>
    range(1, { 3: 3, 4: 4, 5: 5, 6: 4 }[region]).map(last => `0${region}${last}`))])
  for (const prefix of ['02', ...range(0, 99).map(n => `0${pad(n)}`)]) {
    if (prefix === '070') continue
    assert.equal(v.koreanTelephone().test(`${prefix}-123-4567`, {}), areas.has(prefix), prefix)
  }
})

test('every calendar day matches the proleptic Gregorian calendar', () => {
  const rule = v.date()
  const exists = (year, month, day) => {
    const value = new Date(0)
    value.setUTCFullYear(year, month - 1, day)
    return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day
  }
  for (const year of [1, 4, 100, 400, 1900, 2000, 2023, 2024, 2100, 9999]) {
    for (let month = 0; month <= 13; month++) {
      for (let day = 0; day <= 32; day++) {
        const text = `${pad(year, 4)}-${pad(month)}-${pad(day)}`
        assert.equal(rule.test(text, {}), exists(year, month, day), text)
      }
    }
  }
})

test('every minute and second of the day is valid and out-of-range parts are not', () => {
  const minutes = v.time()
  const seconds = v.time({ seconds: true })
  for (let hour = 0; hour <= 29; hour++) {
    for (let minute = 0; minute <= 69; minute++) {
      const text = `${pad(hour)}:${pad(minute)}`
      const valid = hour < 24 && minute < 60
      assert.equal(minutes.test(text, {}), valid, text)
      assert.equal(seconds.test(`${text}:00`, {}), valid, text)
    }
  }
  for (let second = 0; second <= 69; second++) {
    assert.equal(seconds.test(`00:00:${pad(second)}`, {}), second < 60)
  }
})

test('business registration number has exactly one valid check digit and detects digit changes', () => {
  const rule = v.koreanBusinessRegistrationNumber()
  // Known-valid vectors that exercise every weighted position.
  const valid = ['1000000009', '0100000007', '0010000003', '0001000009', '0000100007',
    '0000010003', '0000001009', '0000000107', '0000000015', '1234567891', '9999999999']
  const checkDigits = body => range(0, 9).filter(last => rule.test(`${body}${last}`, {}))
  for (const value of valid) {
    const expected = value === '9999999999' ? checkDigits('999999999') : [Number(value[9])]
    assert.deepEqual(checkDigits(value.slice(0, 9)), expected, value)
  }
  const base = '1234567891'
  for (let position = 0; position < 8; position++) {
    for (const digit of range(0, 9)) {
      const changed = base.slice(0, position) + digit + base.slice(position + 1)
      assert.equal(rule.test(changed, {}), changed === base, changed)
    }
  }
})

test('corporate registration options only enable the checksum for an explicit true', () => {
  const unchecked = '1101111234567'
  for (const options of [undefined, {}, { legacyChecksum: false }, { legacyChecksum: 1 }, '메시지']) {
    assert.equal(v.koreanCorporateRegistrationNumber(options).test(unchecked, {}), true)
  }
  assert.equal(v.koreanCorporateRegistrationNumber({ legacyChecksum: true }).test(unchecked, {}), false)
  assert.equal(v.koreanCorporateRegistrationNumber().test(`x${unchecked}`, {}), false)
})

test('email domain labels may be a single character, local part may not be empty', () => {
  for (const value of ['a@b.co', 'a@example.c']) assert.equal(v.email().test(value, {}), true, value)
  assert.equal(v.email().test('@example.com', {}), false)
})

test('zero is a valid length limit', () => {
  assert.equal(v.minLength(0).test('', {}), true)
  assert.equal(v.maxLength(0).test('', {}), true)
  assert.equal(v.maxLength(0).test('a', {}), false)
})

test('url requires the scheme at the start and rejects hosts the parser cannot read', () => {
  for (const value of ['xhttps://example.com', 'ftp://a/http://b', 'https://[', 'https://%', 'http://exa<mple.com']) {
    assert.equal(v.url().test(value, {}), false, value)
  }
  const coercible = { toString: () => 'https://example.com' }
  assert.equal(v.url().test(coercible, {}), false)
})

test('numeric strings enforce sign, grouping, and fraction syntax', () => {
  const plain = v.number({ allowString: true })
  const grouped = v.number({ allowString: true, thousandsSeparator: ',' })
  for (const rule of [plain, grouped]) {
    for (const value of ['0', '+1', '-1', '1.25', '10.5']) assert.equal(rule.test(value, {}), true, value)
    for (const value of ['x1', '1x', 'x1.5', '++1', '1.2.3', '1.', '- 1']) assert.equal(rule.test(value, {}), false, value)
  }
  for (const value of ['10,000', '100,000.5']) assert.equal(grouped.test(value, {}), true, value)
})

test('exact decimal comparison agrees with BigInt over a grid of values', () => {
  const scale = 1000n
  const toText = scaled => {
    const magnitude = scaled < 0n ? -scaled : scaled
    return `${scaled < 0n ? '-' : ''}${magnitude / scale}.${pad(magnitude % scale, 3)}`
  }
  const points = [-100001n, -100000n, -10000n, -1001n, -1000n, -999n, -120n, -102n, -12n, -1n, 0n,
    1n, 12n, 102n, 120n, 999n, 1000n, 1001n, 10000n, 100000n, 100001n]
  const options = { allowString: true, exactDecimal: true }
  for (const limit of points) {
    const lower = v.min(Number(toText(limit)), options)
    const upper = v.max(Number(toText(limit)), options)
    for (const value of points) {
      assert.equal(lower.test(toText(value), {}), value >= limit, `${toText(value)} >= ${toText(limit)}`)
      assert.equal(upper.test(toText(value), {}), value <= limit, `${toText(value)} <= ${toText(limit)}`)
    }
  }
})

test('numeric options given as objects without a message keep default behaviour', () => {
  assert.equal(v.integer({ safe: false }).test(Number.MAX_SAFE_INTEGER + 1, {}), true)
  assert.equal(v.integer({ safe: true }).test(Number.MAX_SAFE_INTEGER + 1, {}), false)
  assert.equal(v.integer({ safe: true }, 'm').message, 'm')
  assert.equal(v.min(1, 'm').test(2, {}), true)
})

test('anyOf is required only when every alternative is required', () => {
  assert.equal(v.anyOf([v.accepted(), v.email()]).required, false)
  assert.equal(v.anyOf([v.accepted(), v.required()]).required, true)
  assert.equal(v.anyOf([v.email()]).required, false)
})

test('anyOf collapses inner object errors into one anyOf error', () => {
  const inner = createValidator({ name: [required()] })
  const { errors } = createValidator({ value: [v.anyOf([v.object(inner)])] }).validate({ value: {} })
  assert.deepEqual(errors.value.map(error => [error.code, error.name]), [['anyOf', 'value']])
})

test('passing each and object rules let the following rules run', () => {
  const inner = createValidator({ name: [required()] })
  for (const [container, value] of [[v.object(inner), { name: 'a' }], [v.each([required()]), ['a']]]) {
    const result = createValidator({ value: [container, v.custom(() => false, 'next', 'next')] }).validate({ value })
    assert.equal(result.firstError.code, 'next')
  }
})

test('each object items report a fixed object message, independent of the list message', () => {
  const inner = createValidator({ name: [required()] })
  const result = createValidator({ value: [v.each(inner, '목록')] }).validate({ value: [1] })
  assert.deepEqual([result.firstError.code, result.firstError.message], ['object', '객체를 입력해주세요.'])
})

test('result errors are ordinary mutable properties', () => {
  const result = createValidator({ value: [required()] }).validate({})
  const descriptor = Object.getOwnPropertyDescriptor(result.errors, 'value')
  assert.deepEqual([descriptor.writable, descriptor.configurable, descriptor.enumerable], [true, true, true])
})

test('validate rejects every non-plain input kind with a TypeError of its own', () => {
  const validator = createValidator({})
  for (const value of [null, undefined, 'a', 1, true, [], () => {}]) {
    assert.throws(() => validator.validate(value), { name: 'TypeError', message: /객체/ })
  }
})

test('errors thrown by user rules propagate unchanged, also through containers', () => {
  const failure = new Error('boom')
  const boom = v.custom(() => { throw failure }, 'm')
  const inner = createValidator({ name: [boom] })
  for (const [rules, value] of [[[boom], 'a'], [[v.object(inner)], { name: 'a' }], [[v.each([boom])], ['a']], [[v.anyOf([boom])], 'a']]) {
    assert.throws(() => createValidator({ value: rules }).validate({ value }), error => error === failure)
  }
})

test('pathToName covers identifier boundaries and the empty path', () => {
  assert.equal(v.pathToName([]), '')
  assert.equal(v.pathToName([0]), '[0]')
  assert.equal(v.pathToName(['_a', '$b', 'c1']), '_a.$b.c1')
  for (const key of ['1a', 'a-b', 'a b', '', 'a]', '한글']) {
    assert.equal(v.pathToName(['root', key]), `root[${JSON.stringify(key)}]`)
  }
})

test('email without an @ is rejected even if both slices would look valid', () => {
  for (const value of ['example.com', 'abc.de']) assert.equal(v.email().test(value, {}), false, value)
})

test('corporate registration number accepts a message as its only argument', () => {
  assert.equal(v.koreanCorporateRegistrationNumber('메시지만').message, '메시지만')
})

test('url requires "//" right after the scheme, not merely somewhere in the value', () => {
  assert.equal(v.url().test('https:example.com/http://x', {}), false)
})
