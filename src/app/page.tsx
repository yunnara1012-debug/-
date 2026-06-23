'use client';

import { useState, useCallback, useEffect } from 'react';
import { INITIAL_BRANDS, INITIAL_STORES } from '@/data/initialData';
import type { Brand, Store, VerdictResult, StoreStatus } from '@/types';
import { loadBrands, loadStores, upsertBrand, upsertBrands, upsertStore, upsertStores, deleteStore as dbDeleteStore } from '@/lib/supabase/db';
import { STATUS_LABELS } from '@/lib/map/markerStyles';
import { KakaoMap } from '@/components/map/KakaoMap';
import { BrandSelector } from '@/components/ui/BrandSelector';
import { SearchBar } from '@/components/search/SearchBar';
import { VerdictPanel } from '@/components/panel/VerdictPanel';
import { StorePanel } from '@/components/panel/StorePanel';
import { StoreListPanel } from '@/components/panel/StoreListPanel';
import { ImportPanel } from '@/components/panel/ImportPanel';
import { Download, Store as StoreIcon, List, MoreVertical, Plus, SlidersHorizontal, X } from 'lucide-react';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const BRAND_COLORS = ['#7C3AED', '#059669', '#D97706', '#C026D3', '#0284C7', '#0D9488'];

const PROVINCES = ['서울', '경기', '인천', '강원', '충북', '충남', '세종', '대전', '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주'];

const STORE_STATUSES: StoreStatus[] = ['open', 'contracted', 'consulting', 'candidate', 'closed'];

const PROVINCE_PREFIXES: Record<string, string[]> = {
  '서울': ['서울'], '경기': ['경기'], '인천': ['인천'], '강원': ['강원'],
  '충북': ['충북', '충청북'], '충남': ['충남', '충청남'],
  '세종': ['세종'], '대전': ['대전'],
  '전북': ['전북', '전라북'], '전남': ['전남', '전라남'],
  '광주': ['광주'], '경북': ['경북', '경상북'], '경남': ['경남', '경상남'],
  '대구': ['대구'], '울산': ['울산'], '부산': ['부산'], '제주': ['제주'],
};

function matchProvince(address: string, province: string): boolean {
  const prefixes = PROVINCE_PREFIXES[province];
  if (!prefixes) return false;
  const first = address.trim().split(/\s+/)[0] ?? '';
  return prefixes.some(p => first.startsWith(p));
}

