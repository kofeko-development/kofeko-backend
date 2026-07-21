import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  moduleNameMapper: {
    '^otplib$': '<rootDir>/src/__tests__/mocks/otplib.ts',
    '^qrcode$': '<rootDir>/src/__tests__/mocks/qrcode.ts',
  },
  testTimeout: 60000,
};

export default config;
