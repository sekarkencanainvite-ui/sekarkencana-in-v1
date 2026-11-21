import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, MessageCircle, X } from 'lucide-react';
import { PackageConfig, PackageTier, TemplateItem } from '../types';
import { createOrder } from '../lib/firebase';
import {
  buildOrderWhatsAppMessage,
  buildWhatsAppUrl,
  formatRupiah,
  getOrderedPackages,
  getPackagePrice,
  isPackageAvailableForTemplate,
} from '../lib/pricing';

interface OrderModalProps {
  template: TemplateItem | null;
  initialTier: PackageTier;
  packageConfigs?: Partial<Record<PackageTier, PackageConfig>>;
  adminWaNumber?: string;
  onClose: () => void;
}

export default function OrderModal({
  template,
  initialTier,
  packageConfigs,
  adminWaNumber = '',
  onClose,
}: OrderModalProps) {
  const [selectedTier, setSelectedTier] = useState<PackageTier>(initialTier);
  const [namaPria, setNamaPria] = useState('');
  const [namaWanita, setNamaWanita] = useState('');
  const [tanggalAcara, setTanggalAcara] = useState('');
  const [namaPemesan, setNamaPemesan] = useState('');
  const [noWA, setNoWA] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const orderedPackages = useMemo(() => getOrderedPackages(packageConfigs), [packageConfigs]);

  useEffect(() => {
    if (!template) {
      setSelectedTier(initialTier);
    } else if (isPackageAvailableForTemplate(template, initialTier)) {
      setSelectedTier(initialTier);
    } else {
      const firstValid = orderedPackages.find((t) => isPackageAvailableForTemplate(template, t.key));
      setSelectedTier(firstValid?.key || initialTier);
    }
    setErrorMsg(null);
    setCreatedOrderId(null);
  }, [template, initialTier, orderedPackages]);

  useEffect(() => {
    if (!template) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [template, onClose]);

  if (!template) return null;

  const selectedIsAvailable = isPackageAvailableForTemplate(template, selectedTier);
  const activePrice = getPackagePrice(template, selectedTier, packageConfigs);
  const activeFeatures = packageConfigs?.[selectedTier]?.fitur || [];

  const waOrderText = buildOrderWhatsAppMessage({
    paketLabel: activePrice.tierLabel,
    templateName: template.namaTemplate,
    hargaBayar: activePrice.finalPrice,
    namaPria: namaPria.trim(),
    namaWanita: namaWanita.trim(),
    tanggalAcara: tanggalAcara.trim(),
    namaPemesan: namaPemesan.trim(),
    noWA: noWA.trim(),
  });
  const waOrderHref = buildWhatsAppUrl(adminWaNumber, waOrderText);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isPackageAvailableForTemplate(template, selectedTier)) {
      setErrorMsg('Template tidak tersedia untuk paket ini sehingga tidak dapat dipesan.');
      return;
    }

    if (!namaPria.trim() || !namaWanita.trim() || !tanggalAcara.trim() || !namaPemesan.trim() || !noWA.trim()) {
      setErrorMsg('Mohon lengkapi seluruh data acara dan kontak pemesan.');
      return;
    }

    const digits = noWA.replace(/\D/g, '');
    if (digits.length < 8) {
      setErrorMsg('Nomor WhatsApp tidak valid. Masukkan minimal 8 digit angka.');
      return;
    }

    setSubmitting(true);
    try {
      const orderId = await createOrder({
        templateId: template.id,
        templateName: template.namaTemplate,
        paketDipilih: selectedTier,
        hargaBayar: activePrice.finalPrice,
        namaPria: namaPria.trim(),
        namaWanita: namaWanita.trim(),
        tanggalAcara: tanggalAcara.trim(),
        namaPemesan: namaPemesan.trim(),
        noWA: noWA.trim(),
      });
      setCreatedOrderId(orderId);
    } catch (err) {
      console.error('Order submit error:', err);
      setErrorMsg('Gagal mengirim pesanan. Periksa koneksi Anda lalu coba kembali.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B0B0D]/80 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Form Order ${template.namaTemplate}`}
    >
      <div className="w-full sm:max-w-xl max-h-[94vh] overflow-y-auto bg-[#FAF8F4] text-[#111113] border border-[#C8A24D]/40 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 sm:px-6 py-4 bg-[#0B0B0D] text-[#FAF8F4] border-b border-[#C8A24D]/30">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
              Formulir Pemesanan · Paket {activePrice.tierLabel}
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-semibold truncate">
              {template.namaTemplate}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form order"
            className="w-10 h-10 inline-flex items-center justify-center border border-white/15 text-[#FAF8F4]/80 hover:text-white hover:border-white/40 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {createdOrderId ? (
          <div className="p-6 sm:p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#9E7B2F] mx-auto mb-4" strokeWidth={1.5} />
            <h3 className="font-display text-3xl font-semibold text-[#111113]">
              Pesanan Berhasil Diterima
            </h3>
            <p className="mt-2 text-sm text-[#52525B] max-w-md mx-auto leading-relaxed">
              Terima kasih, <strong className="text-[#111113]">{namaPemesan}</strong>. Pesanan Anda
              sudah tercatat. Klik tombol WhatsApp di bawah untuk konfirmasi langsung dengan tim kami.
            </p>

            <div className="mt-6 text-left bg-white border border-[#C8A24D]/30 p-5 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4 border-b border-[#E4E0D8] pb-2">
                <span className="text-[#71717A]">ID Pesanan</span>
                <span className="font-mono text-xs text-[#111113]">{createdOrderId}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#71717A]">Template</span>
                <span className="font-medium text-[#111113]">{template.namaTemplate}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#71717A]">Paket Dipilih</span>
                <span className="font-medium text-[#111113] uppercase">{activePrice.tierLabel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#71717A]">Nama Acara / Mempelai</span>
                <span className="font-medium text-[#111113]">
                  {namaPria} &amp; {namaWanita}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#71717A]">Tanggal Acara</span>
                <span className="font-medium text-[#111113] tabular-nums">{tanggalAcara}</span>
              </div>
              <div className="flex justify-between gap-4 pt-2 border-t border-[#E4E0D8]">
                <span className="font-semibold text-[#111113]">Total Pembayaran</span>
                <span className="font-semibold text-[#9E7B2F] text-base tabular-nums">
                  {formatRupiah(activePrice.finalPrice)}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {waOrderHref ? (
                <a
                  href={waOrderHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Lanjut Order via WhatsApp (Paket {activePrice.tierLabel})</span>
                </a>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  Nomor WhatsApp layanan belum tersedia. Pesanan Anda sudah tercatat dengan baik.
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 min-h-[44px] bg-[#0B0B0D] text-[#FAF8F4] text-sm font-semibold hover:bg-[#1C1C21] transition-colors"
              >
                Kembali ke Katalog
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
            {/* Pilih Paket */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#52525B] mb-2">
                1. Pilih Paket Layanan
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {orderedPackages.map((tierMeta) => {
                  const isAvailable = isPackageAvailableForTemplate(template, tierMeta.key);
                  const pInfo = getPackagePrice(template, tierMeta.key, packageConfigs);
                  const isSelected = selectedTier === tierMeta.key && isAvailable;
                  return (
                    <button
                      key={tierMeta.key}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (isAvailable) {
                          setSelectedTier(tierMeta.key);
                        }
                      }}
                      className={`text-left p-3 border transition-colors ${
                        !isAvailable
                          ? 'bg-[#F3F1EC] border-[#E4E0D8] text-[#71717A] cursor-not-allowed opacity-75'
                          : isSelected
                          ? 'bg-[#0B0B0D] border-[#C8A24D] text-[#FAF8F4]'
                          : 'bg-white border-[#E4E0D8] text-[#111113] hover:border-[#C8A24D]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold uppercase truncate">
                          {pInfo.tierLabel}
                        </span>
                        {isAvailable && pInfo.isPromo && (
                          <span className="text-[10px] font-semibold uppercase text-[#D4AF37] shrink-0">
                            {pInfo.labelPromo}
                          </span>
                        )}
                      </div>
                      {!isAvailable ? (
                        <p className="mt-1 text-[11px] font-medium text-red-700 leading-tight">
                          Template tidak tersedia
                        </p>
                      ) : (
                        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                          {pInfo.isPromo && (
                            <span
                              className={`text-[11px] line-through tabular-nums ${
                                isSelected ? 'text-[#FAF8F4]/50' : 'text-[#71717A]'
                              }`}
                            >
                              {formatRupiah(pInfo.normalPrice)}
                            </span>
                          )}
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              pInfo.isPromo
                                ? isSelected
                                  ? 'text-[#D4AF37]'
                                  : 'text-[#9E7B2F]'
                                : ''
                            }`}
                          >
                            {formatRupiah(pInfo.finalPrice)}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {!selectedIsAvailable && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Template tidak tersedia.</strong> Paket ini belum memiliki link template sehingga pemesanan dinonaktifkan.
                  </span>
                </div>
              )}

              {/* Compact Feature Checklist Summary (100% from Firestore) */}
              <div className="mt-3 bg-white border border-[#E4E0D8] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9E7B2F] mb-2">
                  Fitur Paket {activePrice.tierLabel}
                </p>
                {activeFeatures.length === 0 ? (
                  <p className="text-xs text-[#71717A]">
                    Belum ada daftar fitur tersimpan di Firestore untuk paket ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {activeFeatures.map((fitur) => (
                      <div key={fitur.id} className="flex items-start gap-1.5">
                        {fitur.tersedia ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                            <span className="text-[#18181B]">{fitur.nama}</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0 mt-0.5" />
                            <span className="text-[#71717A] line-through">{fitur.nama}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Data Acara & Pemesan */}
            <div className="space-y-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#52525B]">
                2. Data Acara &amp; Kontak Pemesan
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="order-pria" className="block text-xs font-medium text-[#111113] mb-1">
                    Nama Mempelai Pria / Subjek 1
                  </label>
                  <input
                    id="order-pria"
                    type="text"
                    required
                    maxLength={120}
                    value={namaPria}
                    onChange={(e) => setNamaPria(e.target.value)}
                    placeholder="Contoh: Bagas Pratama"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D4CFC5] text-sm text-[#111113] focus:outline-none focus:border-[#9E7B2F]"
                  />
                </div>
                <div>
                  <label htmlFor="order-wanita" className="block text-xs font-medium text-[#111113] mb-1">
                    Nama Mempelai Wanita / Subjek 2
                  </label>
                  <input
                    id="order-wanita"
                    type="text"
                    required
                    maxLength={120}
                    value={namaWanita}
                    onChange={(e) => setNamaWanita(e.target.value)}
                    placeholder="Contoh: Sekar Ayu"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D4CFC5] text-sm text-[#111113] focus:outline-none focus:border-[#9E7B2F]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="order-tanggal" className="block text-xs font-medium text-[#111113] mb-1">
                  Tanggal Acara
                </label>
                <input
                  id="order-tanggal"
                  type="date"
                  required
                  value={tanggalAcara}
                  onChange={(e) => setTanggalAcara(e.target.value)}
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D4CFC5] text-sm text-[#111113] focus:outline-none focus:border-[#9E7B2F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="order-pemesan" className="block text-xs font-medium text-[#111113] mb-1">
                    Nama Pemesan
                  </label>
                  <input
                    id="order-pemesan"
                    type="text"
                    required
                    maxLength={120}
                    value={namaPemesan}
                    onChange={(e) => setNamaPemesan(e.target.value)}
                    placeholder="Nama lengkap Anda"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D4CFC5] text-sm text-[#111113] focus:outline-none focus:border-[#9E7B2F]"
                  />
                </div>
                <div>
                  <label htmlFor="order-wa" className="block text-xs font-medium text-[#111113] mb-1">
                    Nomor WhatsApp
                  </label>
                  <input
                    id="order-wa"
                    type="tel"
                    required
                    maxLength={30}
                    value={noWA}
                    onChange={(e) => setNoWA(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D4CFC5] text-sm text-[#111113] tabular-nums focus:outline-none focus:border-[#9E7B2F]"
                  />
                </div>
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-white border border-[#C8A24D]/35 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#71717A]">
                  Total Harga Paket {activePrice.tierLabel}
                  {activePrice.isPromo ? ` (${activePrice.labelPromo})` : ''}
                </p>
                {activePrice.isPromo && (
                  <p className="text-xs text-[#71717A] line-through tabular-nums">
                    {formatRupiah(activePrice.normalPrice)}
                  </p>
                )}
              </div>
              <p className="text-xl font-semibold text-[#9E7B2F] tabular-nums">
                {formatRupiah(activePrice.finalPrice)}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700" role="alert">
                {errorMsg}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="submit"
                disabled={submitting || !selectedIsAvailable}
                className="w-full py-3.5 min-h-[48px] bg-[#C8A24D] hover:bg-[#D4AF37] disabled:bg-[#D4CFC5] disabled:text-[#52525B] disabled:cursor-not-allowed text-[#0B0B0D] text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim Pesanan...</span>
                  </>
                ) : !selectedIsAvailable ? (
                  <span>Template Tidak Tersedia</span>
                ) : (
                  <span>Kirim Pesanan Paket {activePrice.tierLabel}</span>
                )}
              </button>

              {selectedIsAvailable && waOrderHref ? (
                <a
                  href={waOrderHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 min-h-[44px] bg-white border border-[#111113] hover:bg-[#111113] hover:text-[#FAF8F4] text-[#111113] text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Order Cepat via WhatsApp: &ldquo;Paket {activePrice.tierLabel} - {template.namaTemplate}&rdquo;</span>
                </a>
              ) : !selectedIsAvailable ? null : (
                <p className="text-[11px] text-center text-[#71717A] py-1">
                  Gunakan tombol Kirim Pesanan di atas untuk melanjutkan pemesanan Anda.
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
