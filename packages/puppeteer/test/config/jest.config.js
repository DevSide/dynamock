export default {
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '^.+\\.spec\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.\\.?\\/.+)\\.js$': '$1',
  },
  rootDir: '../../',
  setupFilesAfterEnv: ['<rootDir>/test/config/setupTests.ts'],
}
