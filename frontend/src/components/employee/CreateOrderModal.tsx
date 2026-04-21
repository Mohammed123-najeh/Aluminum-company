import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../contexts/AppContext';
import type { ApiProfile, ApiColor, ApiInventoryItem, CreateOrderPayload } from '../../services/api';
import { formatIls } from '../../utils/currency';

type LineItem = {
  profileId: number;
  profileCode: string;
  profileName: string;
  colorCode: string;
  colorName: string;
  quantityM: number;
  unitPricePerM?: number;
};

type ProductOption = {
  value: string;
  profileId: number;
  profileCode: string;
  profileName: string;
  colorCode: string;
  colorName: string;
  categoryName: string;
};

type Props = {
  profiles: ApiProfile[];
  colors: ApiColor[];
  /** Stock lines with list prices (optional; improves estimates in the picker). */
  inventory?: ApiInventoryItem[];
  onSubmit: (payload: CreateOrderPayload) => Promise<unknown>;
  onClose: () => void;
  /** When creating an order from My Tasks, the backend links this task to the new order. */
  taskIdToLink?: string | null;
  linkedTaskTitle?: string | null;
};

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

const LIST_CAP = 120;

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function invKey(profileId: number, colorCode: string) {
  return `${profileId}|${colorCode}`;
}

