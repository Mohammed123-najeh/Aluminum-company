// Shared types + serialiser for the multi-card custom-order flow.
// The serialiser produces (a) a readable Arabic/English text block that lives
// on Task.description for backward compatibility with every viewer in the
// app, and (b) appends a fenced ```customOrder ...``` JSON block so a future
// renderer can round-trip the structured spec without DB changes.

export const CUSTOM_ORDER_TITLE_PREFIX = 'Custom order:';

export type ProductType =
  | 'window'
  | 'aluminum_door'
  | 'glass_door'
  | 'glass_facade'
  | 'canopy'
  | 'glass_partition'
  | 'mesh_door'
  | 'cabinet'
  | 'aluminum_kitchen';

export type FillingOption = '' | 'aluminum_only' | 'glass_only' | 'glass_and_aluminum';

export type CardSpec = {
  productType: ProductType | '';
  system: string;
  width: string;
  height: string;
  quantity: string;
  unit: 'cm' | 'meter';

  filling: FillingOption;

  frameType: string;
  frameColor: string;

  sheetType: string;
  sheetColor: string;

  glassType: string;
  glassThickness: string;
  glassTint: string;
  glassShade: string;

  lockType: string;
  handleType: string;
  hingeType: string;
  openDirection: string;

  accessories: Record<string, boolean>;

  productionNotes: string;
};

export type CustomOrderCard = {
  id: string;
  spec: CardSpec;
  estimatedPrice: string;
  attachments?: File[];
  externalLink?: string;
};

export const EMPTY_SPEC: CardSpec = {
  productType: '',
  system: '',
  width: '',
  height: '',
  quantity: '1',
  unit: 'cm',

  filling: '',

  frameType: '',
  frameColor: '',

  sheetType: '',
  sheetColor: '',

  glassType: '',
  glassThickness: '',
  glassTint: '',
  glassShade: '',

  lockType: '',
  handleType: '',
  hingeType: '',
  openDirection: '',

  accessories: {
    slidingWheels: false,
    thermalInsulation: false,
    acousticInsulation: false,
    insectMesh: false,
    softClose: false,
    siliconeTouch: false,
    waterSeal: false,
    dustSeal: false,
    ledLighting: false,
    smartLock: false,
    fingerprintLock: false,
    cabinetSystem: false,
    kitchenAccessories: false,
  },

  productionNotes: '',
};

export const EMPTY_CARD: CustomOrderCard = {
  id: '',
  spec: EMPTY_SPEC,
  estimatedPrice: '',
  attachments: [],
  externalLink: '',
};

// ── Label bag (passed in so the serialiser stays i18n-agnostic) ───────────

export type CardLabels = {
  productType: string; system: string;
  dimensions: string; width: string; height: string; quantity: string; unit: string;
  filling: string;
  frameType: string; frameColor: string;
  sheet: string; sheetType: string; sheetColor: string;
  glass: string; glassType: string; glassThickness: string; glassTint: string; glassShade: string;
  accessories: string;
  lockType: string; handleType: string; hingeType: string; openDirection: string;
  notes: string;
  customer: string; customerName: string; customerPhone: string; companyName: string;
  deliveryAddress: string; estimatedPrice: string;
  productCards: string; cardLabel: string;
};

type Labelers = {
  productTypeLabel: (pt: ProductType) => string;
  systemLabel: (s: string) => string;
  fillingLabel: (f: FillingOption) => string;
  frameTypeLabel: (s: string) => string;
  frameColorLabel: (s: string) => string;
  sheetTypeLabel: (s: string) => string;
  sheetColorLabel: (s: string) => string;
  glassTypeLabel: (s: string) => string;
  glassThicknessLabel: (s: string) => string;
  glassTintLabel: (s: string) => string;
  glassShadeLabel: (s: string) => string;
  lockTypeLabel: (s: string) => string;
  handleTypeLabel: (s: string) => string;
  hingeTypeLabel: (s: string) => string;
  openDirectionLabel: (s: string) => string;
  accessoryLabel: (k: string) => string;
};

type BuildArgs = {
  brief: string;
  cards: CustomOrderCard[];
  customer: { name: string; phone: string; company: string };
  deliveryAddress: string;
  labels: CardLabels;
} & Labelers;

