import {
  HargaPaket,
  HargaPromo,
  LinkPaket,
  PackageConfig,
  PackageTier,
  TemplateCategory,
  TemplateItem,
} from '../types';

export interface PackageSlotMeta {
  key: PackageTier;
  label: string;
  order: number;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Pernikahan',
  'Ulang Tahun',
  'Khitanan',
  'Aqiqah',
  'Lamaran & Wisuda',
  'Acara Lainnya',
];

export const PACKAGE_TIERS: PackageSlotMeta[] = [
  { key: 'bronze', label: 'Bronze', order: 1 },
  { key: 'silver', label: 'Silver', order: 2 },
  { key: 'gold', label: 'Gold', order: 3 },
  { key: 'platinum', label: 'Platinum', order: 4 },
];

export const EMPTY_HARGA_PAKET: HargaPaket = {
  bronze: 0,
  silver: 0,
  gold: 0,
  platinum: 0,
};

export const EMPTY_LINK_PAKET: LinkPaket = {
  bronze: '',
  silver: '',
  gold: '',
  platinum: '',
};

export const EMPTY_HARGA_PROMO: HargaPromo = {
  aktif: false,
  paket: 'gold',
  hargaPromo: 0,
  labelPromo: 'Promo',
  tanggalMulai: '',
  tanggalSelesai: '',
};

export function createEmptyPackageConfig(tier: PackageTier): PackageConfig {
  const slot = PACKAGE_TIERS.find((p) => p.key === tier) || PACKAGE_TIERS[0];
  return {
    id: tier,
    namaPaket: slot.label,
    harga: 0,
    hargaCoret: 0,
    promoAktif: false,
    labelPromo: 'Promo',
    order: slot.order,
    fitur: [],
  };
}

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function isPromoActive(promo?: HargaPromo | null, referenceDate = new Date()): boolean {
  if (!promo || !promo.aktif) {
    return false;
  }

  if (typeof promo.hargaPromo !== 'number' || !Number.isFinite(promo.hargaPromo) || promo.hargaPromo <= 0) {
    return false;
  }

  const todayYmd = toLocalYmd(referenceDate);

  if (promo.tanggalMulai && promo.tanggalMulai.trim() !== '') {
    if (todayYmd < promo.tanggalMulai.trim()) {
      return false;
    }
  }

  if (promo.tanggalSelesai && promo.tanggalSelesai.trim() !== '') {
    if (todayYmd > promo.tanggalSelesai.trim()) {
      return false;
    }
  }

  return true;
}

function toLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ResolvedPackagePrice {
  tier: PackageTier;
  tierLabel: string;
  normalPrice: number;
  finalPrice: number;
  isPromo: boolean;
  labelPromo: string;
}

export function getPackagePrice(
  template: TemplateItem,
  tier: PackageTier,
  packageConfigs?: Partial<Record<PackageTier, PackageConfig>>
): ResolvedPackagePrice {
  const meta = PACKAGE_TIERS.find((p) => p.key === tier) || PACKAGE_TIERS[0];
  const pkgCfg = packageConfigs?.[tier];
  const tierLabel = pkgCfg?.namaPaket?.trim() || meta.label;

  const templatePrice = template.hargaPaket?.[tier];
  const basePrice =
    pkgCfg && typeof pkgCfg.harga === 'number' && Number.isFinite(pkgCfg.harga)
      ? pkgCfg.harga
      : typeof templatePrice === 'number' && Number.isFinite(templatePrice)
      ? templatePrice
      : 0;

  const templatePromoVal =
    typeof template.hargaPromo?.hargaPromo === 'number' && Number.isFinite(template.hargaPromo.hargaPromo)
      ? template.hargaPromo.hargaPromo
      : 0;
  const templatePromoActive =
    isPromoActive(template.hargaPromo) &&
    template.hargaPromo.paket === tier &&
    templatePromoVal > 0;

  if (templatePromoActive) {
    return {
      tier,
      tierLabel,
      normalPrice: basePrice,
      finalPrice: templatePromoVal,
      isPromo: true,
      labelPromo: (template.hargaPromo?.labelPromo || 'Promo').trim() || 'Promo',
    };
  }

  if (pkgCfg?.promoAktif && pkgCfg.hargaCoret > pkgCfg.harga) {
    return {
      tier,
      tierLabel,
      normalPrice: pkgCfg.hargaCoret,
      finalPrice: pkgCfg.harga,
      isPromo: true,
      labelPromo: (pkgCfg.labelPromo || 'Promo').trim() || 'Promo',
    };
  }

  return {
    tier,
    tierLabel,
    normalPrice: basePrice,
    finalPrice: basePrice,
    isPromo: false,
    labelPromo: 'Promo',
  };
}

export function getTemplatePreviewLink(template: TemplateItem, tier: PackageTier): string {
  const tierLink = template.linkPaket?.[tier]?.trim();
  if (tierLink && /^https?:\/\/.+/i.test(tierLink)) {
    return tierLink;
  }
  return template.linkWebsite;
}

export function getTierLabel(
  tier: PackageTier,
  packageConfigs?: Partial<Record<PackageTier, PackageConfig>>
): string {
  return packageConfigs?.[tier]?.namaPaket || PACKAGE_TIERS.find((p) => p.key === tier)?.label || tier;
}

export function formatNomorWA(rawPhone: string): string {
  const digits = rawPhone.replace(/[\s\-+().]/g, '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export const normalizeWhatsAppNumber = formatNomorWA;

export function buildWhatsAppUrl(phone: string, text?: string): string {
  const normalized = formatNomorWA(phone);
  if (!normalized) return '';
  const base = `https://wa.me/${normalized}`;
  if (text && text.trim()) {
    return `${base}?text=${encodeURIComponent(text.trim())}`;
  }
  return base;
}

export function buildOrderWhatsAppMessage(params: {
  paketLabel: string;
  templateName: string;
  hargaBayar: number;
  namaPria?: string;
  namaWanita?: string;
  tanggalAcara?: string;
  namaPemesan?: string;
  noWA?: string;
}): string {
  const lines = [`Saya mau order Paket ${params.paketLabel} - ${params.templateName}`];
  lines.push(`Harga: ${formatRupiah(params.hargaBayar)}`);
  if (params.namaPria && params.namaWanita) {
    lines.push(`Mempelai / Acara: ${params.namaPria} & ${params.namaWanita}`);
  }
  if (params.tanggalAcara) {
    lines.push(`Tanggal Acara: ${params.tanggalAcara}`);
  }
  if (params.namaPemesan) {
    lines.push(`Pemesan: ${params.namaPemesan}${params.noWA ? ` (${params.noWA})` : ''}`);
  }
  return lines.join('\n');
}

export function formatFirestoreTimestamp(ts: unknown): string {
  if (!ts) return '—';
  try {
    if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (ts instanceof Date) {
      return ts.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  } catch {
    return '—';
  }
  return '—';
}