export const CreateOrderModal: React.FC<Props> = ({
  profiles,
  colors,
  inventory = [],
  onSubmit,
  onClose,
  taskIdToLink,
  linkedTaskTitle,
}) => {
  const { t } = useApp();
  const [customerReference, setCustomerReference] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantityM, setQuantityM] = useState<string>('');
  const [productQuery, setProductQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [productOpen, setProductOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLUListElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const priceByProfileColor = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of inventory) {
      if (row.unitPricePerM == null || !Number.isFinite(row.unitPricePerM)) continue;
      m.set(invKey(row.profileId, row.colorCode), row.unitPricePerM);
    }
    return m;
  }, [inventory]);

  const unitPriceFor = (profileId: number, colorCode: string) => priceByProfileColor.get(invKey(profileId, colorCode));

  const productOptions = useMemo(() => {
    const options: ProductOption[] = [];
    profiles.forEach((p) => {
      colors.forEach((c) => {
        options.push({
          value: `${p.id}|${c.colorCode}`,
          profileId: p.id,
          profileCode: p.profileId,
          profileName: p.name,
          colorCode: c.colorCode,
          colorName: c.name,
          categoryName: p.categoryName || p.categoryCode || '',
        });
      });
    });
    return options;
  }, [profiles, colors]);

  const categoryNames = useMemo(() => {
    const set = new Set<string>();
    productOptions.forEach((o) => set.add(o.categoryName || t('other')));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productOptions, t]);

  /** Search and product list are scoped to the selected category (pick a category first). */
  const categoryPicked = Boolean(categoryFilter);

  const countInCategory = useMemo(() => {
    if (!categoryFilter) return 0;
    return productOptions.filter((o) => (o.categoryName || t('other')) === categoryFilter).length;
  }, [productOptions, categoryFilter, t]);

  const filteredProducts = useMemo(() => {
    if (!categoryFilter) {
      return [] as ProductOption[];
    }
    let list = productOptions.filter((o) => (o.categoryName || t('other')) === categoryFilter);
    const q = normalize(productQuery);
    if (!q) {
      return list.slice(0, LIST_CAP);
    }
    return list
      .filter((o) => {
        const hay = [o.profileCode, o.profileName, o.colorName, o.colorCode].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, LIST_CAP);
  }, [productOptions, productQuery, categoryFilter, t]);

  const selectedOption = useMemo(
    () => productOptions.find((o) => o.value === selectedProduct),
    [productOptions, selectedProduct],
  );

  const selectedUnitPrice = selectedOption ? unitPriceFor(selectedOption.profileId, selectedOption.colorCode) : undefined;

  const lineAmounts = useMemo(
    () =>
      lines.map((l) =>
        l.unitPricePerM != null && Number.isFinite(l.unitPricePerM) ? l.unitPricePerM * l.quantityM : null,
      ),
    [lines],
  );

  const estimatedTotal = useMemo(
    () => lineAmounts.reduce<number>((sum, a) => sum + (a ?? 0), 0),
    [lineAmounts],
  );

  const pricedLineCount = useMemo(() => lineAmounts.filter((a) => a != null).length, [lineAmounts]);

  useLayoutEffect(() => {
    if (!productOpen || !categoryPicked) {
      setMenuPos(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [productOpen, categoryPicked, filteredProducts.length, productQuery, categoryFilter]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (pickerRef.current?.contains(node)) return;
      if (menuPortalRef.current?.contains(node)) return;
      setProductOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    setProductQuery('');
    setSelectedProduct('');
    setProductOpen(Boolean(categoryFilter));
  }, [categoryFilter]);

  const addLine = () => {
    const qty = parseFloat(quantityM);
    if (!selectedProduct || !Number.isFinite(qty) || qty <= 0) return;
    const opt = productOptions.find((o) => o.value === selectedProduct);
    if (!opt) return;
    const up = unitPriceFor(opt.profileId, opt.colorCode);
    setLines((prev) => [
      ...prev,
      {
        profileId: opt.profileId,
        profileCode: opt.profileCode,
        profileName: opt.profileName,
        colorCode: opt.colorCode,
        colorName: opt.colorName,
        quantityM: qty,
        ...(up != null ? { unitPricePerM: up } : {}),
      },
    ]);
    setQuantityM('');
    setSelectedProduct('');
    setProductQuery('');
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) return;
    setSaving(true);
    try {
      await onSubmit({
        customer_reference: customerReference.trim() || null,
        task_id: taskIdToLink ?? undefined,
        items: lines.map((l) => ({ profile_id: l.profileId, color_code: l.colorCode, quantity_m: l.quantityM })),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const pickProduct = (value: string) => {
    setSelectedProduct(value);
    setProductQuery('');
    setProductOpen(false);
  };

  const productDropdown =
    productOpen && categoryPicked && menuPos
      ? createPortal(
          <ul
            ref={menuPortalRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 10000,
            }}
            className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          >
            {filteredProducts.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">
                {countInCategory === 0
                  ? t('noProductsInCategory')
                  : normalize(productQuery)
                    ? t('noProductsMatch')
                    : t('typeToFilterProducts')}
              </li>
            ) : (
              filteredProducts.map((o) => {
                const up = unitPriceFor(o.profileId, o.colorCode);
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => pickProduct(o.value)}
                      className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-indigo-50 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{o.profileCode}</span> – {o.profileName}{' '}
                        <span className="text-slate-500 dark:text-slate-400">/ {o.colorName}</span>
                      </span>
                      {up != null && (
                        <span className="shrink-0 tabular-nums text-xs text-slate-500 dark:text-slate-400">
                          {formatIls(up)}/m
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('createOrder')}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {taskIdToLink && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                <span className="font-semibold">{t('linkedTask')}:</span> {linkedTaskTitle ?? `#${taskIdToLink}`}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('customerReference')}</label>
              <input type="text" value={customerReference} onChange={(e) => setCustomerReference(e.target.value)} className={inputCls} placeholder={t('customerReference')} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
              <p className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-400">{t('addProductFromStorehouse')}</p>
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('category')}</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">{t('selectCategoryPrompt')}</option>
                  {categoryNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div ref={pickerRef} className="relative space-y-2">
                <label className="sr-only">{t('searchProducts')}</label>
                <div ref={anchorRef} className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    {selectedOption && !productOpen ? (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700">
                        <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">
                          {selectedOption.profileCode} – {selectedOption.profileName} / {selectedOption.colorName}
                          {selectedUnitPrice != null && (
                            <span className="ml-2 tabular-nums text-xs text-slate-500 dark:text-slate-400">
                              ({formatIls(selectedUnitPrice)}/m)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct('');
                            setProductOpen(categoryPicked);
                          }}
                          className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                          {t('change')}
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={productQuery}
                        onChange={(e) => {
                          setProductQuery(e.target.value);
                          setProductOpen(true);
                          setSelectedProduct('');
                        }}
                        onFocus={() => categoryPicked && setProductOpen(true)}
                        placeholder={categoryPicked ? t('searchProductsInCategoryPlaceholder') : t('selectCategoryToSearch')}
                        disabled={!categoryPicked}
                        className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-60`}
                        autoComplete="off"
                      />
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={quantityM}
                    onChange={(e) => setQuantityM(e.target.value)}
                    placeholder={t('quantityM')}
                    className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={addLine}
                    disabled={!categoryPicked}
                    className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('add')}
                  </button>
                </div>
                {productDropdown}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">
                {categoryPicked
                  ? t('productCategorySearchNote').replace('{count}', String(countInCategory))
                  : t('selectCategoryHint')}
              </p>
            </div>
            {lines.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('orderItems')}</p>
                  {estimatedTotal > 0 && (
                    <p className="text-xs font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                      {t('salesCartTotal')}: {formatIls(estimatedTotal)}
                    </p>
                  )}
                </div>
                <ul className="space-y-2">
                  {lines.map((line, i) => {
                    const lineEst: number | null =
                      line.unitPricePerM != null ? line.unitPricePerM * line.quantityM : null;
                    return (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      >
                        <span className="min-w-0">
                          {line.profileCode} – {line.profileName} / {line.colorName} × {line.quantityM} m
                          {line.unitPricePerM != null && (
                            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                              ({formatIls(line.unitPricePerM)}/m
                              {lineEst !== null ? ` → ${formatIls(lineEst)}` : ''})
                            </span>
                          )}
                        </span>
                        <button type="button" onClick={() => removeLine(i)} className="shrink-0 text-red-500 hover:text-red-600">
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {pricedLineCount > 0 && (
                  <div className="mt-3 rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-3 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                    <p className="mb-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200">{t('orderPriceCalculation')}</p>
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-slate-800 dark:text-slate-200">
                      {lines
                        .map((line, i) => ({ line, amt: lineAmounts[i], i }))
                        .filter((x) => x.amt != null)
                        .map((x, j) => (
                          <React.Fragment key={x.i}>
                            {j > 0 && <span className="font-semibold text-indigo-600 dark:text-indigo-400"> + </span>}
                            <span className="tabular-nums">
                              {formatIls(x.amt!)}
                              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                {' '}
                                ({x.line.profileCode}/{x.line.colorName})
                              </span>
                            </span>
                          </React.Fragment>
                        ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-indigo-200/60 pt-2 dark:border-indigo-900/40">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('salesCartTotal')}</span>
                      <span className="text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{formatIls(estimatedTotal)}</span>
                    </div>
                  </div>
                )}
                {lines.length > 0 && pricedLineCount < lines.length && (
                  <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300/90">
                    {t('orderPricePartialEstimateHint')}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving || lines.length === 0} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? '...' : t('createOrder')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
