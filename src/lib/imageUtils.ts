export function isValidImageDataUrl(dataUrl: string): boolean {
  return (
    typeof dataUrl === 'string' &&
    dataUrl.startsWith('data:image/') &&
    dataUrl.length > 100
  );
}

export const compressImage = (
  dataUrl: string,
  maxWidth = 600,
  maxWeight = 0.5
): Promise<string> => {
  if (!isValidImageDataUrl(dataUrl)) {
    return Promise.reject(new Error('画像データが無効です。撮り直してください。'));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.width === 0 || img.height === 0) {
        reject(new Error('画像のサイズが取得できませんでした。撮り直してください。'));
        return;
      }

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('画像の処理に失敗しました。'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', maxWeight));
    };
    img.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました。撮り直してください。'));
    };
    img.src = dataUrl;
  });
};
