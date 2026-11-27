import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createValidator, required, email, integer, min, minItems, maxItems, custom,
  time, beforeTime, afterTime, each, object, matchesField, pathToName,
} from '../dist/valimini.js'

const accepts = (rule, value) => createValidator({ value: [rule] }).validate({ value }).valid

test('time validates exact 24-hour HH:mm or HH:mm:ss with fixed precision', () => {
  for (const value of ['00:00', '09:05', '23:59']) assert.equal(accepts(time(), value), true)
  for (const value of ['24:00', '12:60', '9:05', '09:5', '09:05:00', '09:05Z', ' 09:05', 905]) {
    assert.equal(accepts(time(), value), false, String(value))
  }
  const options = { seconds: true }
  const rule = time(options)
  options.seconds = false
  for (const value of ['00:00:00', '23:59:59']) assert.equal(accepts(rule, value), true)
  for (const value of ['09:05', '23:59:60', '24:00:00', '09:05:1']) assert.equal(accepts(rule, value), false)
  assert.equal(accepts(time(), ''), true)
  assert.equal(createValidator({ value: [required(), time()] }).validate({}).valid, false)
})

test('time ranges exclude the boundary and use the same precision as the input', () => {
  assert.equal(accepts(beforeTime('18:00'), '17:59'), true)
  assert.equal(accepts(beforeTime('18:00'), '18:00'), false)
  assert.equal(accepts(beforeTime('18:00'), '18:01'), false)
  assert.equal(accepts(afterTime('09:00'), '09:01'), true)
  assert.equal(accepts(afterTime('09:00'), '09:00'), false)
  assert.equal(accepts(afterTime('09:00'), '08:59'), false)
  assert.equal(accepts(afterTime('09:00:00', { seconds: true }), '09:00:01'), true)
  assert.equal(accepts(beforeTime('09:00:01', { seconds: true }), '09:00:00'), true)
  for (const value of ['24:00', '9:00', '09:00:00', null]) {
    assert.throws(() => beforeTime(value), RangeError)
    assert.throws(() => afterTime(value), RangeError)
  }
  assert.throws(() => beforeTime('09:00', { seconds: true }), RangeError)
  for (const rule of [time('형식'), time({ seconds: true }, '형식'), beforeTime('09:00', '형식'), afterTime('09:00', {}, '형식')]) {
    assert.equal(createValidator({ value: [rule] }).validate({ value: 'bad' }).firstError.message, '형식')
  }
})

test('each reports the first failed rule per primitive item with HTML names', () => {
  const validator = createValidator({ emails: [each([required(), email()])] })
  const result = validator.validate({ emails: ['ok@example.com', 'bad', ''] })
  assert.equal(result.valid, false)
  assert.deepEqual(result.firstError, {
    field: 'emails', path: ['emails', 1], name: 'emails[1]', code: 'email',
    message: '이메일 형식이 올바르지 않습니다.',
  })
  assert.deepEqual(result.errors.emails.map(error => [error.path, error.code]), [
    [['emails', 1], 'email'], [['emails', 2], 'required'],
  ])
  assert.equal(validator.validate({ emails: ['ok@example.com'] }).valid, true)
  assert.equal(validator.validate({ emails: [] }).valid, true)
  assert.equal(validator.validate({}).valid, true)
  assert.equal(validator.validate({ emails: 'bad' }).firstError.code, 'each')
  assert.equal(createValidator({ emails: [minItems(1), each([email()])] }).validate({ emails: [] }).firstError.code, 'minItems')
})

test('each validates object lists and cross-field rules in each object context', () => {
  const user = createValidator({
    name: [required()], age: [required(), integer(), min(0)],
    confirmation: [matchesField('name')],
  })
  const validator = createValidator({ users: [each(user)] })
  const result = validator.validate({ users: [
    { name: 'A', age: 20, confirmation: 'A' },
    { name: '', age: -1 },
    { name: 'B', age: 10, confirmation: 'C' },
  ] })
  assert.deepEqual(result.errors.users.map(error => error.path), [
    ['users', 1, 'name'], ['users', 1, 'age'], ['users', 2, 'confirmation'],
  ])
  assert.equal(result.firstError.field, 'users')
  assert.equal(result.firstError.name, 'users[1].name')
  const wrong = validator.validate({ users: [null, [], 3, 'text'] })
  assert.equal(wrong.errors.users.length, 4)
  assert.equal(wrong.errors.users[0].code, 'object')
  assert.equal(wrong.errors.users[0].name, 'users[0]')
})

