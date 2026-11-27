import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const { name, version, license } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const licenseText = readFileSync(new URL('./LICENSE', import.meta.url), 'utf8').trimEnd()
const banner = [
  `/*! ${name} v${version} | ${license} License`,
  ' *',
  ...licenseText.split('\n').map(line => line ? ` * ${line}` : ' *'),
  ' */',
].join('\n')

export default defineConfig({
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        minify: true,
        banner,
        comments: { legal: true },
      },
    },
    lib: {
      entry: 'src/index.ts',
      name: 'Valimini',
      formats: ['es', 'iife'],
      fileName: format => format === 'es' ? 'valimini.js' : 'valimini.global.js',
    },
  },
})
