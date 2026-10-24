import { createBrowserRouter } from 'react-router';
import { routes } from './routes.tsx';

// import.meta.env.BASE_URL is "/" or "/<repo>/". The router wants the base without its trailing slash.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export const router = createBrowserRouter(routes, {
  basename: basename === '' ? undefined : basename,
});
