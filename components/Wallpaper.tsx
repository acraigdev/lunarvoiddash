import React from 'react';
import type { ApodData } from '@/lib/nasa';

export function Wallpaper({ apod }: { apod: ApodData }) {
  return (
    <img
      src={apod.hdurl ?? apod.url}
      alt={apod.title}
      className="fixed inset-0 w-full h-full object-cover -z-10"
    />
  );
}
