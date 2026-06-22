'use client';
import { useState, useCallback } from 'react';
import type { Brand, Store, ImportCandidate } from '@/types';
import { haversineDistance } from '@/lib/geo/distance';
import { X, Search, MapPin, AlertTriangle } from 'lucide-react';

interface Props {
  brands: Brand[];
  selectedBrandId: string;
  existingStores: Store[];
  onApprove: (store: Store) => void;
  onClose: () => void;
}

function detectDuplicate(
  candidate: Partial<ImportCandidate>,
  existing: Store[]
): { isDuplicate: boolean; store?: Store; reason?: string } {
  for (const store of existing) {
    if (candidate.placeId && store.placeId && candidate.placeId === store.placeId)
      return { isDuplicate: true, store, reason: 'place_id 동일' };

    if (
      candidate.phone &&
      store.phone &&
      candidate.phone.replace(/-/g, '') === store.phone.replace(/-/g, '')
    )
      return { isDuplicate: true, store, reason: '전화번호 동일' };

    if (candidate.lat && candidate.lng) {
      const dist = haversineDistance(candidate.lat, candidate.lng, store.lat, store.lng);
      if (dist < 100 && candidate.name) {
        const nameSimilar =
          candidate.name.includes(store.name.slice(0, 4)) ||
          store.name.includes((candidate.name ?? '').slice(0, 4));
        if (nameSimilar)
          return {
            isDuplicate: true,
            store,
            reason: `좌표 근접(${Math.round(dist)}m) + 이름 유사`,
          };
      }
    }
  }
  return { isDuplicate: false };
}

interface CandidateItem {
  id: string;
  placeId: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  duplicate?: { store: Store; reason: string };
  status: 'pending' | 'approved' | 'excluded';
}

export function ImportPanel({
  brands,
  selectedBrandId,
  existingStores,
  onApprove,
  onClose,
}: Props) {
  const [searching, setSearching] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [error, setError] = useState('');

  const selectedBrand = brands.find(b => b.id === selectedBrandId);
  const isAllBrand = selectedBrandId === 'all' || !selectedBrand;

  const handleSearch = useCallback(() => {
    if (typeof kakao === 'undefined') {
      setError('카카오 지도 SDK가 로드되지 않았습니다');
      return;
    }
    if (!keywordInput.trim()) {
      setError('검색어를 입력해주세요');
      return;
    }

    setSearching(true);
    setError('');
    setCandidates([]);

    // Free-form search — if a brand is selected and user didn't include brand name, prepend it
    let keyword = keywordInput.trim();
    if (!isAllBrand && selectedBrand && !keyword.toLowerCase().includes(selectedBrand.keyword.toLowerCase())) {
      keyword = `${selectedBrand.keyword} ${keyword}`;
    }

    const ps = new kakao.maps.services.Places();
    const allResults: kakao.maps.services.PlacesSearchResult[] = [];

    const processResults = (results: kakao.maps.services.PlacesSearchResult[]) => {
      const unique = results.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);
      const items: CandidateItem[] = unique.map(r => {
        const lat = parseFloat(r.y);
        const lng = parseFloat(r.x);
        const dup = detectDuplicate(
          { placeId: r.id, name: r.place_name, phone: r.phone, lat, lng },
          existingStores
        );
        return {
          id: r.id,
          placeId: r.id,
          name: r.place_name,
          phone: r.phone,
          address: r.road_address_name || r.address_name,
          lat,
          lng,
          duplicate:
            dup.isDuplicate && dup.store
              ? { store: dup.store, reason: dup.reason! }
              : undefined,
          status: 'pending' as const,
        };
      });
      setCandidates(items);
      setSearching(false);
    };

    const search = (page: number) => {
      ps.keywordSearch(
        keyword,
        (result, status, pagination) => {
          if (status === kakao.maps.services.Status.OK) {
            allResults.push(...result);
            if (!pagination.isEnd && page < 3) {
              search(page + 1);
            } else {
              processResults(allResults);
            }
          } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
            setError('검색 결과가 없습니다');
            setSearching(false);
          } else {
            setError('검색 오류가 발생했습니다');
            setSearching(false);
          }
        },
        { size: 15, page }
      );
    };

    search(1);
  }, [selectedBrand, isAllBrand, keywordInput, existingStores]);

  const handleApprove = (item: CandidateItem) => {
    const brandId = isAllBrand ? '' : selectedBrandId;
    const newStore: Store = {
      id: 'imported-' + Date.now() + '-' + item.placeId,
      placeId: item.placeId,
      name: item.name,
      phone: item.phone,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      status: 'open',
      brandIds: brandId ? [brandId] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onApprove(newStore);
    setCandidates(prev =>
      prev.map(c => (c.id === item.id ? { ...c, status: 'approved' } : c))
    );
  };



  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <div className="font-semibold text-gray-800">매장 불러오기</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {isAllBrand ? '카카오 장소 검색' : `${selectedBrand?.name} 카카오 검색`}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="flex-none px-4 py-3 border-b border-gray-100">
          <div className="flex gap-2">
            <input
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={isAllBrand ? '검색어 입력 (예: 호랑이족발 강남점)' : `지역·매장명 입력 (예: 강남, 송도점)`}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              <Search size={15} />
              {searching ? '검색중...' : '검색'}
            </button>
          </div>
          {!isAllBrand && keywordInput && !keywordInput.toLowerCase().includes(selectedBrand!.keyword.toLowerCase()) && (
            <div className="text-xs text-gray-400 mt-1">
              검색어: <span className="text-blue-500 font-medium">{selectedBrand?.keyword} {keywordInput}</span>
            </div>
          )}
          {error && <div className="text-xs text-red-500 mt-1.5">{error}</div>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {candidates.length === 0 && !searching && (
            <div className="text-center text-gray-400 text-sm py-12">
              검색어를 입력하고 검색해주세요
            </div>
          )}

          {searching && (
            <div className="text-center text-gray-400 text-sm py-12">검색 중...</div>
          )}

          {candidates.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-50">
              <span className="text-xs text-gray-500">{candidates.length}개 결과 — 핀 아이콘을 눌러 지도에 추가하세요</span>
            </div>
          )}

          {candidates.map(item => (
            <div
              key={item.id}
              className={`px-4 py-3 border-b border-gray-50 ${
                item.status === 'approved'
                  ? 'bg-green-50'
                  : item.status === 'excluded'
                  ? 'bg-gray-50 opacity-60'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800 truncate">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{item.address}</div>
                  {item.phone && (
                    <div className="text-xs text-gray-400 mt-0.5">{item.phone}</div>
                  )}
                  {item.duplicate && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                      <AlertTriangle size={11} className="flex-none" />
                      중복 의심: {item.duplicate.reason}
                    </div>
                  )}
                </div>
                <div className="flex-none flex items-center">
                  {item.status === 'pending' && (
                    <button
                      onClick={() => handleApprove(item)}
                      className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                      style={{ color: selectedBrand?.color ?? '#3B82F6' }}
                      title="지도에 추가"
                    >
                      <MapPin size={22} />
                    </button>
                  )}
                  {item.status === 'approved' && (
                    <MapPin size={18} style={{ color: selectedBrand?.color ?? '#3B82F6' }} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
