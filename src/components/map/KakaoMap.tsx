'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { Store, Brand, VerdictResult } from '@/types';
import { makeMarkerSvg, makeSearchMarkerSvg, getStoreColor } from '@/lib/map/markerStyles';
import { haversineDistance } from '@/lib/geo/distance';
import { getProvincePolygon } from '@/data/provinces';

interface KakaoMapProps {
  stores: Store[];
  brands: Brand[];
  selectedBrandId: string;
  verdict: VerdictResult | null;
  selectedStoreId?: string;
  highlightedStore?: Store | null;
  onStoreClick: (store: Store) => void;
  onMapClick?: () => void;
  rulerMode: boolean;
}

function getShortName(name: string): string {
  const idx = name.indexOf(' ');
  return idx !== -1 ? name.slice(idx + 1) : (name.length > 5 ? name.slice(-4) : name);
}

function formatDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
const BRAND_LOGOS: Record<string, string> = {
  '호랑이족발': `${BASE}/logos/horangi.png`,
  '천년아구찜': `${BASE}/logos/chunnyeon.png`,
};

function getBrandLogo(group: Store[], currentBrands: Brand[], activeBrandId = 'all'): string | null {
  const ordered = activeBrandId !== 'all'
    ? [...currentBrands.filter(b => b.id === activeBrandId), ...currentBrands.filter(b => b.id !== activeBrandId)]
    : currentBrands;

  for (const brand of ordered) {
    if (group.some(store => store.brandIds.includes(brand.id))) {
      const key = brand.keyword || brand.name;
      if (BRAND_LOGOS[key]) return BRAND_LOGOS[key];
    }
  }
  return null;
}

function makeLogoPinElement(logoUrl: string, color: string, count: number, onClick: () => void, label?: string): { el: HTMLElement; yAnchor: number } {
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;display:inline-flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.3))';

  const circle = document.createElement('div');
  circle.style.cssText = `position:relative;width:36px;height:36px;border-radius:50%;border:2px solid ${color};overflow:hidden;background:white;flex-shrink:0;`;

  const img = document.createElement('img');
  img.src = logoUrl;
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;';
  img.draggable = false;
  circle.appendChild(img);

  if (count > 1) {
    const badge = document.createElement('div');
    badge.style.cssText = 'position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;background:#EF4444;border-radius:8px;color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid white;padding:0 2px;box-sizing:border-box;';
    badge.textContent = String(count);
    circle.appendChild(badge);
  }

  el.appendChild(circle);

  const pointer = document.createElement('div');
  pointer.style.cssText = `width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid ${color};pointer-events:none;`;
  el.appendChild(pointer);

  const labelHeight = 20;
  if (label) {
    const text = document.createElement('div');
    text.style.cssText = `margin-top:2px;background:${color};color:white;padding:2px 5px;border-radius:5px;font-size:10px;font-weight:700;white-space:nowrap;pointer-events:none;`;
    text.textContent = label;
    el.appendChild(text);
  }

  el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });

  const pinHeight = 45;
  const totalHeight = pinHeight + (label ? labelHeight : 0);
  const yAnchor = 1 - (label ? labelHeight : 0) / totalHeight;

  return { el, yAnchor };
}

