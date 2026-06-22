'use client';
import type { VerdictResult } from '@/types';
import { formatDistance } from '@/lib/geo/distance';
import { CheckCircle, XCircle, MapPin, X } from 'lucide-react';

interface Props {
  verdict: VerdictResult;
  onCreatePin: () => void;
  onClose: () => void;
}

export function VerdictDisplay({ verdict, onCreatePin, onClose }: Props) {
  const { canOpen, nearestStore, nearestDistance, region } = verdict;

  return (
    <div className={`rounded-2xl shadow-xl border-2 p-4 bg-white ${canOpen ? 'border-green-400' : 'border-red-400'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {canOpen
            ? <CheckCircle className="text-green-500 flex-none" size={28} />
            : <XCircle className="text-red-500 flex-none" size={28} />
          }
          <div>
            <div className={`text-lg font-bold ${canOpen ? 'text-green-600' : 'text-red-600'}`}>
              출점 {canOpen ? '가능' : '불가능'}
            </div>
            {region && <div className="text-xs text-gray-500 mt-0.5">{region} 지역</div>}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-none">
          <X size={18} />
        </button>
      </div>

      {nearestStore && nearestDistance !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
          <MapPin size={14} className="text-gray-400 flex-none" />
          <span>가장 가까운 매장: <strong>{nearestStore.name}</strong> ({formatDistance(nearestDistance)})</span>
        </div>
      )}

      {!nearestStore && (
        <div className="mt-2 text-sm text-gray-500">등록된 매장이 없습니다</div>
      )}

      <button
        onClick={onCreatePin}
        className="mt-3 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
      >
        <MapPin size={15} />
        후보 핀 생성
      </button>
    </div>
  );
}
