export interface ApodData {
  hdurl: string;
  url: string;
  title: string;
  explanation: string;
  date: string;
  media_type: 'image' | 'video';
}

export async function getImageOTD(): Promise<ApodData> {
  const apiKey = process.env.NEXT_PUBLIC_NASA_API_KEY ?? 'DEMO_KEY';
  const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`, {
    // Next.js extended fetch: cache APOD for 24 hours server-side.
    // When called from a client component via TanStack Query, this option is
    // ignored and TanStack Query's staleTime handles caching instead.
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`NASA APOD ${res.status}`);
  return res.json() as Promise<ApodData>;
}
