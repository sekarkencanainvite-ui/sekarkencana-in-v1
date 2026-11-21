export type PackageTier = string;

export type OrderStatus = 'baru' | 'diproses' | 'selesai';

export type TemplateCategory =
  | 'Pernikahan'
  | 'Ulang Tahun'
  | 'Khitanan'
  | 'Aqiqah'
  | 'Lamaran & Wisuda'
  | 'Acara Lainnya';

export type HargaPaket = Record<string, number>;

export type LinkPaket = Record<string, string>;

export interface HargaPromo {
  aktif: boolean;
  paket: PackageTier;
  hargaPromo: number;
  labelPromo: string;
  tanggalMulai: string;
  tanggalSelesai: string;
}

export interface PackageFeatureItem {
  id: string;
  nama: string;
  tersedia: boolean;
}

export interface PackageConfig {
  id: PackageTier;
  namaPaket: string;
  harga: number;
  hargaCoret: number;
  promoAktif: boolean;
  labelPromo: string;
  order: number;
  fitur: PackageFeatureItem[];
  updatedAt?: unknown;
}

export interface TemplateItem {
  id: string;
  namaTemplate: string;
  kategori: string;
  fotoThumbnail: string;
  linkWebsite: string;
  linkPaket: LinkPaket;
  deskripsi: string;
  hargaPaket: HargaPaket;
  hargaPromo: HargaPromo;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TemplateFormPayload {
  namaTemplate: string;
  kategori: string;
  fotoThumbnail: string;
  linkWebsite: string;
  linkPaket: LinkPaket;
  deskripsi: string;
  hargaPaket: HargaPaket;
  hargaPromo: HargaPromo;
}

export interface OrderItem {
  id: string;
  templateId: string;
  templateName: string;
  paketDipilih: PackageTier;
  hargaBayar: number;
  namaPria: string;
  namaWanita: string;
  tanggalAcara: string;
  namaPemesan: string;
  noWA: string;
  status: OrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderFormPayload {
  templateId: string;
  templateName: string;
  paketDipilih: PackageTier;
  hargaBayar: number;
  namaPria: string;
  namaWanita: string;
  tanggalAcara: string;
  namaPemesan: string;
  noWA: string;
}

export interface AdminProfile {
  uid: string;
  username: string;
  email: string;
  role: string;
}

export interface StoreSettings {
  noWaAdmin: string;
}

export interface WebsiteImages {
  heroImage: string;
  alurImage: string;
}
