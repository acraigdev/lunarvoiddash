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

  const src =
    data.media_type === 'video'
      ? 'https://www.nasa.gov/wp-content/uploads/2025/02/30dor.jpg?resize=2000,1344'
      : data.hdurl ?? data.url;

  return (
    <img
      src={src}
      alt={data.title}
      className="fixed inset-0 w-full h-full object-cover -z-10 pointer-events-none"
    />
  );
}
