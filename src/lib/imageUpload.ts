/**
 * Compresses and resizes a user-selected image file in the browser via HTML5 Canvas
 * so it fits comfortably within Firestore's document size limit (< 300 KB).
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxWidth = 1280,
  maxHeight = 720,
  quality = 0.78,
  maxChars = 480000
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File yang dipilih harus berupa gambar (JPG, PNG, atau WebP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca file gambar dari perangkat.'));
      el.src = objectUrl;
    });

    let { width, height } = img;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser tidak mendukung pemrosesan kanvas gambar.');
    }

    ctx.fillStyle = '#0B0B0D';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length > Math.min(350000, maxChars)) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.58);
    }
    if (dataUrl.length > maxChars) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.42);
    }
    if (dataUrl.length > maxChars) {
      throw new Error('Ukuran gambar terlalu besar. Pilih gambar dengan resolusi lebih kecil.');
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function estimateDataUrlSizeKb(dataUrl: string): number {
  if (!dataUrl.startsWith('data:')) return 0;
  const base64Part = dataUrl.split(',')[1] || '';
  return Math.max(1, Math.round((base64Part.length * 3) / 4 / 1024));
}
