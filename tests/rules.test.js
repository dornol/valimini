import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createValidator, required, pattern, number, integer, min, max, url, oneOf, matchesField,
  koreanTelephone, koreanMobile, koreanPhone, koreanFax,
  koreanPostalCode, koreanBusinessRegistrationNumber, koreanRepresentativeNumber, koreanContactNumber,
  anyOf, email, custom, accepted, requiredIf, each, koreanCorporateRegistrationNumber, koreanTollFreeNumber,
} from '../dist/valimini.js'

const accepts = (rule, value) => createValidator({ value: [rule] }).validate({ value }).valid

test('pattern is repeatable with global and sticky expressions and does not mutate caller state', () => {
  for (const flags of ['g', 'y', 'gy']) {
    const regex = new RegExp('^a+$', flags)
    regex.lastIndex = 2
    const rule = pattern(regex)
    for (let i = 0; i < 3; i++) {
      assert.equal(accepts(rule, 'aaa'), true)
      assert.equal(accepts(rule, 'baa'), false)
    }
    assert.equal(regex.lastIndex, 2)
    assert.equal(accepts(rule, 123), false)
  }
})

test('number and integer reject coercion, NaN, and infinities', () => {
  for (const value of ['123', true, NaN, Infinity, -Infinity, {}, []]) {
    // Empty arrays are optional values, so use required for this case.
    const result = createValidator({ value: [required(), number()] }).validate({ value })
    assert.equal(result.valid, false)
  }
  for (const value of [0, -3, 1.5]) assert.equal(accepts(number(), value), true)
  for (const value of [0, -3, 2]) assert.equal(accepts(integer(), value), true)
  for (const value of [1.5, '2', NaN, Infinity]) assert.equal(accepts(integer(), value), false)
})

test('numeric limits are inclusive and must be finite', () => {
  assert.equal(accepts(min(-1), -1), true)
  assert.equal(accepts(min(-1), -2), false)
  assert.equal(accepts(max(1.5), 1.5), true)
  assert.equal(accepts(max(1.5), 2), false)
  for (const value of ['2', true, NaN, Infinity]) {
    assert.equal(accepts(min(1), value), false)
    assert.equal(accepts(max(3), value), false)
  }
  for (const limit of [NaN, Infinity, -Infinity, '3']) {
    assert.throws(() => min(limit), RangeError)
    assert.throws(() => max(limit), RangeError)
  }
})

test('url accepts absolute HTTP(S) URLs only', () => {
  for (const value of ['https://example.com/path?q=a#b', 'http://localhost:3000', 'https://예시.한국', 'http://[::1]:3000', 'https://example.com/a%20b']) {
    assert.equal(accepts(url(), value), true)
  }
  for (const value of ['example.com', '/relative', 'ftp://example.com', 'javascript:alert(1)', 'https://', 'https://exa mple.com', 123]) {
    assert.equal(accepts(url(), value), false)
  }
})

test('url rejects malformed input even when URL parsing would normalize it', () => {
  for (const value of ['https:///example.com', 'https://example.com\\path', 'https://example.com/path\u0000', 'https://example.com/path\u007f']) {
    assert.equal(accepts(url(), value), false, JSON.stringify(value))
  }
})

test('koreanPhone accepts supported domestic and international formats', () => {
  const rule = koreanPhone()
  for (const value of [
    '010-1234-5678', '01012345678', '010 1234 5678', '+821012345678', '+82 10-1234-5678',
    '02-123-4567', '02-1234-5678', '0311234567', '044-123-4567', '055-123-4567',
    '+82-64-123-4567', '070-1234-5678', '+82 70 1234 5678',
  ]) {
    assert.equal(accepts(rule, value), true, value)
  }
})

test('koreanPhone rejects unsupported prefixes, lengths, separators and types', () => {
  const validator = createValidator({ phone: [required(), koreanPhone('연락처를 확인해주세요.')] })
  for (const phone of [
    '011-1234-5678', '030-123-4567', '045-123-4567', '065-123-4567', '1588-1234',
    '010-123-4567', '070-123-4567', '02-12-4567', '031-12345-5678', '010-1234 5678',
    '010--1234--5678', '010-12345678', '010\t1234\t5678', '010-1234-5678\n',
    '+82-010-1234-5678', '+81-10-1234-5678', '010-1234-5678 ext. 1', 1012345678,
  ]) {
    const result = validator.validate({ phone })
    assert.equal(result.valid, false, JSON.stringify(phone))
    assert.equal(result.firstError.code, 'koreanPhone')
    assert.equal(result.firstError.message, '연락처를 확인해주세요.')
  }
  assert.equal(accepts(koreanPhone(), ''), true)
  assert.equal(validator.validate({ phone: '' }).firstError.code, 'required')
})

