import type { PackUserConfig } from 'vite-plus/pack'

export const pack = {
  attw: {
    profile: 'strict',
  },
  dts: {
    sourcemap: true,
  },
  exports: {
    enabled: true,
    devExports: true,
  },
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
} satisfies PackUserConfig
