'use client';
import { useState, useEffect } from 'react';
import type { Store, Brand, StoreStatus } from '@/types';
import { STATUS_LABELS, getStoreColor } from '@/lib/map/markerStyles';
import { haversineDistance, formatDistance } from '@/lib/geo/distance';
import { X, Phone, Edit3, Trash2, Check, MapPin, Loader2 } from 'lucide-react';

interface Props {
  store: Store;
  brands: Brand[];
  allStores: Store[];
  onUpdate: (store: Store) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const STATUSES: StoreStatus[] = ['open', 'contracted', 'consulting', 'closed', 'candidate'];

function computeCanOpen(store: Store, allStores: Store[]): { canOpen: boolean; nearestDistance?: number; nearestName?: string } {
  const others = allStores.filter(
    s => s.id !== store.id && s.brandIds.some(b => store.brandIds.includes(b)) && ['open', 'contracted', 'consulting'].includes(s.status)
  );
  if (others.length === 0) return { canOpen: true };
  let nearest = Infinity;
  let nearestName = '';
  for (const o of others) {
    const d = haversineDistance(store.lat, store.lng, o.lat, o.lng);
    if (d < nearest) { nearest = d; nearestName = o.name; }
  }
  return { canOpen: nearest >= 2000, nearestDistance: nearest, nearestName };
}

function formatPhone(value: string): string {
  const raw = value.replace(/\D/g, '');

  // 02 서울 지역번호 (최대 10자리)
  if (raw.startsWith('02')) {
    const d = raw.slice(0, 10);
    if (d.length <= 5) return d.replace(/(\d{2})(\d+)/, '$1-$2');
    if (d.length <= 9) return d.replace(/(\d{2})(\d{3,4})(\d+)/, '$1-$2-$3');
    return d.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  // 050X 인터넷 가상번호 (0504, 0507 등 — 4자리 지역코드, 최대 12자리)
  if (raw.startsWith('050')) {
    const d = raw.slice(0, 12);
    if (d.length <= 4) return d;
    if (d.length <= 7) return d.replace(/(\d{4})(\d+)/, '$1-$2');
    if (d.length <= 11) return d.replace(/(\d{4})(\d{3})(\d+)/, '$1-$2-$3');
    return d.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  // 나머지 (010, 070 등 — 3자리 지역코드, 최대 11자리)
  const d = raw.slice(0, 11);
  if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, '$1-$2');
  if (d.length <= 10) return d.replace(/(\d{3})(\d{3,4})(\d+)/, '$1-$2-$3');
  return d.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const kakao: any;

function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!address || typeof kakao === 'undefined') { resolve(null); return; }
    const geocoder = new kakao.maps.services.Geocoder();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocoder.addressSearch(address, (result: any[], status: kakao.maps.services.Status) => {
      if (status === kakao.maps.services.Status.OK && result.length > 0) {
        resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
      } else {
        // 주소 검색 실패 시 키워드 검색 시도
        const ps = new kakao.maps.services.Places();
        ps.keywordSearch(address, (places: kakao.maps.services.PlacesSearchResult[], pStatus: kakao.maps.services.Status) => {
          if (pStatus === kakao.maps.services.Status.OK && places.length > 0) {
            resolve({ lat: parseFloat(places[0].y), lng: parseFloat(places[0].x) });
          } else {
            resolve(null);
          }
        });
      }
    });
  });
}

