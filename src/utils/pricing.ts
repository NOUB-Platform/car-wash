import {
  DiscountType,
  InvoiceStatus,
  PaymentMethod,
  PricingMode,
  StaffRole,
  StockMovementType,
  VehicleTier,
  WashService,
} from '../types/carwash';

export function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function formatEGP(amount: number): string {
  return `${roundMoney(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

export function formatNumber(val: number): string {
  return val.toLocaleString('en-US');
}

export function formatDateTimeAr(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function calculateProductSellingPrice(
  costPrice: number,
  mode: PricingMode,
  markupValue: number,
  manualPrice?: number
): number {
  const cost = Math.max(0, Number(costPrice) || 0);
  const val = Math.max(0, Number(markupValue) || 0);
  if (mode === 'markup_percent') {
    return roundMoney(cost * (1 + val / 100));
  }
  if (mode === 'markup_fixed') {
    return roundMoney(cost + val);
  }
  return roundMoney(Math.max(0, Number(manualPrice ?? val) || 0));
}

export function calculatePriceWithVat(preVatPrice: number, vatRate: number): number {
  return roundMoney(preVatPrice * (1 + vatRate / 100));
}

export function calculateInvoiceTotals(params: {
  items: Array<{ unit_price: number; unit_cost: number; quantity: number; line_discount?: number }>;
  discountType: DiscountType;
  discountValue: number;
  vatRate: number;
}) {
  const subtotal = roundMoney(
    params.items.reduce((sum, item) => {
      const lineTotal = item.unit_price * item.quantity - (item.line_discount || 0);
      return sum + Math.max(0, lineTotal);
    }, 0)
  );

  const totalCost = roundMoney(
    params.items.reduce((sum, item) => sum + item.unit_cost * item.quantity, 0)
  );

  let discountAmount = 0;
  if (params.discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, params.discountValue || 0));
    discountAmount = roundMoney(subtotal * (pct / 100));
  } else if (params.discountType === 'fixed') {
    discountAmount = roundMoney(Math.min(subtotal, Math.max(0, params.discountValue || 0)));
  }

  const taxableAmount = roundMoney(Math.max(0, subtotal - discountAmount));
  const vatAmount = roundMoney(taxableAmount * (params.vatRate / 100));
  const totalAmount = roundMoney(taxableAmount + vatAmount);
  const netProfit = roundMoney(taxableAmount - totalCost);

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    vatAmount,
    totalAmount,
    totalCost,
    netProfit,
  };
}

export function getServicePriceForTier(service: WashService, tier: VehicleTier): number {
  switch (tier) {
    case 'sedan':
      return service.price_sedan;
    case 'suv':
      return service.price_suv;
    case '4x4':
      return service.price_4x4;
    case 'van':
      return service.price_van;
    default:
      return service.price_sedan;
  }
}

export const VEHICLE_TIER_LABELS: Record<VehicleTier, string> = {
  sedan: 'سيدان / هاتشباك',
  suv: 'SUV / كروس أوفر',
  '4x4': 'دفع رباعي 4x4',
  van: 'فان / ميكروباص',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'في الانتظار',
  washing: 'قيد التنفيذ',
  ready: 'جاهزة للتسليم',
  completed: 'مكتملة ومسلمة',
  cancelled: 'ملغاة',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدي (كاش)',
  card: 'بطاقة بنكية (فيزا)',
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستاباي (InstaPay)',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  washer: 'فني غسيل سيارات',
  detailer: 'أخصائي تلميع وحماية',
  cashier: 'كاشير ومبيعات',
  inventory_manager: 'أمين مخزن ومبيعات',
  supervisor: 'مشرف وردية ومدير',
};

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  restock: 'توريد للمخزن',
  sale: 'بيع منفرد (فاتورة)',
  wash_usage: 'استهلاك تشغيل مغسلة',
  adjustment: 'تسوية جرد',
};

export const WASH_BAYS = [
  'حارة الغسيل 1',
  'حارة الغسيل 2',
  'حارة التلميع 3',
  'حارة البخار والكيماوي 4',
];
