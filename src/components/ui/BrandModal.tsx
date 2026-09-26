'use client';
import { useState } from 'react';
import type { Brand } from '@/types';
import { getStaticBrandLogoUrl } from '@/lib/map/brandLogos';
import { X } from 'lucide-react';

interface Props {
  initialBrand?: Brand;
  onSubmit: (name: string, logoUrl?: string) => void;
  onClose: () => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function BrandModal({ initialBrand, onSubmit, onClose }: Props) {
  const isEdit = !!initialBrand;
  const [name, setName] = useState(initialBrand?.name ?? '');
  const [logoPreview, setLogoPreview] = useState<string | undefined>(
    initialBrand ? (initialBrand.logoUrl ?? getStaticBrandLogoUrl(initialBrand)) : undefined
  );
  const [fileName, setFileName] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setLogoPreview(await readAsDataUrl(file));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), logoPreview);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">{isEdit ? '브랜드 수정' : '브랜드 추가'}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <label className="block text-xs text-gray-500 mb-1">브랜드 이름</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="예: 명가 들기름 김치찜"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 mb-4"
        />

        <label className="block text-xs text-gray-500 mb-1">로고 이미지 (선택)</label>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-full border border-gray-200 overflow-hidden bg-gray-50 flex-none flex items-center justify-center">
            {logoPreview
              ? <img src={logoPreview} alt="" className="w-full h-full object-contain" />
              : <span className="text-[10px] text-gray-400">없음</span>}
          </div>
          <label className="flex-1 flex items-center gap-2 min-w-0">
            <span className="flex-none px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg cursor-pointer transition-colors">
              파일 선택
            </span>
            {fileName && <span className="text-xs text-gray-500 truncate">{fileName}</span>}
            <input
              type="file"
              accept="image/*"
              onChange={e => handleFile(e.target.files?.[0])}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">취소</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