test('nested lists compose paths and preserve top-level grouping', () => {
  const team = createValidator({ members: [each(createValidator({ age: [integer(), min(0)] }))] })
  const result = createValidator({ teams: [each(team)], title: [required()] }).validate({
    teams: [{ members: [{ age: -1 }] }],
  })
  assert.deepEqual(result.firstError.path, ['teams', 0, 'members', 0, 'age'])
  assert.equal(result.firstError.name, 'teams[0].members[0].age')
  assert.deepEqual(Object.keys(result.errors), ['teams', 'title'])
  const matrix = createValidator({ matrix: [each([each([required(), integer()])])] })
  assert.deepEqual(matrix.validate({ matrix: [[1], ['bad']] }).firstError.path, ['matrix', 1, 0])
})

test('each snapshots rules, checks sparse entries, and keeps parent context for primitive rules', () => {
  const rules = [required(), custom((value, data) => value === data.expected, '다름')]
  const validator = createValidator({ values: [each(rules)] })
  rules.length = 0
  assert.equal(validator.validate({ expected: 'A', values: ['A'] }).valid, true)
  assert.equal(validator.validate({ expected: 'A', values: ['B'] }).valid, false)
  assert.equal(validator.validate({ values: new Array(1) }).firstError.code, 'required')
  const data = Object.freeze({ expected: 'A', values: Object.freeze(['A']) })
  assert.equal(validator.validate(data).valid, true)
})

test('list container rules retain declaration priority and fresh result paths', () => {
  const validator = createValidator({ values: [maxItems(1), each([required()])] })
  assert.deepEqual(validator.validate({ values: ['', ''] }).firstError.path, ['values'])
  const failed = validator.validate({ values: [''] })
  failed.errors.values[0].path.push('changed')
  assert.deepEqual(validator.validate({ values: [''] }).firstError.path, ['values', 0])
})

test('path names distinguish literal property punctuation and numeric indices', () => {
  assert.equal(pathToName(['users', 2, 'age']), 'users[2].age')
  assert.equal(pathToName(['user.name']), '["user.name"]')
  assert.equal(pathToName(['users', '2']), 'users["2"]')
  assert.equal(pathToName(['users', 2]), 'users[2]')
  assert.equal(pathToName(['a', 'x[y]', 'quote"']), 'a["x[y]"]["quote\\\""]')
  const result = createValidator({ ['user.name']: [required()] }).validate({})
  assert.deepEqual(result.firstError.path, ['user.name'])
  assert.equal(result.firstError.name, '["user.name"]')
})

test('object reports every inner field with nested paths and uses the inner object context', () => {
  const address = createValidator({
    zip: [required()],
    confirm: [matchesField('zip')],
  })
  const validator = createValidator({ address: [object(address)] })
  const result = validator.validate({ address: { confirm: 'x' }, zip: 'x' })
  assert.deepEqual(result.errors.address.map(error => [error.name, error.code]), [
    ['address.zip', 'required'], ['address.confirm', 'matchesField'],
  ])
  assert.deepEqual(result.firstError.path, ['address', 'zip'])
  assert.equal(validator.validate({ address: { zip: '1', confirm: '1' } }).valid, true)
})

test('object skips optional empty values and rejects non-objects with its message', () => {
  const inner = createValidator({ name: [required()] })
  const optional = createValidator({ user: [object(inner, 'bad object')] })
  for (const user of [undefined, null, '', []]) assert.equal(optional.validate({ user }).valid, true)
  for (const user of ['text', 1, false, [{}]]) {
    const { firstError } = optional.validate({ user })
    assert.deepEqual([firstError.code, firstError.message, firstError.name], ['object', 'bad object', 'user'])
  }
  assert.equal(optional.validate({ user: {} }).firstError.name, 'user.name')
  assert.equal(createValidator({ user: [required(), object(inner)] }).validate({}).firstError.code, 'required')
})

test('object composes with each across multiple levels', () => {
  const address = createValidator({ zip: [required()] })
  const user = createValidator({ address: [object(address)] })
  const team = createValidator({ users: [each(user)] })
  const result = createValidator({ team: [object(team)] }).validate({ team: { users: [{ address: {} }] } })
  assert.equal(result.firstError.name, 'team.users[0].address.zip')
  const listed = createValidator({ items: [each([object(address)])] }).validate({ items: [{}] })
  assert.equal(listed.firstError.name, 'items[0].zip')
})
