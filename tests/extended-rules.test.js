import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createValidator, required, accepted, notOneOf, notMatchesField, requiredIf,
  date, before, after, minItems, maxItems, uniqueItems, number, integer, min, max,
} from '../dist/valimini.js'

const accepts = (rule, value) => createValidator({ value: [rule] }).validate({ value }).valid

test('accepted requires exactly true, including when missing or empty', () => {
  assert.equal(accepts(accepted(), true), true)
  for (const value of [false, undefined, null, '', ' ', [], 1, 'true', 'on']) {
    assert.equal(accepts(accepted(), value), false)
  }
  assert.equal(createValidator({ terms: [accepted('동의 필수')] }).validate({}).firstError.message, '동의 필수')
})

test('notOneOf snapshots values and preserves value types', () => {
  const list = ['admin', 1]
  const rule = notOneOf(list)
  list.push('new')
  assert.equal(accepts(rule, 'admin'), false)
  assert.equal(accepts(rule, 1), false)
  assert.equal(accepts(rule, '1'), true)
  assert.equal(accepts(rule, 'new'), true)
  assert.equal(accepts(rule, ''), true)
})

test('notMatchesField checks strict inequality and allows an absent comparison field', () => {
  const validator = createValidator({ next: [notMatchesField('previous')] })
  assert.equal(validator.validate({ previous: 'a', next: 'a' }).valid, false)
  assert.equal(validator.validate({ previous: 'a', next: 'b' }).valid, true)
  assert.equal(validator.validate({ previous: 1, next: '1' }).valid, true)
  assert.equal(validator.validate({ next: 'a' }).valid, true)
})

test('requiredIf checks empty and missing values, reevaluates the condition, and composes with other rules', () => {
  const validator = createValidator({ address: [requiredIf(data => data.delivery === true, '주소 필수')] })
  for (const value of [undefined, null, '', ' ', []]) {
    assert.equal(validator.validate({ delivery: true, address: value }).valid, false)
    assert.equal(validator.validate({ delivery: false, address: value }).valid, true)
  }
  assert.equal(validator.validate({ delivery: true }).firstError.code, 'requiredIf')
  assert.equal(validator.validate({ delivery: true, address: '서울' }).valid, true)
  assert.equal(validator.validate({ delivery: true, address: 0 }).valid, true)
  const combined = createValidator({ age: [requiredIf(data => data.enabled === true), integer()] })
  assert.equal(combined.validate({ enabled: false }).valid, true)
  assert.equal(combined.validate({ enabled: false, age: 'bad' }).valid, false)
  assert.throws(() => accepts(requiredIf(() => 'yes'), ''), TypeError)
  assert.throws(() => accepts(requiredIf(async () => true), ''), TypeError)
})

test('date checks exact calendar dates including leap years without timezone conversion', () => {
  for (const value of ['2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31', '2026-11-15']) {
    assert.equal(accepts(date(), value), true, value)
  }
  for (const value of ['2026-02-30', '2025-02-29', '1900-02-29', '0000-01-01', '2026-00-10', '2026-13-01', '2026-01-00', '2026-04-31', '2026-1-01', '2026-11-15T00:00:00Z', new Date(), 123]) {
    assert.equal(accepts(date(), value), false, String(value))
  }
  assert.equal(accepts(date(), ''), true)
})

test('date boundaries are exclusive and invalid limits fail on rule creation', () => {
  assert.equal(accepts(before('2026-11-15'), '2026-11-14'), true)
  assert.equal(accepts(before('2026-11-15'), '2026-11-15'), false)
  assert.equal(accepts(before('2026-11-15'), '2026-11-16'), false)
  assert.equal(accepts(after('2026-11-15'), '2026-11-16'), true)
  assert.equal(accepts(after('2026-11-15'), '2026-11-15'), false)
  assert.equal(accepts(after('2026-11-15'), '2026-11-14'), false)
  assert.equal(accepts(before('2026-11-15'), '2026-02-30'), false)
  for (const value of ['bad', '2026-02-30', new Date(), null]) {
    assert.throws(() => before(value), RangeError)
    assert.throws(() => after(value), RangeError)
  }
})

