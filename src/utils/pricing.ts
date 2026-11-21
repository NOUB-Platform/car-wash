import {
  AppThemeId,
  DiscountType,
  ExpenseCategory,
  InvoiceStatus,
  PaymentMethod,
  PricingMode,
  Product,
  SaleTier,
  StaffPermissions,
  StaffRole,
  StockMovementType,
  VehicleTier,
  WalletAccount,
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

export function getProductPriceForSaleTier(product: Product, tier: SaleTier): number {
  if (tier === 'wholesale') {
    return roundMoney(
      product.wholesale_price && product.wholesale_price > 0
        ? product.wholesale_price
        : Math.max(product.cost_price, product.selling_price * 0.85)
    );
  }
  if (tier === 'half_wholesale') {
    return roundMoney(
      product.half_wholesale_price && product.half_wholesale_price > 0
        ? product.half_wholesale_price
        : Math.max(product.cost_price, product.selling_price * 0.92)
    );
  }
  return roundMoney(product.selling_price);
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

export const SALE_TIER_LABELS: Record<SaleTier, string> = {
  retail: 'قطاعي',
  half_wholesale: 'نص جملة',
  wholesale: 'جملة',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'في الانتظار',
  washing: 'قيد التنفيذ',
  ready: 'جاهزة للتسليم',
  completed: 'مكتملة ومسلمة',
  cancelled: 'ملغاة',
};

export const BASE_PAYMENT_METHOD_LABELS: Record<
  'cash' | 'card' | 'vodafone_cash' | 'instapay' | 'deferred',
  string
> = {
  cash: 'نقدي (كاش)',
  card: 'بطاقة بنكية (فيزا)',
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستاباي (InstaPay)',
  deferred: 'آجل (على الحساب)',
};

// Backwards-compatible map for simple lookups
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ...BASE_PAYMENT_METHOD_LABELS,
};

export function getPaymentMethodLabel(
  method: PaymentMethod,
  wallets: WalletAccount[] = []
): string {
  if (method.startsWith('wallet:')) {
    const id = method.slice('wallet:'.length);
    const w = wallets.find((item) => item.id === id);
    return w ? `${w.name} (${w.provider})` : 'محفظة إلكترونية';
  }
  return BASE_PAYMENT_METHOD_LABELS[method as keyof typeof BASE_PAYMENT_METHOD_LABELS] || method;
}

export function isWalletPayment(method: PaymentMethod): boolean {
  return (
    method === 'vodafone_cash' ||
    method === 'instapay' ||
    method.startsWith('wallet:')
  );
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  washer: 'فني غسيل سيارات',
  detailer: 'أخصائي تلميع وحماية',
  cashier: 'كاشير ومبيعات',
  inventory_manager: 'أمين مخزن ومبيعات',
  supervisor: 'مشرف وردية ومدير',
};

export function getDefaultPermissionsForRole(role: StaffRole): StaffPermissions {
  if (role === 'supervisor') {
    return {
      can_access_pos: true,
      can_apply_discount: true,
      can_sell_wholesale: true,
      can_view_profits: true,
      can_manage_inventory: true,
      can_manage_purchases: true,
      can_manage_expenses: true,
      can_close_shift: true,
      can_view_reports: true,
      can_export_excel: true,
      can_manage_settings: true,
    };
  }
  if (role === 'inventory_manager') {
    return {
      can_access_pos: true,
      can_apply_discount: false,
      can_sell_wholesale: true,
      can_view_profits: true,
      can_manage_inventory: true,
      can_manage_purchases: true,
      can_manage_expenses: false,
      can_close_shift: false,
      can_view_reports: true,
      can_export_excel: true,
      can_manage_settings: false,
    };
  }
  if (role === 'cashier') {
    return {
      can_access_pos: true,
      can_apply_discount: true,
      can_sell_wholesale: true,
      can_view_profits: false,
      can_manage_inventory: false,
      can_manage_purchases: false,
      can_manage_expenses: true,
      can_close_shift: true,
      can_view_reports: true,
      can_export_excel: true,
      can_manage_settings: false,
    };
  }
  return {
    can_access_pos: false,
    can_apply_discount: false,
    can_sell_wholesale: false,
    can_view_profits: false,
    can_manage_inventory: false,
    can_manage_purchases: false,
    can_manage_expenses: false,
    can_close_shift: false,
    can_view_reports: false,
    can_export_excel: false,
    can_manage_settings: false,
  };
}

export const PERMISSION_LABELS: Record<keyof StaffPermissions, string> = {
  can_access_pos: 'دخول نقطة البيع (الكاشير)',
  can_apply_discount: 'منح خصومات على الفواتير',
  can_sell_wholesale: 'البيع بسعر الجملة ونص الجملة',
  can_view_profits: 'عرض التكلفة وصافي الأرباح',
  can_manage_inventory: 'إدارة المخزن والأسعار والباركود',
  can_manage_purchases: 'تسجيل المشتريات والموردين',
  can_manage_expenses: 'تسجيل المصروفات النثرية',
  can_close_shift: 'فتح وإغلاق ومراجعة الوردية',
  can_view_reports: 'عرض مركز التقارير والأرباح',
  can_export_excel: 'تصدير بيانات إكسيل (Excel)',
  can_manage_settings: 'دخول الإعدادات والنسخ الاحتياطي',
};

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  restock: 'توريد / مشتريات للمخزن',
  sale: 'بيع منفرد (فاتورة)',
  wash_usage: 'استهلاك تشغيل مغسلة',
  adjustment: 'تسوية جرد',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  utilities: 'كهرباء ومياه وإنترنت',
  rent: 'إيجار ومرافق',
  maintenance: 'صيانة ماكينات ومعدات',
  supplies: 'خامات ومستهلكات تشغيل',
  hospitality: 'ضيافة وبوفيه ونثريات',
  salaries: 'سلف ورواتب ومكافآت',
  other: 'مصروفات نثرية أخرى',
};

