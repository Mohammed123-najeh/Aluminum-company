import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { CustomOrderCard, FillingOption, ProductType } from './customOrderTypes';

type InvoiceMode = 'employee' | 'customer';

type Props = {
  mode: InvoiceMode;
  orderTitle: string;
  orderBrief: string;
  orderReference: string;
  dueDate: string;
  deliveryAddress: string;
  customer: { name: string; phone: string; company: string };
  cards: CustomOrderCard[];
  assignees: User[];
  totalQty: number;
  totalPrice: number;
  onSwitch: (mode: InvoiceMode) => void;
  onClose: () => void;
};

const productTypeLabelKey: Record<ProductType, any> = {
  window: 'customOrderPkgProductTypeWindow',
  aluminum_door: 'customOrderPkgProductTypeAluminumDoor',
  glass_door: 'customOrderPkgProductTypeGlassDoor',
  glass_facade: 'customOrderPkgProductTypeGlassFacade',
  canopy: 'customOrderPkgProductTypeCanopy',
  glass_partition: 'customOrderPkgProductTypeGlassPartition',
  mesh_door: 'customOrderPkgProductTypeMeshDoor',
  cabinet: 'customOrderPkgProductTypeCabinet',
  aluminum_kitchen: 'customOrderPkgProductTypeAluminumKitchen',
};

const fillingLabelKey: Record<FillingOption, any> = {
  '': 'customOrderBuilderFilling',
  aluminum_only: 'customOrderBuilderFillingAluminumOnly',
  glass_only: 'customOrderBuilderFillingGlassOnly',
  glass_and_aluminum: 'customOrderBuilderFillingGlassAndAluminum',
};

