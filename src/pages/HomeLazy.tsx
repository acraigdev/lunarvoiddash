import React from 'react';
import { lazy, Suspense } from 'react';

const Home = lazy(() =>
  import('./Home.tsx').then(module => ({
    default: module.Home,
  })),
);

export function HomeLazy() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
