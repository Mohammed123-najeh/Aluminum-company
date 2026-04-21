import React, { useEffect, useMemo, useState } from 'react';
import { LOW_STOCK_THRESHOLD_M } from '../../constants/inventory';
import { useApp } from '../../contexts/AppContext';
import { useStorehouse } from '../../hooks/useStorehouse';
import type { ApiInventoryItem, ApiProfile } from '../../services/api';
import { formatIls } from '../../utils/currency';

const PAGE_SIZE = 15;

type Props = {
  /** When omitted, supervisor and employee roles can manage stock lines. */
  canManageInventory?: boolean;
};

function filterInventory(
  items: ApiInventoryItem[],
  search: string,
  categoryFilter: string,
  colorFilter: string,
): ApiInventoryItem[] {
  let out = items;
  const q = search.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (i) =>
        (i.profileCode && i.profileCode.toLowerCase().includes(q)) ||
        (i.profileName && i.profileName.toLowerCase().includes(q)) ||
        (i.colorName && i.colorName.toLowerCase().includes(q)) ||
        (i.colorCode && i.colorCode.toLowerCase().includes(q)) ||
        (i.categoryName && i.categoryName.toLowerCase().includes(q)) ||
        (i.usage && i.usage.toLowerCase().includes(q)),
    );
  }
  if (categoryFilter) {
    out = out.filter((i) => i.categoryCode === categoryFilter);
  }
  if (colorFilter) {
    out = out.filter((i) => i.colorCode === colorFilter);
  }
  return out;
}

