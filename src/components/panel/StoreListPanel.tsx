'use client';
import { useState } from 'react';
import type { Store, Brand } from '@/types';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS_LABELS, getStoreColor } from '@/lib/map/markerStyles';

interface Props {
  stores: Store[];
  brands: Brand[];
  onSelectStore: (store: Store) => void;
  onClose: () => void;
}

const PROVINCE_OPTIONS = [
  '전체', '서울', '경기', '인천', '강원',
  '충북', '충남', '세종', '대전',
  '전북', '전남', '광주',
  '경북', '경남', '대구', '울산', '부산', '제주',
];

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

const PAGE_SIZE = 8;

export function StoreListPanel({ stores, brands, onSelectStore, onClose }: Props) {
  const [province, setProvince] = useState('전체');
  const [page, setPage] = useState(1);

  const filtered = province === '전체'
    ? stores
    : stores.filter(s => matchProvince(s.address, province));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleProvinceChange = (p: string) => {
    setProvince(p);
    setPage(1);
  };

  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-30 flex flex-col border-r border-gray-200">
      {/* 헤더 */}
      <div className="flex-none flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <span className="font-semibold text-gray-800 text-base flex-none">
          매장 목록
          <span className="text-gray-400 font-normal text-sm ml-1">({filtered.length}개)</span>
        </span>

        {/* 지역 선택 */}
        <select
          value={province}
          onChange={e => handleProvinceChange(e.target.value)}
          className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 text-gray-700 bg-white"
        >
          {PROVINCE_OPTIONS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <button onClick={onClose} className="flex-none p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* 목록 (스크롤 없음) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            매장이 없습니다
          </div>
        ) : (
          <>
            {paginated.map(store => {
              const color = getStoreColor(store, brands);
              return (
                <button
                  key={store.id}
                  onClick={() => onSelectStore(store)}
                  className="flex-1 text-left px-4 border-b border-gray-100 hover:bg-gray-50 transition-colors flex flex-col justify-center"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: color }} />
                    <span className="text-sm font-semibold text-gray-800 truncate flex-1">{store.name}</span>
                    <span
                      className="flex-none text-xs font-semibold text-white px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: color }}
                    >
                      {STATUS_LABELS[store.status]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 ml-5 truncate">{store.address || '-'}</div>
                </button>
              );
            })}
            {/* 빈 슬롯으로 높이 채우기 */}
            {paginated.length < PAGE_SIZE && Array.from({ length: PAGE_SIZE - paginated.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 border-b border-gray-50" />
            ))}
          </>
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="flex-none flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="p-1.5 text-gray-500 hover:text-gray-800 disabled:text-gray-200 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
            const pageNum = totalPages <= 5
              ? i + 1
              : currentPage <= 3
                ? i + 1
                : currentPage >= totalPages - 2
                  ? totalPages - 4 + i
                  : currentPage - 2 + i;
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-7 h-7 text-xs rounded-full font-medium transition-colors ${
                  currentPage === pageNum
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 text-gray-500 hover:text-gray-800 disabled:text-gray-200 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
