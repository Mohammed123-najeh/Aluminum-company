import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { CustomOrderCard, FillingOption, ProductType } from './customOrderTypes';
// Icon-only brand mark (the full logo's baked-in text is illegible when scaled
// down, so we pair the square mark with the company name rendered as real text).
import brandLogoMark from '../../assets/brand-logo-mark.jpeg';

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

  // Print only the invoice. The body class flips on the global @media print rules
  // (style.css) that hide all app chrome; 'invoice-flow' overrides the single-page
  // receipt pin so a multi-card order paginates instead of clipping to page 1.
  const handlePrint = () => {
    document.body.classList.add('printing-receipt');
    const cleanup = () => {
      document.body.classList.remove('printing-receipt');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  // Safety net: if the modal unmounts mid-print (or the dialog is cancelled and
  // closed), make sure we never leave the body class on — that would hide the app.
  useEffect(() => {
    return () => document.body.classList.remove('printing-receipt');
  }, []);

  // Rendered through a portal to document.body so the printable card and its
  // backdrop are direct body children — the global print rule then cleanly hides
  // the parent CustomOrderModal overlay instead of leaving the live form behind it.
  return createPortal(
    <>
      {/* Screen-only chrome (backdrop + action bar) — sibling of the printable. */}
      <div className="no-print fixed inset-0 z-70 flex flex-col bg-black/60 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="no-print fixed inset-x-0 top-0 z-80 flex items-center justify-between gap-3 bg-linear-to-r from-violet-600 to-fuchsia-500 px-5 py-3 text-white shadow-lg sm:inset-x-auto sm:right-4 sm:top-4 sm:rounded-xl">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
            {isCustomer ? t('customOrderInvoiceTitleCustomer') : t('customOrderInvoiceTitleEmployee')}
          </p>
          <h2 className="text-sm font-bold leading-tight">{orderTitle || t('customOrderTitle')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onSwitch(isCustomer ? 'employee' : 'customer')} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25">
            {isCustomer ? t('customOrderInvoiceSwitchToEmployee') : t('customOrderInvoiceSwitchToCustomer')}
          </button>
          <button type="button" onClick={handlePrint} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50">
            {t('customOrderInvoicePrint')}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/10 p-1.5 text-white/90 hover:bg-white/20" aria-label={t('close')}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* The printable A4 invoice. On screen it sits over the backdrop; on print
          it is the only thing shown (global rule + invoice-flow pagination). */}
      <div className="receipt-printable invoice-flow fixed inset-0 z-70 mx-auto max-h-dvh w-full overflow-y-auto bg-white p-6 text-slate-800 sm:inset-4 sm:max-h-[95vh] sm:max-w-4xl sm:rounded-2xl sm:p-8 sm:shadow-2xl">
        {/* Header: square logo mark + company name (text) | document title / ref / date */}
        <header className="mb-6 flex items-center justify-between gap-4 border-b-2 border-slate-300 pb-4">
          <div className="flex items-center gap-3">
            <img src={brandLogoMark} alt={factoryName} className="h-16 w-16 shrink-0 rounded-lg object-contain ring-1 ring-slate-200 print:h-20 print:w-20" draggable={false} />
            <div className="leading-tight">
              <p className="text-base font-extrabold text-slate-900">{t('companyNameEn')}</p>
              <p className="text-sm font-bold text-slate-700">{t('companyNameAr')}</p>
            </div>
          </div>
          <div className="text-end">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              {isCustomer ? t('customOrderInvoiceTitleCustomer') : t('customOrderInvoiceTitleEmployee')}
            </p>
            <h2 className="text-lg font-extrabold text-slate-900">{orderTitle || t('customOrderTitle')}</h2>
            {orderReference && <p className="text-xs text-slate-600">{t('orderReference')}: <span dir="ltr" className="font-mono">{orderReference}</span></p>}
            {dueDate && <p className="text-xs text-slate-600">{t('dueDate')}: <span dir="ltr" className="font-mono">{dueDate}</span></p>}
            <p className="text-xs text-slate-500"><span dir="ltr">{formattedDate}</span></p>
          </div>
        </header>

        {/* Factory + customer band — borders + dark text (no gradients, print-safe). */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <section className="rounded-lg border border-slate-300 p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('customOrderInvoiceFactoryInfo')}</p>
            <p className="text-sm font-bold text-slate-900">{factoryName}</p>
          </section>
          <section className="rounded-lg border border-slate-300 p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('customOrderInvoiceCustomerInfo')}</p>
            {customer.name && <p className="text-sm font-bold text-slate-900">{customer.name}</p>}
            {customer.phone && <p dir="ltr" className="text-start text-xs text-slate-700">{customer.phone}</p>}
            {customer.company && <p className="text-xs text-slate-700">{customer.company}</p>}
            {deliveryAddress && <p className="mt-1 text-xs text-slate-600">{deliveryAddress}</p>}
          </section>
        </div>

        {(orderTitle || orderBrief) && (
          <div className="mb-5 break-inside-avoid rounded-lg border border-slate-300 p-4">
            {orderTitle && <p className="text-sm font-bold text-slate-900">{orderTitle}</p>}
            {orderBrief && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{orderBrief}</p>}
          </div>
        )}

        {/* Product cards */}
        <div className="space-y-4">
          <h3 className="break-after-avoid text-sm font-bold text-slate-900">{t('customOrderInvoiceProductCards')}</h3>
          {cards.map((card, idx) => (
            <InvoiceCard key={card.id} index={idx + 1} card={card} isCustomer={isCustomer} t={t} />
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 break-inside-avoid rounded-lg border-2 border-slate-300 p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-900">{t('customOrderInvoiceSummary')}</h3>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 print:grid-cols-4">
            <SummaryStat label={t('customOrderFooterCards')} value={String(cards.length)} />
            <SummaryStat label={t('customOrderFooterTotalQty')} value={String(totalQty)} />
            {isCustomer ? (
              <div className="col-span-2 rounded-lg border border-slate-300 p-3 text-center print:col-span-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">{t('customOrderFooterTotalPrice')}</p>
                <p dir="ltr" className="text-2xl font-extrabold text-slate-900 print:text-black">{totalPrice.toLocaleString()} ILS</p>
              </div>
            ) : (
              <div className="col-span-2 rounded-lg border-2 border-blue-500 p-3 text-center text-xs font-bold uppercase text-blue-700 print:col-span-2">
                {t('customOrderInvoicePricesHidden')}
              </div>
            )}
          </div>
        </div>

        {/* Assigned team */}
        {assignees.length > 0 && (
          <div className="mt-5 break-inside-avoid">
            <h3 className="mb-2 text-sm font-bold text-slate-900">{t('customOrderInvoiceAssignedTeam')}</h3>
            <div className="flex flex-wrap gap-2">
              {assignees.map((u) => (
                <span key={u.id} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800">{u.name}</span>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-6 border-t border-slate-300 pt-3 text-center text-[11px] text-slate-500">{factoryName}</footer>
      </div>
    </>,
    document.body,
  );
};

const SummaryStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-300 p-3 text-center">
    <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
    <p dir="ltr" className="text-lg font-bold text-slate-900">{value}</p>
  </div>
);

const InvoiceCard: React.FC<{ index: number; card: CustomOrderCard; isCustomer: boolean; t: (k: any) => string }> = ({ index, card, isCustomer, t }) => {
  const s = card.spec;
  const accessoriesOn = Object.entries(s.accessories).filter(([, v]) => v);
  const hasSheet = s.sheetType || s.sheetColor;
  const hasGlass = s.glassType || s.glassThickness || s.glassTint || s.glassShade;
  const hasAccessories = accessoriesOn.length > 0 || s.lockType || s.handleType || s.hingeType || s.openDirection;
  return (
    <article className="break-inside-avoid rounded-lg border border-slate-300">
      {/* Card header — light tint + dark text + border (prints cleanly, no gradient). */}
      <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-slate-300 bg-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-400 bg-white text-xs font-bold text-slate-800">{index}</span>
          <span className="text-sm font-bold text-slate-900">{s.productType ? t(productTypeLabelKey[s.productType]) : t('customOrderCardUntitled')}</span>
        </div>
        {isCustomer && card.estimatedPrice && parseFloat(card.estimatedPrice) > 0 && (
          <span dir="ltr" className="rounded-full border border-slate-400 bg-white px-2 py-0.5 text-xs font-bold text-slate-800">
            {parseFloat(card.estimatedPrice).toLocaleString()} ILS
          </span>
        )}
      </div>

      {/* Adaptive grid: only populated groups render, and auto-fit fills the row
          so a Basic-only card doesn't leave empty tracks. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 p-3 text-xs">
        <InvoiceGroup title={t('customOrderInvoiceBasicData')}>
          {s.productType && <InvoiceLine k={t('customOrderPkgProductType')} v={t(productTypeLabelKey[s.productType])} />}
          {s.system && <InvoiceLine k={t('customOrderPkgProductSystem')} v={s.system} />}
          {s.width && s.height && <InvoiceLine k={t('customOrderPkgDimensionsSection')} v={`${s.width} × ${s.height} ${s.unit}`} ltr />}
          <InvoiceLine k={t('customOrderPkgQuantity')} v={s.quantity || '1'} ltr />
          {s.filling && s.productType !== 'window' && <InvoiceLine k={t('customOrderBuilderFilling')} v={t(fillingLabelKey[s.filling])} />}
          {s.frameType && <InvoiceLine k={t('customOrderPkgFrameTypeSection')} v={s.frameType} />}
          {s.frameColor && <InvoiceLine k={t('customOrderPkgFrameColor')} v={s.frameColor} />}
        </InvoiceGroup>

        {hasSheet && (
          <InvoiceGroup title={t('customOrderInvoiceSheetData')}>
            {s.sheetType && <InvoiceLine k={t('customOrderPkgSheetType')} v={s.sheetType} />}
            {s.sheetColor && <InvoiceLine k={t('customOrderPkgSheetColor')} v={s.sheetColor} />}
          </InvoiceGroup>
        )}

        {hasGlass && (
          <InvoiceGroup title={t('customOrderInvoiceGlassData')}>
            {s.glassType && <InvoiceLine k={t('customOrderPkgGlassType')} v={s.glassType} />}
            {s.glassThickness && <InvoiceLine k={t('customOrderPkgGlassThickness')} v={s.glassThickness} ltr />}
            {s.glassTint && <InvoiceLine k={t('customOrderPkgGlassTint')} v={s.glassTint} />}
            {s.glassShade && <InvoiceLine k={t('customOrderPkgGlassShade')} v={s.glassShade} />}
          </InvoiceGroup>
        )}

        {hasAccessories && (
          <InvoiceGroup title={t('customOrderInvoiceAccessoriesData')}>
            {s.lockType && <InvoiceLine k={t('customOrderPkgLockType')} v={s.lockType} />}
            {s.handleType && <InvoiceLine k={t('customOrderPkgHandleType')} v={s.handleType} />}
            {s.hingeType && <InvoiceLine k={t('customOrderPkgHingeType')} v={s.hingeType} />}
            {s.openDirection && <InvoiceLine k={t('customOrderPkgOpenDirection')} v={s.openDirection} />}
            {accessoriesOn.length > 0 && (
              <p className="mt-1 text-[10px] text-slate-600">
                ✓ {accessoriesOn.map(([k]) => k).join(', ')}
              </p>
            )}
          </InvoiceGroup>
        )}
      </div>

      {/* Manufacturing notes — full-width row under the grid, border-encoded so it
          stays legible even when the browser strips background colors on print. */}
      {s.productionNotes && (
        <div className="break-inside-avoid border-t border-t-slate-300 border-s-4 border-s-amber-400 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">{t('customOrderInvoiceManufacturingNotes')}</p>
          <p className="whitespace-pre-wrap break-words text-xs text-slate-700">{s.productionNotes}</p>
        </div>
      )}
    </article>
  );
};

const InvoiceGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg border border-slate-300 p-3">
    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
    <div className="space-y-1">{children}</div>
  </div>
);

const InvoiceLine: React.FC<{ k: string; v: string; ltr?: boolean }> = ({ k, v, ltr }) => (
  <div className="flex justify-between gap-2 text-[11px]">
    <span className="text-slate-500">{k}</span>
    <span {...(ltr ? { dir: 'ltr' } : {})} className="font-medium text-slate-800">{v}</span>
  </div>
);
