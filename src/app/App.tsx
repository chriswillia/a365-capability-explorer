import { FluentProvider } from '@fluentui/react-components';
import { RouterProvider } from 'react-router/dom';
import { StateProviders } from '../lib/state/StateProviders.tsx';
import { fluentTheme } from '../theme/fluentTheme.ts';
import { router } from './router.ts';

export function App() {
  return (
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>
  );
}
