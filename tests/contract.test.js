// Contract shared by every exported rule: code, messages, type safety, and empty values.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as v from '../dist/valimini.js'

const { createValidator, required } = v
const inner = createValidator({ name: [required()] })
const numeric = { allowString: true }

// [factory name, arguments without message, code, default message, rejected value]
const contracts = [
  ['required', [], 'required', '필수 입력 항목입니다.', ''],
  ['email', [], 'email', '이메일 형식이 올바르지 않습니다.', 'x'],
  ['koreanTelephone', [], 'koreanTelephone', '한국 일반전화 번호 형식이 올바르지 않습니다.', 'x'],
  ['koreanMobile', [], 'koreanMobile', '한국 휴대전화 번호 형식이 올바르지 않습니다.', 'x'],
  ['koreanPhone', [], 'koreanPhone', '한국 전화번호 형식이 올바르지 않습니다.', 'x'],
  ['koreanRepresentativeNumber', [], 'koreanRepresentativeNumber', '전국대표번호 형식이 올바르지 않습니다.', 'x'],
  ['koreanTollFreeNumber', [], 'koreanTollFreeNumber', '수신자부담 번호 형식이 올바르지 않습니다.', 'x'],
  ['koreanContactNumber', [], 'koreanContactNumber', '한국 연락처 번호 형식이 올바르지 않습니다.', 'x'],
  ['koreanFax', [], 'koreanFax', '한국 팩스 번호 형식이 올바르지 않습니다.', 'x'],
  ['koreanPostalCode', [], 'koreanPostalCode', '한국 우편번호는 숫자 5자리여야 합니다.', 'x'],
  ['koreanBusinessRegistrationNumber', [], 'koreanBusinessRegistrationNumber', '사업자등록번호 형식이 올바르지 않습니다.', 'x'],
  ['koreanCorporateRegistrationNumber', [{}], 'koreanCorporateRegistrationNumber', '법인등록번호 형식이 올바르지 않습니다.', 'x'],
  ['minLength', [2], 'minLength', '2자 이상 입력해주세요.', 'a'],
  ['maxLength', [1], 'maxLength', '1자 이하로 입력해주세요.', 'ab'],
  ['pattern', [/^a$/], 'pattern', '입력 형식이 올바르지 않습니다.', 'b'],
  ['number', [{}], 'number', '숫자를 입력해주세요.', 'x'],
  ['integer', [{}], 'integer', '정수를 입력해주세요.', 1.5],
  ['min', [2, {}], 'min', '2 이상 입력해주세요.', 1],
  ['max', [2, {}], 'max', '2 이하로 입력해주세요.', 3],
  ['url', [], 'url', 'URL 형식이 올바르지 않습니다.', 'x'],
  ['oneOf', [['a']], 'oneOf', '허용된 값 중에서 선택해주세요.', 'b'],
  ['notOneOf', [['a']], 'notOneOf', '사용할 수 없는 값입니다.', 'a'],
  ['matchesField', ['other'], 'matchesField', '입력값이 일치하지 않습니다.', 'a'],
  ['notMatchesField', ['other'], 'notMatchesField', '다른 값을 입력해주세요.', 'same'],
  ['accepted', [], 'accepted', '동의가 필요합니다.', false],
  ['requiredIf', [() => true], 'requiredIf', '필수 입력 항목입니다.', ''],
  ['date', [], 'date', '유효한 날짜를 YYYY-MM-DD 형식으로 입력해주세요.', 'x'],
  ['before', ['2026-01-02'], 'before', '2026-01-02 이전 날짜를 입력해주세요.', '2026-01-02'],
  ['after', ['2026-01-02'], 'after', '2026-01-02 이후 날짜를 입력해주세요.', '2026-01-02'],
  ['time', [{}], 'time', '유효한 시간을 입력해주세요.', 'x'],
  ['beforeTime', ['09:00', {}], 'beforeTime', '09:00 이전 시간을 입력해주세요.', '09:00'],
  ['afterTime', ['09:00', {}], 'afterTime', '09:00 이후 시간을 입력해주세요.', '09:00'],
  ['minItems', [1], 'minItems', '1개 이상 선택해주세요.', []],
  ['maxItems', [0], 'maxItems', '0개 이하로 선택해주세요.', [1]],
  ['uniqueItems', [], 'uniqueItems', '중복된 항목이 있습니다.', [1, 1]],
  ['anyOf', [[v.email()]], 'anyOf', '허용된 형식 중 하나에 맞게 입력해주세요.', 'x'],
  ['object', [inner], 'object', '객체를 입력해주세요.', 'x'],
  ['each', [[required()]], 'each', '배열을 입력해주세요.', 'x'],
]

