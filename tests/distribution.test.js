import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as esm from '../dist/valimini.js'

test('both browser bundles retain the package version and complete license', () => {
  const { name, version, license } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const licenseText = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8').trimEnd()

  for (const file of ['valimini.js', 'valimini.global.js']) {
    const bundle = readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8')
    assert.ok(bundle.startsWith(`/*! ${name} v${version} | ${license} License\n`), file)
    const endOfComment = bundle.indexOf('*/')
    const licenseInBundle = bundle.slice(0, endOfComment).trimEnd().split('\n').slice(2)
      .map(line => line.replace(/^ *\* ?/, '')).join('\n')
    assert.equal(licenseInBundle, licenseText, file)
  }
})

test('classic script exposes the same public API without a module loader', () => {
  const context = { URL }
  runInNewContext(readFileSync(new URL('../dist/valimini.global.js', import.meta.url), 'utf8'), context)
  const global = context.Valimini
  assert.deepEqual(Object.keys(global).sort(), Object.keys(esm).sort())
  const user = global.createValidator({ age: [global.integer(), global.min(0)] })
  const validator = global.createValidator({
    users: [global.each(user)],
    price: [global.number({ allowString: true, thousandsSeparator: ',' })],
    homepage: [global.url()],
  })
  const result = validator.validate({ users: [{ age: -1 }], price: '1,000', homepage: 'https://example.com' })
  assert.equal(result.firstError.name, 'users[0].age')
  assert.equal(result.firstError.code, 'min')
  assert.equal(validator.validate({ users: [{ age: 0 }], price: '1,000' }).valid, true)
  const nested = global.createValidator({ owner: [global.object(user)] })
  assert.equal(nested.validate({ owner: { age: -1 } }).firstError.name, 'owner.age')
})