test('Korean telephone, mobile, contact, and fax rules accept their own number formats', () => {
  const rules = [koreanTelephone(), koreanMobile(), koreanPhone(), koreanFax()]
  for (const [value, expected] of [
    ['02-123-4567', [true, false, true, true]],
    ['+82 31 1234 5678', [true, false, true, true]],
    ['+827012345678', [true, false, true, true]],
    ['01012345678', [false, true, true, false]],
    ['+82-10-1234-5678', [false, true, true, false]],
    ['0504-123-4567', [false, false, false, true]],
    ['050356785678', [false, false, false, true]],
    ['+82 503-5678-5678', [false, false, false, true]],
    ['0504-12-4567', [false, false, false, false]],
    ['0503-1234 5678', [false, false, false, false]],
    ['+82-0504-123-4567', [false, false, false, false]],
    ['1588-1234', [false, false, false, false]],
    [1012345678, [false, false, false, false]],
    ['', [true, true, true, true]],
  ]) {
    assert.deepEqual(rules.map(rule => accepts(rule, value)), expected, String(value))
  }
})

test('Korean number rules report distinct error codes and accept custom messages', () => {
  for (const [factory, code] of [[koreanTelephone, 'koreanTelephone'], [koreanMobile, 'koreanMobile'], [koreanFax, 'koreanFax']]) {
    const validator = createValidator({ value: [required(), factory('번호를 확인해주세요.')] })
    const error = validator.validate({ value: 'wrong' }).firstError
    assert.equal(error.code, code)
    assert.equal(error.message, '번호를 확인해주세요.')
    assert.equal(validator.validate({ value: '' }).firstError.code, 'required')
  }
})

test('koreanPostalCode requires a five-digit string and preserves leading zeroes', () => {
  const rule = koreanPostalCode()
  for (const value of ['01234', '12345']) assert.equal(accepts(rule, value), true, value)
  for (const value of ['1234', '123456', '１２３４５', '12-345', '12345\n', 12345]) {
    assert.equal(accepts(rule, value), false, JSON.stringify(value))
  }
})

test('koreanBusinessRegistrationNumber checks grouping and the check digit', () => {
  const rule = koreanBusinessRegistrationNumber()
  for (const value of ['123-45-67891', '1234567891', '123-45-67800']) {
    assert.equal(accepts(rule, value), true, value)
  }
  for (const value of ['123-45-67890', '123-4567891', '12345-67891', '123 45 67891', '000-00-00000', '12345678911', 1234567891]) {
    assert.equal(accepts(rule, value), false, JSON.stringify(value))
  }
})

test('koreanContactNumber accepts telephone, mobile, or representative numbers', () => {
  const representative = koreanRepresentativeNumber()
  const contact = koreanContactNumber()
  for (const value of ['1588-1234', '16001234', '1800 1234', '142234']) {
    assert.equal(accepts(representative, value), true, value)
    assert.equal(accepts(contact, value), true, value)
    assert.equal(accepts(koreanPhone(), value), false, value)
  }
  for (const value of ['02-123-4567', '070-1234-5678', '+82 10-1234-5678']) {
    assert.equal(accepts(contact, value), true, value)
    assert.equal(accepts(representative, value), false, value)
  }
  for (const value of ['0504-123-4567', '1588--1234', '1588-123', '14223456', '1700-1234', '+82-1588-1234', 15881234]) {
    assert.equal(accepts(contact, value), false, JSON.stringify(value))
    assert.equal(accepts(representative, value), false, JSON.stringify(value))
  }
})

test('Korean postal, business, representative, and contact rules support optional fields and custom messages', () => {
  for (const [factory, code] of [
    [koreanPostalCode, 'koreanPostalCode'],
    [koreanBusinessRegistrationNumber, 'koreanBusinessRegistrationNumber'],
    [koreanRepresentativeNumber, 'koreanRepresentativeNumber'],
    [koreanContactNumber, 'koreanContactNumber'],
  ]) {
    const rule = factory('입력값을 확인해주세요.')
    const validator = createValidator({ value: [required(), rule] })
    assert.equal(accepts(rule, ''), true)
    assert.equal(validator.validate({ value: '' }).firstError.code, 'required')
    const error = validator.validate({ value: 'wrong' }).firstError
    assert.equal(error.code, code)
    assert.equal(error.message, '입력값을 확인해주세요.')
  }
})

test('koreanCorporateRegistrationNumber accepts both issue formats and applies a legacy checksum on request', () => {
  const standard = koreanCorporateRegistrationNumber()
  const options = { legacyChecksum: true }
  const legacy = koreanCorporateRegistrationNumber(options, '법인번호를 확인해주세요.')
  options.legacyChecksum = false
  for (const value of ['110111-0000010', '1101110000010', '110111-0000036']) {
    assert.equal(accepts(standard, value), true, value)
    assert.equal(accepts(legacy, value), true, value)
  }
  assert.equal(accepts(standard, '110111-1234567'), true)
  const failed = createValidator({ value: [legacy] }).validate({ value: '110111-1234567' })
  assert.equal(failed.firstError.code, 'koreanCorporateRegistrationNumber')
  assert.equal(failed.firstError.message, '법인번호를 확인해주세요.')
  for (const value of ['11011-11234567', '110111-123456', '110111 1234567', '110111-1234567\n', '000000-0000000', 1101111234567]) {
    assert.equal(accepts(standard, value), false, JSON.stringify(value))
  }
  assert.equal(accepts(standard, ''), true)
})

