export type StoreStatus = 'open' | 'contracted' | 'consulting' | 'closed' | 'candidate';

export interface Brand {
  id: string;
  name: string;
  keyword: string;
  color?: string;
  logoUrl?: string;
  radius?: number; // 독점(출점 가능) 반경, 단위: m. 미설정 시 기본값 2000m
}

export interface Store {
  id: string;
  placeId?: string;
  name: string;
  phone?: string;
  address: string;
  lat: number;
  lng: number;
  status: StoreStatus;
  openDate?: string;
  contactName?: string;
  memo?: string;
  inflowSource?: string;
  brandIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportCandidate {
  id: string;
  placeId?: string;
  name: string;
  phone?: string;
  address: string;
  lat: number;
  lng: number;
  brandId: string;
  sourceKeyword: string;
  duplicateStoreId?: string;
  duplicateReason?: 'place_id' | 'phone' | 'coord_name' | 'address';
  duplicateSimilarity?: number;
  status: 'pending' | 'approved' | 'excluded' | 'merged';
  rawData: unknown;
}

export interface SearchResult {
  address: string;
  lat: number;
  lng: number;
  placeName?: string;
}

export interface VerdictResult {
  canOpen: boolean;
  nearestStore?: Store;
  nearestDistance?: number;
  searchLat: number;
  searchLng: number;
  region?: string;
  searchAddress?: string;
  zoomLevel?: number;
  isRegionSearch?: boolean;
  radiusUsed?: number;
}
