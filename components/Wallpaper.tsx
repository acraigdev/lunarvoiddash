'use client';

import { useQuery } from '@tanstack/react-query';
import { getImageOTD, type ApodData } from '@/lib/nasa';

export function Wallpaper({ apod }: { apod: ApodData }) {
  const { data } = useQuery({
    queryKey: ['apod'],
    queryFn: getImageOTD,
    initialData: apod,
    refetchInterval: 60 * 60_000,
  });

  return (
    <img
      src={data.hdurl ?? data.url}
      alt={data.title}
      className="fixed inset-0 w-full h-full object-cover -z-10 pointer-events-none"
    />
  );
}
