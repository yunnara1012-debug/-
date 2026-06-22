import type { Brand, Store } from '@/types';

export const INITIAL_BRANDS: Brand[] = [
  { id: 'tiger', name: '호랑이족발', keyword: '호랑이족발', color: '#2563EB' },
  { id: 'chunnyun', name: '천년아구찜', keyword: '천년아구찜', color: '#DC2626' },
];

export const INITIAL_STORES: Store[] = [
  {
    id: 'store-1',
    name: '호랑이족발 강남점',
    phone: '02-1234-5678',
    address: '서울 강남구 테헤란로 123',
    lat: 37.5012,
    lng: 127.0396,
    status: 'open',
    brandIds: ['tiger'],
    openDate: '2023-03-15',
    memo: '강남 주요 상권',
    inflowSource: '직접 문의',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'store-2',
    name: '호랑이족발 서초점',
    phone: '02-2345-6789',
    address: '서울 서초구 서초대로 456',
    lat: 37.4912,
    lng: 127.0142,
    status: 'contracted',
    brandIds: ['tiger'],
    openDate: '2024-01-10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'store-3',
    name: '천년아구찜 강남점',
    phone: '02-3456-7890',
    address: '서울 강남구 강남대로 789',
    lat: 37.4955,
    lng: 127.0302,
    status: 'open',
    brandIds: ['chunnyun'],
    openDate: '2023-08-20',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
