import { supabase } from './client';
import type { Brand, Store } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCamelStore(row: any): Store {
  return {
    id: row.id,
    placeId: row.place_id ?? undefined,
    name: row.name,
    phone: row.phone ?? undefined,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    openDate: row.open_date ?? undefined,
    contactName: row.contact_name ?? undefined,
    memo: row.memo ?? undefined,
    inflowSource: row.inflow_source ?? undefined,
    brandIds: row.brand_ids ?? [],
    bizLicenseUrl: row.biz_license_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSnakeStore(s: Store): Record<string, unknown> {
  return {
    id: s.id,
    place_id: s.placeId ?? null,
    name: s.name,
    phone: s.phone ?? null,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    status: s.status,
    open_date: s.openDate ?? null,
    contact_name: s.contactName ?? null,
    memo: s.memo ?? null,
    inflow_source: s.inflowSource ?? null,
    brand_ids: s.brandIds,
    biz_license_url: s.bizLicenseUrl ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export async function loadBrands(): Promise<Brand[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('brands').select('*').order('name');
  if (error) { console.error('loadBrands', error); return null; }
  return (data ?? []) as Brand[];
}

export async function loadStores(): Promise<Store[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('stores').select('*').order('created_at');
  if (error) { console.error('loadStores', error); return null; }
  return (data ?? []).map(toCamelStore);
}

export async function upsertBrand(brand: Brand): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('brands').upsert(brand);
  if (error) console.error('upsertBrand', error);
}

export async function upsertBrands(brands: Brand[]): Promise<void> {
  if (!supabase || brands.length === 0) return;
  const { error } = await supabase.from('brands').upsert(brands);
  if (error) console.error('upsertBrands', error);
}

export async function upsertStore(store: Store): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('stores').upsert(toSnakeStore(store));
  if (error) console.error('upsertStore', error);
}

export async function upsertStores(stores: Store[]): Promise<void> {
  if (!supabase || stores.length === 0) return;
  const { error } = await supabase.from('stores').upsert(stores.map(toSnakeStore));
  if (error) console.error('upsertStores', error);
}

export async function deleteStore(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('stores').delete().eq('id', id);
  if (error) console.error('deleteStore', error);
}

export async function deleteBrand(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('brands').delete().eq('id', id);
  if (error) console.error('deleteBrand', error);
}

export async function uploadBizLicense(storeId: string, file: File): Promise<string | null> {
  if (!supabase) return null;
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `${storeId}.${ext}`;
  const { error } = await supabase.storage.from('biz-licenses').upload(path, file, { upsert: true });
  if (error) { console.error('uploadBizLicense', error); return null; }
  const { data } = supabase.storage.from('biz-licenses').getPublicUrl(path);
  return data.publicUrl;
}