export const CustomOrderInvoiceModal: React.FC<Props> = ({
  mode, orderTitle, orderBrief, orderReference, dueDate, deliveryAddress,
  customer, cards, assignees, totalQty, totalPrice, onSwitch, onClose,
}) => {
  const { t, lang } = useApp();

  const formattedDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleString(lang === 'ar' ? 'ar' : 'en');
  }, [lang]);

  const factoryName = t(lang === 'ar' ? 'companyNameAr' : 'companyNameEn');
  const isCustomer = mode === 'customer';

  return (
    <div className="fixed inset-0 z-70 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4 print:static print:bg-white print:p-0">
      <div className="relative flex max-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-800 sm:max-h-[95vh] sm:max-w-4xl sm:rounded-2xl print:max-h-none print:w-auto print:rounded-none print:shadow-none">
        {/* Header (hidden in print) */}
        <div className="flex shrink-0 items-start justify-between gap-3 bg-linear-to-r from-violet-600 to-fuchsia-500 px-5 py-4 text-white print:hidden">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
              {isCustomer ? t('customOrderInvoiceTitleCustomer') : t('customOrderInvoiceTitleEmployee')}
            </p>
            <h2 className="text-lg font-bold leading-tight">{orderTitle || t('customOrderTitle')}</h2>
            <p className="text-xs text-white/80">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25">
              {t('customOrderInvoicePrint')}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg bg-white/10 p-1.5 text-white/90 hover:bg-white/20" aria-label={t('close')}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-6 text-slate-800 dark:bg-slate-900 dark:text-slate-100 print:overflow-visible">
          {/* Top info grid */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-linear-to-br from-violet-50 to-fuchsia-50 p-4 dark:from-violet-950/30 dark:to-fuchsia-950/30">
              <p className="mb-1 text-[10px] font-semibold uppercase text-violet-700 dark:text-violet-300">{t('customOrderInvoiceFactoryInfo')}</p>
              <p className="text-sm font-bold">{factoryName}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{formattedDate}</p>
              {orderReference && <p className="mt-1 text-xs">{t('orderReference')}: <span className="font-mono">{orderReference}</span></p>}
              {dueDate && <p className="text-xs">{t('dueDate')}: <span className="font-mono">{dueDate}</span></p>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">{t('customOrderInvoiceCustomerInfo')}</p>
              {customer.name    && <p className="text-sm font-bold">{customer.name}</p>}
              {customer.phone   && <p dir="ltr" className="text-xs">{customer.phone}</p>}
              {customer.company && <p className="text-xs">{customer.company}</p>}
              {deliveryAddress  && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{deliveryAddress}</p>}
            </div>
          </div>

          {(orderTitle || orderBrief) && (
            <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              {orderTitle && <p className="text-sm font-bold">{orderTitle}</p>}
              {orderBrief && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{orderBrief}</p>}
            </div>
          )}

          {/* Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('customOrderInvoiceProductCards')}</h3>
            {cards.map((card, idx) => (
              <InvoiceCard
                key={card.id}
                index={idx + 1}
                card={card}
                isCustomer={isCustomer}
                t={t}
              />
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900 dark:bg-violet-950/20">
            <h3 className="mb-3 text-sm font-bold text-violet-700 dark:text-violet-200">{t('customOrderInvoiceSummary')}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <SummaryStat label={t('customOrderFooterCards')} value={String(cards.length)} />
              <SummaryStat label={t('customOrderFooterTotalQty')} value={String(totalQty)} />
              {isCustomer ? (
                <div className="col-span-2 rounded-lg bg-white p-3 text-center dark:bg-slate-800">
                  <p className="text-[10px] uppercase text-slate-500">{t('customOrderFooterTotalPrice')}</p>
                  <p className="bg-linear-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-2xl font-bold text-transparent">{totalPrice.toLocaleString()} ILS</p>
                </div>
              ) : (
                <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-center text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  {t('customOrderInvoicePricesHidden')}
                </div>
              )}
            </div>
          </div>

          {/* Team */}
          {assignees.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{t('customOrderInvoiceAssignedTeam')}</h3>
              <div className="flex flex-wrap gap-2">
                {assignees.map((u) => (
                  <span key={u.id} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                    {u.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer (hidden in print) */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800 print:hidden">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{factoryName}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onSwitch(isCustomer ? 'employee' : 'customer')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
              {isCustomer ? t('customOrderInvoiceSwitchToEmployee') : t('customOrderInvoiceSwitchToCustomer')}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white">
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-white p-3 text-center dark:bg-slate-800">
    <p className="text-[10px] uppercase text-slate-500">{label}</p>
    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</p>
  </div>
);

const InvoiceCard: React.FC<{ index: number; card: CustomOrderCard; isCustomer: boolean; t: (k: any) => string }> = ({ index, card, isCustomer, t }) => {
  const s = card.spec;
  const accessoriesOn = Object.entries(s.accessories).filter(([, v]) => v);
  const hasSheet = s.sheetType || s.sheetColor;
  const hasGlass = s.glassType || s.glassThickness || s.glassTint || s.glassShade;
  const hasAccessories = accessoriesOn.length > 0 || s.lockType || s.handleType || s.hingeType || s.openDirection;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2 bg-linear-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-xs font-bold">{index}</span>
          <span className="text-sm font-bold">{s.productType ? t(productTypeLabelKey[s.productType]) : t('customOrderCardUntitled')}</span>
        </div>
        {isCustomer && card.estimatedPrice && parseFloat(card.estimatedPrice) > 0 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
            {parseFloat(card.estimatedPrice).toLocaleString()} ILS
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 text-xs sm:grid-cols-3">
        <InvoiceGroup title={t('customOrderInvoiceBasicData')} tone="slate">
          {s.productType && <InvoiceLine k={t('customOrderPkgProductType')} v={t(productTypeLabelKey[s.productType])} />}
          {s.system && <InvoiceLine k={t('customOrderPkgProductSystem')} v={s.system} />}
          {s.width && s.height && <InvoiceLine k={t('customOrderPkgDimensionsSection')} v={`${s.width} × ${s.height} ${s.unit}`} />}
          <InvoiceLine k={t('customOrderPkgQuantity')} v={s.quantity || '1'} />
          {s.filling && s.productType !== 'window' && <InvoiceLine k={t('customOrderBuilderFilling')} v={t(fillingLabelKey[s.filling])} />}
          {s.frameType && <InvoiceLine k={t('customOrderPkgFrameTypeSection')} v={s.frameType} />}
          {s.frameColor && <InvoiceLine k={t('customOrderPkgFrameColor')} v={s.frameColor} />}
        </InvoiceGroup>

        {hasSheet && (
          <InvoiceGroup title={t('customOrderInvoiceSheetData')} tone="amber">
            {s.sheetType && <InvoiceLine k={t('customOrderPkgSheetType')} v={s.sheetType} />}
            {s.sheetColor && <InvoiceLine k={t('customOrderPkgSheetColor')} v={s.sheetColor} />}
          </InvoiceGroup>
        )}

        {hasGlass && (
          <InvoiceGroup title={t('customOrderInvoiceGlassData')} tone="blue">
            {s.glassType && <InvoiceLine k={t('customOrderPkgGlassType')} v={s.glassType} />}
            {s.glassThickness && <InvoiceLine k={t('customOrderPkgGlassThickness')} v={s.glassThickness} />}
            {s.glassTint && <InvoiceLine k={t('customOrderPkgGlassTint')} v={s.glassTint} />}
            {s.glassShade && <InvoiceLine k={t('customOrderPkgGlassShade')} v={s.glassShade} />}
          </InvoiceGroup>
        )}

        {hasAccessories && (
          <InvoiceGroup title={t('customOrderInvoiceAccessoriesData')} tone="violet">
            {s.lockType && <InvoiceLine k={t('customOrderPkgLockType')} v={s.lockType} />}
            {s.handleType && <InvoiceLine k={t('customOrderPkgHandleType')} v={s.handleType} />}
            {s.hingeType && <InvoiceLine k={t('customOrderPkgHingeType')} v={s.hingeType} />}
            {s.openDirection && <InvoiceLine k={t('customOrderPkgOpenDirection')} v={s.openDirection} />}
            {accessoriesOn.length > 0 && (
              <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-300">
                ✓ {accessoriesOn.map(([k]) => k).join(', ')}
              </p>
            )}
          </InvoiceGroup>
        )}

        {s.productionNotes && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 sm:col-span-3 dark:border-violet-900 dark:bg-violet-950/30">
            <p className="mb-1 text-[10px] font-semibold uppercase text-violet-700 dark:text-violet-300">{t('customOrderInvoiceManufacturingNotes')}</p>
            <p className="whitespace-pre-wrap text-xs">{s.productionNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const InvoiceGroup: React.FC<{ title: string; tone: 'slate' | 'amber' | 'blue' | 'violet'; children: React.ReactNode }> = ({ title, tone, children }) => {
  const bg = {
    slate: 'bg-slate-50 dark:bg-slate-800/60',
    amber: 'bg-amber-50 dark:bg-amber-950/20',
    blue: 'bg-blue-50 dark:bg-blue-950/20',
    violet: 'bg-violet-50 dark:bg-violet-950/20',
  }[tone];
  return (
    <div className={`rounded-lg border border-slate-200 p-3 dark:border-slate-700 ${bg}`}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
};

const InvoiceLine: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex justify-between gap-2 text-[11px]">
    <span className="text-slate-500 dark:text-slate-400">{k}</span>
    <span className="font-medium text-slate-700 dark:text-slate-200">{v}</span>
  </div>
);
