/**
 * Imóveis (CRM mockups 04, 05) on the live API: the same properties table as the portal and the
 * broker page. Uploads (photos, owner authorization) go as multipart.
 */
import type { components } from '@casvitta/api-client';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

import { CrmError } from './crm';

type S = components['schemas'];
export type PropertyOut = S['PropertyOut'];
export type PropertyIn = S['PropertyIn'];
export type PropertyPatch = S['PropertyPatch'];
/** Sent as the JSON "data" field of the multipart request (see AuthorizationIn in the API). */
export type AuthorizationIn = {
  kind: 'sale' | 'rent';
  exclusive: boolean;
  evidence: 'document' | 'attestation';
  owner_name: string;
  signed_at: string;
  expires_at: string;
  attest: boolean;
};
export type Blocker = S['Blocker'];
export type MatchingContact = S['MatchingContact'];
export type ListingChannel = S['Channel'];

type Result<T> = { data?: T; error?: unknown; response: Response };

function check<T>(result: Result<T>): T {
  if (result.error !== undefined || !result.response.ok) {
    const body = result.error as { error?: { code?: string; message?: string } } | undefined;
    throw new CrmError(
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? '',
      result.response.status,
    );
  }
  return result.data as T;
}

const KEY = ['crm', 'properties'] as const;
const invalidate = (client: QueryClient) => client.invalidateQueries({ queryKey: ['crm'] });
const asForm = (body: unknown) => body as FormData;

export function useProperties() {
  return useQuery({ queryKey: KEY, queryFn: async () => check(await api.GET('/v1/properties')) });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () =>
      check(
        await api.GET('/v1/properties/{property_id}', { params: { path: { property_id: id } } }),
      ),
  });
}

export function useMatchingContacts(id: string) {
  return useQuery({
    queryKey: [...KEY, id, 'matching'],
    queryFn: async () =>
      check(
        await api.GET('/v1/properties/{property_id}/matching-contacts', {
          params: { path: { property_id: id } },
        }),
      ),
  });
}

export async function createProperty(body: PropertyIn) {
  return check(await api.POST('/v1/properties', { body }));
}

export async function updateProperty(id: string, body: PropertyPatch) {
  return check(
    await api.PATCH('/v1/properties/{property_id}', {
      params: { path: { property_id: id } },
      body,
    }),
  );
}

export async function addPhoto(id: string, file: File) {
  const form = new FormData();
  form.append('photo', file);
  return check(
    await api.POST('/v1/properties/{property_id}/photos', {
      params: { path: { property_id: id } },
      body: asForm(form) as never,
      bodySerializer: asForm,
    }),
  );
}

export async function addAuthorization(id: string, data: AuthorizationIn, document: File | null) {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  if (document) form.append('document', document);
  return check(
    await api.POST('/v1/properties/{property_id}/authorizations', {
      params: { path: { property_id: id } },
      body: asForm(form) as never,
      bodySerializer: asForm,
    }),
  );
}

export async function publish(id: string, channel: ListingChannel) {
  return check(
    await api.PUT('/v1/properties/{property_id}/listings/{channel}', {
      params: { path: { property_id: id, channel } },
    }),
  );
}

export function usePropertyMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => fn(...args),
    onSettled: () => invalidate(client),
  });
}