export default function Home() {
  const [brands, setBrands] = useState<Brand[]>(() => {
    const saved = loadFromStorage<Brand[]>('fm-brands', INITIAL_BRANDS);
    return saved.map(b => ({ ...b, color: b.color ?? INITIAL_BRANDS.find(ib => ib.id === b.id)?.color }));
  });
  const [stores, setStores] = useState<Store[]>(() => loadFromStorage('fm-stores', INITIAL_STORES));
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [showStoreList, setShowStoreList] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterProvince, setFilterProvince] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<StoreStatus[]>([]);

  useEffect(() => { localStorage.setItem('fm-stores', JSON.stringify(stores)); }, [stores]);
  useEffect(() => { localStorage.setItem('fm-brands', JSON.stringify(brands)); }, [brands]);

  // Supabase 초기 로드: 클라우드 데이터가 있으면 덮어씀, 없으면 로컬 데이터를 Supabase로 마이그레이션
  useEffect(() => {
    async function init() {
      const [sbBrands, sbStores] = await Promise.all([loadBrands(), loadStores()]);

      if (sbBrands !== null) {
        if (sbBrands.length > 0) {
          setBrands(sbBrands.map(b => ({ ...b, color: b.color ?? INITIAL_BRANDS.find(ib => ib.id === b.id)?.color })));
        } else {
          const local = loadFromStorage<Brand[]>('fm-brands', INITIAL_BRANDS)
            .map(b => ({ ...b, color: b.color ?? INITIAL_BRANDS.find(ib => ib.id === b.id)?.color }));
          await upsertBrands(local);
        }
      }

      if (sbStores !== null) {
        if (sbStores.length > 0) {
          setStores(sbStores);
        } else {
          const local = loadFromStorage<Store[]>('fm-stores', INITIAL_STORES);
          await upsertStores(local);
        }
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBrandStores = selectedBrandId === 'all'
    ? stores
    : stores.filter(s => s.brandIds.includes(selectedBrandId));

  const displayedStores = selectedBrandStores.filter(s => {
    if (filterProvince && !matchProvince(s.address, filterProvince)) return false;
    if (filterStatuses.length > 0 && !filterStatuses.includes(s.status)) return false;
    return true;
  });

  const activeFilterCount = (filterProvince ? 1 : 0) + filterStatuses.length;

  const toggleStatusFilter = (status: StoreStatus) => {
    setFilterStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setFilterProvince('');
    setFilterStatuses([]);
  };

  const handleVerdict = useCallback((result: VerdictResult) => {
    setVerdict(result);
    setSelectedStore(null);
  }, []);

  const handleStoreClick = useCallback((store: Store) => {
    setSelectedStore(store);
    setVerdict(null);
    if (typeof window !== 'undefined' && window.innerWidth < 768) setShowStoreList(false);
  }, []);

  const handleAddStore = useCallback(() => {
    const brandId = selectedBrandId === 'all' ? null : selectedBrandId;
    const newStore: Store = {
      id: 'new-' + Date.now(),
      name: '',
      address: verdict?.searchAddress ?? verdict?.region ?? '',
      lat: verdict?.searchLat ?? 37.5665,
      lng: verdict?.searchLng ?? 126.9780,
      status: 'candidate',
      brandIds: brandId ? [brandId] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStores(prev => [...prev, newStore]);
    setSelectedStore(newStore);
    setVerdict(null);
  }, [verdict, selectedBrandId, brands]);

  const handleStoreUpdate = useCallback((updated: Store) => {
    setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedStore(updated);
    upsertStore(updated);
  }, []);

  const handleStoreDelete = useCallback((id: string) => {
    setStores(prev => prev.filter(s => s.id !== id));
    setSelectedStore(null);
    dbDeleteStore(id);
  }, []);

  const handleAddBrand = useCallback(() => {
    const name = prompt('브랜드 이름을 입력하세요:');
    if (!name?.trim()) return;
    setBrands(prev => {
      const color = BRAND_COLORS[prev.length % BRAND_COLORS.length];
      const brand = { id: 'brand-' + Date.now(), name: name.trim(), keyword: name.trim(), color };
      upsertBrand(brand);
      return [...prev, brand];
    });
    setShowMore(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedStore(null);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Top Bar */}
      <header className="flex-none bg-white border-b border-gray-200 shadow-sm z-50">
        {/* 메인 행 */}
        <div className="flex items-center gap-1.5 px-3 py-2">
          {/* 브랜드 선택 */}
          <div className="w-28 md:w-44 flex-none">
            <BrandSelector brands={brands} selectedBrandId={selectedBrandId} onSelect={setSelectedBrandId} />
          </div>

          {/* 검색창 - 데스크톱만 */}
          <div className="hidden md:block flex-1 min-w-0">
            <SearchBar stores={selectedBrandStores} onVerdict={handleVerdict} />
          </div>

          {/* 모바일 스페이서 */}
          <div className="flex-1 md:hidden" />

          {/* 필터 버튼 */}
          <button
            onClick={() => setShowFilter(v => !v)}
            className={`relative flex items-center gap-1 px-2 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${showFilter || activeFilterCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
          >
            <SlidersHorizontal size={12} />
            <span className="hidden sm:inline">필터</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* 목록보기 */}
          <button
            onClick={() => setShowStoreList(v => !v)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${showStoreList ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
          >
            <List size={12} />
            <span className="hidden sm:inline">{showStoreList ? '목록접기' : '목록보기'}</span>
          </button>

          {/* 매장 추가 */}
          <button
            onClick={handleAddStore}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors whitespace-nowrap"
          >
            <StoreIcon size={12} />
            <span className="hidden sm:inline">매장</span>
          </button>

          {/* 불러오기 - 데스크톱만 */}
          <button
            onClick={() => setShowImportPanel(true)}
            className="hidden md:flex items-center gap-1 px-2 py-1.5 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md font-medium transition-colors whitespace-nowrap"
          >
            <Download size={12} />
            불러오기
          </button>

          {/* 더보기 */}
          <div className="relative">
            <button
              onClick={() => setShowMore(v => !v)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px]">
                <button
                  onClick={handleAddBrand}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <Plus size={13} />
                  브랜드 추가
                </button>
                <button
                  onClick={() => { setShowImportPanel(true); setShowMore(false); }}
                  className="md:hidden w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <Download size={13} />
                  불러오기
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 검색창 - 모바일만 */}
        <div className="md:hidden px-3 pb-2">
          <SearchBar stores={selectedBrandStores} onVerdict={handleVerdict} />
        </div>

        {/* 필터 행 */}
        {showFilter && (
          <div className="px-3 pb-2 space-y-2 border-t border-gray-100 pt-2 relative">
            {/* 필터 닫기 X */}
            <button
              onClick={() => setShowFilter(false)}
              className="absolute right-3 top-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="필터 닫기"
            >
              <X size={14} />
            </button>

            {/* 지역 필터 */}
            <div className="flex items-center gap-2 pr-6">
              <span className="flex-none text-xs text-gray-500 font-medium w-7">지역</span>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
                <button
                  onClick={() => setFilterProvince('')}
                  className={`flex-none px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                    filterProvince === '' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {PROVINCES.map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterProvince(prev => prev === p ? '' : p)}
                    className={`flex-none px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                      filterProvince === p
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 상태 필터 */}
            <div className="flex items-center gap-2 pr-6">
              <span className="flex-none text-xs text-gray-500 font-medium w-7">상태</span>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
                <button
                  onClick={() => setFilterStatuses([])}
                  className={`flex-none px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                    filterStatuses.length === 0 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {STORE_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleStatusFilter(s)}
                    className={`flex-none px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                      filterStatuses.includes(s)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex-none flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <X size={13} />
                  초기화
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 지도 영역 */}
      <main className="flex-1 relative overflow-hidden">
        <KakaoMap
          stores={displayedStores}
          brands={brands}
          selectedBrandId={selectedBrandId}
          verdict={verdict}
          selectedStoreId={selectedStore?.id}
          onStoreClick={handleStoreClick}
          onMapClick={handleClosePanel}
        />

        {/* Verdict Panel */}
        {verdict && !selectedStore && (
          <VerdictPanel
            verdict={verdict}
            onCreatePin={handleAddStore}
            onClose={() => setVerdict(null)}
          />
        )}

        {/* Store List Panel */}
        {showStoreList && (
          <StoreListPanel
            stores={displayedStores}
            brands={brands}
            onSelectStore={(store) => { setSelectedStore(store); setVerdict(null); }}
            onClose={() => setShowStoreList(false)}
          />
        )}

        {/* Store Panel */}
        {selectedStore && (
          <StorePanel
            store={selectedStore}
            brands={brands}
            allStores={stores}
            onUpdate={handleStoreUpdate}
            onDelete={handleStoreDelete}
            onClose={handleClosePanel}
          />
        )}
      </main>

      {/* Import Panel */}
      {showImportPanel && (
        <ImportPanel
          brands={brands}
          selectedBrandId={selectedBrandId}
          existingStores={stores}
          onApprove={(store) => { setStores(prev => [...prev, store]); upsertStore(store); }}
          onClose={() => setShowImportPanel(false)}
        />
      )}
    </div>
  );
}
