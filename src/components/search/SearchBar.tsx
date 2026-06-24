'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { Store, VerdictResult } from '@/types';
import { haversineDistance } from '@/lib/geo/distance';
import { Search, X, Building2, MapPin } from 'lucide-react';

interface Props {
  stores: Store[];
  onVerdict: (result: VerdictResult) => void;
  onSelectStore?: (store: Store) => void;
}

interface Suggestion {
  type: 'store' | 'place';
  placeName: string;
  address: string;
  lat: number;
  lng: number;
  store?: Store;
}

export function SearchBar({ stores, onVerdict, onSelectStore }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchKakao = useCallback(async (q: string): Promise<Suggestion[]> => {
    if (!q.trim() || typeof kakao === 'undefined') return [];

    // "경기 군포" → "경기도 군포" 처럼 도 약어 자동 확장
    const expand = (s: string) => s
      .replace(/^경기(\s|$)/, '경기도$1')
      .replace(/^강원(\s|$)/, '강원도$1')
      .replace(/^충북(\s|$)/, '충청북도$1')
      .replace(/^충남(\s|$)/, '충청남도$1')
      .replace(/^전북(\s|$)/, '전라북도$1')
      .replace(/^전남(\s|$)/, '전라남도$1')
      .replace(/^경북(\s|$)/, '경상북도$1')
      .replace(/^경남(\s|$)/, '경상남도$1')
      .replace(/^제주(\s|$)/, '제주특별자치도$1');

    const normalized = expand(q.trim());

    return new Promise((resolve) => {
      const geocoder = new kakao.maps.services.Geocoder();
      const ps = new kakao.maps.services.Places();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toAddrSugg = (results: any[]) =>
        results.slice(0, 5).map(r => ({
          type: 'place' as const,
          placeName: r.address_name,
          address: r.road_address?.address_name ?? r.address_name,
          lat: parseFloat(r.y),
          lng: parseFloat(r.x),
        }));

      // 키워드 결과 중 주소에 검색어 토큰이 포함된 것만 사용 (엉뚱한 지역 차단)
      const toSugg = (places: kakao.maps.services.PlacesSearchResult[], queryTokens: string[]) => {
        const filtered = places.filter(p => {
          const addr = (p.address_name || p.road_address_name || '').toLowerCase();
          return queryTokens.some(t => t.length >= 2 && addr.includes(t));
        });
        return (filtered.length > 0 ? filtered : places).slice(0, 5).map(p => ({
          type: 'place' as const,
          placeName: p.place_name,
          address: p.road_address_name || p.address_name,
          lat: parseFloat(p.y),
          lng: parseFloat(p.x),
        }));
      };

      const normTokens = normalized.toLowerCase().split(/\s+/);

      const tryKeyword = (keyword: string, fallbackKeyword?: string) => {
        ps.keywordSearch(keyword, (places, pStatus) => {
          if (pStatus === kakao.maps.services.Status.OK && places.length > 0) {
            const sugg = toSugg(places, normTokens);
            if (sugg.length > 0) { resolve(sugg); return; }
          }
          if (fallbackKeyword) {
            tryKeyword(fallbackKeyword);
          } else {
            resolve([]);
          }
        });
      };

      // 1) 정규화된 주소로 addressSearch
      geocoder.addressSearch(normalized, (result, status) => {
        if (status === kakao.maps.services.Status.OK && result.length > 0) {
          resolve(toAddrSugg(result));
        } else if (normalized !== q.trim()) {
          // 2) 원본 그대로 addressSearch
          geocoder.addressSearch(q.trim(), (result2, status2) => {
            if (status2 === kakao.maps.services.Status.OK && result2.length > 0) {
              resolve(toAddrSugg(result2));
            } else {
              // 3) 키워드 검색 (정규화 → 마지막 토큰 순)
              const last = normTokens[normTokens.length - 1];
              tryKeyword(normalized, last !== normalized ? last : undefined);
            }
          });
        } else {
          const last = normTokens[normTokens.length - 1];
          tryKeyword(normalized, last !== normalized ? last : undefined);
        }
      });
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = query.trim().toLowerCase();
      const storeMatches: Suggestion[] = stores
        .filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          (s.contactName ?? '').toLowerCase().includes(q)
        )
        .slice(0, 4)
        .map(s => ({ type: 'store' as const, placeName: s.name || s.contactName || '', address: s.address, lat: s.lat, lng: s.lng, store: s }));

      const kakaoResults = await searchKakao(query);
      const all = [...storeMatches, ...kakaoResults].slice(0, 7);
      setSuggestions(all);
      setShowSuggestions(all.length > 0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchKakao, stores]);

  const executeVerdict = useCallback((lat: number, lng: number, placeName?: string, address?: string) => {
    setLoading(true);
    setShowSuggestions(false);

    const activeStores = stores.filter(s => ['open', 'contracted', 'consulting'].includes(s.status));
    let nearestStore: Store | undefined;
    let nearestDistance = Infinity;

    for (const store of activeStores) {
      const dist = haversineDistance(lat, lng, store.lat, store.lng);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestStore = store;
      }
    }

    const canOpen = nearestDistance >= 2000;
    const searchAddress = address ?? placeName;

    if (typeof kakao === 'undefined') {
      onVerdict({ canOpen, nearestStore, nearestDistance: nearestDistance === Infinity ? undefined : nearestDistance, searchLat: lat, searchLng: lng, searchAddress });
      setLoading(false);
      return;
    }

    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2RegionCode(lng, lat, (result, status) => {
      const region = status === kakao.maps.services.Status.OK
        ? result.find(r => r.region_type === 'H')?.region_1depth_name ?? result[0]?.region_1depth_name
        : undefined;
      onVerdict({
        canOpen,
        nearestStore,
        nearestDistance: nearestDistance === Infinity ? undefined : nearestDistance,
        searchLat: lat,
        searchLng: lng,
        region,
        searchAddress,
      });
      setLoading(false);
    });
  }, [stores, onVerdict]);

  const handleSelectSuggestion = useCallback((s: Suggestion) => {
    setQuery(s.placeName || s.address);
    setSuggestions([]);
    setShowSuggestions(false);
    if (s.type === 'store' && s.store && onSelectStore) {
      onSelectStore(s.store);
    } else {
      executeVerdict(s.lat, s.lng, s.placeName, s.address);
    }
  }, [onSelectStore, executeVerdict]);

  const handleSearch = () => {
    if (!query.trim()) return;
    clearTimeout(debounceRef.current);
    const current = suggestions;
    setSuggestions([]);
    setShowSuggestions(false);
    if (current.length > 0) {
      handleSelectSuggestion(current[0]);
      return;
    }
    // debounce 전 엔터 대비: Kakao 검색 전에 매장/점주명 매칭 먼저 확인
    const q = query.trim().toLowerCase();
    const matched = stores.find(s =>
      s.name.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      (s.contactName ?? '').toLowerCase().includes(q)
    );
    if (matched) {
      handleSelectSuggestion({ type: 'store', placeName: matched.name || matched.contactName || '', address: matched.address, lat: matched.lat, lng: matched.lng, store: matched });
      return;
    }
    setLoading(true);
    searchKakao(query).then(results => {
      if (results.length > 0) handleSelectSuggestion(results[0]);
      else setLoading(false);
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="주소, 지역, 장소 검색..."
          className="flex-1 px-4 py-3 text-sm outline-none bg-transparent"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSuggestions([]); }} className="p-2 text-gray-400">
            <X size={16} />
          </button>
        )}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-3 bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          <Search size={18} />
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-72 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelectSuggestion(s)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-3 ${
                s.type === 'store' ? 'bg-blue-50/40' : ''
              }`}
            >
              <div className={`flex-none mt-0.5 p-1 rounded ${s.type === 'store' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                {s.type === 'store'
                  ? <Building2 size={12} className="text-blue-600" />
                  : <MapPin size={12} className="text-gray-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{s.placeName}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{s.address}</div>
              </div>
              {s.type === 'store' && (
                <span className="flex-none text-xs font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">지점</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
