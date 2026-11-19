import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createValidator, required, email, minLength, maxLength, custom } from '../dist/valimini.js'

test('returns the first error in rule declaration order and one error per field', () => {
  const validator = createValidator({
    email: [required('이메일 필수'), email()],
    password: [required(), minLength(8)],
  })
  const result = validator.validate({ password: '123', email: '' })
  assert.equal(result.valid, false)
  assert.deepEqual(result.firstError, { field: 'email', code: 'required', message: '이메일 필수', path: ['email'], name: 'email' })
  assert.deepEqual(Object.keys(result.errors), ['email', 'password'])
  assert.equal(result.errors.email.length, 1)
  assert.equal(result.errors.password[0].code, 'minLength')
})

test('cross-field validation identifies the input to focus', () => {
  const validator = createValidator({
    password: [required(), minLength(8)],
    passwordConfirm: [required(), custom((value, data) => value === data.password, '비밀번호가 일치하지 않습니다.', 'match')],
  })
  const result = validator.validate({ password: 'password', passwordConfirm: 'different' })
  assert.deepEqual(result.firstError, {
    field: 'passwordConfirm', code: 'match', message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'], name: 'passwordConfirm',
  })
  assert.deepEqual(validator.validate({ password: 'password', passwordConfirm: 'password' }), {
    valid: true, errors: {}, firstError: null,
  })
})

test('optional empty values are skipped; required handles empty values regardless of rule position', () => {
  const optional = createValidator({ value: [email()] })
  const mandatory = createValidator({ value: [email(), required()] })
  for (const value of [undefined, null, '', '  ', []]) {
    assert.equal(optional.validate({ value }).valid, true)
    assert.equal(mandatory.validate({ value }).firstError.code, 'required')
  }
  assert.equal(mandatory.validate({}).firstError.code, 'required')
  assert.equal(createValidator({ value: [required()] }).validate({ value: false }).valid, true)
  assert.equal(createValidator({ value: [required()] }).validate({ value: 0 }).valid, true)
})

test('length boundaries, wrong types, and email format', () => {
  const length = createValidator({ value: [minLength(2), maxLength(3)] })
  assert.equal(length.validate({ value: 'a' }).valid, false)
  assert.equal(length.validate({ value: 'ab' }).valid, true)
  assert.equal(length.validate({ value: 'abc' }).valid, true)
  assert.equal(length.validate({ value: 'abcd' }).firstError.code, 'maxLength')
  assert.equal(length.validate({ value: 12 }).valid, false)
  assert.equal(length.validate({ value: ['a', 'b'] }).valid, true)
  const mail = createValidator({ value: [email()] })
  for (const value of ['hello', 'a@@b.com', 'a b@c.com', 123]) assert.equal(mail.validate({ value }).valid, false)
  assert.equal(mail.validate({ value: 'name@example.com' }).valid, true)
  for (const value of [-1, 1.2, NaN, Infinity]) assert.throws(() => minLength(value), RangeError)
})

test('email validates local-part and domain syntax', () => {
  const mail = createValidator({ value: [email('이메일을 확인해주세요.')] })
  for (const value of [
    'First.Last+tag@sub.example.co.kr', "o'connor@example.com", 'a_b@my-domain.example',
    'user@xn--bcher-kva.example',
  ]) {
    assert.equal(mail.validate({ value }).valid, true, value)
  }

  for (const value of [
    '.a@example.com', 'a.@example.com', 'a..b@example.com', 'a,b@example.com', 'a\u0000b@example.com',
    'a@.example.com', 'a@example..com', 'a@example.com.', 'a@-example.com', 'a@example-.com',
    'a@ex_ample.com', 'a@exam!ple.com', 'a@example', 'a@example.com\n', 'a@bücher.example',
  ]) {
    const result = mail.validate({ value })
    assert.equal(result.valid, false, JSON.stringify(value))
    assert.equal(result.firstError.code, 'email')
    assert.equal(result.firstError.message, '이메일을 확인해주세요.')
  }
})

test('email enforces local-part, domain label, and total length limits', () => {
  const mail = createValidator({ value: [email()] })
  const local = 'a'.repeat(64)
  const label = 'b'.repeat(63)
  const domain = `${label}.${label}.${'c'.repeat(61)}`

  assert.equal(mail.validate({ value: `${local}@${domain}` }).valid, true)
  assert.equal(mail.validate({ value: `${local}a@example.com` }).valid, false)
  assert.equal(mail.validate({ value: `a@${label}b.example` }).valid, false)
  assert.equal(mail.validate({ value: `${local}@${domain}c` }).valid, false)
})

test('reusable validator preserves input, ignores undeclared fields, and produces fresh results', () => {
  const data = Object.freeze({ name: 'valid', extra: 'anything' })
  const rules = { name: [required()] }
  const validator = createValidator(rules)
  rules.name.length = 0
  assert.equal(validator.validate(data).valid, true)
  const failed = validator.validate({})
  failed.errors.name[0].message = 'changed'
  assert.notEqual(validator.validate({}).errors.name[0].message, 'changed')
  assert.deepEqual(data, { name: 'valid', extra: 'anything' })
})

test('rejects non-object data and non-boolean rule results', () => {
  const validator = createValidator({ value: [required()] })
  for (const value of [null, undefined, 'text', 1, []]) assert.throws(() => validator.validate(value), TypeError)
  assert.throws(() => createValidator({ value: [custom(() => 'yes', 'error')] }).validate({ value: 'x' }), TypeError)
})

test('special field names are safe and inherited values do not satisfy required', () => {
  const validator = createValidator(JSON.parse('{"__proto__": [], "constructor": []}'))
  assert.equal(validator.validate({}).valid, true)
  const special = createValidator({ ['__proto__']: [required()] }).validate({})
  assert.equal(special.firstError.field, '__proto__')
  assert.equal(Object.hasOwn(special.errors, '__proto__'), true)
  assert.equal(createValidator({ name: [required()] }).validate(Object.create({ name: 'inherited' })).valid, false)
})