test('koreanTollFreeNumber accepts domestic 080 numbers with consistent grouping', () => {
  const rule = koreanTollFreeNumber()
  for (const value of ['080-123-4567', '080-1234-5678', '080 123 4567', '08012345678']) {
    assert.equal(accepts(rule, value), true, value)
    assert.equal(accepts(koreanContactNumber(), value), false, value)
  }
  for (const value of ['+82-80-123-4567', '070-1234-5678', '080-12-4567', '080-1234 5678', '080-1234567', 801234567]) {
    assert.equal(accepts(rule, value), false, JSON.stringify(value))
  }
  assert.equal(accepts(rule, ''), true)
})

test('anyOf reports one error, snapshots alternatives, and stops after a passing rule', () => {
  const emailRule = email()
  const branches = [emailRule, koreanMobile()]
  const rule = anyOf(branches, '이메일 또는 휴대전화 번호를 입력해주세요.')
  emailRule.test = () => false
  branches.push(pattern(/.*/))
  const validator = createValidator({ value: [rule] })
  for (const value of ['hello@example.com', '010-1234-5678', '']) {
    assert.equal(validator.validate({ value }).valid, true, value)
  }
  const rejected = validator.validate({ value: 'wrong' })
  assert.equal(rejected.errors.value.length, 1)
  assert.equal(rejected.firstError.code, 'anyOf')
  assert.equal(rejected.firstError.message, '이메일 또는 휴대전화 번호를 입력해주세요.')
  const firstPasses = anyOf([email(), custom(() => { throw new Error('unexpected evaluation') }, '오류')])
  assert.equal(accepts(firstPasses, 'hello@example.com'), true)
  assert.throws(() => anyOf([]), RangeError)
})

test('anyOf respects required alternatives and passes context to each branch', () => {
  const mixed = anyOf([accepted(), email()])
  assert.equal(accepts(mixed, ''), true)
  assert.equal(createValidator({ value: [required(), mixed] }).validate({}).firstError.code, 'required')

  const validator = createValidator({ value: [anyOf([accepted(), requiredIf(data => data.enabled)])] })
  assert.equal(validator.validate({ enabled: false }).valid, true)
  assert.equal(validator.validate({ enabled: true }).firstError.code, 'anyOf')
  assert.equal(validator.validate({ enabled: true, value: 'provided' }).valid, true)

  const emailsOrSingleMobile = anyOf([each([required(), email()]), koreanMobile()])
  assert.equal(accepts(emailsOrSingleMobile, ['hello@example.com']), true)
  assert.equal(accepts(emailsOrSingleMobile, ['hello@example.com', 'wrong']), false)
  assert.throws(() => accepts(anyOf([custom(() => 'invalid', '오류')]), 'value'), TypeError)
})

test('oneOf preserves types and snapshots the allowed list', () => {
  const values = ['admin', 1, false]
  const rule = oneOf(values)
  values.push('other')
  for (const value of ['admin', 1, false]) assert.equal(accepts(rule, value), true)
  for (const value of ['1', 0, 'other']) assert.equal(accepts(rule, value), false)
  assert.equal(accepts(oneOf([]), 'x'), false)
})

test('matchesField returns the confirm field as firstError and uses strict equality', () => {
  const validator = createValidator({ confirm: [required(), matchesField('password', '불일치')] })
  assert.equal(validator.validate({ password: 'abc', confirm: 'abc' }).valid, true)
  assert.deepEqual(validator.validate({ password: 'abc', confirm: 'def' }).firstError, {
    field: 'confirm', code: 'matchesField', message: '불일치', path: ['confirm'], name: 'confirm',
  })
  assert.equal(validator.validate({ password: 1, confirm: '1' }).valid, false)
  assert.equal(validator.validate({ confirm: 'abc' }).valid, false)
  assert.equal(validator.validate(Object.assign(Object.create({ password: 'abc' }), { confirm: 'abc' })).valid, false)
})

test('new rules retain empty-value skipping and custom messages', () => {
  const rules = [pattern(/^a$/), number(), integer(), min(1), max(3), url(), oneOf(['a']), matchesField('other')]
  for (const rule of rules) {
    for (const value of ['', null, undefined]) assert.equal(accepts(rule, value), true)
  }
  for (const rule of [pattern(/^a$/, 'custom'), number('custom'), integer('custom'), min(1, 'custom'), max(-1, 'custom'), url('custom'), oneOf(['a'], 'custom'), matchesField('other', 'custom')]) {
    assert.equal(createValidator({ value: [rule] }).validate({ value: 'bad' }).firstError.message, 'custom')
  }
})