export const THEME_OPTIONS: Array<{
  id: AppThemeId;
  label: string;
  swatch: string;
  bgCanvas: string;
  sidebarFrom: string;
  sidebarTo: string;
  headerBg: string;
  dark: boolean;
}> = [
  {
    id: 'royal-blue',
    label: 'أزرق سماوي (كلاسيكي)',
    swatch: '#1D4ED8',
    bgCanvas: '#EEF3F9',
    sidebarFrom: '#E6F0FD',
    sidebarTo: '#E2ECFB',
    headerBg: 'rgba(255,255,255,0.95)',
    dark: false,
  },
  {
    id: 'emerald-mint',
    label: 'زمردي نعناعي',
    swatch: '#047857',
    bgCanvas: '#ECFDF5',
    sidebarFrom: '#D1FAE5',
    sidebarTo: '#E0F2FE',
    headerBg: 'rgba(255,255,255,0.95)',
    dark: false,
  },
  {
    id: 'warm-sand',
    label: 'رملي دافئ (الأهرام)',
    swatch: '#B45309',
    bgCanvas: '#F8F4EE',
    sidebarFrom: '#F3EAD8',
    sidebarTo: '#EFE4CE',
    headerBg: 'rgba(255,252,247,0.95)',
    dark: false,
  },
  {
    id: 'sunset-coral',
    label: 'سلموني ناعم',
    swatch: '#EA580C',
    bgCanvas: '#FFF5F0',
    sidebarFrom: '#FFEDD5',
    sidebarTo: '#FFE4E6',
    headerBg: 'rgba(255,255,255,0.95)',
    dark: false,
  },
  {
    id: 'slate-dark',
    label: 'ليلي احترافي',
    swatch: '#0F172A',
    bgCanvas: '#E2E8F0',
    sidebarFrom: '#1E293B',
    sidebarTo: '#0F172A',
    headerBg: 'rgba(248,250,252,0.95)',
    dark: true,
  },
];

export const WASH_BAYS = [
  'حارة الغسيل 1',
  'حارة الغسيل 2',
  'حارة التلميع 3',
  'حارة البخار والكيماوي 4',
];
