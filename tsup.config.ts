import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    internals: 'src/internals.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
})
