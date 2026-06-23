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
}

function getShortName(name: string): string {
  const idx = name.indexOf(' ');
  return idx !== -1 ? name.slice(idx + 1) : (name.length > 5 ? name.slice(-4) : name);
}

function makePopup(html: string): string {
  // pointer-events:none prevents the transparent padding area from blocking marker clicks
  return `<div style="display:inline-block;padding-bottom:46px;pointer-events:none">${html}</div>`;
}

export function KakaoMap({ stores, brands, verdict, selectedStoreId, highlightedStore, onStoreClick, onMapClick }: KakaoMapProps) {
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<{ marker: kakao.maps.Marker; stores: Store[] }[]>([]);
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
  const [mapZoom, setMapZoom] = useState(8);

  useEffect(() => { storesRef.current = stores; }, [stores]);
  useEffect(() => { brandsRef.current = brands; }, [brands]);

  const clearOverlays = useCallback(() => {
    markersRef.current.forEach(({ marker }) => marker.setMap(null));
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

  const renderStores = useCallback((map: kakao.maps.Map, storeList: Store[], currentBrands: Brand[], zoom = 8, highlightId?: string) => {
    markersRef.current.forEach(({ marker }) => marker.setMap(null));
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
      const label = (showLabel && group.length === 1) ? getShortName(primary.name) : undefined;
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
        position: new kakao.maps.LatLng(primary.lat, primary.lng),
        image: markerImage,
        zIndex: 5,
      });

      kakao.maps.event.addListener(marker, 'click', () => {
        if (hoverIwRef.current) { hoverIwRef.current.setMap(null); hoverIwRef.current = null; }
        onStoreClick(group[0]);
      });

      kakao.maps.event.addListener(marker, 'mouseover', () => {
        if (hoverIwRef.current) { hoverIwRef.current.setMap(null); hoverIwRef.current = null; }
        const names = group.map(s => s.name).join('<br>');
        const bubble = `<div style="background:#1f2937;color:white;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);pointer-events:none">${names}</div>`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const overlay = new (kakao.maps as any).CustomOverlay({
          content: makePopup(bubble),
          position: marker.getPosition(),
          yAnchor: 1,
          zIndex: 10,
        });
        overlay.setMap(map);
        hoverIwRef.current = overlay;
      });
      kakao.maps.event.addListener(marker, 'mouseout', () => {
        if (hoverIwRef.current) { hoverIwRef.current.setMap(null); hoverIwRef.current = null; }
      });

      markersRef.current.push({ marker, stores: group });

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
        kakao.maps.event.addListener(map, 'click', () => {
          onMapClickRef.current?.();
        });
        renderStores(map, storesRef.current, brandsRef.current, 8);
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
    renderStores(mapRef.current, stores, brands, mapZoom, highlightedStore?.id);
  }, [stores, brands, renderStores, mapZoom, highlightedStore]);

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

    // 도/시 경계선
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
    if (!mapRef.current) return;

    if (!selectedStoreId) {
      if (infoWindowRef.current) { infoWindowRef.current.setMap(null); infoWindowRef.current = null; }
      return;
    }

    const found = markersRef.current.find(({ stores }) => stores.some(s => s.id === selectedStoreId));
    if (!found) return;

    const store = found.stores.find(s => s.id === selectedStoreId)!;

    if (!store.name) return;

    mapRef.current.panTo(new kakao.maps.LatLng(store.lat, store.lng));

    const color = getStoreColor(store, brandsRef.current);
    const bubble = `<div style="background:${color};color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2)">${store.name}</div>`;

    if (infoWindowRef.current) infoWindowRef.current.setMap(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overlay = new (kakao.maps as any).CustomOverlay({
      content: makePopup(bubble),
      position: new kakao.maps.LatLng(store.lat, store.lng),
      yAnchor: 1,
      zIndex: 10,
    });
    overlay.setMap(mapRef.current);
    infoWindowRef.current = overlay;
  }, [selectedStoreId]);

  useEffect(() => {
    return () => clearOverlays();
  }, [clearOverlays]);

  return (
    <div ref={containerRef} id="kakao-map" className="w-full h-full" style={{ minHeight: '300px' }} />
  );
}
