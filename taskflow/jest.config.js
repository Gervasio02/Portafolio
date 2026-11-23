export default {
  testMatch: ["<rootDir>/tests/*.test.js"],
  testEnvironment: "node",
  transform: {},
  collectCoverageFrom: [
    "server/app.js",
    "server/auth.js",
    "server/boards.js",
    "server/order.js",
    "server/dashboard.js",
    "server/operations.js",
  ],
  coverageThreshold: {
    global: { lines: 70, statements: 70, functions: 70, branches: 70 },
  },
};
