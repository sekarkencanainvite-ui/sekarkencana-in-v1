import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  User,
} from 'firebase/auth';
import {
  Check,
  ExternalLink,
  Image as ImageIcon,
  ImageOff,
  KeyRound,
  Layers,
  Link as LinkIcon,
  Loader2,
  LogOut,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Store,
  Trash2,
  Upload,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import {
  auth,
  createTemplate,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_WEBSITE_IMAGES,
  ensureInitialAdminDoc,
  findAdminByUsername,
  getAdminProfileByUid,
  removeTemplate,
  repairPlatinumPackage,
  savePackageConfig,
  saveStoreSettings,
  saveWebsiteImages,
  subscribeOrders,
  subscribePackages,
  subscribeStoreSettings,
  subscribeTemplates,
  subscribeWebsiteImages,
  updateAdminUsername,
  updateOrderStatus,
  updateTemplate,
  updateTemplateThumbnail,
} from './lib/firebase';
import {
  buildWhatsAppUrl,
  createEmptyPackageConfig,
  EMPTY_HARGA_PAKET,
  EMPTY_HARGA_PROMO,
  EMPTY_LINK_PAKET,
  formatFirestoreTimestamp,
  formatNomorWA,
  formatRupiah,
  getTemplatePreviewLink,
  getTierLabel,
  isPromoActive,
  PACKAGE_TIERS,
  TEMPLATE_CATEGORIES,
} from './lib/pricing';
import { compressImageFileToDataUrl, estimateDataUrlSizeKb } from './lib/imageUpload';
import {
  AdminProfile,
  OrderItem,
  OrderStatus,
  PackageConfig,
  PackageFeatureItem,
  PackageTier,
  TemplateFormPayload,
  TemplateItem,
  WebsiteImages,
} from './types';

function createInitialFormState(
  packageConfigs?: Partial<Record<PackageTier, PackageConfig>>
): TemplateFormPayload {
  return {
    namaTemplate: '',
    kategori: 'Pernikahan',
    fotoThumbnail: '',
    linkWebsite: '',
    linkPaket: { ...EMPTY_LINK_PAKET },
    deskripsi: '',
    hargaPaket: {
      bronze: packageConfigs?.bronze?.harga ?? EMPTY_HARGA_PAKET.bronze,
      silver: packageConfigs?.silver?.harga ?? EMPTY_HARGA_PAKET.silver,
      gold: packageConfigs?.gold?.harga ?? EMPTY_HARGA_PAKET.gold,
      platinum: packageConfigs?.platinum?.harga ?? EMPTY_HARGA_PAKET.platinum,
    },
    hargaPromo: { ...EMPTY_HARGA_PROMO },
  };
}

function AdminThumbnail({
  src,
  alt,
  className = 'w-full h-full object-cover',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-2 text-center text-[#FAF8F4]/45">
        <ImageOff className="w-5 h-5 mb-1 text-[#C8A24D]/60" />
        <span className="text-[10px] leading-tight">
          {failed ? 'URL bukan gambar langsung' : 'Belum ada thumbnail'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export default function AdminApp() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  // Login Form States (2 inputs only: Username & Password)
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const loginInProgressRef = useRef(false);

  // Workspace Tab
  const [activeTab, setActiveTab] = useState<
    'templates' | 'packages' | 'images' | 'orders' | 'store' | 'settings'
  >('templates');

  // Data States (100% from Firestore)
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [packageConfigs, setPackageConfigs] = useState<Partial<Record<PackageTier, PackageConfig>>>(
    {}
  );
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Template Form States
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TemplateFormPayload>(() => createInitialFormState());
  const [templateFormDirty, setTemplateFormDirty] = useState(false);
  const [showUrlThumbnailInput, setShowUrlThumbnailInput] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateFeedback, setTemplateFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Kelola Paket States
  const [selectedPkgTier, setSelectedPkgTier] = useState<PackageTier>('bronze');
  const [pkgDraft, setPkgDraft] = useState<PackageConfig>(() => createEmptyPackageConfig('bronze'));
  const [pkgDirty, setPkgDirty] = useState(false);
  const [newFiturNama, setNewFiturNama] = useState('');
  const [newFiturTersedia, setNewFiturTersedia] = useState(true);
  const [savingPackage, setSavingPackage] = useState(false);
  const [repairingPlatinum, setRepairingPlatinum] = useState(false);
  const [packageFeedback, setPackageFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Kelola Gambar Website States
  const [websiteImages, setWebsiteImages] = useState<WebsiteImages>({
    heroImage: '',
    alurImage: '',
  });
  const [imagesDraft, setImagesDraft] = useState<WebsiteImages>({
    heroImage: '',
    alurImage: '',
  });
  const [imagesDirty, setImagesDirty] = useState(false);
  const [showHeroUrlInput, setShowHeroUrlInput] = useState(false);
  const [showAlurUrlInput, setShowAlurUrlInput] = useState(false);
  const [processingSiteImgKey, setProcessingSiteImgKey] = useState<'heroImage' | 'alurImage' | null>(
    null
  );
  const [savingImages, setSavingImages] = useState(false);
  const [imagesFeedback, setImagesFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Template thumbnail quick-replace inside Kelola Gambar Website
  const [editingThumbTplId, setEditingThumbTplId] = useState<string | null>(null);
  const [tplThumbDraft, setTplThumbDraft] = useState('');
  const [showTplThumbUrlInput, setShowTplThumbUrlInput] = useState(false);
  const [processingTplThumb, setProcessingTplThumb] = useState(false);
  const [savingTplThumb, setSavingTplThumb] = useState(false);
  const [tplThumbFeedback, setTplThumbFeedback] = useState<{
    id: string;
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Orders Filter States
  const [orderStatusFilter, setOrderStatusFilter] = useState<'semua' | OrderStatus>('semua');
  const [orderSearch, setOrderSearch] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Account & Store Settings States
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [savedAdminWa, setSavedAdminWa] = useState('');
  const [adminWaInput, setAdminWaInput] = useState('');
  const [savingStoreWa, setSavingStoreWa] = useState(false);
  const [storeWaFeedback, setStoreWaFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setAdminProfile(null);
        setAuthReady(true);
        return;
      }

      try {
        let profile = await getAdminProfileByUid(currentUser.uid);
        if (!profile && currentUser.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL) {
          profile = await ensureInitialAdminDoc(currentUser.uid, currentUser.email);
        }

        if (profile && profile.role === 'admin') {
          setUser(currentUser);
          setAdminProfile(profile);
          setNewUsername(profile.username);
        } else {
          await signOut(auth);
          setUser(null);
          setAdminProfile(null);
          if (!loginInProgressRef.current) {
            setLoginError('Username atau password salah');
          }
        }
      } catch (err) {
        console.error('Admin profile check error:', err);
        await signOut(auth);
        setUser(null);
        setAdminProfile(null);
        setLoginError('Username atau password salah');
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !adminProfile) {
      setTemplates([]);
      setOrders([]);
      setPackageConfigs({});
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setDataError(null);

    const unsubTemplates = subscribeTemplates(
      (items) => {
        setTemplates(items);
        setDataLoading(false);
      },
      (err) => {
        console.error('Admin templates subscribe error:', err);
        setDataError('Gagal memuat daftar template dari Firestore.');
        setDataLoading(false);
      }
    );

    const unsubPackages = subscribePackages(
      (pkgs) => {
        setPackageConfigs(pkgs);
      },
      (err) => {
        console.error('Admin packages subscribe error:', err);
      }
    );

    const unsubOrders = subscribeOrders(
      (items) => {
        setOrders(items);
      },
      (err) => {
        console.error('Admin orders subscribe error:', err);
        setDataError('Gagal memuat daftar orderan dari Firestore.');
      }
    );

    const unsubSettings = subscribeStoreSettings((settings) => {
      setSavedAdminWa(settings.noWaAdmin);
      setAdminWaInput(settings.noWaAdmin);
    });

    const unsubImages = subscribeWebsiteImages((imgs) => {
      setWebsiteImages(imgs);
    });

    return () => {
      unsubTemplates();
      unsubPackages();
      unsubOrders();
      unsubSettings();
      unsubImages();
    };
  }, [authReady, user, adminProfile]);

  useEffect(() => {
    if (!imagesDirty) {
      setImagesDraft(websiteImages);
    }
  }, [websiteImages, imagesDirty]);

  // Sync new template form prices from Firestore packages while untouched
  useEffect(() => {
    if (!editingTemplateId && !templateFormDirty) {
      setFormState(createInitialFormState(packageConfigs));
    }
  }, [packageConfigs, editingTemplateId, templateFormDirty]);

  // Sync Kelola Paket draft when tier changes or when Firestore updates while untouched
  useEffect(() => {
    if (pkgDirty) return;
    const cfg = packageConfigs[selectedPkgTier];
    if (cfg) {
      setPkgDraft({
        ...cfg,
        fitur: cfg.fitur.map((f) => ({ ...f })),
      });
    } else {
      setPkgDraft(createEmptyPackageConfig(selectedPkgTier));
    }
  }, [selectedPkgTier, packageConfigs, pkgDirty]);

  const handleSelectPkgTier = (tier: PackageTier) => {
    setSelectedPkgTier(tier);
    setPkgDirty(false);
    setPackageFeedback(null);
    const cfg = packageConfigs[tier];
    if (cfg) {
      setPkgDraft({
        ...cfg,
        fitur: cfg.fitur.map((f) => ({ ...f })),
      });
    } else {
      setPkgDraft(createEmptyPackageConfig(tier));
    }
  };

  const templateMap = useMemo(() => {
    const map = new Map<string, TemplateItem>();
    templates.forEach((t) => map.set(t.id, t));
    return map;
  }, [templates]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      if (orderStatusFilter !== 'semua' && order.status !== orderStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        order.namaPemesan.toLowerCase().includes(q) ||
        order.namaPria.toLowerCase().includes(q) ||
        order.namaWanita.toLowerCase().includes(q) ||
        order.templateName.toLowerCase().includes(q) ||
        order.noWA.toLowerCase().includes(q)
      );
    });
  }, [orders, orderStatusFilter, orderSearch]);

  const handleUsernameLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername || !passwordInput) {
      setLoginError('Username atau password salah');
      return;
    }

    setLoginLoading(true);
    loginInProgressRef.current = true;

    let adminDocExists = false;

    try {
      const matchedAdmin = await findAdminByUsername(cleanUsername);

      if (matchedAdmin) {
        adminDocExists = true;
        if (matchedAdmin.role !== 'admin' || !matchedAdmin.email) {
          setLoginError('Username atau password salah');
          return;
        }
        await signInWithEmailAndPassword(auth, matchedAdmin.email, passwordInput);
        return;
      }

      if (
        cleanUsername === DEFAULT_ADMIN_USERNAME ||
        cleanUsername.toLowerCase() === DEFAULT_ADMIN_EMAIL
      ) {
        await signInWithEmailAndPassword(auth, DEFAULT_ADMIN_EMAIL, passwordInput);
        return;
      }

      setLoginError('Username atau password salah');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: string }).code)
          : '';

      if (code === 'auth/operation-not-allowed') {
        setLoginError(
          'Login Email/Password belum diaktifkan di Firebase Console (Authentication → Sign-in method).'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        if (
          !adminDocExists &&
          (cleanUsername === DEFAULT_ADMIN_USERNAME ||
            cleanUsername.toLowerCase() === DEFAULT_ADMIN_EMAIL)
        ) {
          setLoginError(
            'Username atau password salah. Pastikan akun admin@sekarkencana.id sudah dibuat di Firebase Console → Authentication → Users.'
          );
        } else {
          setLoginError('Username atau password salah');
        }
      } else if (code === 'auth/too-many-requests') {
        setLoginError('Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat.');
      } else {
        setLoginError('Username atau password salah');
      }
    } finally {
      loginInProgressRef.current = false;
      setLoginLoading(false);
    }
  };

  const handleThumbnailFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateFeedback(null);
    setProcessingImage(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      setTemplateFormDirty(true);
      setFormState((prev) => ({ ...prev, fotoThumbnail: dataUrl }));
    } catch (err) {
      setTemplateFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal memproses file gambar dari perangkat.',
      });
    } finally {
      setProcessingImage(false);
      e.target.value = '';
    }
  };

  const handleTemplateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTemplateFeedback(null);

    if (
      !formState.namaTemplate.trim() ||
      !formState.fotoThumbnail.trim() ||
      !formState.linkWebsite.trim() ||
      !formState.deskripsi.trim()
    ) {
      setTemplateFeedback({
        type: 'error',
        message: 'Nama template, foto thumbnail, link website utama, dan deskripsi wajib diisi.',
      });
      return;
    }

    if (!/^https?:\/\/.+/i.test(formState.linkWebsite.trim())) {
      setTemplateFeedback({
        type: 'error',
        message: 'Link Website Utama harus diawali dengan http:// atau https://',
      });
      return;
    }

    for (const tier of PACKAGE_TIERS) {
      const tierUrl = formState.linkPaket[tier.key].trim();
      if (tierUrl && !/^https?:\/\/.+/i.test(tierUrl)) {
        setTemplateFeedback({
          type: 'error',
          message: `Link paket ${tier.label} harus diawali http:// atau https:// (atau kosongkan).`,
        });
        return;
      }
    }

    if (formState.hargaPromo.aktif && Number(formState.hargaPromo.hargaPromo) <= 0) {
      setTemplateFeedback({
        type: 'error',
        message: 'Jika Harga Promo Template diaktifkan, Harga Promo (Rp) harus lebih dari 0.',
      });
      return;
    }

    setSavingTemplate(true);
    try {
      if (editingTemplateId) {
        await updateTemplate(editingTemplateId, formState);
        setTemplateFeedback({
          type: 'success',
          message: `Template "${formState.namaTemplate}" berhasil diperbarui di Firestore.`,
        });
      } else {
        await createTemplate(formState);
        setTemplateFeedback({
          type: 'success',
          message: `Template "${formState.namaTemplate}" berhasil ditambahkan ke Firestore.`,
        });
      }
      setEditingTemplateId(null);
      setTemplateFormDirty(false);
      setFormState(createInitialFormState(packageConfigs));
      setShowUrlThumbnailInput(false);
    } catch (err) {
      console.error('Save template error:', err);
      setTemplateFeedback({
        type: 'error',
        message: 'Gagal menyimpan template ke Firestore.',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const startEditTemplate = (tpl: TemplateItem) => {
    setEditingTemplateId(tpl.id);
    setTemplateFormDirty(true);
    setTemplateFeedback(null);
    setShowUrlThumbnailInput(Boolean(tpl.fotoThumbnail && !tpl.fotoThumbnail.startsWith('data:')));
    setFormState({
      namaTemplate: tpl.namaTemplate,
      kategori: tpl.kategori || 'Pernikahan',
      fotoThumbnail: tpl.fotoThumbnail,
      linkWebsite: tpl.linkWebsite,
      linkPaket: {
        bronze: tpl.linkPaket?.bronze || '',
        silver: tpl.linkPaket?.silver || '',
        gold: tpl.linkPaket?.gold || '',
        platinum: tpl.linkPaket?.platinum || '',
      },
      deskripsi: tpl.deskripsi,
      hargaPaket: { ...tpl.hargaPaket },
      hargaPromo: { ...tpl.hargaPromo },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTemplate = async (id: string) => {
    setDeletingId(id);
    try {
      await removeTemplate(id);
      if (editingTemplateId === id) {
        setEditingTemplateId(null);
        setTemplateFormDirty(false);
        setFormState(createInitialFormState(packageConfigs));
      }
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Delete template failed:', err);
      setTemplateFeedback({
        type: 'error',
        message: 'Gagal menghapus template dari Firestore.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Kelola Paket Handlers
  const handleAddFitur = () => {
    const clean = newFiturNama.trim();
    if (!clean) return;
    if (pkgDraft.fitur.length >= 30) {
      setPackageFeedback({
        type: 'error',
        message: 'Maksimal 30 fitur per paket.',
      });
      return;
    }

    const item: PackageFeatureItem = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nama: clean,
      tersedia: newFiturTersedia,
    };

    setPkgDirty(true);
    setPkgDraft((prev) => ({
      ...prev,
      fitur: [...prev.fitur, item],
    }));
    setNewFiturNama('');
  };

  const handleToggleFiturTersedia = (id: string) => {
    setPkgDirty(true);
    setPkgDraft((prev) => ({
      ...prev,
      fitur: prev.fitur.map((f) => (f.id === id ? { ...f, tersedia: !f.tersedia } : f)),
    }));
  };

  const handleEditFiturNama = (id: string, nama: string) => {
    setPkgDirty(true);
    setPkgDraft((prev) => ({
      ...prev,
      fitur: prev.fitur.map((f) => (f.id === id ? { ...f, nama } : f)),
    }));
  };

  const handleRemoveFitur = (id: string) => {
    setPkgDirty(true);
    setPkgDraft((prev) => ({
      ...prev,
      fitur: prev.fitur.filter((f) => f.id !== id),
    }));
  };

  const handleSavePackage = async (e: FormEvent) => {
    e.preventDefault();
    setPackageFeedback(null);

    if (!pkgDraft.namaPaket.trim()) {
      setPackageFeedback({
        type: 'error',
        message: 'Nama paket wajib diisi.',
      });
      return;
    }

    setSavingPackage(true);
    try {
      await savePackageConfig(pkgDraft);
      setPkgDirty(false);
      setPackageFeedback({
        type: 'success',
        message: `Paket ${pkgDraft.namaPaket} dan daftar fiturnya berhasil disimpan ke Firestore.`,
      });
    } catch (err) {
      console.error('Save package error:', err);
      setPackageFeedback({
        type: 'error',
        message: 'Gagal menyimpan konfigurasi paket ke Firestore.',
      });
    } finally {
      setSavingPackage(false);
    }
  };

  const handleRepairPlatinum = async () => {
    setPackageFeedback(null);
    setRepairingPlatinum(true);
    try {
      const currentPlatinumFitur =
        packageConfigs.platinum?.fitur ||
        (selectedPkgTier === 'platinum' ? pkgDraft.fitur : []);
      const repaired = await repairPlatinumPackage(currentPlatinumFitur);
      setSelectedPkgTier('platinum');
      setPkgDirty(false);
      setPkgDraft({
        ...repaired,
        fitur: repaired.fitur.map((f) => ({ ...f })),
      });
      setPackageFeedback({
        type: 'success',
        message:
          'Data Platinum di Firestore berhasil ditimpa (Platinum · Harga Jual Rp 349.000, Harga Coret Rp 399.000, Promo Aktif, Label Promo) dan promo template bernilai Rp 0 ikut dibersihkan.',
      });
    } catch (err) {
      console.error('Repair Platinum error:', err);
      setPackageFeedback({
        type: 'error',
        message: 'Gagal memperbaiki data Platinum di Firestore.',
      });
    } finally {
      setRepairingPlatinum(false);
    }
  };

  const handleOrderStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
    } catch (err) {
      console.error('Update order status failed:', err);
      setDataError('Gagal memperbarui status pesanan.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleUpdateUsername = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !adminProfile) return;
    setUsernameFeedback(null);

    const clean = newUsername.trim();
    if (clean.length < 3 || clean.length > 50 || !/^[a-zA-Z0-9_.-]+$/.test(clean)) {
      setUsernameFeedback({
        type: 'error',
        message:
          'Username minimal 3 karakter dan hanya boleh huruf, angka, titik, strip, atau underscore.',
      });
      return;
    }

    if (clean === adminProfile.username) {
      setUsernameFeedback({
        type: 'error',
        message: 'Username baru sama dengan username saat ini.',
      });
      return;
    }

    setSavingUsername(true);
    try {
      await updateAdminUsername(user.uid, clean);
      setAdminProfile((prev) => (prev ? { ...prev, username: clean } : prev));
      setUsernameFeedback({
        type: 'success',
        message: `Username berhasil diperbarui menjadi "${clean}".`,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
        setUsernameFeedback({
          type: 'error',
          message: 'Username tersebut sudah digunakan. Pilih username lain.',
        });
      } else {
        console.error('Update username error:', err);
        setUsernameFeedback({
          type: 'error',
          message: 'Gagal memperbarui username.',
        });
      }
    } finally {
      setSavingUsername(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setPasswordFeedback(null);

    if (!oldPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'Masukkan kata sandi lama terlebih dahulu.',
      });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordFeedback({
        type: 'error',
        message: 'Kata sandi baru minimal 6 karakter.',
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'Konfirmasi kata sandi baru tidak cocok.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordFeedback({
        type: 'success',
        message: 'Kata sandi berhasil diperbarui.',
      });
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: string }).code)
          : '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPasswordFeedback({
          type: 'error',
          message: 'Kata sandi lama tidak sesuai.',
        });
      } else if (code === 'auth/weak-password') {
        setPasswordFeedback({
          type: 'error',
          message: 'Kata sandi baru minimal 6 karakter.',
        });
      } else {
        console.error('Update password error:', err);
        setPasswordFeedback({
          type: 'error',
          message: 'Gagal memperbarui kata sandi. Silakan coba lagi.',
        });
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleWebsiteImageFileChange = async (
    slotKey: 'heroImage' | 'alurImage',
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagesFeedback(null);
    setProcessingSiteImgKey(slotKey);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1000, 750, 0.76, 350000);
      setImagesDirty(true);
      setImagesDraft((prev) => ({ ...prev, [slotKey]: dataUrl }));
    } catch (err) {
      setImagesFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal memproses file gambar dari perangkat.',
      });
    } finally {
      setProcessingSiteImgKey(null);
      e.target.value = '';
    }
  };

  const handleSaveWebsiteImages = async (e: FormEvent) => {
    e.preventDefault();
    setImagesFeedback(null);
    setSavingImages(true);
    try {
      await saveWebsiteImages(imagesDraft);
      setImagesDirty(false);
      setImagesFeedback({
        type: 'success',
        message:
          'Gambar website berhasil disimpan ke Firestore (settings/images). Perubahan langsung aktif di website depan.',
      });
    } catch (err) {
      console.error('Save website images error:', err);
      setImagesFeedback({
        type: 'error',
        message: 'Gagal menyimpan gambar website ke Firestore.',
      });
    } finally {
      setSavingImages(false);
    }
  };

  const handleTplThumbFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTplThumbFeedback(null);
    setProcessingTplThumb(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      setTplThumbDraft(dataUrl);
    } catch (err) {
      if (editingThumbTplId) {
        setTplThumbFeedback({
          id: editingThumbTplId,
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal memproses file gambar dari perangkat.',
        });
      }
    } finally {
      setProcessingTplThumb(false);
      e.target.value = '';
    }
  };

  const handleSaveTplThumb = async (templateId: string, templateName: string) => {
    if (!tplThumbDraft.trim()) {
      setTplThumbFeedback({
        id: templateId,
        type: 'error',
        message: 'Pilih file foto dari perangkat atau tempel link gambar terlebih dahulu.',
      });
      return;
    }

    setSavingTplThumb(true);
    setTplThumbFeedback(null);
    try {
      await updateTemplateThumbnail(templateId, tplThumbDraft);
      setEditingThumbTplId(null);
      setTplThumbDraft('');
      setShowTplThumbUrlInput(false);
      setTplThumbFeedback({
        id: templateId,
        type: 'success',
        message: `Thumbnail "${templateName}" berhasil diperbarui di Firestore.`,
      });
    } catch (err) {
      console.error('Update template thumbnail error:', err);
      setTplThumbFeedback({
        id: templateId,
        type: 'error',
        message: 'Gagal menyimpan thumbnail template ke Firestore.',
      });
    } finally {
      setSavingTplThumb(false);
    }
  };

  const handleSaveStoreWa = async (e: FormEvent) => {
    e.preventDefault();
    setStoreWaFeedback(null);

    const cleanRaw = adminWaInput.trim();
    const formatted = formatNomorWA(cleanRaw);
    if (cleanRaw && formatted.length < 8) {
      setStoreWaFeedback({
        type: 'error',
        message: 'Nomor WhatsApp tidak valid. Masukkan minimal 8 digit angka.',
      });
      return;
    }

    setSavingStoreWa(true);
    try {
      await saveStoreSettings({ noWaAdmin: formatted });
      setAdminWaInput(formatted);
      setStoreWaFeedback({
        type: 'success',
        message: formatted
          ? `Nomor WhatsApp Admin (${formatted}) berhasil disimpan ke Firestore (settings/whatsapp).`
          : 'Nomor WhatsApp Admin dikosongkan di Firestore (settings/whatsapp).',
      });
    } catch (err) {
      console.error('Save store WA error:', err);
      setStoreWaFeedback({
        type: 'error',
        message: 'Gagal menyimpan nomor WhatsApp admin ke Firestore.',
      });
    } finally {
      setSavingStoreWa(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-[#FAF8F4] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-7 h-7 text-[#D4AF37] animate-spin mb-3" />
        <p className="text-sm text-[#FAF8F4]/75">Memuat CMS Admin...</p>
      </div>
    );
  }

  // Simple Login Screen: Username + Password + Masuk button only (Hitam-Gold)
  if (!user || !adminProfile) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-[#FAF8F4] flex flex-col justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto bg-[#131317] border border-[#C8A24D]/35 p-6 sm:p-8 shadow-2xl">
          <div className="border-b border-[#C8A24D]/20 pb-5 mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              SEKAR KENCANA INVITATION
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-semibold text-[#FAF8F4]">
              Login Admin CMS
            </h1>
            <p className="mt-1.5 text-xs text-[#FAF8F4]/65 leading-relaxed">
              Masuk untuk mengelola katalog template, paket fitur, harga promo, dan orderan pelanggan.
            </p>
          </div>

          <form onSubmit={handleUsernameLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1.5">
                Username
              </label>
              <input
                id="admin-username"
                type="text"
                required
                autoComplete="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1.5">
                Kata Sandi
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-950/60 border border-red-500/40 text-xs text-red-200 leading-relaxed" role="alert">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 min-h-[46px] bg-[#C8A24D] hover:bg-[#D4AF37] disabled:opacity-60 text-[#0B0B0D] text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Masuk</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <a href="/index.html" className="text-xs text-[#FAF8F4]/60 hover:text-[#D4AF37]">
              &larr; Kembali ke Halaman Katalog
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isSelectedTierSavedInFirestore = Boolean(packageConfigs[selectedPkgTier]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0B0D] text-[#FAF8F4]">
      {/* CMS Top Bar + Menu Navigation */}
      <header className="sticky top-0 z-30 bg-[#111114] border-b border-[#C8A24D]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a
            href="/admin.html"
            className="font-display text-lg sm:text-xl font-semibold tracking-[0.06em] text-[#D4AF37] whitespace-nowrap shrink-0"
          >
            SEKAR KENCANA · CMS
          </a>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-[#FAF8F4]/60">
              @{adminProfile.username}
            </span>

            <a
              href="/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] border border-[#C8A24D]/40 text-xs font-medium text-[#FAF8F4] hover:border-[#D4AF37] hover:text-[#D4AF37] whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lihat Toko</span>
            </a>

            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] border border-white/15 text-xs font-medium text-[#FAF8F4]/80 hover:text-white hover:border-white/35 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* CMS Menu Navigation */}
        <nav
          aria-label="Menu CMS Admin"
          className="border-t border-white/10 bg-[#0B0B0D]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-3.5 py-2 min-h-[38px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'templates'
                  ? 'bg-[#C8A24D] text-[#0B0B0D]'
                  : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
              }`}
            >
              Kelola Template ({templates.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('packages')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'packages'
                  ? 'bg-[#C8A24D] text-[#0B0B0D]'
                  : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kelola Paket</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('images')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'images'
                  ? 'bg-[#C8A24D] text-[#0B0B0D]'
                  : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Kelola Gambar Website</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-3.5 py-2 min-h-[38px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'orders'
                  ? 'bg-[#C8A24D] text-[#0B0B0D]'
                  : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
              }`}
            >
              Orderan ({orders.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'store'
                  ? 'bg-[#C8A24D] text-[#0B0B0D]'
                  : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Pengaturan Toko</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-[#C8A24D] text-[#0B0B0D]'
                  : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Data Admin</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {dataError && (
          <div className="mb-6 p-4 bg-red-950/60 border border-red-500/40 text-xs text-red-200">
            {dataError}
          </div>
        )}

        {/* TAB 1: KELOLA TEMPLATE */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Tambah / Edit Template */}
            <section className="lg:col-span-5 bg-[#131317] border border-[#C8A24D]/30 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10 mb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#D4AF37] font-semibold">
                    {editingTemplateId ? 'Edit Website Undangan' : 'Tambah Website Baru'}
                  </p>
                  <h2 className="font-display text-2xl font-semibold text-[#FAF8F4]">
                    {editingTemplateId ? 'Perbarui Template' : 'Form Katalog Template'}
                  </h2>
                </div>
                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplateId(null);
                      setTemplateFormDirty(false);
                      setFormState(createInitialFormState(packageConfigs));
                      setShowUrlThumbnailInput(false);
                      setTemplateFeedback(null);
                    }}
                    className="px-3 py-1.5 text-xs border border-white/20 text-[#FAF8F4]/80 hover:text-white"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleTemplateSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tpl-nama" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                      Nama Template
                    </label>
                    <input
                      id="tpl-nama"
                      type="text"
                      required
                      maxLength={120}
                      value={formState.namaTemplate}
                      onChange={(e) => {
                        setTemplateFormDirty(true);
                        setFormState((prev) => ({ ...prev, namaTemplate: e.target.value }));
                      }}
                      placeholder="Contoh: Pendopo Agung"
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label htmlFor="tpl-kategori" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                      Kategori Undangan
                    </label>
                    <select
                      id="tpl-kategori"
                      value={formState.kategori}
                      onChange={(e) => {
                        setTemplateFormDirty(true);
                        setFormState((prev) => ({ ...prev, kategori: e.target.value }));
                      }}
                      className="w-full px-3 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                    >
                      {TEMPLATE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-[#131317] text-[#FAF8F4]">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Upload Foto Thumbnail dari Perangkat */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="block text-xs font-medium text-[#FAF8F4]/85">
                      Foto Thumbnail (Pilih File dari Perangkat)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowUrlThumbnailInput((prev) => !prev)}
                      className="text-[11px] text-[#D4AF37] hover:underline"
                    >
                      {showUrlThumbnailInput ? 'Tutup input URL' : 'Atau tempel URL'}
                    </button>
                  </div>

                  <label
                    htmlFor="tpl-thumb-file"
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-[#0B0B0D] border border-dashed border-[#C8A24D]/45 hover:border-[#D4AF37] cursor-pointer transition-colors text-center"
                  >
                    {processingImage ? (
                      <>
                        <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                        <span className="text-xs text-[#FAF8F4]/80">Memproses &amp; mengompres gambar...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-[#D4AF37]" />
                        <span className="text-xs font-medium text-[#FAF8F4]">
                          {formState.fotoThumbnail
                            ? 'Ganti Foto dari Perangkat (JPG / PNG / WebP)'
                            : 'Pilih Foto dari Perangkat (JPG / PNG / WebP)'}
                        </span>
                        <span className="text-[11px] text-[#FAF8F4]/55">
                          Otomatis dikompres &amp; disimpan langsung ke database Firestore
                        </span>
                      </>
                    )}
                    <input
                      id="tpl-thumb-file"
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailFileChange}
                      className="sr-only"
                    />
                  </label>

                  {showUrlThumbnailInput && (
                    <input
                      id="tpl-thumb"
                      type="text"
                      maxLength={500000}
                      value={formState.fotoThumbnail}
                      onChange={(e) => {
                        setTemplateFormDirty(true);
                        setFormState((prev) => ({ ...prev, fotoThumbnail: e.target.value }));
                      }}
                      placeholder="https://... (opsional tempel URL gambar langsung)"
                      className="mt-2 w-full px-3.5 py-2 min-h-[40px] bg-[#0B0B0D] border border-white/15 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                    />
                  )}

                  {formState.fotoThumbnail.trim() && (
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="w-36 aspect-video bg-[#0B0B0D] border border-white/15 overflow-hidden shrink-0">
                        <AdminThumbnail
                          src={formState.fotoThumbnail.trim()}
                          alt="Preview Thumbnail"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-[11px] text-[#FAF8F4]/70 space-y-1">
                        {formState.fotoThumbnail.startsWith('data:') ? (
                          <p className="text-emerald-300 font-medium">
                            Siap disimpan ({estimateDataUrlSizeKb(formState.fotoThumbnail)} KB)
                          </p>
                        ) : (
                          <p className="truncate max-w-[180px] font-mono">{formState.fotoThumbnail}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateFormDirty(true);
                            setFormState((prev) => ({ ...prev, fotoThumbnail: '' }));
                          }}
                          className="text-red-300 hover:underline"
                        >
                          Hapus gambar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Link Website Utama */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="tpl-link" className="block text-xs font-medium text-[#FAF8F4]/85">
                      Link Website Utama (Default Live Preview)
                    </label>
                    {formState.linkWebsite && /^https?:\/\/.+/.test(formState.linkWebsite) && (
                      <a
                        href={formState.linkWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Tes Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    id="tpl-link"
                    type="url"
                    required
                    maxLength={1000}
                    value={formState.linkWebsite}
                    onChange={(e) => {
                      setTemplateFormDirty(true);
                      setFormState((prev) => ({ ...prev, linkWebsite: e.target.value }));
                    }}
                    placeholder="https://website-undangan-asli.com/..."
                    className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm font-mono text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* Link Template Per Paket */}
                <div className="p-3.5 bg-[#0B0B0D] border border-white/10 space-y-2.5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                      Link Template per Paket (Opsional)
                    </p>
                    <p className="text-[11px] text-[#FAF8F4]/55 mt-0.5">
                      Sesuaikan link demo khusus tiap paket harga. Kosongkan jika memakai Link Utama.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PACKAGE_TIERS.map((tier) => (
                      <div key={tier.key}>
                        <label
                          htmlFor={`link-paket-${tier.key}`}
                          className="block text-[11px] text-[#FAF8F4]/75 mb-1"
                        >
                          Link {getTierLabel(tier.key, packageConfigs)}
                        </label>
                        <input
                          id={`link-paket-${tier.key}`}
                          type="url"
                          maxLength={1000}
                          value={formState.linkPaket[tier.key]}
                          onChange={(e) => {
                            setTemplateFormDirty(true);
                            setFormState((prev) => ({
                              ...prev,
                              linkPaket: {
                                ...prev.linkPaket,
                                [tier.key]: e.target.value,
                              },
                            }));
                          }}
                          placeholder="https://... (opsional)"
                          className="w-full px-2.5 py-2 min-h-[38px] bg-[#131317] border border-white/15 text-xs font-mono text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="tpl-desc" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                    Deskripsi Singkat
                  </label>
                  <textarea
                    id="tpl-desc"
                    rows={3}
                    required
                    maxLength={1500}
                    value={formState.deskripsi}
                    onChange={(e) => {
                      setTemplateFormDirty(true);
                      setFormState((prev) => ({ ...prev, deskripsi: e.target.value }));
                    }}
                    placeholder="Ceritakan nuansa desain dan keunggulan undangan ini..."
                    className="w-full px-3.5 py-2.5 bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* 4 Input Harga Paket */}
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37] mb-3">
                    Harga Paket Template (Rp)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {PACKAGE_TIERS.map((tier) => (
                      <div key={tier.key}>
                        <label
                          htmlFor={`harga-${tier.key}`}
                          className="block text-xs text-[#FAF8F4]/80 mb-1"
                        >
                          {getTierLabel(tier.key, packageConfigs)}
                        </label>
                        <input
                          id={`harga-${tier.key}`}
                          type="number"
                          min={0}
                          max={100000000}
                          required
                          value={formState.hargaPaket[tier.key]}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setTemplateFormDirty(true);
                            setFormState((prev) => ({
                              ...prev,
                              hargaPaket: {
                                ...prev.hargaPaket,
                                [tier.key]: val,
                              },
                            }));
                          }}
                          className="w-full px-3 py-2 min-h-[40px] bg-[#0B0B0D] border border-white/15 text-sm tabular-nums text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fitur Harga Promo */}
                <div className="p-4 bg-[#0B0B0D] border border-[#C8A24D]/30 space-y-3.5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formState.hargaPromo.aktif}
                      onChange={(e) => {
                        setTemplateFormDirty(true);
                        setFormState((prev) => ({
                          ...prev,
                          hargaPromo: { ...prev.hargaPromo, aktif: e.target.checked },
                        }));
                      }}
                      className="w-4 h-4 accent-[#C8A24D]"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                      Aktifkan Harga Promo Template
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="promo-paket" className="block text-xs text-[#FAF8F4]/75 mb-1">
                        Paket Dipromo
                      </label>
                      <select
                        id="promo-paket"
                        value={formState.hargaPromo.paket}
                        onChange={(e) => {
                          setTemplateFormDirty(true);
                          setFormState((prev) => ({
                            ...prev,
                            hargaPromo: {
                              ...prev.hargaPromo,
                              paket: e.target.value as PackageTier,
                            },
                          }));
                        }}
                        className="w-full px-3 py-2 min-h-[40px] bg-[#131317] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                      >
                        {PACKAGE_TIERS.map((t) => (
                          <option key={t.key} value={t.key}>
                            {getTierLabel(t.key, packageConfigs)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="promo-harga" className="block text-xs text-[#FAF8F4]/75 mb-1">
                        Harga Promo (Rp)
                      </label>
                      <input
                        id="promo-harga"
                        type="number"
                        min={0}
                        max={100000000}
                        value={formState.hargaPromo.hargaPromo}
                        onChange={(e) => {
                          setTemplateFormDirty(true);
                          setFormState((prev) => ({
                            ...prev,
                            hargaPromo: {
                              ...prev.hargaPromo,
                              hargaPromo: Number(e.target.value) || 0,
                            },
                          }));
                        }}
                        className="w-full px-3 py-2 min-h-[40px] bg-[#131317] border border-white/15 text-sm tabular-nums text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="promo-label" className="block text-xs text-[#FAF8F4]/75 mb-1">
                      Label Promo
                    </label>
                    <input
                      id="promo-label"
                      type="text"
                      maxLength={60}
                      value={formState.hargaPromo.labelPromo}
                      onChange={(e) => {
                        setTemplateFormDirty(true);
                        setFormState((prev) => ({
                          ...prev,
                          hargaPromo: { ...prev.hargaPromo, labelPromo: e.target.value },
                        }));
                      }}
                      placeholder="Promo"
                      className="w-full px-3 py-2 min-h-[40px] bg-[#131317] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="promo-mulai" className="block text-xs text-[#FAF8F4]/75 mb-1">
                        Tanggal Mulai
                      </label>
                      <input
                        id="promo-mulai"
                        type="date"
                        value={formState.hargaPromo.tanggalMulai}
                        onChange={(e) => {
                          setTemplateFormDirty(true);
                          setFormState((prev) => ({
                            ...prev,
                            hargaPromo: { ...prev.hargaPromo, tanggalMulai: e.target.value },
                          }));
                        }}
                        className="w-full px-3 py-2 min-h-[40px] bg-[#131317] border border-white/15 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label htmlFor="promo-selesai" className="block text-xs text-[#FAF8F4]/75 mb-1">
                        Tanggal Selesai
                      </label>
                      <input
                        id="promo-selesai"
                        type="date"
                        value={formState.hargaPromo.tanggalSelesai}
                        onChange={(e) => {
                          setTemplateFormDirty(true);
                          setFormState((prev) => ({
                            ...prev,
                            hargaPromo: { ...prev.hargaPromo, tanggalSelesai: e.target.value },
                          }));
                        }}
                        className="w-full px-3 py-2 min-h-[40px] bg-[#131317] border border-white/15 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                </div>

                {templateFeedback && (
                  <div
                    className={`p-3 text-xs border ${
                      templateFeedback.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/50 border-red-500/40 text-red-200'
                    }`}
                    role="status"
                  >
                    {templateFeedback.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingTemplate || processingImage}
                  className="w-full py-3 min-h-[46px] bg-[#C8A24D] hover:bg-[#D4AF37] disabled:opacity-60 text-[#0B0B0D] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  {savingTemplate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{editingTemplateId ? 'Simpan Perubahan' : 'Simpan Template ke Katalog'}</span>
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* Daftar Template */}
            <section className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-[#FAF8F4]">
                    Daftar Template di Firestore ({templates.length})
                  </h2>
                  <p className="text-xs text-[#FAF8F4]/60 mt-0.5">
                    100% dibaca dari Firestore dan tidak pernah di-reset otomatis.
                  </p>
                </div>
              </div>

              {dataLoading ? (
                <div className="p-8 bg-[#131317] border border-white/10 flex items-center justify-center gap-2 text-sm text-[#FAF8F4]/70">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                  <span>Memuat template...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="p-8 bg-[#131317] border border-[#C8A24D]/25 text-center">
                  <p className="font-display text-xl text-[#FAF8F4]">
                    Belum Ada Template di Firestore
                  </p>
                  <p className="mt-1 text-xs text-[#FAF8F4]/65">
                    Isi formulir di sebelah kiri untuk menambahkan website undangan pertama Anda ke Firestore.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((tpl) => {
                    const promoOn = isPromoActive(tpl.hargaPromo);
                    const customLinkCount = PACKAGE_TIERS.filter(
                      (t) => tpl.linkPaket?.[t.key]?.trim()
                    ).length;
                    return (
                      <article
                        key={tpl.id}
                        className="bg-[#131317] border border-white/12 p-4 sm:p-5 flex flex-col sm:flex-row gap-4"
                      >
                        <div className="w-full sm:w-48 aspect-video bg-[#0B0B0D] border border-white/10 overflow-hidden shrink-0">
                          <AdminThumbnail
                            src={tpl.fotoThumbnail}
                            alt={tpl.namaTemplate}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.16em] text-[#D4AF37] font-semibold">
                                  {tpl.kategori || 'Pernikahan'}
                                </p>
                                <h3 className="font-display text-xl font-semibold text-[#FAF8F4]">
                                  {tpl.namaTemplate}
                                </h3>
                              </div>
                              {promoOn && (
                                <span className="px-2 py-0.5 bg-[#C8A24D]/15 border border-[#C8A24D]/50 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                                  Promo {getTierLabel(tpl.hargaPromo.paket, packageConfigs)} ·{' '}
                                  {formatRupiah(tpl.hargaPromo.hargaPromo)}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-[#FAF8F4]/65 line-clamp-2">
                              {tpl.deskripsi}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <a
                                href={tpl.linkWebsite}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-mono text-[#D4AF37] hover:underline max-w-full truncate"
                              >
                                <span className="truncate">{tpl.linkWebsite}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                              {customLinkCount > 0 && (
                                <span className="text-[11px] text-emerald-300">
                                  +{customLinkCount} link paket khusus
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#FAF8F4]/75 tabular-nums">
                              {PACKAGE_TIERS.map((t) => (
                                <span key={t.key}>
                                  {getTierLabel(t.key, packageConfigs)}:{' '}
                                  {formatRupiah(tpl.hargaPaket[t.key])}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEditTemplate(tpl)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/20 text-xs font-medium text-[#FAF8F4] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {confirmDeleteId === tpl.id ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={deletingId === tpl.id}
                                    onClick={() => void handleDeleteTemplate(tpl.id)}
                                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
                                  >
                                    {deletingId === tpl.id ? 'Menghapus...' : 'Konfirmasi Hapus'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2.5 py-1.5 border border-white/20 text-xs"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(tpl.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500/35 text-xs font-medium text-red-300 hover:bg-red-950/60"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Hapus</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: KELOLA PAKET */}
        {activeTab === 'packages' && (
          <section className="space-y-6">
            <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#D4AF37] font-semibold">
                  100% Tersimpan &amp; Dibaca dari Firestore
                </p>
                <h2 className="font-display text-3xl font-semibold text-[#FAF8F4]">
                  Kelola Paket
                </h2>
                <p className="mt-1 text-xs text-[#FAF8F4]/65">
                  Atur nama paket, harga, harga coret/promo, dan daftar fitur (centang ✓ atau silang ✕). Perubahan langsung disimpan permanen di Firestore.
                </p>
              </div>

              {/* Tier Selector Tabs + Perbaiki Data Platinum */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  disabled={repairingPlatinum}
                  onClick={() => void handleRepairPlatinum()}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] bg-amber-500/15 border border-[#D4AF37] text-xs font-semibold text-[#D4AF37] hover:bg-[#C8A24D] hover:text-[#0B0B0D] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {repairingPlatinum ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memperbaiki Platinum...</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Perbaiki Data Platinum</span>
                    </>
                  )}
                </button>

                <div className="grid grid-cols-4 gap-1 p-1 bg-[#131317] border border-white/15">
                  {PACKAGE_TIERS.map((tier) => {
                    const cfg = packageConfigs[tier.key];
                    const active = selectedPkgTier === tier.key;
                    const saved = Boolean(cfg);
                    return (
                      <button
                        key={tier.key}
                        type="button"
                        onClick={() => handleSelectPkgTier(tier.key)}
                        className={`px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${
                          active
                            ? 'bg-[#C8A24D] text-[#0B0B0D]'
                            : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
                        }`}
                      >
                        <span>{cfg?.namaPaket || tier.label}</span>
                        {saved && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              active ? 'bg-[#0B0B0D]' : 'bg-emerald-400'
                            }`}
                            title="Sudah tersimpan di Firestore"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Editor Form */}
              <form
                onSubmit={handleSavePackage}
                className="lg:col-span-7 bg-[#131317] border border-[#C8A24D]/30 p-5 sm:p-6 space-y-5"
              >
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10 text-xs">
                  <span className="text-[#FAF8F4]/75">
                    Status di Firestore:{' '}
                    {isSelectedTierSavedInFirestore ? (
                      <strong className="text-emerald-300">Tersimpan di Firestore</strong>
                    ) : (
                      <strong className="text-amber-300">Belum ada dokumen di Firestore</strong>
                    )}
                  </span>
                  {pkgDirty && (
                    <span className="text-[#D4AF37] font-medium">Ada perubahan belum disimpan</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pkg-nama" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                      Nama Paket
                    </label>
                    <input
                      id="pkg-nama"
                      type="text"
                      required
                      maxLength={60}
                      value={pkgDraft.namaPaket}
                      onChange={(e) => {
                        setPkgDirty(true);
                        setPkgDraft((prev) => ({ ...prev, namaPaket: e.target.value }));
                      }}
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label htmlFor="pkg-harga" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                      Harga Jual (Rp)
                    </label>
                    <input
                      id="pkg-harga"
                      type="number"
                      min={0}
                      max={100000000}
                      required
                      value={pkgDraft.harga}
                      onChange={(e) => {
                        setPkgDirty(true);
                        setPkgDraft((prev) => ({ ...prev, harga: Number(e.target.value) || 0 }));
                      }}
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm tabular-nums text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Harga Coret / Promo Paket */}
                <div className="p-4 bg-[#0B0B0D] border border-[#C8A24D]/30 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pkgDraft.promoAktif}
                      onChange={(e) => {
                        setPkgDirty(true);
                        setPkgDraft((prev) => ({ ...prev, promoAktif: e.target.checked }));
                      }}
                      className="w-4 h-4 accent-[#C8A24D]"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                      Aktifkan Harga Coret / Promo untuk Paket Ini
                    </span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="pkg-coret" className="block text-xs text-[#FAF8F4]/75 mb-1">
                        Harga Coret (Sebelum Diskon)
                      </label>
                      <input
                        id="pkg-coret"
                        type="number"
                        min={0}
                        max={100000000}
                        value={pkgDraft.hargaCoret}
                        onChange={(e) => {
                          setPkgDirty(true);
                          setPkgDraft((prev) => ({
                            ...prev,
                            hargaCoret: Number(e.target.value) || 0,
                          }));
                        }}
                        className="w-full px-3 py-2 min-h-[40px] bg-[#131317] border border-white/15 text-sm tabular-nums text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div>
                      <label htmlFor="pkg-label-promo" className="block text-xs text-[#FAF8F4]/75 mb-1">
                        Label Promo
                      </label>
                      <input
                        id="pkg-label-promo"
                        type="text"
                        maxLength={60}
                        value={pkgDraft.labelPromo}
                        onChange={(e) => {
                          setPkgDirty(true);
                          setPkgDraft((prev) => ({ ...prev, labelPromo: e.target.value }));
                        }}
                        placeholder="Promo"
                        className="w-full px-3 py-2 min-h-[40px] bg-[#131317] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                </div>

                {/* Daftar Fitur Paket (Add / Edit / Toggle / Delete) */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                      Daftar Fitur Paket ({pkgDraft.fitur.length}/30)
                    </p>
                    <p className="text-[11px] text-[#FAF8F4]/55">
                      Klik ikon centang/silang untuk mengatur apakah fitur termasuk di paket ini.
                    </p>
                  </div>

                  {pkgDraft.fitur.length === 0 ? (
                    <div className="p-4 bg-[#0B0B0D] border border-white/10 text-xs text-[#FAF8F4]/60 text-center">
                      Belum ada fitur pada paket ini. Tambahkan fitur di bawah lalu klik Simpan.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {pkgDraft.fitur.map((fitur) => (
                        <div
                          key={fitur.id}
                          className="flex items-center gap-2 bg-[#0B0B0D] border border-white/12 p-2"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleFiturTersedia(fitur.id)}
                            title={
                              fitur.tersedia
                                ? 'Dapat di paket ini (klik untuk ubah ke Tidak Dapat)'
                                : 'Tidak dapat di paket ini (klik untuk ubah ke Dapat)'
                            }
                            className={`px-2.5 py-1.5 min-h-[36px] text-xs font-semibold inline-flex items-center gap-1 border shrink-0 transition-colors ${
                              fitur.tersedia
                                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                                : 'bg-[#18181B] border-white/15 text-[#A1A1AA]'
                            }`}
                          >
                            {fitur.tersedia ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Dapat</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3.5 h-3.5" />
                                <span>Tidak</span>
                              </>
                            )}
                          </button>

                          <input
                            type="text"
                            maxLength={200}
                            value={fitur.nama}
                            onChange={(e) => handleEditFiturNama(fitur.id, e.target.value)}
                            aria-label="Nama fitur"
                            className={`flex-1 min-w-0 px-2.5 py-1.5 min-h-[36px] bg-transparent border border-transparent focus:border-[#D4AF37] focus:bg-[#131317] text-xs focus:outline-none ${
                              fitur.tersedia ? 'text-[#FAF8F4]' : 'text-[#A1A1AA]'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleRemoveFitur(fitur.id)}
                            aria-label={`Hapus fitur ${fitur.nama}`}
                            className="p-2 text-red-300/80 hover:text-red-300 hover:bg-red-950/40 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Feature Input Row */}
                  <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      maxLength={200}
                      value={newFiturNama}
                      onChange={(e) => setNewFiturNama(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFitur();
                        }
                      }}
                      placeholder="Tambah fitur baru (contoh: Video Prewedding HD)..."
                      className="flex-1 px-3 py-2 min-h-[40px] bg-[#0B0B0D] border border-white/15 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={newFiturTersedia ? 'ya' : 'tidak'}
                        onChange={(e) => setNewFiturTersedia(e.target.value === 'ya')}
                        aria-label="Status fitur baru"
                        className="px-2.5 py-2 min-h-[40px] bg-[#0B0B0D] border border-white/15 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                      >
                        <option value="ya">✓ Dapat</option>
                        <option value="tidak">✕ Tidak Dapat</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddFitur}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] border border-[#C8A24D] text-[#D4AF37] hover:bg-[#C8A24D] hover:text-[#0B0B0D] text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>
                </div>

                {packageFeedback && (
                  <div
                    className={`p-3 text-xs border ${
                      packageFeedback.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/50 border-red-500/40 text-red-200'
                    }`}
                    role="status"
                  >
                    {packageFeedback.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingPackage}
                  className="w-full py-3 min-h-[46px] bg-[#C8A24D] hover:bg-[#D4AF37] disabled:opacity-60 text-[#0B0B0D] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  {savingPackage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Firestore...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan Paket {pkgDraft.namaPaket}</span>
                  )}
                </button>
              </form>

              {/* Right Column: Live Storefront Preview of Checklist */}
              <div className="lg:col-span-5 bg-[#FAF8F4] text-[#111113] border border-[#C8A24D]/40 p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9E7B2F]">
                  Preview Tampilan Pembeli
                </p>
                <div className="mt-2 pb-4 border-b border-[#E4E0D8] flex items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-display text-2xl font-semibold text-[#111113]">
                      Paket {pkgDraft.namaPaket || selectedPkgTier}
                    </h3>
                    {pkgDraft.promoAktif && pkgDraft.hargaCoret > pkgDraft.harga && (
                      <span className="inline-block mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#9E7B2F]">
                        {pkgDraft.labelPromo || 'Promo'}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {pkgDraft.promoAktif && pkgDraft.hargaCoret > pkgDraft.harga && (
                      <p className="text-xs text-[#71717A] line-through tabular-nums">
                        {formatRupiah(pkgDraft.hargaCoret)}
                      </p>
                    )}
                    <p className="text-xl font-semibold text-[#9E7B2F] tabular-nums">
                      {formatRupiah(pkgDraft.harga)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#111113] mb-3">
                    Fitur yang Kamu Dapat · {pkgDraft.namaPaket}
                  </p>
                  {pkgDraft.fitur.length === 0 ? (
                    <p className="text-xs text-[#71717A]">
                      Belum ada daftar fitur. Tambahkan fitur di kolom sebelah kiri.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {pkgDraft.fitur.map((f) => (
                        <li key={f.id} className="flex items-start gap-2 leading-snug">
                          {f.tersedia ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" strokeWidth={2.5} />
                              <span className="text-[#18181B] font-medium">{f.nama || '(Fitur kosong)'}</span>
                            </>
                          ) : (
                            <>
                              <X className="w-4 h-4 text-[#A1A1AA] shrink-0 mt-0.5" strokeWidth={2.25} />
                              <span className="text-[#71717A] line-through">{f.nama || '(Fitur kosong)'}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: KELOLA GAMBAR WEBSITE */}
        {activeTab === 'images' && (
          <section className="space-y-8">
            <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#D4AF37] font-semibold">
                  100% Tersimpan &amp; Dibaca dari Firestore (settings/images)
                </p>
                <h2 className="font-display text-3xl font-semibold text-[#FAF8F4]">
                  Kelola Gambar Website
                </h2>
                <p className="mt-1 text-xs text-[#FAF8F4]/65">
                  Ganti gambar yang tampil di website depan via upload dari HP / paste link gambar. Perubahan langsung tayang di website depan tanpa publish ulang kode.
                </p>
              </div>
              {imagesDirty && (
                <span className="text-xs font-medium text-[#D4AF37]">
                  Ada perubahan gambar belum disimpan
                </span>
              )}
            </div>

            {/* Form Gambar Halaman Utama (Hero & Alur Pemesanan) */}
            <form onSubmit={handleSaveWebsiteImages} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Slot 1: Gambar Hero (Foto HP + Amplop) */}
                <div className="bg-[#131317] border border-[#C8A24D]/30 p-5 sm:p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
                          Bagian Atas Website Depan
                        </p>
                        <h3 className="font-display text-2xl font-semibold text-[#FAF8F4]">
                          Gambar Hero Utama (Foto HP &amp; Amplop)
                        </h3>
                      </div>
                      <span
                        className={`text-[11px] font-medium shrink-0 ${
                          imagesDraft.heroImage ? 'text-emerald-300' : 'text-[#FAF8F4]/55'
                        }`}
                      >
                        {imagesDraft.heroImage ? 'Dari Firestore' : 'Default Bawaan'}
                      </span>
                    </div>

                    <div className="aspect-[4/3] w-full bg-[#0B0B0D] border border-white/15 overflow-hidden">
                      <AdminThumbnail
                        src={imagesDraft.heroImage || DEFAULT_WEBSITE_IMAGES.heroImage}
                        alt="Preview Gambar Hero Website"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="site-hero-file"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-[#C8A24D] hover:bg-[#D4AF37] text-[#0B0B0D] text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {processingSiteImgKey === 'heroImage' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Memproses...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Ganti Gambar (Upload HP)</span>
                          </>
                        )}
                        <input
                          id="site-hero-file"
                          type="file"
                          accept="image/*"
                          disabled={processingSiteImgKey !== null}
                          onChange={(e) => void handleWebsiteImageFileChange('heroImage', e)}
                          className="sr-only"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowHeroUrlInput((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] border border-white/20 text-xs font-medium text-[#FAF8F4] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>{showHeroUrlInput ? 'Tutup Link' : 'Paste Link Gambar'}</span>
                      </button>

                      {imagesDraft.heroImage && (
                        <button
                          type="button"
                          onClick={() => {
                            setImagesDirty(true);
                            setImagesDraft((prev) => ({ ...prev, heroImage: '' }));
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] border border-white/15 text-xs text-[#FAF8F4]/70 hover:text-white transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Pakai Default</span>
                        </button>
                      )}
                    </div>

                    {showHeroUrlInput && (
                      <div>
                        <label htmlFor="hero-url-input" className="block text-[11px] text-[#FAF8F4]/70 mb-1">
                          URL Gambar Hero (https://...)
                        </label>
                        <input
                          id="hero-url-input"
                          type="url"
                          maxLength={420000}
                          value={imagesDraft.heroImage.startsWith('data:') ? '' : imagesDraft.heroImage}
                          onChange={(e) => {
                            setImagesDirty(true);
                            setImagesDraft((prev) => ({ ...prev, heroImage: e.target.value }));
                          }}
                          placeholder="https://contoh.com/gambar-hero.jpg"
                          className="w-full px-3 py-2 min-h-[40px] bg-[#0B0B0D] border border-white/15 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    )}

                    {imagesDraft.heroImage.startsWith('data:') && (
                      <p className="text-[11px] text-emerald-300">
                        Gambar upload siap disimpan ({estimateDataUrlSizeKb(imagesDraft.heroImage)} KB)
                      </p>
                    )}
                  </div>
                </div>

                {/* Slot 2: Gambar Alur Pemesanan (Foto Flat-lay Cincin) */}
                <div className="bg-[#131317] border border-[#C8A24D]/30 p-5 sm:p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
                          Bagian Alur Pemesanan Mudah
                        </p>
                        <h3 className="font-display text-2xl font-semibold text-[#FAF8F4]">
                          Gambar Alur Pemesanan (Flat-lay Cincin)
                        </h3>
                      </div>
                      <span
                        className={`text-[11px] font-medium shrink-0 ${
                          imagesDraft.alurImage ? 'text-emerald-300' : 'text-[#FAF8F4]/55'
                        }`}
                      >
                        {imagesDraft.alurImage ? 'Dari Firestore' : 'Default Bawaan'}
                      </span>
                    </div>

                    <div className="aspect-[4/3] w-full bg-[#0B0B0D] border border-white/15 overflow-hidden">
                      <AdminThumbnail
                        src={imagesDraft.alurImage || DEFAULT_WEBSITE_IMAGES.alurImage}
                        alt="Preview Gambar Alur Pemesanan"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="site-alur-file"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-[#C8A24D] hover:bg-[#D4AF37] text-[#0B0B0D] text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {processingSiteImgKey === 'alurImage' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Memproses...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Ganti Gambar (Upload HP)</span>
                          </>
                        )}
                        <input
                          id="site-alur-file"
                          type="file"
                          accept="image/*"
                          disabled={processingSiteImgKey !== null}
                          onChange={(e) => void handleWebsiteImageFileChange('alurImage', e)}
                          className="sr-only"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowAlurUrlInput((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] border border-white/20 text-xs font-medium text-[#FAF8F4] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>{showAlurUrlInput ? 'Tutup Link' : 'Paste Link Gambar'}</span>
                      </button>

                      {imagesDraft.alurImage && (
                        <button
                          type="button"
                          onClick={() => {
                            setImagesDirty(true);
                            setImagesDraft((prev) => ({ ...prev, alurImage: '' }));
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] border border-white/15 text-xs text-[#FAF8F4]/70 hover:text-white transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Pakai Default</span>
                        </button>
                      )}
                    </div>

                    {showAlurUrlInput && (
                      <div>
                        <label htmlFor="alur-url-input" className="block text-[11px] text-[#FAF8F4]/70 mb-1">
                          URL Gambar Alur Pemesanan (https://...)
                        </label>
                        <input
                          id="alur-url-input"
                          type="url"
                          maxLength={420000}
                          value={imagesDraft.alurImage.startsWith('data:') ? '' : imagesDraft.alurImage}
                          onChange={(e) => {
                            setImagesDirty(true);
                            setImagesDraft((prev) => ({ ...prev, alurImage: e.target.value }));
                          }}
                          placeholder="https://contoh.com/gambar-flatlay-cincin.jpg"
                          className="w-full px-3 py-2 min-h-[40px] bg-[#0B0B0D] border border-white/15 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    )}

                    {imagesDraft.alurImage.startsWith('data:') && (
                      <p className="text-[11px] text-emerald-300">
                        Gambar upload siap disimpan ({estimateDataUrlSizeKb(imagesDraft.alurImage)} KB)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {imagesFeedback && (
                <div
                  className={`p-3.5 text-xs border ${
                    imagesFeedback.type === 'success'
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/50 border-red-500/40 text-red-200'
                  }`}
                  role="status"
                >
                  {imagesFeedback.message}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingImages || processingSiteImgKey !== null}
                  className="px-6 py-3 min-h-[46px] bg-[#C8A24D] hover:bg-[#D4AF37] disabled:opacity-60 text-[#0B0B0D] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  {savingImages ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Gambar ke Firestore...</span>
                    </>
                  ) : (
                    <span>Simpan Gambar Website ke Firestore</span>
                  )}
                </button>
              </div>
            </form>

            {/* Daftar Semua Gambar Thumbnail Katalog Template */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#D4AF37] font-semibold">
                  Semua Gambar Katalog ({templates.length})
                </p>
                <h3 className="font-display text-2xl font-semibold text-[#FAF8F4]">
                  Gambar Thumbnail Template Undangan
                </h3>
                <p className="text-xs text-[#FAF8F4]/60 mt-0.5">
                  Setiap gambar kartu katalog di website depan juga dapat langsung diganti dari sini.
                </p>
              </div>

              {templates.length === 0 ? (
                <div className="p-6 bg-[#131317] border border-white/10 text-xs text-[#FAF8F4]/60 text-center">
                  Belum ada template di Firestore.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {templates.map((tpl) => {
                    const isEditing = editingThumbTplId === tpl.id;
                    const displaySrc = isEditing && tplThumbDraft ? tplThumbDraft : tpl.fotoThumbnail;
                    const feedbackForThis = tplThumbFeedback?.id === tpl.id ? tplThumbFeedback : null;

                    return (
                      <div
                        key={tpl.id}
                        className="bg-[#131317] border border-white/12 p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
                                {tpl.kategori || 'Pernikahan'}
                              </p>
                              <h4 className="font-display text-lg font-semibold text-[#FAF8F4] truncate">
                                {tpl.namaTemplate}
                              </h4>
                            </div>
                          </div>

                          <div className="aspect-video w-full bg-[#0B0B0D] border border-white/10 overflow-hidden">
                            <AdminThumbnail
                              src={displaySrc}
                              alt={tpl.namaTemplate}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>

                        {feedbackForThis && (
                          <div
                            className={`p-2.5 text-[11px] border ${
                              feedbackForThis.type === 'success'
                                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                                : 'bg-red-950/50 border-red-500/40 text-red-200'
                            }`}
                          >
                            {feedbackForThis.message}
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-2.5 pt-2 border-t border-white/10">
                            <div className="flex flex-wrap gap-2">
                              <label
                                htmlFor={`tpl-quick-thumb-${tpl.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] bg-[#C8A24D] hover:bg-[#D4AF37] text-[#0B0B0D] text-xs font-semibold cursor-pointer"
                              >
                                {processingTplThumb ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Memproses...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Upload dari HP</span>
                                  </>
                                )}
                                <input
                                  id={`tpl-quick-thumb-${tpl.id}`}
                                  type="file"
                                  accept="image/*"
                                  disabled={processingTplThumb}
                                  onChange={(e) => void handleTplThumbFileChange(e)}
                                  className="sr-only"
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => setShowTplThumbUrlInput((prev) => !prev)}
                                className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] border border-white/20 text-xs text-[#FAF8F4] hover:border-[#D4AF37]"
                              >
                                <LinkIcon className="w-3 h-3" />
                                <span>{showTplThumbUrlInput ? 'Tutup URL' : 'Paste Link'}</span>
                              </button>
                            </div>

                            {showTplThumbUrlInput && (
                              <input
                                type="url"
                                maxLength={500000}
                                value={tplThumbDraft.startsWith('data:') ? '' : tplThumbDraft}
                                onChange={(e) => setTplThumbDraft(e.target.value)}
                                placeholder="https://..."
                                className="w-full px-3 py-2 min-h-[38px] bg-[#0B0B0D] border border-white/15 text-xs text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                              />
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={savingTplThumb || processingTplThumb}
                                onClick={() => void handleSaveTplThumb(tpl.id, tpl.namaTemplate)}
                                className="flex-1 py-2 min-h-[38px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold"
                              >
                                {savingTplThumb ? 'Menyimpan...' : 'Simpan ke Firestore'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingThumbTplId(null);
                                  setTplThumbDraft('');
                                  setShowTplThumbUrlInput(false);
                                }}
                                className="px-3 py-2 min-h-[38px] border border-white/20 text-xs text-[#FAF8F4]/75"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingThumbTplId(tpl.id);
                              setTplThumbDraft(tpl.fotoThumbnail);
                              setShowTplThumbUrlInput(false);
                              setTplThumbFeedback(null);
                            }}
                            className="w-full py-2 min-h-[40px] border border-[#C8A24D]/45 text-xs font-semibold text-[#D4AF37] hover:bg-[#C8A24D] hover:text-[#0B0B0D] transition-colors inline-flex items-center justify-center gap-1.5"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Ganti Gambar</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 4: KELOLA ORDERAN */}
        {activeTab === 'orders' && (
          <section className="space-y-6">
            <div className="p-4 sm:p-5 bg-[#16140F] border border-[#C8A24D]/40 text-xs sm:text-sm text-[#FAF8F4]/85 leading-relaxed">
              <strong className="text-[#D4AF37] font-semibold">Alur Pengerjaan Pesanan:</strong>{' '}
              Edit undangan tidak dilakukan di platform ini. Buka website asli pada akun sumber Anda,
              duplikat template tersebut, ubah nama pengantin/tanggal/foto, lalu kirimkan tautan undangan
              baru kepada pembeli melalui WhatsApp.
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="inline-flex flex-wrap gap-1 p-1 bg-[#131317] border border-white/10">
                {(['semua', 'baru', 'diproses', 'selesai'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3.5 py-2 text-xs font-semibold capitalize transition-colors ${
                      orderStatusFilter === st
                        ? 'bg-[#C8A24D] text-[#0B0B0D]'
                        : 'text-[#FAF8F4]/75 hover:text-[#FAF8F4]'
                    }`}
                  >
                    {st === 'semua'
                      ? `Semua (${orders.length})`
                      : `${st} (${orders.filter((o) => o.status === st).length})`}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-[#FAF8F4]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Cari pengantin, pemesan, atau WA..."
                  className="w-full sm:w-72 pl-10 pr-4 py-2.5 min-h-[42px] bg-[#131317] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-10 bg-[#131317] border border-white/10 text-center">
                <p className="font-display text-2xl text-[#FAF8F4]">Belum Ada Orderan</p>
                <p className="mt-1 text-xs text-[#FAF8F4]/60">
                  Pesanan yang masuk dari halaman katalog akan tampil secara otomatis di sini.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const linkedTemplate = templateMap.get(order.templateId);
                  const tierLabel = getTierLabel(order.paketDipilih, packageConfigs);
                  const sourceUrl = linkedTemplate
                    ? getTemplatePreviewLink(linkedTemplate, order.paketDipilih)
                    : '';
                  const waMessage = `Halo Kak ${order.namaPemesan}, terima kasih telah memesan undangan "${order.templateName}" paket ${tierLabel} untuk acara ${order.namaPria} & ${order.namaWanita} (${order.tanggalAcara}) di Sekar Kencana Invitation.`;
                  const waBuyerHref = buildWhatsAppUrl(order.noWA, waMessage);

                  return (
                    <article
                      key={order.id}
                      className="bg-[#131317] border border-white/12 p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                    >
                      <div className="lg:col-span-4 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-[#FAF8F4]/55">
                          <span className="font-mono">{order.id.slice(0, 8)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatFirestoreTimestamp(order.createdAt)}</span>
                        </div>
                        <h3 className="font-display text-xl font-semibold text-[#FAF8F4]">
                          {order.namaPria} &amp; {order.namaWanita}
                        </h3>
                        <p className="text-xs text-[#FAF8F4]/70">
                          Acara: <span className="tabular-nums font-medium">{order.tanggalAcara}</span>
                        </p>
                      </div>

                      <div className="lg:col-span-3 space-y-1">
                        <p className="text-sm font-medium text-[#D4AF37]">{order.templateName}</p>
                        <p className="text-xs text-[#FAF8F4]/80 tabular-nums">
                          Paket {tierLabel} ·{' '}
                          <strong className="text-[#FAF8F4]">{formatRupiah(order.hargaBayar)}</strong>
                        </p>
                        {sourceUrl && (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#FAF8F4]/65 hover:text-[#D4AF37]"
                          >
                            <span>Buka Website Paket {tierLabel}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="lg:col-span-3 space-y-1.5">
                        <p className="text-sm font-medium text-[#FAF8F4]">{order.namaPemesan}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-[#FAF8F4]/75 tabular-nums">
                            {order.noWA}
                          </span>
                          {waBuyerHref && (
                            <a
                              href={waBuyerHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium hover:bg-emerald-600/30"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Chat WA</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="lg:col-span-2 flex items-center justify-end gap-2">
                        <label htmlFor={`status-${order.id}`} className="sr-only">
                          Status Pesanan
                        </label>
                        <select
                          id={`status-${order.id}`}
                          disabled={updatingOrderId === order.id}
                          value={order.status}
                          onChange={(e) =>
                            void handleOrderStatusChange(order.id, e.target.value as OrderStatus)
                          }
                          className={`w-full lg:w-auto px-3 py-2 min-h-[40px] border text-xs font-semibold uppercase tracking-wider focus:outline-none ${
                            order.status === 'baru'
                              ? 'bg-[#1D1910] border-[#D4AF37] text-[#D4AF37]'
                              : order.status === 'diproses'
                              ? 'bg-sky-950/60 border-sky-500/50 text-sky-300'
                              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                          }`}
                        >
                          <option value="baru" className="bg-[#131317] text-[#FAF8F4]">
                            Baru
                          </option>
                          <option value="diproses" className="bg-[#131317] text-[#FAF8F4]">
                            Diproses
                          </option>
                          <option value="selesai" className="bg-[#131317] text-[#FAF8F4]">
                            Selesai
                          </option>
                        </select>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 5: PENGATURAN TOKO (WHATSAPP ADMIN DI settings/whatsapp) */}
        {activeTab === 'store' && (
          <section className="max-w-3xl mx-auto space-y-6">
            <div className="border-b border-white/10 pb-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#D4AF37] font-semibold">
                100% Tersimpan &amp; Dibaca dari Firestore (settings/whatsapp)
              </p>
              <h2 className="font-display text-3xl font-semibold text-[#FAF8F4]">
                Pengaturan Toko
              </h2>
              <p className="mt-1 text-xs text-[#FAF8F4]/65">
                Atur Nomor WhatsApp Admin penerima seluruh tombol Pesan, Order, Chat, dan Floating WA di website depan.
              </p>
            </div>

            <form
              onSubmit={handleSaveStoreWa}
              className="bg-[#131317] border border-[#C8A24D]/30 p-5 sm:p-6 space-y-5"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="font-display text-xl font-semibold text-[#FAF8F4]">
                    Nomor WhatsApp Admin
                  </h3>
                </div>
                <span className="text-[11px] text-[#FAF8F4]/60 font-mono">
                  {savedAdminWa ? `Aktif: ${formatNomorWA(savedAdminWa)}` : 'Belum diatur'}
                </span>
              </div>

              <div>
                <label htmlFor="store-wa-input" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1.5">
                  Nomor WhatsApp Admin (Format bebas: 08..., +62..., atau 628...)
                </label>
                <input
                  id="store-wa-input"
                  type="tel"
                  maxLength={30}
                  value={adminWaInput}
                  onChange={(e) => setAdminWaInput(e.target.value)}
                  placeholder="Contoh: 6282315824206 atau 0823-1582-4206"
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#0B0B0D] border border-white/15 text-sm font-mono tabular-nums text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                />
                <p className="mt-1.5 text-[11px] text-[#FAF8F4]/55">
                  Fungsi <code className="text-[#D4AF37]">formatNomorWA</code> otomatis mengubah awalan <code className="text-[#FAF8F4]/80">08...</code> menjadi <code className="text-[#FAF8F4]/80">628...</code> serta membuang spasi, strip (<code className="text-[#FAF8F4]/80">-</code>), dan tanda <code className="text-[#FAF8F4]/80">+</code>.
                </p>
              </div>

              {/* Live Preview Link http://wa.me/nomornya */}
              <div className="p-4 bg-[#0B0B0D] border border-[#C8A24D]/30 space-y-2">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-[#D4AF37]">
                  Preview Link WhatsApp (Klik untuk Tes)
                </p>
                {formatNomorWA(adminWaInput) ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <a
                      href={`https://wa.me/${formatNomorWA(adminWaInput)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-emerald-300 hover:underline break-all"
                    >
                      http://wa.me/{formatNomorWA(adminWaInput)}
                    </a>
                    <a
                      href={`https://wa.me/${formatNomorWA(adminWaInput)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[38px] bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Tes Klik Link WA</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-[#FAF8F4]/50">
                    Masukkan nomor WhatsApp di atas untuk melihat preview link <span className="font-mono">http://wa.me/...</span>
                  </p>
                )}
              </div>

              {storeWaFeedback && (
                <div
                  className={`p-3 text-xs border ${
                    storeWaFeedback.type === 'success'
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/50 border-red-500/40 text-red-200'
                  }`}
                  role="status"
                >
                  {storeWaFeedback.message}
                </div>
              )}

              <button
                type="submit"
                disabled={savingStoreWa}
                className="w-full sm:w-auto px-6 py-3 min-h-[46px] bg-[#C8A24D] hover:bg-[#D4AF37] disabled:opacity-60 text-[#0B0B0D] text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {savingStoreWa ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Firestore...</span>
                  </>
                ) : (
                  <span>Simpan Pengaturan WhatsApp</span>
                )}
              </button>
            </form>
          </section>
        )}

        {/* TAB 6: DATA ADMIN */}
        {activeTab === 'settings' && (
          <section className="max-w-4xl mx-auto space-y-6">
            <div className="border-b border-white/10 pb-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#D4AF37] font-semibold">
                Keamanan &amp; Akun Administrator
              </p>
              <h2 className="font-display text-3xl font-semibold text-[#FAF8F4]">
                Data Admin
              </h2>
              <p className="mt-1 text-xs text-[#FAF8F4]/65">
                Email akun: <span className="font-mono text-[#FAF8F4]/90">{adminProfile.email}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ganti Username */}
              <form
                onSubmit={handleUpdateUsername}
                className="bg-[#131317] border border-[#C8A24D]/30 p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                  <UserCheck className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="font-display text-xl font-semibold text-[#FAF8F4]">
                    Ubah Username Admin
                  </h3>
                </div>

                <div>
                  <label className="block text-xs text-[#FAF8F4]/60 mb-1">
                    Username Saat Ini
                  </label>
                  <p className="px-3.5 py-2 bg-[#0B0B0D] border border-white/10 text-sm font-mono text-[#D4AF37]">
                    {adminProfile.username}
                  </p>
                </div>

                <div>
                  <label htmlFor="new-username" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                    Username Baru
                  </label>
                  <input
                    id="new-username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Contoh: admin_sekar"
                    className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {usernameFeedback && (
                  <div
                    className={`p-3 text-xs border ${
                      usernameFeedback.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/50 border-red-500/40 text-red-200'
                    }`}
                    role="status"
                  >
                    {usernameFeedback.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingUsername}
                  className="w-full py-2.5 min-h-[44px] bg-[#C8A24D] hover:bg-[#D4AF37] disabled:opacity-60 text-[#0B0B0D] text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  {savingUsername ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Username</span>
                  )}
                </button>
              </form>

              {/* Ganti Password */}
              <form
                onSubmit={handleUpdatePassword}
                className="bg-[#131317] border border-[#C8A24D]/30 p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                  <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="font-display text-xl font-semibold text-[#FAF8F4]">
                    Ubah Password Admin
                  </h3>
                </div>

                <div>
                  <label htmlFor="old-password" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                    Password Lama
                  </label>
                  <input
                    id="old-password"
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Masukkan password saat ini"
                    className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                    Password Baru (minimal 6 karakter)
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-medium text-[#FAF8F4]/85 mb-1">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#0B0B0D] border border-white/15 text-sm text-[#FAF8F4] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {passwordFeedback && (
                  <div
                    className={`p-3 text-xs border ${
                      passwordFeedback.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/50 border-red-500/40 text-red-200'
                    }`}
                    role="status"
                  >
                    {passwordFeedback.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full py-2.5 min-h-[44px] bg-[#C8A24D] hover:bg-[#D4AF37] disabled:opacity-60 text-[#0B0B0D] text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memperbarui...</span>
                    </>
                  ) : (
                    <span>Simpan Password Baru</span>
                  )}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
