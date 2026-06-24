import type { StoreStatus, Brand, Store } from '@/types';

export const STATUS_COLORS: Record<StoreStatus, string> = {
  open: '#2563EB',
  contracted: '#EAB308',
  consulting: '#16A34A',
  closed: '#4B5563',
  candidate: '#9333EA',
};

export const STATUS_LABELS: Record<StoreStatus, string> = {
  open: '오픈',
  contracted: '계약완료',
  consulting: '상담중',
  closed: '폐점',
  candidate: '후보',
};

export const MULTI_BRAND_COLOR = '#0D9488'; // 두 브랜드 동시 운영 지점 (청록)

export function getStoreColor(store: Store, brands: Brand[]): string {
  if (store.status !== 'open') return STATUS_COLORS[store.status];
  // 오픈 상태에서 복수 브랜드 보유 → 주황
  const activeBrands = brands.filter(b => store.brandIds.includes(b.id));
  if (activeBrands.length > 1) return MULTI_BRAND_COLOR;
  return activeBrands[0]?.color ?? STATUS_COLORS.open;
}

// label: 핀 아래에 표시할 짧은 이름 (줌 인 시에만 전달)
export function makeMarkerSvg(color: string, count = 1, label?: string): string {
  if (count > 1) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 24 16 24s16-13 16-24C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="Arial">${count}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }
  if (label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="58" viewBox="0 0 52 58"><g transform="translate(10,0)"><path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 24 16 24s16-13 16-24C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/></g><rect x="1" y="43" width="50" height="14" rx="7" fill="white" stroke="${color}" stroke-width="1.5"/><text x="26" y="54" text-anchor="middle" fill="${color}" font-size="10" font-weight="bold" font-family="sans-serif">${label}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34"><path d="M13 0C5.82 0 0 5.82 0 13c0 8.938 13 21 13 21s13-12.063 13-21C26 5.82 20.18 0 13 0z" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

export function makeSearchMarkerSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 0C8.059 0 0 8.059 0 18c0 12.375 18 26 18 26s18-13.625 18-26C36 8.059 27.941 0 18 0z" fill="#16A34A" stroke="white" stroke-width="2.5"/><text x="18" y="23" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial">?</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
