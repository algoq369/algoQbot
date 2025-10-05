module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'optimization/**/*.js',
    'resilience/**/*.js',
    'blockchain/**/*.js',
    'database/**/*.js',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  verbose: true,
  testTimeout: 30000, // 30 seconds for async tests
  maxWorkers: 4 // Parallel test execution
};


