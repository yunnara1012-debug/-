'use client';
import type { Brand } from '@/types';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface Props {
  brands: Brand[];
  selectedBrandId: string;
  onSelect: (id: string) => void;
}

export function BrandSelector({ brands, selectedBrandId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedName = selectedBrandId === 'all'
    ? '전체'
    : (brands.find(b => b.id === selectedBrandId)?.name ?? '브랜드 선택');

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-md text-sm font-semibold truncate"
      >
        <span className="truncate">{selectedName}</span>
        <ChevronDown size={14} className="flex-none" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px]">
          <button
            onClick={() => { onSelect('all'); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-lg ${selectedBrandId === 'all' ? 'text-orange-600 font-semibold bg-orange-50' : 'text-gray-700'}`}
          >
            전체
          </button>
          {brands.map((b, i) => (
            <button
              key={b.id}
              onClick={() => { onSelect(b.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${i === brands.length - 1 ? 'rounded-b-lg' : ''} ${b.id === selectedBrandId ? 'text-orange-600 font-semibold bg-orange-50' : 'text-gray-700'}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
