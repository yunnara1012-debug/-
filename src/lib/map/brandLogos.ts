const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const BRAND_LOGOS: Record<string, string> = {
  '호랑이족발': `${BASE}/logos/horangi.png`,
  '천년아구찜': `${BASE}/logos/chunnyeon.png`,
  '명가 들기름 김치찜': `${BASE}/logos/myeongga.png`,
};

function normalizeKey(s: string): string {
  return s.replace(/\s+/g, '');
}

const BRAND_LOGOS_NORMALIZED: Record<string, string> = Object.fromEntries(
  Object.entries(BRAND_LOGOS).map(([k, v]) => [normalizeKey(k), v])
);

export function getStaticBrandLogoUrl(brand: { name: string; keyword?: string }): string | undefined {
  const key = normalizeKey(brand.keyword || brand.name);
  return BRAND_LOGOS_NORMALIZED[key];
}