export const EmployeeInventory: React.FC<Props> = ({ canManageInventory }) => {
  const { t, currentUser } = useApp();
  const {
    categories,
    colors,
    profiles,
    inventory,
    loading,
    error,
    createInventoryItem,
    updateInventoryItem,
    updateProfileName,
    deleteInventoryItem,
    refetch,
  } = useStorehouse();

  const canManage =
    canManageInventory ?? (currentUser?.role === 'supervisor' || currentUser?.role === 'employee');

  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [colorFilter, setColorFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ApiInventoryItem | null>(null);
  /** Narrow profile list in the form; empty = all categories */
  const [formCategoryCode, setFormCategoryCode] = useState('');
  const [formProfileId, setFormProfileId] = useState<number | ''>('');
  const [formColorCode, setFormColorCode] = useState('');
  const [formQty, setFormQty] = useState('');
  /** Editable display name for the selected profile (updates catalog `profiles.name`). */
  const [formProfileName, setFormProfileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const profilesForForm = useMemo(() => {
    if (!formCategoryCode) return profiles;
    return profiles.filter((p) => p.categoryCode === formCategoryCode);
  }, [profiles, formCategoryCode]);

  const selectedProfile: ApiProfile | undefined = useMemo(
    () => profiles.find((p) => p.id === formProfileId),
    [profiles, formProfileId],
  );

  useEffect(() => {
    if (formProfileId === '') setFormProfileName('');
  }, [formProfileId]);

  const filtered = useMemo(
    () => filterInventory(inventory, search, categoryFilter, colorFilter),
    [inventory, search, categoryFilter, colorFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const displayList = useMemo(() => filtered.slice(start, start + PAGE_SIZE), [filtered, start]);

  const lowStockCount = useMemo(
    () => inventory.filter((i) => i.quantityM <= LOW_STOCK_THRESHOLD_M).length,
    [inventory],
  );

  const isLowStock = (i: ApiInventoryItem) => i.quantityM <= LOW_STOCK_THRESHOLD_M;

  const openAdd = () => {
    setEditItem(null);
    setFormCategoryCode('');
    setFormProfileId('');
    setFormProfileName('');
    setFormColorCode('');
    setFormQty('');
    setShowModal(true);
  };

  const openEdit = (item: ApiInventoryItem) => {
    setEditItem(item);
    setFormCategoryCode(item.categoryCode ?? '');
    setFormProfileId(item.profileId);
    setFormProfileName(item.profileName ?? '');
    setFormColorCode(item.colorCode);
    setFormQty(String(item.quantityM));
    setShowModal(true);
  };

  const onFormCategoryChange = (code: string) => {
    setFormCategoryCode(code);
    setFormProfileId((prev) => {
      if (prev === '') return prev;
      const p = profiles.find((x) => x.id === prev);
      if (!p) return '';
      if (!code || p.categoryCode === code) return prev;
      return '';
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(formQty);
    if (!Number.isFinite(qty) || qty < 0) return;
    if (formProfileId === '' || !formColorCode) return;
    const nameTrim = formProfileName.trim();
    if (!nameTrim) {
      alert(t('profileNameRequired'));
      return;
    }
    const pid = formProfileId as number;
    const prof = profiles.find((p) => p.id === pid);
    if (!prof) return;
    const payload = {
      profile_id: pid,
      color_code: formColorCode,
      quantity_m: qty,
    };
    setSaving(true);
    try {
      if (nameTrim !== prof.name) {
        await updateProfileName(pid, nameTrim);
      }
      if (editItem) {
        await updateInventoryItem(editItem.id, payload);
      } else {
        await createInventoryItem(payload);
      }
      closeModal();
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ApiInventoryItem) => {
    if (!window.confirm(t('inventoryDeleteConfirm'))) return;
    setDeletingId(item.id);
    try {
      await deleteInventoryItem(item.id);
      await refetch();
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="space-y-4">
      {lowStockCount > 0 && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          {t('lowStockBanner')
            .replace('{count}', String(lowStockCount))
            .replace('{threshold}', String(LOW_STOCK_THRESHOLD_M))}
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
        {canManage && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 md:order-2 md:w-auto md:shrink-0"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t('inventoryAddLine')}
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center md:order-1">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('searchInventoryPlaceholder')}
            className="min-w-[200px] flex-1 max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            {t('filterByCategory')}:
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t('allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.categoryCode}>
                  {c.categoryName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            {t('filterByColor')}:
            <select
              value={colorFilter}
              onChange={(e) => {
                setColorFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t('allColors')}</option>
              {colors.map((c) => (
                <option key={c.colorCode} value={c.colorCode}>
                  {c.name} ({c.colorCode})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">
            {inventory.length === 0 ? t('noInventoryItems') : t('noInventoryMatch')}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={openAdd}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('inventoryAddLine')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                    <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('category')}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('profile')}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('thicknessMm')}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('weightKgPerM')}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('usage')}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('color')}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('salesPricePerM')}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('quantityInStock')}</th>
                    {canManage && (
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('actionsCol')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-700 ${
                        isLowStock(item) ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">{item.categoryName ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                        <span className="font-medium">{item.profileCode}</span>
                        <span className="ml-1 text-slate-500 dark:text-slate-400">– {item.profileName}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">
                        {item.thicknessMm != null ? `${item.thicknessMm} mm` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">
                        {item.weightKgPerM != null ? `${item.weightKgPerM} kg/m` : '—'}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-slate-600 dark:text-slate-400" title={item.usage ?? undefined}>
                        {item.usage ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">
                        {item.colorName} ({item.colorCode})
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {item.unitPricePerM != null ? formatIls(item.unitPricePerM) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{item.quantityM} m</td>
                      {canManage && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              {t('edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item.id}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              {deletingId === item.id ? '…' : t('delete')}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('showingXToYOfZ')
                  .replace('{start}', String(start + 1))
                  .replace('{end}', String(Math.min(start + PAGE_SIZE, filtered.length)))
                  .replace('{total}', String(filtered.length))}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                >
                  {t('previous')}
                </button>
                <span className="px-2 text-sm text-slate-600 dark:text-slate-400">
                  {t('page')} {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                >
                  {t('next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showModal && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {editItem ? t('inventoryEditLine') : t('inventoryAddLine')}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('inventoryFormIntro')}</p>
            <form onSubmit={handleSaveModal} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('filterByCategory')}</label>
                <select
                  value={formCategoryCode}
                  onChange={(e) => onFormCategoryChange(e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t('allCategories')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.categoryCode}>
                      {c.categoryName}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{t('inventoryCategoryHint')}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('profile')}</label>
                <select
                  required
                  value={formProfileId === '' ? '' : String(formProfileId)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setFormProfileId('');
                      setFormProfileName('');
                      return;
                    }
                    const id = Number(v);
                    setFormProfileId(id);
                    const p = profiles.find((x) => x.id === id);
                    setFormProfileName(p?.name ?? '');
                  }}
                  className={inputCls}
                >
                  <option value="">{t('selectProfile')}</option>
                  {profilesForForm.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.profileId} – {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {formProfileId !== '' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('profileName')}</label>
                  <input
                    type="text"
                    required
                    value={formProfileName}
                    onChange={(e) => setFormProfileName(e.target.value)}
                    className={inputCls}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{t('inventoryProfileNameHint')}</p>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('color')}</label>
                <select
                  required
                  value={formColorCode}
                  onChange={(e) => setFormColorCode(e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t('selectColor')}</option>
                  {colors.map((c) => (
                    <option key={c.colorCode} value={c.colorCode}>
                      {c.name} ({c.colorCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('quantityM')}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  className={inputCls}
                />
              </div>
              {selectedProfile && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('inventoryProductPreview')}
                  </p>
                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[10px] font-medium uppercase text-slate-400">{t('category')}</dt>
                      <dd className="text-slate-800 dark:text-slate-200">{selectedProfile.categoryName ?? selectedProfile.categoryCode}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase text-slate-400">{t('profile')}</dt>
                      <dd className="text-slate-800 dark:text-slate-200">
                        {selectedProfile.profileId} – {formProfileName.trim() || selectedProfile.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase text-slate-400">{t('thicknessMm')}</dt>
                      <dd className="text-slate-800 dark:text-slate-200">
                        {selectedProfile.thicknessMm != null ? `${selectedProfile.thicknessMm} mm` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase text-slate-400">{t('weightKgPerM')}</dt>
                      <dd className="text-slate-800 dark:text-slate-200">
                        {selectedProfile.weightKgPerM != null ? `${selectedProfile.weightKgPerM} kg/m` : '—'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase text-slate-400">{t('usage')}</dt>
                      <dd className="text-slate-700 dark:text-slate-300">{selectedProfile.usage ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? '…' : t('saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
