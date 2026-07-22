const SAKURA_UPLOAD_URL = "https://violetgoat8.sakura.ne.jp/employee.drive/upload.php";

export async function uploadToSakura(imageData: string): Promise<string> {
  const response = await fetch(SAKURA_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageData })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "画像アップロード失敗");
  return result.url;
}
