import { useEffect, useState } from 'react';
import { Check, Eye, ImageOff, ShoppingBag, X } from 'lucide-react';
import { PackageConfig, PackageTier, TemplateItem } from '../types';
import {
  formatRupiah,
  getPackagePrice,
  isPromoActive,
  PACKAGE_TIERS,
} from '../lib/pricing';

interface TemplateCardProps {
  template: TemplateItem;
  packageConfigs?: Partial<Record<PackageTier, PackageConfig>>;
  onPreview: (template: TemplateItem, selectedTier: PackageTier) => void;
  onOrder: (template: TemplateItem, selectedTier: PackageTier) => void;
}

export default function TemplateCard({
  template,
  packageConfigs,
  onPreview,
  onOrder,
}: TemplateCardProps) {
  const promoCurrentlyActive = isPromoActive(template.hargaPromo);
  const firstFirestoreTier = PACKAGE_TIERS.find((t) => Boolean(packageConfigs?.[t.key]))?.key;
  const initialTier: PackageTier = promoCurrentlyActive
    ? template.hargaPromo.paket
    : firstFirestoreTier || 'bronze';

  const [selectedTier, setSelectedTier] = useState<PackageTier>(initialTier);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [template.fotoThumbnail]);

  useEffect(() => {
    if (!promoCurrentlyActive && !packageConfigs?.[selectedTier] && firstFirestoreTier) {
      setSelectedTier(firstFirestoreTier);
    }
  }, [firstFirestoreTier, packageConfigs, promoCurrentlyActive, selectedTier]);

  const activePrice = getPackagePrice(template, selectedTier, packageConfigs);
  const pkgFromFirestore = packageConfigs?.[selectedTier];
  const activeFeatures = pkgFromFirestore?.fitur || [];
  const includedCount = activeFeatures.filter((f) => f.tersedia).length;

  return (
    <article className="group flex flex-col bg-white border border-[#C8A24D]/25 hover:border-[#C8A24D]/70 transition-all duration-200 hover:-translate-y-0.5 shadow-sm hover:shadow-lg overflow-hidden">
      {/* Thumbnail Media Frame (16:9 Full Uncropped) */}
      <div className="relative aspect-video w-full bg-[#0B0B0D] overflow-hidden border-b border-[#C8A24D]/15">
        {!imgError && template.fotoThumbnail ? (
          <img
            src={template.fotoThumbnail}
            alt={`Thumbnail ${template.namaTemplate}`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center bg-gradient-to-br from-[#141417] via-[#1C1A16] to-[#0B0B0D] text-[#FAF8F4]/70">
            <ImageOff className="w-7 h-7 text-[#C8A24D]/70 mb-2" strokeWidth={1.5} />
            <span className="font-display text-lg tracking-wide text-[#FAF8F4]">
              {template.namaTemplate}
            </span>
            <span className="text-xs text-[#FAF8F4]/50 mt-1">
              Klik Lihat Preview untuk membuka website live
            </span>
          </div>
        )}

        {/* Sharp Architectural Promo Corner Tag (Zero-Pill) */}
        {(promoCurrentlyActive || activePrice.isPromo) && (
          <div className="absolute top-3 right-3 bg-[#0B0B0D]/95 border border-[#D4AF37] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase text-[#D4AF37]">
            PROMO · {promoCurrentlyActive ? template.hargaPromo.labelPromo || 'Promo' : activePrice.labelPromo}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="flex-1 flex flex-col p-5 sm:p-6">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9E7B2F] mb-1">
            {template.kategori || 'Pernikahan'}
          </p>
          <h3 className="font-display text-2xl font-semibold text-[#111113] leading-snug tracking-tight">
            {template.namaTemplate}
          </h3>
          <p className="mt-2 text-sm text-[#52525B] leading-relaxed line-clamp-2 min-h-[2.625rem]">
            {template.deskripsi}
          </p>
        </div>

        {/* 4 Clickable Package Tiers */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-[#71717A] mb-2.5 gap-2">
            <span className="font-medium text-[#111113]">Pilih Paket Harga</span>
            <span className="tabular-nums font-medium text-[#9E7B2F] text-right">
              {activePrice.tierLabel}: {formatRupiah(activePrice.finalPrice)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PACKAGE_TIERS.map((tierMeta) => {
              const priceInfo = getPackagePrice(template, tierMeta.key, packageConfigs);
              const isSelected = selectedTier === tierMeta.key;

              return (
                <button
                  key={tierMeta.key}
                  type="button"
                  onClick={() => setSelectedTier(tierMeta.key)}
                  aria-pressed={isSelected}
                  className={`text-left px-3 py-2.5 border transition-colors min-h-[60px] flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A24D] ${
                    isSelected
                      ? 'bg-[#0B0B0D] border-[#C8A24D] text-[#FAF8F4]'
                      : 'bg-[#FAF8F4] border-[#E4E0D8] text-[#111113] hover:border-[#C8A24D]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-xs font-semibold tracking-wide uppercase whitespace-nowrap">
                      {priceInfo.tierLabel}
                    </span>
                    {priceInfo.isPromo && (
                      <span
                        className={`text-[10px] font-semibold tracking-wider uppercase truncate ${
                          isSelected ? 'text-[#D4AF37]' : 'text-[#9E7B2F]'
                        }`}
                      >
                        {priceInfo.labelPromo}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                    {priceInfo.isPromo ? (
                      <>
                        <span
                          className={`text-[11px] line-through tabular-nums ${
                            isSelected ? 'text-[#FAF8F4]/50' : 'text-[#71717A]'
                          }`}
                        >
                          {formatRupiah(priceInfo.normalPrice)}
                        </span>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            isSelected ? 'text-[#D4AF37]' : 'text-[#9E7B2F]'
                          }`}
                        >
                          {formatRupiah(priceInfo.finalPrice)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold tabular-nums">
                        {formatRupiah(priceInfo.finalPrice)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feature Checklist Box (100% from Firestore) */}
        <div className="mb-5 bg-[#FAF8F4] border border-[#C8A24D]/30 p-3.5">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-[#E4E0D8]">
            <p className="text-xs font-semibold text-[#111113] uppercase tracking-wider">
              Fitur yang Kamu Dapat · {activePrice.tierLabel}
            </p>
            {activeFeatures.length > 0 && (
              <span className="text-[11px] font-medium text-[#9E7B2F] tabular-nums shrink-0">
                {includedCount}/{activeFeatures.length} Fitur
              </span>
            )}
          </div>

          {activeFeatures.length === 0 ? (
            <p className="text-xs text-[#71717A] leading-relaxed">
              Belum ada daftar fitur untuk paket {activePrice.tierLabel} di Firestore.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {activeFeatures.map((fitur) => (
                <li key={fitur.id} className="flex items-start gap-2 leading-snug">
                  {fitur.tersedia ? (
                    <>
                      <Check
                        className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                      <span className="text-[#18181B] font-medium">{fitur.nama}</span>
                    </>
                  ) : (
                    <>
                      <X
                        className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0 mt-0.5"
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
                      <span className="text-[#71717A] line-through">{fitur.nama}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-auto pt-4 border-t border-[#E4E0D8] grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onPreview(template, selectedTier)}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-xs sm:text-sm font-medium border border-[#111113] text-[#111113] bg-white hover:bg-[#111113] hover:text-[#FAF8F4] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A24D]"
          >
            <Eye className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>Lihat Preview</span>
          </button>

          <button
            type="button"
            onClick={() => onOrder(template, selectedTier)}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold bg-[#C8A24D] text-[#0B0B0D] hover:bg-[#D4AF37] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0D]"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>Order {activePrice.tierLabel}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
