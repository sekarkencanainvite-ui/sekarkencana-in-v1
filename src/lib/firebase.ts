import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  DocumentData,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  AdminProfile,
  OrderFormPayload,
  OrderItem,
  OrderStatus,
  PackageConfig,
  PackageFeatureItem,
  PackageTier,
  StoreSettings,
  TemplateFormPayload,
  TemplateItem,
  WebsiteImages,
} from '../types';
import { formatNomorWA } from './pricing';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const DEFAULT_ADMIN_EMAIL = 'admin@sekarkencana.id';
export const DEFAULT_ADMIN_USERNAME = 'admin';

export const DEFAULT_WEBSITE_IMAGES: WebsiteImages = {
  heroImage: '/src/assets/images/hero_sekar_kencana_1794810464252.jpg',
  alurImage: '/src/assets/images/atelier_craft_gold_1794810464391.jpg',
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function findAdminByUsername(username: string): Promise<AdminProfile | null> {
  const path = 'admins';
  const cleanUsername = username.trim();
  if (!cleanUsername) return null;

  try {
    const q = query(
      collection(db, path),
      where('username', '==', cleanUsername),
      where('role', '==', 'admin'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return null;
    }
    const d = snap.docs[0];
    const data = d.data();
    return {
      uid: d.id,
      username: String(data.username ?? ''),
      email: String(data.email ?? ''),
      role: String(data.role ?? ''),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getAdminProfileByUid(uid: string): Promise<AdminProfile | null> {
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: snap.id,
      username: String(data.username ?? ''),
      email: String(data.email ?? ''),
      role: String(data.role ?? ''),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

const adminBootstrapInFlight = new Map<string, Promise<AdminProfile | null>>();

export async function ensureInitialAdminDoc(uid: string, email: string): Promise<AdminProfile | null> {
  const inFlight = adminBootstrapInFlight.get(uid);
  if (inFlight) {
    return inFlight;
  }

  const task = (async (): Promise<AdminProfile | null> => {
    const existing = await getAdminProfileByUid(uid);
    if (existing) return existing;

    if (email.toLowerCase() === DEFAULT_ADMIN_EMAIL) {
      const path = `admins/${uid}`;
      try {
        await setDoc(doc(db, 'admins', uid), {
          username: DEFAULT_ADMIN_USERNAME,
          email: DEFAULT_ADMIN_EMAIL,
          role: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return {
          uid,
          username: DEFAULT_ADMIN_USERNAME,
          email: DEFAULT_ADMIN_EMAIL,
          role: 'admin',
        };
      } catch (error) {
        const retryExisting = await getAdminProfileByUid(uid).catch(() => null);
        if (retryExisting) return retryExisting;
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }

    return null;
  })();

  adminBootstrapInFlight.set(uid, task);
  try {
    return await task;
  } finally {
    adminBootstrapInFlight.delete(uid);
  }
}

export async function updateAdminUsername(uid: string, newUsername: string): Promise<void> {
  const clean = newUsername.trim();
  const path = `admins/${uid}`;

  const existing = await findAdminByUsername(clean);
  if (existing && existing.uid !== uid) {
    throw new Error('USERNAME_TAKEN');
  }

  try {
    await updateDoc(doc(db, 'admins', uid), {
      username: clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function normalizeFiturList(raw: unknown): PackageFeatureItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object' && typeof (item as { nama?: unknown }).nama === 'string')
    .slice(0, 30)
    .map((item, idx) => {
      const obj = item as { id?: unknown; nama?: unknown; tersedia?: unknown };
      return {
        id: typeof obj.id === 'string' && obj.id ? obj.id : `f-${idx}`,
        nama: String(obj.nama ?? '').trim().slice(0, 200),
        tersedia: Boolean(obj.tersedia),
      };
    })
    .filter((f) => f.nama.length > 0);
}

function mapPackagesSnapshot(
  snapshot: QuerySnapshot<DocumentData>
): Partial<Record<PackageTier, PackageConfig>> {
  const fromFirestore: Partial<Record<PackageTier, PackageConfig>> = {};

  snapshot.docs.forEach((d) => {
    const tier = d.id as PackageTier;
    if (tier === 'bronze' || tier === 'silver' || tier === 'gold' || tier === 'platinum') {
      const data = d.data();
      fromFirestore[tier] = {
        id: tier,
        namaPaket: String(data.namaPaket ?? tier),
        harga: Number(data.harga ?? 0),
        hargaCoret: Number(data.hargaCoret ?? 0),
        promoAktif: Boolean(data.promoAktif),
        labelPromo: String(data.labelPromo ?? 'Promo'),
        order: Number(data.order ?? 1),
        fitur: normalizeFiturList(data.fitur),
        updatedAt: data.updatedAt,
      };
    }
  });

  return fromFirestore;
}

export function subscribePackages(
  onData: (packages: Partial<Record<PackageTier, PackageConfig>>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'packages';
  let active = true;

  void getDocsFromServer(collection(db, path))
    .then((serverSnap) => {
      if (active) {
        onData(mapPackagesSnapshot(serverSnap));
      }
    })
    .catch(() => {
      // onSnapshot below handles live sync and permission errors
    });

  const unsub = onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (active) {
        onData(mapPackagesSnapshot(snapshot));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    active = false;
    unsub();
  };
}

export async function savePackageConfig(pkg: PackageConfig): Promise<void> {
  const path = `packages/${pkg.id}`;
  const cleanFitur = pkg.fitur
    .filter((f) => f.nama.trim().length > 0)
    .slice(0, 30)
    .map((f, idx) => ({
      id: clampString(f.id || `f-${idx}`, 40),
      nama: clampString(f.nama, 200),
      tersedia: Boolean(f.tersedia),
    }));

  const payload = {
    namaPaket: clampString(pkg.namaPaket, 60),
    harga: clampPrice(pkg.harga),
    hargaCoret: clampPrice(pkg.hargaCoret),
    promoAktif: Boolean(pkg.promoAktif),
    labelPromo: clampString(pkg.labelPromo || 'Promo', 60),
    order: pkg.order,
    fitur: cleanFitur,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'packages', pkg.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function repairPlatinumPackage(
  fallbackFitur: PackageFeatureItem[] = []
): Promise<PackageConfig> {
  const path = 'packages/platinum';
  let existingFitur: PackageFeatureItem[] = [];

  try {
    const serverSnap = await getDocFromServer(doc(db, 'packages', 'platinum'));
    if (serverSnap.exists()) {
      existingFitur = normalizeFiturList(serverSnap.data().fitur);
    }
  } catch {
    existingFitur = normalizeFiturList(fallbackFitur);
  }

  if (existingFitur.length === 0 && fallbackFitur.length > 0) {
    existingFitur = normalizeFiturList(fallbackFitur);
  }

  const repairedPayload = {
    namaPaket: 'Platinum',
    harga: 349000,
    hargaCoret: 399000,
    promoAktif: true,
    labelPromo: 'Promo',
    order: 4,
    fitur: existingFitur,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'packages', 'platinum'), repairedPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  // Also fix any template whose template-level promo was left enabled with hargaPromo <= 0
  try {
    const templatesSnap = await getDocsFromServer(collection(db, 'templates'));
    for (const d of templatesSnap.docs) {
      const data = d.data();
      const promo = data.hargaPromo;
      const hasZeroPromo =
        promo &&
        typeof promo === 'object' &&
        Boolean(promo.aktif) &&
        Number(promo.hargaPromo ?? 0) <= 0;

      if (hasZeroPromo) {
        await updateDoc(doc(db, 'templates', d.id), {
          hargaPromo: {
            aktif: false,
            paket: promo.paket || 'gold',
            hargaPromo: 0,
            labelPromo: String(promo.labelPromo ?? 'Promo'),
            tanggalMulai: String(promo.tanggalMulai ?? ''),
            tanggalSelesai: String(promo.tanggalSelesai ?? ''),
          },
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'templates');
  }

  return {
    id: 'platinum',
    namaPaket: 'Platinum',
    harga: 349000,
    hargaCoret: 399000,
    promoAktif: true,
    labelPromo: 'Promo',
    order: 4,
    fitur: existingFitur,
  };
}

export function subscribeStoreSettings(
  onData: (settings: StoreSettings) => void
): Unsubscribe {
  const whatsappDocRef = doc(db, 'settings', 'whatsapp');
  let active = true;

  const resolveFromSnap = async (waExists: boolean, waVal: string) => {
    if (!active) return;
    if (waExists && waVal) {
      onData({ noWaAdmin: waVal });
      return;
    }
    try {
      const legacySnap = await getDocFromServer(doc(db, 'settings', 'store'));
      if (active && legacySnap.exists()) {
        const legacyVal = String(legacySnap.data().noWaAdmin ?? '').trim();
        if (legacyVal) {
          onData({ noWaAdmin: legacyVal });
          return;
        }
      }
    } catch {
      // Ignore legacy read error if absent
    }
    if (active) {
      onData({ noWaAdmin: waVal });
    }
  };

  void getDocFromServer(whatsappDocRef)
    .then((serverSnap) => {
      const val = serverSnap.exists() ? String(serverSnap.data().noWaAdmin ?? '').trim() : '';
      void resolveFromSnap(serverSnap.exists(), val);
    })
    .catch(() => {
      // onSnapshot below handles updates
    });

  const unsub = onSnapshot(
    whatsappDocRef,
    (snap) => {
      const val = snap.exists() ? String(snap.data().noWaAdmin ?? '').trim() : '';
      void resolveFromSnap(snap.exists(), val);
    },
    () => {
      if (active) {
        onData({ noWaAdmin: '' });
      }
    }
  );

  return () => {
    active = false;
    unsub();
  };
}

export async function saveStoreSettings(settings: StoreSettings): Promise<void> {
  const path = 'settings/whatsapp';
  const formatted = formatNomorWA(settings.noWaAdmin);
  try {
    await setDoc(doc(db, 'settings', 'whatsapp'), {
      noWaAdmin: clampString(formatted, 30),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeWebsiteImages(
  onData: (images: WebsiteImages) => void,
  onReady?: () => void
): Unsubscribe {
  const imagesDocRef = doc(db, 'settings', 'images');
  let active = true;

  const emitSnap = (exists: boolean, data?: DocumentData) => {
    if (!active) return;
    if (!exists || !data) {
      onData({ heroImage: '', alurImage: '' });
    } else {
      onData({
        heroImage: String(data.heroImage ?? '').trim(),
        alurImage: String(data.alurImage ?? '').trim(),
      });
    }
    onReady?.();
  };

  void getDocFromServer(imagesDocRef)
    .then((serverSnap) => {
      emitSnap(serverSnap.exists(), serverSnap.data());
    })
    .catch(() => {
      onReady?.();
    });

  const unsub = onSnapshot(
    imagesDocRef,
    (snap) => {
      emitSnap(snap.exists(), snap.data());
    },
    () => {
      if (active) {
        onData({ heroImage: '', alurImage: '' });
        onReady?.();
      }
    }
  );

  return () => {
    active = false;
    unsub();
  };
}

export async function saveWebsiteImages(images: WebsiteImages): Promise<void> {
  const path = 'settings/images';
  try {
    await setDoc(doc(db, 'settings', 'images'), {
      heroImage: clampString(images.heroImage, 420000),
      alurImage: clampString(images.alurImage, 420000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateTemplateThumbnail(
  templateId: string,
  fotoThumbnail: string
): Promise<void> {
  const path = `templates/${templateId}`;
  try {
    await updateDoc(doc(db, 'templates', templateId), {
      fotoThumbnail: clampString(fotoThumbnail, 500000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function mapTemplatesSnapshot(snapshot: QuerySnapshot<DocumentData>): TemplateItem[] {
  return snapshot.docs.map((d) => {
    const data = d.data();
    const primaryLink = String(data.linkWebsite ?? '');
    return {
      id: d.id,
      namaTemplate: String(data.namaTemplate ?? ''),
      kategori: String(data.kategori ?? 'Pernikahan') || 'Pernikahan',
      fotoThumbnail: String(data.fotoThumbnail ?? ''),
      linkWebsite: primaryLink,
      linkPaket: {
        bronze: String(data.linkPaket?.bronze ?? ''),
        silver: String(data.linkPaket?.silver ?? ''),
        gold: String(data.linkPaket?.gold ?? ''),
        platinum: String(data.linkPaket?.platinum ?? ''),
      },
      deskripsi: String(data.deskripsi ?? ''),
      hargaPaket: {
        bronze: Number(data.hargaPaket?.bronze ?? 0),
        silver: Number(data.hargaPaket?.silver ?? 0),
        gold: Number(data.hargaPaket?.gold ?? 0),
        platinum: Number(data.hargaPaket?.platinum ?? 0),
      },
      hargaPromo: {
        aktif: Boolean(data.hargaPromo?.aktif),
        paket: data.hargaPromo?.paket || 'gold',
        hargaPromo: Number(data.hargaPromo?.hargaPromo ?? 0),
        labelPromo: String(data.hargaPromo?.labelPromo ?? 'Promo'),
        tanggalMulai: String(data.hargaPromo?.tanggalMulai ?? ''),
        tanggalSelesai: String(data.hargaPromo?.tanggalSelesai ?? ''),
      },
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });
}

export function subscribeTemplates(
  onData: (templates: TemplateItem[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'templates';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  let active = true;

  void getDocsFromServer(q)
    .then((serverSnap) => {
      if (active) {
        onData(mapTemplatesSnapshot(serverSnap));
      }
    })
    .catch(() => {
      // onSnapshot handles live sync and permission errors
    });

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      if (active) {
        onData(mapTemplatesSnapshot(snapshot));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    active = false;
    unsub();
  };
}

export function subscribeOrders(
  onData: (orders: OrderItem[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'orders';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: OrderItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          templateId: String(data.templateId ?? ''),
          templateName: String(data.templateName ?? ''),
          paketDipilih: data.paketDipilih || 'gold',
          hargaBayar: Number(data.hargaBayar ?? 0),
          namaPria: String(data.namaPria ?? ''),
          namaWanita: String(data.namaWanita ?? ''),
          tanggalAcara: String(data.tanggalAcara ?? ''),
          namaPemesan: String(data.namaPemesan ?? ''),
          noWA: String(data.noWA ?? ''),
          status: data.status || 'baru',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

function clampString(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function clampPrice(val: number): number {
  if (!Number.isFinite(val) || val < 0) return 0;
  return Math.min(Math.round(val), 100000000);
}

export async function createTemplate(payload: TemplateFormPayload): Promise<string> {
  const path = 'templates';
  const cleanPayload = {
    namaTemplate: clampString(payload.namaTemplate, 120),
    kategori: clampString(payload.kategori || 'Pernikahan', 60),
    fotoThumbnail: clampString(payload.fotoThumbnail, 500000),
    linkWebsite: clampString(payload.linkWebsite, 1000),
    linkPaket: {
      bronze: clampString(payload.linkPaket?.bronze || '', 1000),
      silver: clampString(payload.linkPaket?.silver || '', 1000),
      gold: clampString(payload.linkPaket?.gold || '', 1000),
      platinum: clampString(payload.linkPaket?.platinum || '', 1000),
    },
    deskripsi: clampString(payload.deskripsi, 1500),
    hargaPaket: {
      bronze: clampPrice(payload.hargaPaket.bronze),
      silver: clampPrice(payload.hargaPaket.silver),
      gold: clampPrice(payload.hargaPaket.gold),
      platinum: clampPrice(payload.hargaPaket.platinum),
    },
    hargaPromo: {
      aktif: Boolean(payload.hargaPromo.aktif),
      paket: payload.hargaPromo.paket,
      hargaPromo: clampPrice(payload.hargaPromo.hargaPromo),
      labelPromo: clampString(payload.hargaPromo.labelPromo || 'Promo', 60),
      tanggalMulai: clampString(payload.hargaPromo.tanggalMulai || '', 40),
      tanggalSelesai: clampString(payload.hargaPromo.tanggalSelesai || '', 40),
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = await addDoc(collection(db, path), cleanPayload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTemplate(templateId: string, payload: TemplateFormPayload): Promise<void> {
  const path = `templates/${templateId}`;
  const cleanPayload = {
    namaTemplate: clampString(payload.namaTemplate, 120),
    kategori: clampString(payload.kategori || 'Pernikahan', 60),
    fotoThumbnail: clampString(payload.fotoThumbnail, 500000),
    linkWebsite: clampString(payload.linkWebsite, 1000),
    linkPaket: {
      bronze: clampString(payload.linkPaket?.bronze || '', 1000),
      silver: clampString(payload.linkPaket?.silver || '', 1000),
      gold: clampString(payload.linkPaket?.gold || '', 1000),
      platinum: clampString(payload.linkPaket?.platinum || '', 1000),
    },
    deskripsi: clampString(payload.deskripsi, 1500),
    hargaPaket: {
      bronze: clampPrice(payload.hargaPaket.bronze),
      silver: clampPrice(payload.hargaPaket.silver),
      gold: clampPrice(payload.hargaPaket.gold),
      platinum: clampPrice(payload.hargaPaket.platinum),
    },
    hargaPromo: {
      aktif: Boolean(payload.hargaPromo.aktif),
      paket: payload.hargaPromo.paket,
      hargaPromo: clampPrice(payload.hargaPromo.hargaPromo),
      labelPromo: clampString(payload.hargaPromo.labelPromo || 'Promo', 60),
      tanggalMulai: clampString(payload.hargaPromo.tanggalMulai || '', 40),
      tanggalSelesai: clampString(payload.hargaPromo.tanggalSelesai || '', 40),
    },
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'templates', templateId), cleanPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeTemplate(templateId: string): Promise<void> {
  const path = `templates/${templateId}`;
  try {
    await deleteDoc(doc(db, 'templates', templateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createOrder(payload: OrderFormPayload): Promise<string> {
  const path = 'orders';
  const cleanPayload = {
    templateId: clampString(payload.templateId, 128),
    templateName: clampString(payload.templateName, 120),
    paketDipilih: payload.paketDipilih,
    hargaBayar: clampPrice(payload.hargaBayar),
    namaPria: clampString(payload.namaPria, 120),
    namaWanita: clampString(payload.namaWanita, 120),
    tanggalAcara: clampString(payload.tanggalAcara, 40),
    namaPemesan: clampString(payload.namaPemesan, 120),
    noWA: clampString(payload.noWA, 30),
    status: 'baru' as OrderStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = await addDoc(collection(db, path), cleanPayload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
