import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollBy", {
  configurable: true,
  value: () => undefined,
});
