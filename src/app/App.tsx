import { FluentProvider } from '@fluentui/react-components';
import { RouterProvider } from 'react-router/dom';
import { DepthProvider } from '../lib/state/DepthProvider.tsx';
import { fluentTheme } from '../theme/fluentTheme.ts';
import { router } from './router.ts';

export function App() {
  return (
    <FluentProvider theme={fluentTheme}>
      <DepthProvider>
        <RouterProvider router={router} />
      </DepthProvider>
    </FluentProvider>
  );
}