test('array counts check empty arrays, inclusive boundaries, optional missing values, and wrong types', () => {
  assert.equal(accepts(minItems(1), []), false)
  assert.equal(accepts(minItems(0), []), true)
  assert.equal(accepts(minItems(2), ['a']), false)
  assert.equal(accepts(minItems(2), ['a', 'b']), true)
  assert.equal(accepts(maxItems(2), ['a', 'b']), true)
  assert.equal(accepts(maxItems(2), ['a', 'b', 'c']), false)
  assert.equal(accepts(maxItems(0), []), true)
  for (const factory of [minItems, maxItems]) {
    for (const value of [undefined, null, '', ' ']) assert.equal(accepts(factory(1), value), true)
    for (const value of ['abc', {}, 1]) assert.equal(accepts(factory(1), value), false)
    for (const limit of [-1, 1.5, NaN, Infinity, '1']) assert.throws(() => factory(limit), RangeError)
  }
  assert.equal(createValidator({ files: [required(), minItems(1)] }).validate({}).valid, false)
})

test('uniqueItems uses Set equality and rejects non-arrays', () => {
  assert.equal(accepts(uniqueItems(), []), true)
  assert.equal(accepts(uniqueItems(), ['a', 'b']), true)
  assert.equal(accepts(uniqueItems(), [1, '1']), true)
  assert.equal(accepts(uniqueItems(), [NaN, NaN]), false)
  assert.equal(accepts(uniqueItems(), ['a', 'a']), false)
  const object = {}
  assert.equal(accepts(uniqueItems(), [object, object]), false)
  assert.equal(accepts(uniqueItems(), [{}, {}]), true)
  assert.equal(accepts(uniqueItems(), 'abc'), false)
})

const numeric = { allowString: true, thousandsSeparator: ',' }

test('numeric options parse decimal and properly grouped strings consistently without mutating input', () => {
  for (const value of ['1000', '1,000', '+1,000', '-1,000', '1,000.50', ' 1,000 ', '1,234,567.89']) {
    assert.equal(accepts(number(numeric), value), true, value)
  }
  for (const value of ['1,00', '12,34', '1,2,3', ',100', '1,000,', '01,000', '1 000', '1e3', '0x10', '.5', '1.', 'Infinity', 'NaN', '9'.repeat(400)]) {
    assert.equal(accepts(number(numeric), value), false, value)
  }
  assert.equal(accepts(number({ allowString: true }), '1000.5'), true)
  assert.equal(accepts(number({ allowString: true }), '1,000'), false)
  assert.equal(accepts(number({ thousandsSeparator: ',' }), '1,000'), false)
  assert.equal(accepts(integer(numeric), '1,000'), true)
  assert.equal(accepts(integer(numeric), '1,000.5'), false)
  assert.equal(accepts(min(1000, numeric), '1,000'), true)
  assert.equal(accepts(min(1000, numeric), '999'), false)
  assert.equal(accepts(max(1000, numeric), '1,000'), true)
  assert.equal(accepts(max(1000, numeric), '1,001'), false)
  assert.equal(accepts(number(), '1000'), false)
  const data = Object.freeze({ price: '1,000' })
  assert.equal(createValidator({ price: [number(numeric), min(1000, numeric)] }).validate(data).valid, true)
  assert.equal(data.price, '1,000')
})

test('numeric options are snapshotted and retain both old and new custom message forms', () => {
  const options = { ...numeric }
  const rule = number(options)
  options.allowString = false
  assert.equal(accepts(rule, '1,000'), true)
  for (const rule of [number('숫자'), number(numeric, '숫자'), integer('숫자'), integer(numeric, '숫자'), min(1, '숫자'), min(1, numeric, '숫자'), max(1, '숫자'), max(1, numeric, '숫자')]) {
    assert.equal(createValidator({ value: [rule] }).validate({ value: 'bad' }).firstError.message, '숫자')
  }
  assert.throws(() => number({ thousandsSeparator: '.' }), TypeError)
})
