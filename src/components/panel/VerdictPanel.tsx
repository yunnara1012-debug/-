'use client';
import type { VerdictResult } from '@/types';
import { formatDistance } from '@/lib/geo/distance';
import { MapPin, X } from 'lucide-react';

interface Props {
  verdict: VerdictResult;
  onCreatePin: () => void;
  onClose: () => void;
}

export function VerdictPanel({ verdict, onCreatePin, onClose }: Props) {
  const { nearestStore, nearestDistance, searchAddress, region } = verdict;
  const locationLabel = searchAddress || region;

  return (
    <div className="absolute inset-x-0 bottom-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-80 bg-white shadow-2xl z-40 flex flex-col rounded-t-2xl md:rounded-none border-t md:border-l border-gray-200">
      {/* 모바일 핸들 */}
      <div className="flex-none pt-3 pb-1 flex justify-center md:hidden">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      {/* 헤더 */}
      <div className="flex-none px-4 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-start gap-3">
          <MapPin className="text-green-500 flex-none mt-0.5" size={22} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-700">검색 위치</div>
            {locationLabel && (
              <div className="text-xs text-gray-500 mt-0.5 truncate">{locationLabel}</div>
            )}
          </div>
          <button onClick={onClose} className="flex-none p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {nearestStore && nearestDistance !== undefined ? (
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1.5">가장 가까운 매장</div>
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-gray-400 flex-none" />
              <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{nearestStore.name}</span>
              <span className="text-sm text-gray-500 flex-none">{formatDistance(nearestDistance)}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-3">
            반경 2km 내 등록된 매장이 없습니다
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex-none px-4 py-3 border-t border-gray-100">
        <button
          onClick={onCreatePin}
          className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <MapPin size={15} />
          후보 핀 생성
        </button>
      </div>
    </div>
  );
}