export function buildOrderDescription(args: BuildArgs): string {
  const { brief, cards, customer, deliveryAddress, labels } = args;
  const out: string[] = [];

  if (brief.trim()) out.push(brief.trim());

  const customerLines: string[] = [];
  if (customer.name.trim())    customerLines.push(`• ${labels.customerName}: ${customer.name.trim()}`);
  if (customer.phone.trim())   customerLines.push(`• ${labels.customerPhone}: ${customer.phone.trim()}`);
  if (customer.company.trim()) customerLines.push(`• ${labels.companyName}: ${customer.company.trim()}`);
  if (deliveryAddress.trim())  customerLines.push(`• ${labels.deliveryAddress}: ${deliveryAddress.trim()}`);
  if (customerLines.length > 0) {
    out.push('');
    out.push(`— ${labels.customer} —`);
    customerLines.forEach((l) => out.push(l));
  }

  cards.forEach((card, i) => {
    out.push('');
    out.push(`── ${labels.cardLabel} #${i + 1} ──`);
    const s = card.spec;

    if (s.productType) out.push(`• ${labels.productType}: ${args.productTypeLabel(s.productType)}`);
    if (s.system)      out.push(`• ${labels.system}: ${args.systemLabel(s.system)}`);

    const dims: string[] = [];
    if (s.width)    dims.push(`${labels.width} ${s.width} ${s.unit}`);
    if (s.height)   dims.push(`${labels.height} ${s.height} ${s.unit}`);
    if (s.quantity) dims.push(`${labels.quantity} ${s.quantity}`);
    if (dims.length > 0) out.push(`• ${labels.dimensions}: ${dims.join(' · ')}`);

    if (s.filling) out.push(`• ${labels.filling}: ${args.fillingLabel(s.filling)}`);

    if (s.frameType || s.frameColor) {
      const frameBits: string[] = [];
      if (s.frameType)  frameBits.push(args.frameTypeLabel(s.frameType));
      if (s.frameColor) frameBits.push(args.frameColorLabel(s.frameColor));
      out.push(`• ${labels.frameType}: ${frameBits.join(' · ')}`);
    }

    if (s.sheetType || s.sheetColor) {
      const sheetBits: string[] = [];
      if (s.sheetType)  sheetBits.push(args.sheetTypeLabel(s.sheetType));
      if (s.sheetColor) sheetBits.push(args.sheetColorLabel(s.sheetColor));
      out.push(`• ${labels.sheet}: ${sheetBits.join(' · ')}`);
    }

    const glassBits: string[] = [];
    if (s.glassType)      glassBits.push(args.glassTypeLabel(s.glassType));
    if (s.glassThickness) glassBits.push(args.glassThicknessLabel(s.glassThickness));
    if (s.glassTint)      glassBits.push(args.glassTintLabel(s.glassTint));
    if (s.glassShade)     glassBits.push(args.glassShadeLabel(s.glassShade));
    if (glassBits.length > 0) out.push(`• ${labels.glass}: ${glassBits.join(' · ')}`);

    const accBits: string[] = [];
    if (s.lockType)      accBits.push(`${labels.lockType}: ${args.lockTypeLabel(s.lockType)}`);
    if (s.handleType)    accBits.push(`${labels.handleType}: ${args.handleTypeLabel(s.handleType)}`);
    if (s.hingeType)     accBits.push(`${labels.hingeType}: ${args.hingeTypeLabel(s.hingeType)}`);
    if (s.openDirection) accBits.push(`${labels.openDirection}: ${args.openDirectionLabel(s.openDirection)}`);
    const onAcc = Object.entries(s.accessories).filter(([, v]) => v).map(([k]) => args.accessoryLabel(k));
    if (onAcc.length > 0) accBits.push(onAcc.join(' · '));
    if (accBits.length > 0) {
      out.push(`• ${labels.accessories}:`);
      accBits.forEach((b) => out.push(`    – ${b}`));
    }

    if (s.productionNotes.trim()) {
      out.push(`• ${labels.notes}: ${s.productionNotes.trim()}`);
    }
  });

  // Embedded JSON fence so future code can round-trip without DB migration.
  if (cards.length > 0) {
    const payload = {
      brief,
      customer,
      deliveryAddress,
      cards: cards.map((c) => ({ id: c.id, spec: c.spec, estimatedPrice: c.estimatedPrice, externalLink: c.externalLink ?? '' })),
    };
    out.push('');
    out.push('```customOrder');
    out.push(JSON.stringify(payload));
    out.push('```');
  }

  return out.join('\n').trim();
}
