import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ImageOff, Lock, Menu, MessageCircle, Search, X } from 'lucide-react';
import { PackageConfig, PackageTier, StoreSettings, TemplateItem, WebsiteImages } from './types';
import {
  DEFAULT_WEBSITE_IMAGES,
  subscribePackages,
  subscribeStoreSettings,
  subscribeTemplates,
  subscribeWebsiteImages,
} from './lib/firebase';
import {
  buildWhatsAppUrl,
  formatNomorWA,
  formatRupiah,
  isPromoActive,
  PACKAGE_TIERS,
  TEMPLATE_CATEGORIES,
} from './lib/pricing';
import TemplateCard from './components/TemplateCard';
import LivePreviewModal from './components/LivePreviewModal';
import OrderModal from './components/OrderModal';

export default function App() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [packageConfigs, setPackageConfigs] = useState<Partial<Record<PackageTier, PackageConfig>>>(
    {}
  );
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ noWaAdmin: '' });
  const [websiteImages, setWebsiteImages] = useState<WebsiteImages>({ heroImage: '', alurImage: '' });
  const [imagesReady, setImagesReady] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [alurImgFailed, setAlurImgFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'semua' | 'promo'>('semua');
  const [selectedCategory, setSelectedCategory] = useState<string>('semua');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [previewState, setPreviewState] = useState<{
    template: TemplateItem;
    tier: PackageTier;
  } | null>(null);

  const [orderState, setOrderState] = useState<{
    template: TemplateItem;
    tier: PackageTier;
  } | null>(null);

  useEffect(() => {
    const unsubTemplates = subscribeTemplates(
      (items) => {
        setTemplates(items);
        setLoading(false);
        setLoadError(null);
      },
      (err) => {
        console.error('Failed loading templates:', err);
        setLoadError('Gagal memuat katalog undangan. Silakan muat ulang halaman.');
        setLoading(false);
      }
    );

    const unsubPackages = subscribePackages(
      (pkgs) => {
        setPackageConfigs(pkgs);
        setPackagesLoading(false);
      },
      (err) => {
        console.error('Failed loading package configs:', err);
        setPackagesLoading(false);
      }
    );

    const unsubSettings = subscribeStoreSettings((settings) => {
      setStoreSettings(settings);
    });

    const unsubImages = subscribeWebsiteImages(
      (imgs) => {
        setWebsiteImages(imgs);
      },
      () => {
        setImagesReady(true);
      }
    );

    return () => {
      unsubTemplates();
      unsubPackages();
      unsubSettings();
      unsubImages();
    };
  }, []);

  const activeHeroImage = websiteImages.heroImage || DEFAULT_WEBSITE_IMAGES.heroImage;
  const activeAlurImage = websiteImages.alurImage || DEFAULT_WEBSITE_IMAGES.alurImage;

  useEffect(() => {
    setHeroImgFailed(false);
  }, [activeHeroImage]);

  useEffect(() => {
    setAlurImgFailed(false);
  }, [activeAlurImage]);

  const formattedAdminWa = formatNomorWA(storeSettings.noWaAdmin);
  const chatAdminWaUrl = formattedAdminWa
    ? buildWhatsAppUrl(
        formattedAdminWa,
        'Halo Admin Sekar Kencana Invitation, saya ingin konsultasi & pesan undangan digital.'
      )
    : '';

  const firestorePackagesList = useMemo(() => {
    return Object.values(packageConfigs)
      .filter((cfg): cfg is PackageConfig => Boolean(cfg && cfg.id))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.namaPaket.localeCompare(b.namaPaket));
  }, [packageConfigs]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((item) => {
      if (filterMode === 'promo' && !isPromoActive(item.hargaPromo)) {
        return false;
      }
      const itemCat = item.kategori || 'Pernikahan';
      if (selectedCategory !== 'semua' && itemCat !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.namaTemplate.toLowerCase().includes(q) ||
        item.deskripsi.toLowerCase().includes(q) ||
        itemCat.toLowerCase().includes(q)
      );
    });
  }, [templates, searchQuery, filterMode, selectedCategory]);

  const promoCount = useMemo(
    () => templates.filter((t) => isPromoActive(t.hargaPromo)).length,
    [templates]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#111113]">
      {/* Top Bar Contract: Brand Wordmark — 4 Nav Links — 1 Primary Action */}
      <header className="sticky top-0 z-40 bg-[#0B0B0D]/95 backdrop-blur-sm border-b border-[#C8A24D]/25 text-[#FAF8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-[72px] flex items-center justify-between gap-4 lg:gap-8">
          <a
            href="#"
            className="inline-flex items-center gap-2.5 sm:gap-3 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A24D]"
          >
            <img
              src="/assets/logo-sk.png"
              alt="Logo Sekar Kencana"
              className="h-9 sm:h-10 lg:h-11 w-auto object-contain shrink-0"
            />
            <span className="font-display text-sm sm:text-base lg:text-xl font-semibold tracking-[0.08em] sm:tracking-[2px] text-[#D4AF37] whitespace-nowrap">
              SEKAR KENCANA INVITATION
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium text-[#FAF8F4]/80">
            <a
              href="#katalog"
              className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
            >
              Katalog
            </a>
            <a
              href="#paket-harga"
              className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
            >
              Paket Harga
            </a>
            <a
              href="#cara-pesan"
              className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
            >
              Cara Pesan
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="#katalog"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 min-h-[40px] bg-[#C8A24D] hover:bg-[#D4AF37] text-[#0B0B0D] text-xs font-semibold tracking-wide transition-colors whitespace-nowrap shrink-0"
            >
              Pilih Undangan
            </a>

            <a
              href="/admin.html"
              aria-label="Akses Pengelola"
              className="hidden md:inline-flex items-center justify-center w-8 h-8 text-[#C8A24D]/65 hover:text-[#D4AF37] transition-colors shrink-0"
            >
              <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 border border-[#C8A24D]/30 text-[#FAF8F4]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-[#C8A24D]/20 bg-[#0B0B0D] px-4 py-4 flex flex-col gap-3 text-sm">
            <a
              href="#katalog"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-[#FAF8F4]/90 hover:text-[#D4AF37]"
            >
              Katalog Undangan
            </a>
            <a
              href="#paket-harga"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-[#FAF8F4]/90 hover:text-[#D4AF37]"
            >
              Paket Harga
            </a>
            <a
              href="#cara-pesan"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-[#FAF8F4]/90 hover:text-[#D4AF37]"
            >
              Cara Pemesanan
            </a>
            <div className="pt-2 border-t border-white/10 flex justify-end">
              <a
                href="/admin.html"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Akses Pengelola"
                className="inline-flex items-center justify-center w-8 h-8 text-[#C8A24D]/70 hover:text-[#D4AF37] transition-colors"
              >
                <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
              </a>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-[#0B0B0D] text-[#FAF8F4] border-b border-[#C8A24D]/25">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              {/* Left Copy */}
              <div className="lg:col-span-7 flex flex-col justify-center">
                <div className="w-full flex justify-center mb-4">
                  <img
                    src="/assets/logo-sk.png"
                    alt="Logo Sekar Kencana"
                    className="w-[110px] md:w-[140px] h-auto object-contain"
                  />
                </div>
                <p className="text-center lg:text-left text-xs font-medium tracking-[0.18em] uppercase text-[#D4AF37] mb-4">
                  Katalog Website Undangan Digital Premium
                </p>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold leading-[1.1] tracking-tight text-[#FAF8F4] text-balance">
                  Undangan Digital Siap Pakai dengan Estetika Mewah
                </h1>
                <p className="mt-5 text-base sm:text-lg text-[#FAF8F4]/75 leading-relaxed max-w-2xl">
                  Jelajahi koleksi website undangan pernikahan, ulang tahun, khitanan, hingga acara
                  spesial lainnya. Klik{' '}
                  <strong className="text-[#FAF8F4] font-medium">Lihat Preview</strong> untuk
                  mencoba seluruh fitur asli secara langsung—mulai dari tombol Buka Undangan,
                  countdown, musik latar, galeri foto, RSVP, hingga Google Maps.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <a
                    href="#katalog"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] bg-[#C8A24D] hover:bg-[#D4AF37] text-[#0B0B0D] text-sm font-semibold tracking-wide transition-colors whitespace-nowrap"
                  >
                    <span>Lihat Katalog Template</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href="#cara-pesan"
                    className="inline-flex items-center justify-center px-5 py-3.5 min-h-[48px] border border-[#C8A24D]/40 text-[#FAF8F4] hover:border-[#D4AF37] hover:text-[#D4AF37] text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    Cara Pemesanan
                  </a>
                </div>
              </div>

              {/* Right Editorial Visual */}
              <div className="lg:col-span-5">
                <div className="h-full min-h-[260px] sm:min-h-[340px] border border-[#C8A24D]/35 bg-[#141417] overflow-hidden">
                  {!imagesReady ? (
                    <div className="w-full h-full bg-[#141417] animate-pulse" />
                  ) : !heroImgFailed ? (
                    <img
                      src={activeHeroImage}
                      alt="Koleksi undangan pernikahan digital mewah Sekar Kencana Invitation"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#FAF8F4]/60">
                      <ImageOff className="w-7 h-7 text-[#C8A24D]/60 mb-2" />
                      <p className="font-display text-lg text-[#FAF8F4]">Sekar Kencana Invitation</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Package Tier Strip (100% from Firestore `packages` collection) */}
            <div id="paket-harga" className="mt-12 pt-8 border-t border-[#C8A24D]/20">
              {packagesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[1, 2, 3, 4].map((idx) => (
                    <div
                      key={idx}
                      className="border border-white/10 bg-[#121216] p-5 h-40 animate-pulse"
                    >
                      <div className="h-4 w-24 bg-white/10 mb-4" />
                      <div className="h-3 w-full bg-white/10 mb-2" />
                      <div className="h-3 w-4/5 bg-white/10" />
                    </div>
                  ))}
                </div>
              ) : firestorePackagesList.length === 0 ? (
                <div className="border border-white/10 bg-[#121216] p-5 text-center text-xs text-[#FAF8F4]/70">
                  Informasi paket layanan sedang disiapkan.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {firestorePackagesList.map((cfg) => {
                    const hasPromo = cfg.promoAktif && cfg.hargaCoret > cfg.harga;
                    const includedFeatures = cfg.fitur.filter((f) => f.tersedia);

                    return (
                      <div
                        key={cfg.id}
                        className="border border-white/10 bg-[#121216] p-4 sm:p-5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
                              {cfg.namaPaket}
                            </span>
                            <div className="text-right">
                              {hasPromo && (
                                <span className="block text-[11px] text-[#FAF8F4]/45 line-through tabular-nums">
                                  {formatRupiah(cfg.hargaCoret)}
                                </span>
                              )}
                              <span className="text-sm sm:text-base font-semibold text-[#FAF8F4] tabular-nums">
                                {formatRupiah(cfg.harga)}
                              </span>
                            </div>
                          </div>

                          {hasPromo && (
                            <p className="mt-1 text-[10px] uppercase tracking-wider font-semibold text-[#D4AF37]">
                              {cfg.labelPromo || 'Promo'}
                            </p>
                          )}

                          {includedFeatures.length > 0 && (
                            <ul className="mt-3 space-y-1.5 text-xs text-[#FAF8F4]/70">
                              {includedFeatures.slice(0, 5).map((item) => (
                                <li key={item.id} className="flex items-start gap-1.5 leading-snug">
                                  <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                                  <span>{item.nama}</span>
                                </li>
                              ))}
                              {includedFeatures.length > 5 && (
                                <li className="text-[11px] text-[#D4AF37]/80 pl-5">
                                  +{includedFeatures.length - 5} fitur lainnya
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Catalog Section */}
        <section id="katalog" className="py-14 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header + Filter Controls */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#E4E0D8]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9E7B2F]">
                  Pilihan Desain Eksklusif
                </p>
                <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-semibold text-[#111113]">
                  Katalog Website Undangan
                </h2>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama tema..."
                    aria-label="Cari nama template"
                    className="w-full sm:w-64 pl-10 pr-4 py-2.5 min-h-[44px] bg-white border border-[#D4CFC5] text-sm text-[#111113] placeholder:text-[#71717A] focus:outline-none focus:border-[#9E7B2F]"
                  />
                </div>

                {/* Segmented Filter Tabs */}
                <div className="inline-flex p-1 bg-[#EFECE5] border border-[#E4E0D8]">
                  <button
                    type="button"
                    onClick={() => setFilterMode('semua')}
                    className={`px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      filterMode === 'semua'
                        ? 'bg-[#0B0B0D] text-[#FAF8F4]'
                        : 'text-[#52525B] hover:text-[#111113]'
                    }`}
                  >
                    Semua ({templates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('promo')}
                    className={`px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      filterMode === 'promo'
                        ? 'bg-[#0B0B0D] text-[#D4AF37]'
                        : 'text-[#52525B] hover:text-[#111113]'
                    }`}
                  >
                    Sedang Promo ({promoCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="pt-4 flex items-center gap-2 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('semua')}
                className={`px-3.5 py-2 min-h-[38px] text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === 'semua'
                    ? 'bg-[#0B0B0D] border-[#0B0B0D] text-[#D4AF37]'
                    : 'bg-white border-[#E4E0D8] text-[#52525B] hover:border-[#C8A24D] hover:text-[#111113]'
                }`}
              >
                Semua Kategori
              </button>
              {TEMPLATE_CATEGORIES.map((cat) => {
                const count = templates.filter(
                  (t) => (t.kategori || 'Pernikahan') === cat
                ).length;
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 min-h-[38px] text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#0B0B0D] border-[#0B0B0D] text-[#D4AF37]'
                        : 'bg-white border-[#E4E0D8] text-[#52525B] hover:border-[#C8A24D] hover:text-[#111113]'
                    }`}
                  >
                    {cat} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>

            {/* Catalog Content States */}
            {loading ? (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-[#E4E0D8] overflow-hidden animate-pulse"
                  >
                    <div className="aspect-video bg-[#E8E4DC]" />
                    <div className="p-6 space-y-4">
                      <div className="h-6 bg-[#E8E4DC] w-2/3" />
                      <div className="h-4 bg-[#E8E4DC] w-full" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-14 bg-[#EFECE5]" />
                        <div className="h-14 bg-[#EFECE5]" />
                        <div className="h-14 bg-[#EFECE5]" />
                        <div className="h-14 bg-[#EFECE5]" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="h-11 bg-[#E8E4DC]" />
                        <div className="h-11 bg-[#E8E4DC]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="mt-8 p-8 bg-white border border-red-200 text-center">
                <p className="text-sm text-red-700 font-medium">{loadError}</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="mt-8 p-10 sm:p-14 bg-white border border-[#C8A24D]/30 text-center max-w-2xl mx-auto">
                <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[#111113]">
                  {templates.length === 0
                    ? 'Belum Ada Template di Firestore'
                    : 'Tidak Ada Template yang Cocok'}
                </h3>
                <p className="mt-2.5 text-sm text-[#52525B] leading-relaxed">
                  {templates.length === 0
                    ? 'Koleksi undangan digital eksklusif kami sedang disiapkan. Silakan hubungi tim kami melalui WhatsApp atau kunjungi kembali beberapa saat lagi.'
                    : 'Coba ubah kata kunci pencarian atau pilih kategori Lainnya untuk melihat seluruh koleksi template kami.'}
                </p>
                {templates.length === 0 ? (
                  chatAdminWaUrl ? (
                    <a
                      href={chatAdminWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-[#0B0B0D] text-[#D4AF37] text-sm font-semibold hover:bg-[#1C1C21] transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Hubungi via WhatsApp</span>
                    </a>
                  ) : null
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterMode('semua');
                      setSelectedCategory('semua');
                    }}
                    className="mt-6 inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] bg-[#0B0B0D] text-[#FAF8F4] text-sm font-medium"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    packageConfigs={packageConfigs}
                    onPreview={(tpl, tier) => setPreviewState({ template: tpl, tier })}
                    onOrder={(tpl, tier) => setOrderState({ template: tpl, tier })}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* How It Works / Craftsmanship Section */}
        <section
          id="cara-pesan"
          className="bg-[#0B0B0D] text-[#FAF8F4] border-t border-[#C8A24D]/25 py-14 sm:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              <div className="lg:col-span-5">
                <div className="h-full min-h-[260px] border border-[#C8A24D]/35 overflow-hidden bg-[#141417]">
                  {!imagesReady ? (
                    <div className="w-full h-full bg-[#141417] animate-pulse" />
                  ) : !alurImgFailed ? (
                    <img
                      src={activeAlurImage}
                      alt="Proses kurasi dan penyiapan undangan digital Sekar Kencana Invitation"
                      referrerPolicy="no-referrer"
                      onError={() => setAlurImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#FAF8F4]/60">
                      <ImageOff className="w-7 h-7 text-[#C8A24D]/60 mb-2" />
                      <p className="font-display text-lg text-[#FAF8F4]">Alur Pemesanan Mudah</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
                  Alur Pemesanan Mudah
                </p>
                <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-[#FAF8F4]">
                  Tiga Langkah Menuju Undangan Siap Sebar
                </h2>

                <div className="mt-8 space-y-6 divide-y divide-white/10">
                  <div className="pt-2">
                    <h3 className="font-display text-2xl font-semibold text-[#D4AF37]">
                      01. Coba Live Preview Website Asli
                    </h3>
                    <p className="mt-1.5 text-sm text-[#FAF8F4]/75 leading-relaxed">
                      Tekan tombol Lihat Preview pada desain pilihan Anda untuk menguji animasi,
                      musik latar, galeri foto, serta fitur RSVP secara langsung.
                    </p>
                  </div>

                  <div className="pt-6">
                    <h3 className="font-display text-2xl font-semibold text-[#D4AF37]">
                      02. Pilih Paket &amp; Cek Daftar Fiturnya
                    </h3>
                    <p className="mt-1.5 text-sm text-[#FAF8F4]/75 leading-relaxed">
                      Klik paket yang tersedia untuk melihat rincian fitur yang Anda dapatkan
                      secara transparan sebelum memesan.
                    </p>
                  </div>

                  <div className="pt-6">
                    <h3 className="font-display text-2xl font-semibold text-[#D4AF37]">
                      03. Proses Penyiapan &amp; Pengiriman Link via WhatsApp
                    </h3>
                    <p className="mt-1.5 text-sm text-[#FAF8F4]/75 leading-relaxed">
                      Tim kami akan menduplikasi website undangan asli, menyesuaikan seluruh
                      detail acara Anda, dan mengirimkan tautan undangan aktif melalui WhatsApp.
                    </p>
                  </div>
                </div>

                {chatAdminWaUrl && (
                  <div className="mt-8 pt-6 border-t border-white/10">
                    <a
                      href={chatAdminWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-[#C8A24D] hover:bg-[#D4AF37] text-[#0B0B0D] text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>Pesan &amp; Konsultasi via WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#070709] text-[#FAF8F4]/70 border-t border-[#C8A24D]/20 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center gap-6 text-xs">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a href="#katalog" className="hover:text-[#FAF8F4] transition-colors">
              Katalog
            </a>
            <a href="#paket-harga" className="hover:text-[#FAF8F4] transition-colors">
              Paket Harga
            </a>
            <a href="#cara-pesan" className="hover:text-[#FAF8F4] transition-colors">
              Cara Pesan
            </a>
            {chatAdminWaUrl && (
              <a
                href={chatAdminWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Chat WhatsApp</span>
              </a>
            )}
          </div>

          <div className="flex flex-col items-center">
            <img
              src="/assets/logo-sk.png"
              alt="Logo Sekar Kencana"
              className="w-[60px] h-[60px] object-contain mx-auto mb-3"
            />
            <p>&copy; {new Date().getFullYear()} Sekar Kencana Invitation</p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp CTA (100% from Firestore settings/whatsapp) */}
      {chatAdminWaUrl && (
        <a
          href={chatAdminWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat via WhatsApp"
          className="fixed bottom-4 right-4 z-40 inline-flex items-center justify-center gap-2 h-11 px-3.5 sm:px-4 bg-[#0B0B0D] hover:bg-[#16161B] border border-[#C8A24D] text-[#FAF8F4] shadow-xl transition-colors whitespace-nowrap"
        >
          <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold tracking-wide text-[#D4AF37]">
            Chat WA
          </span>
        </a>
      )}

      {/* Live Iframe Preview Modal */}
      <LivePreviewModal
        template={previewState?.template ?? null}
        initialTier={previewState?.tier}
        packageConfigs={packageConfigs}
        onClose={() => setPreviewState(null)}
        onProceedToOrder={(tpl, tier) => {
          setOrderState({ template: tpl, tier });
        }}
      />

      {/* Order Form Modal */}
      <OrderModal
        template={orderState?.template ?? null}
        initialTier={orderState?.tier ?? 'bronze'}
        packageConfigs={packageConfigs}
        adminWaNumber={storeSettings.noWaAdmin}
        onClose={() => setOrderState(null)}
      />
    </div>
  );
}
