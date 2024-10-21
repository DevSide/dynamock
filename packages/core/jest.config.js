export default {
  preset: 'ts-jest/presets/default-esm', // Use ts-jest's ESM preset
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.\\.?\\/.+)\\.js$': '$1',
  },
}
