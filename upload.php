<?php
// --- CORS設定 ここから ---
// 全てのオリジンからのアクセスを許可（テスト用）
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// ブラウザからの事前確認（OPTIONSリクエスト）への対応
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit; 
}
// --- CORS設定 ここまで ---

header("Content-Type: application/json; charset=utf-8");

$uploadDir = 'photos/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$json = file_get_contents('php://input');
$data = json_decode($json);

if (!$data || !isset($data->image)) {
    http_response_code(400);
    echo json_encode(['error' => '画像データがありません。']);
    exit;
}

$base64 = $data->image;
$base64 = preg_replace('/^data:image\/\w+;base64,/', '', $base64);
$imageData = base64_decode($base64);

$fileName = date('YmdHis') . '-' . substr(md5(uniqid()), 0, 6) . '.jpg';
$filePath = $uploadDir . $fileName;

if (file_put_contents($filePath, $imageData)) {
    // 確実に https:// から始まるURLを返す
    $imageUrl = 'https://violetgoat8.sakura.ne.jp/employee.drive/photos/' . $fileName;
    echo json_encode(['url' => $imageUrl]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーへの保存に失敗しました。']);
}
?>
