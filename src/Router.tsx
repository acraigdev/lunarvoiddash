import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { HomeLazy } from './pages/HomeLazy';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeLazy />,
  },
]);
