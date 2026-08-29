import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  sourcemap: true,
  clean: true,
  dts: false,
  noExternal: ['@grounddesk/shared'],
})
