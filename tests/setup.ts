import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Route pages are lazy modules that Vite transforms on first use. With many test files running side by side, that
// first load can take longer than the one-second default, so waiting is allowed to take a few seconds.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  // jsdom does not implement scrolling.
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
