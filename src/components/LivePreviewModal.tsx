import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Monitor,
  Smartphone,
  X,
  ShoppingBag,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { PackageConfig, PackageTier, TemplateItem } from '../types';
import {
  getTemplatePreviewLink,
  getTierLabel,
  isPromoActive,
  PACKAGE_TIERS,
} from '../lib/pricing';

interface LivePreviewModalProps {
  template: TemplateItem | null;
  initialTier?: PackageTier;
  packageConfigs?: Partial<Record<PackageTier, PackageConfig>>;
  onClose: () => void;
  onProceedToOrder: (template: TemplateItem, selectedTier: PackageTier) => void;
}

export default function LivePreviewModal({
  template,
  initialTier,
  packageConfigs,
  onClose,
  onProceedToOrder,
}: LivePreviewModalProps) {
  const [viewportMode, setViewportMode] = useState<'mobile' | 'desktop'>('mobile');
  const [previewTier, setPreviewTier] = useState<PackageTier>(initialTier || 'gold');
  const [isLoading, setIsLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    if (!template) return;
    const defaultTier: PackageTier =
      initialTier || (isPromoActive(template.hargaPromo) ? template.hargaPromo.paket : 'gold');
    setPreviewTier(defaultTier);
  }, [template, initialTier]);

  useEffect(() => {
    if (!template) return;
    setIsLoading(true);
    setIframeError(false);

    const loadingTimeout = window.setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(loadingTimeout);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [template, previewTier, onClose]);

  if (!template) return null;

  const activeUrl = getTemplatePreviewLink(template, previewTier);
  const activeTierLabel = getTierLabel(previewTier, packageConfigs);
  const hasTierLinks = Boolean(
    template.linkPaket &&
      (template.linkPaket.bronze ||
        template.linkPaket.silver ||
        template.linkPaket.gold ||
        template.linkPaket.platinum)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0B0B0D] text-[#FAF8F4]"
      role="dialog"
      aria-modal="true"
      aria-label={`Live Preview ${template.namaTemplate}`}
    >
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-[#111114] border-b border-[#C8A24D]/30 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-[#D4AF37]">
            <span className="uppercase tracking-[0.14em] font-semibold">
              Live Preview · {activeTierLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate text-[#FAF8F4]/60 font-mono text-[11px]">
              {activeUrl}
            </span>
          </div>
          <h2 className="font-display text-lg sm:text-xl font-semibold text-[#FAF8F4] truncate">
            {template.namaTemplate}
          </h2>
        </div>

        {/* Package Preview Switcher (if per-package URLs exist) */}
        {hasTierLinks && (
          <div className="hidden lg:flex items-center gap-1 p-1 bg-[#1A1A1F] border border-[#C8A24D]/20 shrink-0">
            {PACKAGE_TIERS.map((tierMeta) => {
              const isSelected = previewTier === tierMeta.key;
              return (
                <button
                  key={tierMeta.key}
                  type="button"
                  onClick={() => setPreviewTier(tierMeta.key)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#C8A24D] text-[#0B0B0D]'
                      : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
                  }`}
                >
                  {getTierLabel(tierMeta.key, packageConfigs)}
                </button>
              );
            })}
          </div>
        )}

        {/* Viewport Switcher */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-[#1A1A1F] border border-[#C8A24D]/20 shrink-0">
          <button
            type="button"
            onClick={() => setViewportMode('mobile')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              viewportMode === 'mobile'
                ? 'bg-[#C8A24D] text-[#0B0B0D]'
                : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Tampilan HP</span>
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('desktop')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              viewportMode === 'desktop'
                ? 'bg-[#C8A24D] text-[#0B0B0D]'
                : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Layar Penuh</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium border border-[#C8A24D]/40 text-[#FAF8F4] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buka di Tab Baru</span>
            <span className="sm:hidden">Tab Baru</span>
          </a>

          <button
            type="button"
            onClick={() => {
              onClose();
              onProceedToOrder(template, previewTier);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold bg-[#C8A24D] text-[#0B0B0D] hover:bg-[#D4AF37] transition-colors whitespace-nowrap"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Order {activeTierLabel}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Preview"
            className="inline-flex items-center justify-center w-10 h-10 border border-white/15 text-[#FAF8F4]/80 hover:text-white hover:border-white/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile/Tablet Package Switcher Strip (if per-package URLs exist) */}
      {hasTierLinks && (
        <div className="lg:hidden flex items-center gap-1.5 px-4 py-2 bg-[#141418] border-b border-white/10 overflow-x-auto shrink-0">
          <span className="text-[11px] text-[#FAF8F4]/60 shrink-0 mr-1">Preview Paket:</span>
          {PACKAGE_TIERS.map((tierMeta) => {
            const isSelected = previewTier === tierMeta.key;
            return (
              <button
                key={tierMeta.key}
                type="button"
                onClick={() => setPreviewTier(tierMeta.key)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#C8A24D] text-[#0B0B0D]'
                    : 'bg-[#1D1D22] text-[#FAF8F4]/80 border border-white/10'
                }`}
              >
                {getTierLabel(tierMeta.key, packageConfigs)}
              </button>
            );
          })}
        </div>
      )}

      {/* Live Iframe Area */}
      <div className="relative flex-1 flex items-center justify-center bg-[#070709] overflow-hidden p-0 md:p-4">
        {isLoading && !iframeError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0B0B0D]/90 pointer-events-none">
            <Loader2 className="w-7 h-7 text-[#D4AF37] animate-spin mb-3" />
            <p className="text-sm text-[#FAF8F4]/80">Memuat website undangan live...</p>
          </div>
        )}

        {iframeError ? (
          <div className="max-w-md mx-auto p-6 bg-[#141417] border border-[#C8A24D]/40 text-center">
            <AlertTriangle className="w-8 h-8 text-[#D4AF37] mx-auto mb-3" />
            <h3 className="font-display text-2xl font-semibold text-[#FAF8F4]">
              Preview Diblokir oleh Situs Asal
            </h3>
            <p className="mt-2 text-sm text-[#FAF8F4]/75 leading-relaxed">
              Website undangan eksternal ini membatasi penayangan di dalam frame. Silakan buka langsung
              di tab baru untuk mencoba semua fitur interaktifnya secara penuh.
            </p>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-[#C8A24D] text-[#0B0B0D] text-sm font-semibold hover:bg-[#D4AF37] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka Website Live di Tab Baru</span>
            </a>
          </div>
        ) : (
          <div
            className={`h-full transition-all duration-200 bg-white overflow-hidden ${
              viewportMode === 'mobile'
                ? 'w-full md:w-[410px] md:border md:border-[#C8A24D]/40 md:shadow-2xl'
                : 'w-full border border-[#C8A24D]/25'
            }`}
          >
            <iframe
              key={`${template.id}-${previewTier}`}
              src={activeUrl}
              title={`Live Preview ${template.namaTemplate} (${activeTierLabel})`}
              className="w-full h-full border-0 bg-white"
              allow="autoplay; fullscreen; clipboard-write; encrypted-media; geolocation"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setIframeError(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Fallback Notice Strip */}
      <footer className="px-4 py-2 bg-[#111114] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#FAF8F4]/70 shrink-0">
        <span>
          Semua tombol (Buka Undangan, countdown, musik, galeri, RSVP, WhatsApp, Maps) berjalan langsung dari website asli.
        </span>
        <a
          href={activeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#D4AF37] hover:underline font-medium inline-flex items-center gap-1 whitespace-nowrap"
        >
          <span>Layar kosong/diblokir? Buka di tab baru</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </footer>
    </div>
  );
}
