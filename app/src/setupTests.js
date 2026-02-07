// Keep CRA test setup file, but this project doesn't include Testing Library
// dependencies by default.

// React 18: suppress "act environment" warnings for tests that use `createRoot`.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