export function StorePanel({ store, brands, allStores, onUpdate, onDelete, onClose }: Props) {
  const isNew = store.name === '';
  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState<Store>({ ...store });
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    setForm({ ...store });
    setEditing(store.name === '');
  }, [store.id, store]);

  const { canOpen, nearestDistance, nearestName } = computeCanOpen(form, allStores);
  const storeColor = getStoreColor(form, brands);

  const handleGeocode = async () => {
    if (!form.address) return;
    setGeocoding(true);
    const coords = await geocodeAddress(form.address);
    setGeocoding(false);
    if (coords) {
      setForm(prev => ({ ...prev, lat: coords.lat, lng: coords.lng }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    let updated = { ...form, updatedAt: new Date().toISOString() };

    // 주소가 변경됐으면 좌표 자동 갱신 → 핀이 새 주소로 이동
    if (form.address && form.address !== store.address) {
      const coords = await geocodeAddress(form.address);
      if (coords) {
        updated = { ...updated, lat: coords.lat, lng: coords.lng };
      }
    }

    onUpdate(updated);
    setEditing(false);
    setSaving(false);
  };

  const handleCancel = () => {
    if (isNew) { onDelete(store.id); onClose(); return; }
    setForm({ ...store });
    setEditing(false);
  };

  const set = (key: keyof Store, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleBrand = (brandId: string) => {
    const ids = form.brandIds.includes(brandId)
      ? form.brandIds.filter(id => id !== brandId)
      : [...form.brandIds, brandId];
    set('brandIds', ids);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-80 bg-white shadow-2xl z-40 flex flex-col rounded-t-2xl md:rounded-none border-t md:border-l border-gray-200">
      {/* 모바일 핸들 */}
      <div className="flex-none pt-3 pb-1 flex justify-center md:hidden">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      {/* 헤더 */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
          <div className="w-3 h-3 rounded-full flex-none" style={{ backgroundColor: storeColor }} />
          {editing ? (
            <input
              autoFocus={isNew}
              value={form.name}
              onChange={e => {
                const newName = e.target.value;
                const autoIds = brands
                  .filter(b => b.keyword && newName.includes(b.keyword))
                  .map(b => b.id);
                setForm(prev => ({
                  ...prev,
                  name: newName,
                  brandIds: autoIds.length > 0
                    ? [...new Set([...prev.brandIds, ...autoIds])]
                    : prev.brandIds,
                }));
              }}
              placeholder="지점명 입력"
              className="flex-1 min-w-0 font-semibold text-gray-800 text-base outline-none bg-transparent border-b border-gray-300 focus:border-blue-400"
            />
          ) : (
            <span className="font-semibold text-gray-800 text-base truncate">
              {form.name || '새 매장'}
            </span>
          )}
        </div>
        <div className="flex items-center flex-none">
          <button onClick={() => { if (isNew) onDelete(store.id); onClose(); }} className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 고정 필드 */}
        <div className="flex-none overflow-y-auto px-4 py-3 space-y-3 max-h-[60%]">

          {/* 상태 + 오픈일 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">상태</label>
              {editing ? (
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value as StoreStatus)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              ) : (
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: storeColor }}>
                    {STATUS_LABELS[form.status]}
                  </span>
                  {form.status === 'candidate' && (
                    <div className={`text-xs font-semibold mt-1 ${canOpen ? 'text-green-600' : 'text-red-600'}`}>
                      출점 {canOpen ? '가능' : '불가'}
                      {!canOpen && nearestName && nearestDistance !== undefined && (
                        <span className="font-normal ml-1">— {nearestName} {formatDistance(nearestDistance)}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">오픈일</label>
              {editing ? (
                <input type="date" value={form.openDate ?? ''} onChange={e => set('openDate', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400" />
              ) : (
                <div className="text-sm text-gray-800">{form.openDate || '-'}</div>
              )}
            </div>
          </div>

          {/* 점주명 + 전화번호 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">점주명</label>
              {editing ? (
                <input value={form.contactName ?? ''} onChange={e => set('contactName', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400" placeholder="이름" />
              ) : (
                <div className="text-sm text-gray-800">{form.contactName || '-'}</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">전화번호</label>
              {editing ? (
                <input value={form.phone ?? ''} onChange={e => set('phone', formatPhone(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400" placeholder="전화번호" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-800">{form.phone || '-'}</span>
                  {form.phone && <a href={`tel:${form.phone}`} className="text-blue-500 hover:text-blue-600"><Phone size={13} /></a>}
                </div>
              )}
            </div>
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">주소 / 희망지역</label>
            {editing ? (
              <div className="flex gap-1.5">
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400" placeholder="주소 또는 희망지역" />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding || !form.address}
                  title="주소로 핀 위치 갱신"
                  className="flex-none px-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded-lg transition-colors disabled:opacity-40"
                >
                  {geocoding ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-800">{form.address || '-'}</div>
            )}
          </div>

          {/* 브랜드 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">브랜드</label>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {brands.map(b => (
                  <label key={b.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.brandIds.includes(b.id)} onChange={() => toggleBrand(b.id)} className="rounded" />
                    {b.name}
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {form.brandIds.map(id => {
                  const brand = brands.find(b => b.id === id);
                  return brand ? (
                    <span key={id} className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">{brand.name}</span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* 유입경로 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">유입경로</label>
            {editing ? (
              <input value={form.inflowSource ?? ''} onChange={e => set('inflowSource', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400" placeholder="예: 지인 소개, SNS" />
            ) : (
              <div className="text-sm text-gray-800">{form.inflowSource || '-'}</div>
            )}
          </div>
        </div>

        {/* 메모 — 나머지 공간 채우기 */}
        <div className="flex-1 flex flex-col px-4 py-3 min-h-0 border-t border-gray-100">
          <label className="block text-xs text-gray-500 mb-1 flex-none">메모</label>
          {editing ? (
            <textarea value={form.memo ?? ''} onChange={e => set('memo', e.target.value)}
              className="flex-1 min-h-0 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 resize-none" placeholder="메모" />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto text-sm text-gray-800 whitespace-pre-wrap">{form.memo || '-'}</div>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      {editing ? (
        <div className="flex-none flex gap-2 px-4 py-3 border-t border-gray-100">
          <button onClick={handleCancel} disabled={saving} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
            취소
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1 disabled:opacity-70">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? '저장 중...' : '완료'}
          </button>
        </div>
      ) : (
        <div className="flex-none px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={() => { if (confirm('삭제할까요?')) onDelete(store.id); }}
            className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1"
          >
            <Trash2 size={15} />삭제
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1"
          >
            <Edit3 size={15} />수정
          </button>
        </div>
      )}
    </div>
  );
}
