'use client';
import type { Brand } from '@/types';
import { getStaticBrandLogoUrl } from '@/lib/map/brandLogos';
import { X, Pencil } from 'lucide-react';

interface Props {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
  onClose: () => void;
}

export function BrandManagePanel({ brands, onEdit, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-none flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">브랜드 관리</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
          {brands.map(brand => {
            const logoUrl = brand.logoUrl ?? getStaticBrandLogoUrl(brand);
            return (
              <div key={brand.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-10 h-10 rounded-full border border-gray-200 overflow-hidden bg-gray-50 flex-none flex items-center justify-center">
                  {logoUrl
                    ? <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                    : <span className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.color }} />}
                </div>
                <span className="flex-1 text-sm text-gray-700 truncate">{brand.name}</span>
                <button
                  onClick={() => onEdit(brand)}
                  className="flex-none p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="수정"
                >
                  <Pencil size={15} />
                </button>
              </div>
            );
          })}
          {brands.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-6">등록된 브랜드가 없습니다</div>
          )}
        </div>
      </div>
    </div>
  );
}