test('every public export is covered by the contract table', () => {
  const covered = [...contracts.map(([name]) => name), 'createValidator', 'custom', 'pathToName']
  assert.deepEqual(Object.keys(v).sort(), covered.sort())
})

for (const [name, args, code, defaultMessage, rejected] of contracts) {
  test(`${name}: code, default and custom message, and rule.test agree`, () => {
    for (const [rule, message] of [[v[name](...args), defaultMessage], [v[name](...args, '직접 지정'), '직접 지정']]) {
      assert.equal(rule.code, code)
      assert.equal(rule.message, message)
      assert.equal(rule.test(rejected, { other: 'same' }), false)
      const result = createValidator({ value: [rule] }).validate({ value: rejected, other: 'same' })
      assert.deepEqual(result.firstError, { field: 'value', path: ['value'], name: 'value', code, message })
    }
  })
}

test('only the documented rules run on empty values', () => {
  const alwaysRun = new Set(['required', 'accepted', 'requiredIf', 'minItems', 'maxItems'])
  for (const [name, args] of contracts) {
    assert.equal(v[name](...args).required === true, alwaysRun.has(name), name)
  }
})

test('string rules never coerce arrays, boxed strings, or objects with toString', () => {
  const samples = {
    email: 'a@example.com', koreanTelephone: '02-123-4567', koreanMobile: '010-1234-5678',
    koreanPhone: '010-1234-5678', koreanRepresentativeNumber: '1588-1234',
    koreanTollFreeNumber: '080-123-4567', koreanContactNumber: '010-1234-5678', koreanFax: '02-123-4567',
    koreanPostalCode: '12345', koreanBusinessRegistrationNumber: '1234567891',
    koreanCorporateRegistrationNumber: '1101110000010', pattern: 'a', url: 'https://example.com',
    date: '2026-01-01', before: '2026-01-01', after: '2026-01-03', time: '08:00',
    beforeTime: '08:00', afterTime: '10:00', number: '1', integer: '1', min: '3', max: '1',
  }
  for (const [name, args] of contracts) {
    const sample = samples[name]
    if (sample === undefined) continue
    const options = ['number', 'integer', 'min', 'max'].includes(name) ? numeric : undefined
    const rule = v[name](...(options ? [...args.slice(0, -1), options] : args))
    assert.equal(rule.test(sample, {}), true, `${name} accepts its own sample`)
    for (const value of [[sample], new String(sample), { toString: () => sample }]) {
      assert.equal(rule.test(value, {}), false, name)
    }
  }
})

test('length rules reject non-string, non-array values that have a length', () => {
  for (const rule of [v.minLength(0), v.maxLength(10)]) {
    assert.equal(rule.test({ length: 1 }, {}), false)
  }
})

test('object and each rule.test report success as well as failure', () => {
  assert.equal(v.object(inner).test({ name: 'a' }, {}), true)
  assert.equal(v.object(inner).test({}, {}), false)
  assert.equal(v.each([required()]).test(['a'], {}), true)
  assert.equal(v.each([required()]).test([''], {}), false)
})

test('custom defaults to the custom code', () => {
  const rule = v.custom(() => false, 'm')
  assert.deepEqual([rule.code, rule.message, rule.required], ['custom', 'm', undefined])
})

test('programming errors carry a descriptive message', () => {
  for (const [run, type, message] of [
    [() => v.minLength(-1), RangeError, /길이/],
    [() => v.minItems(-1), RangeError, /항목 수/],
    [() => v.min(NaN), RangeError, /범위/],
    [() => v.number({ thousandsSeparator: '.' }), TypeError, /콤마/],
    [() => v.before('x'), RangeError, /기준 날짜/],
    [() => v.after('x'), RangeError, /기준 날짜/],
    [() => v.beforeTime('x'), RangeError, /기준 시간/],
    [() => v.anyOf([]), RangeError, /anyOf/],
    [() => v.requiredIf(() => 1).test('', {}), TypeError, /requiredIf/],
    [() => createValidator({ a: [v.custom(() => 1, 'm')] }).validate({ a: 1 }), TypeError, /boolean/],
    [() => createValidator({}).validate(null), TypeError, /객체/],
  ]) {
    assert.throws(run, error => error instanceof type && message.test(error.message), String(message))
  }
})
