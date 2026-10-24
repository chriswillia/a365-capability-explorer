import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  // jsdom does not implement scrolling.
  window.scrollTo = () => {};
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