export function KakaoMap({ stores, brands, selectedBrandId, verdict, selectedStoreId, highlightedStore, onStoreClick, onMapClick, rulerMode }: KakaoMapProps) {
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<{ remove: () => void; stores: Store[] }[]>([]);
  const circlesRef = useRef<kakao.maps.Circle[]>([]);
  const verdictMarkerRef = useRef<kakao.maps.Marker | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoverIwRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provinceRectRef = useRef<any>(null);
  const searchCircleRef = useRef<kakao.maps.Circle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const storesRef = useRef<Store[]>(stores);
  const brandsRef = useRef<Brand[]>(brands);
  const selectedBrandIdRef = useRef(selectedBrandId);
  const markerJustClickedRef = useRef(false);
  const [mapZoom, setMapZoom] = useState(8);

  // 자 (거리 측정) 관련 — 렌더 타임에 즉시 동기화 (useEffect 지연 없음)
  const rulerModeRef = useRef(rulerMode);
  rulerModeRef.current = rulerMode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulerLineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulerOverlaysRef = useRef<any[]>([]);
  const rulerPointsRef = useRef<{ lat: number; lng: number }[]>([]);
  const [rulerResult, setRulerResult] = useState<{ distanceM: number; walkMin: number; bikeMin: number } | null>(null);
  const [rulerStep, setRulerStep] = useState(0); // 0: 대기, 1: 시작점 찍음, 2: 완료

  useEffect(() => { storesRef.current = stores; }, [stores]);
  useEffect(() => { brandsRef.current = brands; }, [brands]);
  useEffect(() => { selectedBrandIdRef.current = selectedBrandId; }, [selectedBrandId]);

  const clearOverlays = useCallback(() => {
    markersRef.current.forEach(({ remove }) => remove());
    markersRef.current = [];
    circlesRef.current.forEach(c => c.setMap(null));
    circlesRef.current = [];
    if (verdictMarkerRef.current) {
      verdictMarkerRef.current.setMap(null);
      verdictMarkerRef.current = null;
    }
    if (infoWindowRef.current) {
      infoWindowRef.current.setMap(null);
      infoWindowRef.current = null;
    }
    if (hoverIwRef.current) {
      hoverIwRef.current.setMap(null);
      hoverIwRef.current = null;
    }
    if (provinceRectRef.current) {
      provinceRectRef.current.setMap(null);
      provinceRectRef.current = null;
    }
    if (searchCircleRef.current) {
      searchCircleRef.current.setMap(null);
      searchCircleRef.current = null;
    }
  }, []);

  const clearRuler = useCallback(() => {
    if (rulerLineRef.current) { rulerLineRef.current.setMap(null); rulerLineRef.current = null; }
    rulerOverlaysRef.current.forEach(o => o.setMap(null));
    rulerOverlaysRef.current = [];
    rulerPointsRef.current = [];
    setRulerResult(null);
    setRulerStep(0);
  }, []);

  useEffect(() => {
    if (!rulerMode) clearRuler();
  }, [rulerMode, clearRuler]);

  const groupStores = useCallback((storeList: Store[]) => {
    const groups: Store[][] = [];
    const used = new Set<string>();
    for (const store of storeList) {
      if (used.has(store.id)) continue;
      const group = [store];
      used.add(store.id);
      for (const other of storeList) {
        if (used.has(other.id)) continue;
        if (haversineDistance(store.lat, store.lng, other.lat, other.lng) < 10) {
          group.push(other);
          used.add(other.id);
        }
      }
      groups.push(group);
    }
    return groups;
  }, []);

  const renderStores = useCallback((map: kakao.maps.Map, storeList: Store[], currentBrands: Brand[], zoom = 8, highlightId?: string, activeBrandId = 'all') => {
    markersRef.current.forEach(({ remove }) => remove());
    markersRef.current = [];
    circlesRef.current.forEach(c => c.setMap(null));
    circlesRef.current = [];

    const showLabel = zoom <= 9;
    const groups = groupStores(storeList);

    for (const group of groups) {
      const statusOrder: Store['status'][] = ['open', 'contracted', 'consulting', 'candidate', 'closed'];
      const primary = [...group].sort(
        (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
      )[0];
      const isHighlighted = highlightId ? group.some(s => s.id === highlightId) : false;
      const color = isHighlighted ? '#EC4899' : getStoreColor(primary, currentBrands);
      const position = new kakao.maps.LatLng(primary.lat, primary.lng);

      const logoUrl = getBrandLogo(group, currentBrands, activeBrandId);
      const label = (showLabel && group.length === 1) ? getShortName(primary.name) : undefined;
      if (logoUrl) {
        const { el, yAnchor } = makeLogoPinElement(logoUrl, color, group.length, () => { markerJustClickedRef.current = true; onStoreClick(group[0]); }, label);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const overlay = new (kakao.maps as any).CustomOverlay({
          content: el,
          position,
          yAnchor,
          zIndex: 5,
        });
        overlay.setMap(map);
        markersRef.current.push({ remove: () => overlay.setMap(null), stores: group });
      } else {
        const svgUrl = makeMarkerSvg(color, group.length, label);

        let mw: number, mh: number, ox: number, oy: number;
        if (label) {
          [mw, mh, ox, oy] = [52, 58, 26, 40];
        } else if (group.length > 1) {
          [mw, mh, ox, oy] = isHighlighted ? [38, 48, 19, 48] : [32, 40, 16, 40];
        } else {
          [mw, mh, ox, oy] = isHighlighted ? [32, 42, 16, 42] : [26, 34, 13, 34];
        }

        const markerImage = new kakao.maps.MarkerImage(
          svgUrl,
          new kakao.maps.Size(mw, mh),
          { offset: new kakao.maps.Point(ox, oy) }
        );

        const marker = new kakao.maps.Marker({
          map,
          position,
          image: markerImage,
          zIndex: 5,
        });

        kakao.maps.event.addListener(marker, 'click', () => { markerJustClickedRef.current = true; onStoreClick(group[0]); });
        markersRef.current.push({ remove: () => marker.setMap(null), stores: group });
      }

      for (const store of group) {
        if (store.status === 'closed') continue;
        const storeColor = getStoreColor(store, currentBrands);
        const circle = new kakao.maps.Circle({
          map,
          center: new kakao.maps.LatLng(store.lat, store.lng),
          radius: 2000,
          strokeWeight: 2,
          strokeColor: storeColor,
          strokeOpacity: 0.6,
          strokeStyle: 'solid',
          fillColor: storeColor,
          fillOpacity: 0.08,
        });
        circlesRef.current.push(circle);
      }
    }
  }, [groupStores, onStoreClick]);

  const renderStoresRef = useRef(renderStores);
  useEffect(() => { renderStoresRef.current = renderStores; }, [renderStores]);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current) return;

    const initMap = () => {
      if (!containerRef.current || mapRef.current) return;
      kakao.maps.load(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(37.5665, 126.9780),
          level: 8,
        });
        mapRef.current = map;
        kakao.maps.event.addListener(map, 'zoom_changed', () => {
          setMapZoom(map.getLevel());
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
          if (markerJustClickedRef.current) { markerJustClickedRef.current = false; return; }

          if (rulerModeRef.current) {
            const lat = mouseEvent.latLng.getLat();
            const lng = mouseEvent.latLng.getLng();
            const pts = rulerPointsRef.current;

            if (pts.length >= 2) {
              // 이미 완성된 상태면 초기화 후 새 시작점
              if (rulerLineRef.current) { rulerLineRef.current.setMap(null); rulerLineRef.current = null; }
              rulerOverlaysRef.current.forEach(o => o.setMap(null));
              rulerOverlaysRef.current = [];
              rulerPointsRef.current = [{ lat, lng }];
              setRulerResult(null);
              setRulerStep(1);
            } else {
              rulerPointsRef.current = [...pts, { lat, lng }];
              if (pts.length === 0) setRulerStep(1);
            }

            // 점 표시
            const dotEl = document.createElement('div');
            dotEl.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#EF4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);transform:translate(-50%,-50%);';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dotOverlay = new (kakao.maps as any).CustomOverlay({
              content: dotEl,
              position: new kakao.maps.LatLng(lat, lng),
              zIndex: 15,
            });
            dotOverlay.setMap(map);
            rulerOverlaysRef.current.push(dotOverlay);

            const updatedPts = rulerPointsRef.current;
            if (updatedPts.length === 2) {
              // 선 그리기
              if (rulerLineRef.current) rulerLineRef.current.setMap(null);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rulerLineRef.current = new (kakao.maps as any).Polyline({
                map,
                path: updatedPts.map(p => new kakao.maps.LatLng(p.lat, p.lng)),
                strokeWeight: 2,
                strokeColor: '#EF4444',
                strokeOpacity: 1,
                strokeStyle: 'solid',
              });
              const distM = haversineDistance(updatedPts[0].lat, updatedPts[0].lng, updatedPts[1].lat, updatedPts[1].lng);
              setRulerResult({
                distanceM: distM,
                walkMin: Math.max(1, Math.round(distM / 80)),
                bikeMin: Math.max(1, Math.round(distM / 300)),
              });
              setRulerStep(2);
            }
            return;
          }

          onMapClickRef.current?.();
        });
        renderStores(map, storesRef.current, brandsRef.current, 8, undefined, selectedBrandIdRef.current);
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).kakao !== 'undefined') {
      initMap();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakaoKey = (window as any).__KAKAO_MAP_KEY__;
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services,clusterer&autoload=false`;
    script.async = true;
    script.onload = initMap;
    script.onerror = () => console.error('❌ Kakao Maps SDK 로드 실패');
    document.head.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !highlightedStore) return;
    if (typeof kakao === 'undefined') return;
    mapRef.current.panTo(new kakao.maps.LatLng(highlightedStore.lat, highlightedStore.lng));
  }, [highlightedStore]);

  useEffect(() => {
    if (!mapRef.current) return;
    renderStores(mapRef.current, stores, brands, mapZoom, highlightedStore?.id, selectedBrandId);
  }, [stores, brands, renderStores, mapZoom, highlightedStore, selectedBrandId]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (verdictMarkerRef.current) {
      verdictMarkerRef.current.setMap(null);
      verdictMarkerRef.current = null;
    }
    if (infoWindowRef.current) {
      infoWindowRef.current.setMap(null);
      infoWindowRef.current = null;
    }
    if (provinceRectRef.current) {
      provinceRectRef.current.setMap(null);
      provinceRectRef.current = null;
    }
    if (searchCircleRef.current) {
      searchCircleRef.current.setMap(null);
      searchCircleRef.current = null;
    }
    if (!verdict) return;

    const map = mapRef.current;
    const latlng = new kakao.maps.LatLng(verdict.searchLat, verdict.searchLng);
    map.panTo(latlng);

    const svgUrl = makeSearchMarkerSvg();
    const markerImage = new kakao.maps.MarkerImage(svgUrl, new kakao.maps.Size(36, 44), { offset: new kakao.maps.Point(18, 44) });
    const marker = new kakao.maps.Marker({ map, position: latlng, image: markerImage, zIndex: 10 });
    verdictMarkerRef.current = marker;

    searchCircleRef.current = new kakao.maps.Circle({
      map,
      center: latlng,
      radius: 2000,
      strokeWeight: 2,
      strokeColor: '#16A34A',
      strokeOpacity: 0.8,
      strokeStyle: 'solid',
      fillColor: '#16A34A',
      fillOpacity: 0.07,
    });

    if (verdict.region) {
      const points = getProvincePolygon(verdict.region);
      if (points) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const polygon = new (kakao.maps as any).Polygon({
          path: points.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng)),
          strokeWeight: 2,
          strokeColor: '#F97316',
          strokeOpacity: 0.9,
          strokeStyle: 'dash',
          fillColor: '#F97316',
          fillOpacity: 0.06,
          zIndex: 1,
        });
        polygon.setMap(map);
        provinceRectRef.current = polygon;
      }
    }
  }, [verdict]);

  useEffect(() => {
    if (!mapRef.current || !selectedStoreId) return;

    const found = markersRef.current.find(({ stores }) => stores.some(s => s.id === selectedStoreId));
    if (!found) return;

    const store = found.stores.find(s => s.id === selectedStoreId);
    if (!store) return;

    mapRef.current.panTo(new kakao.maps.LatLng(store.lat, store.lng));
  }, [selectedStoreId]);

  useEffect(() => {
    return () => clearOverlays();
  }, [clearOverlays]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        id="kakao-map"
        className="w-full h-full"
        style={{ minHeight: '300px', cursor: rulerMode ? 'crosshair' : undefined }}
      />

      {/* 자 모드 안내 툴팁 */}
      {rulerMode && rulerStep < 2 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/65 text-white text-xs rounded-lg px-3 py-1.5 z-50 pointer-events-none whitespace-nowrap">
          {rulerStep === 0 ? '📍 시작 지점을 클릭하세요' : '📍 끝 지점을 클릭하세요'}
        </div>
      )}

      {/* 거리 결과 카드 */}
      {rulerResult && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-100 px-4 py-3 z-50 text-sm min-w-[170px]">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-3">
            <span className="text-gray-500">총거리</span>
            <span className="font-bold text-pink-500 text-right">{formatDist(rulerResult.distanceM)}</span>
            <span className="text-gray-500">도보</span>
            <span className="font-semibold text-right">{rulerResult.walkMin}분</span>
            <span className="text-gray-500">자전거</span>
            <span className="font-semibold text-right">{rulerResult.bikeMin}분</span>
          </div>
          <button
            onClick={clearRuler}
            className="w-full text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition-colors"
          >
            🗑 지우기
          </button>
        </div>
      )}
    </div>
  );
}
