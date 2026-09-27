/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    'src/core/**/*.ts',
    'src/lib/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/types.ts',
    '!src/**/contracts.ts',
    '!src/**/constants.ts',
  ],
  testRunner: 'vitest',
  reporters: ['html', 'clear-text', 'progress'],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  vitest: {
    configFile: 'vitest.config.ts',
  },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
  concurrency: 4,
};
