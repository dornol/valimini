import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: { minify: true },
    },
    lib: {
      entry: 'src/index.ts',
      name: 'Valimini',
      formats: ['es', 'iife'],
      fileName: format => format === 'es' ? 'valimini.js' : 'valimini.global.js',
    },
  },
})
