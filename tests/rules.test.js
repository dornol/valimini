import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createValidator, required, pattern, number, integer, min, max, url, oneOf, matchesField } from '../dist/valimini.js'

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
  for (const value of ['https://example.com/path?q=a#b', 'http://localhost:3000', 'https://예시.한국']) {
    assert.equal(accepts(url(), value), true)
  }
  for (const value of ['example.com', '/relative', 'ftp://example.com', 'javascript:alert(1)', 'https://', 'https://exa mple.com', 123]) {
    assert.equal(accepts(url(), value), false)
  }
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
