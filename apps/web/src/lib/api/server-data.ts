import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ApiError } from './client';
import { serverApi } from './server';

/** 404 from the api → Next's not-found page (Draft events are 404 for non-Admins) */
async function orNotFound<T>(p: Promise<T>) {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

export const getEventBySlug = cache(async (slug: string) =>
  orNotFound(
    (async () => {
      const api = serverApi();
      const { data: ref } = await api.GET('/api/v1/slugs/{slug}', { params: { path: { slug } } });
      const { data } = await api.GET('/api/v1/events/{eventId}', { params: { path: { eventId: ref!.id } } });
      return data!;
    })(),
  ),
);

export const getMe = cache(async () => (await serverApi().GET('/api/v1/me')).data!);
