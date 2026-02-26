'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQueries } from '@tanstack/react-query';
import { searchContactPhoto } from '@/lib/google';

/**
 * Looks up contact photos for a list of emails via Google People API.
 * Each unique email gets its own cached query (`staleTime: Infinity`),
 * so adding a new organizer only triggers one new search — existing
 * results stay cached.
 */
export function useContactPhotos(emails: string[]) {
  const { data: session } = useSession();

  const uniqueEmails = useMemo(() => {
    const set = new Set(emails.map(e => e.toLowerCase()));
    return Array.from(set);
  }, [emails]);

  const results = useQueries({
    queries: uniqueEmails.map(email => ({
      queryKey: ['contacts', 'photo', email],
      queryFn: async () =>
        (await searchContactPhoto(session!.accessToken, email)) ?? null,
      enabled: !!session?.accessToken,
      staleTime: Infinity,
    })),
  });

  const safeMap = useMemo(() => {
    const map = new Map<string, string>();
    uniqueEmails.forEach((email, i) => {
      const url = results[i]?.data;
      if (url) map.set(email, url);
    });
    // Seed with user's own Google profile photo
    if (session?.user?.email && session?.user?.image) {
      const selfKey = session.user.email.toLowerCase();
      if (!map.has(selfKey)) map.set(selfKey, session.user.image);
    }
    return map;
  }, [uniqueEmails, results, session]);

  function getPhoto(email: string | undefined): string | undefined {
    if (!email) return undefined;
    return safeMap.get(email.toLowerCase());
  }

  return {
    getPhoto,
    isLoading: results.some(r => r.isLoading || r.isFetching),
  };
}
