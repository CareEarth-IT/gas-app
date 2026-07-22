<?php
/**
 * さくらサーバー上でメール送信（SMTP 認証）
 * 配置: https://violetgoat8.sakura.ne.jp/employee.drive/send-mail.php
 */
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["error" => "POST only"]);
    exit;
}

// ★ アップロード後に設定してください
$API_SECRET = "CeGrDrive2026MailSecret_xK9mP2vL";
$FROM_EMAIL = "employee.drive@careearth.net";
$FROM_NAME = "社用車管理";
$SMTP_HOST = "violetgoat8.sakura.ne.jp"; // 初期ドメイン（careearth.net ではない）
$SMTP_PORT = 587;
$SMTP_USER = "employee.drive@careearth.net";
$SMTP_PASS = "VSfBNGif7J9TgPa"; // さくらで作成した employee.drive のパスワード

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

$secret = isset($data["secret"]) ? (string) $data["secret"] : "";
if ($secret === "" || !hash_equals($API_SECRET, $secret)) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden"]);
    exit;
}

$subject = isset($data["subject"]) ? trim((string) $data["subject"]) : "";
$text = isset($data["text"]) ? (string) $data["text"] : "";
$to = $data["to"] ?? [];

if ($subject === "" || $text === "" || !is_array($to) || count($to) === 0) {
    http_response_code(400);
    echo json_encode(["error" => "subject, text, to are required"]);
    exit;
}

$recipients = [];
foreach ($to as $addr) {
    $addr = trim(strtolower((string) $addr));
    if ($addr !== "" && filter_var($addr, FILTER_VALIDATE_EMAIL)) {
        $recipients[] = $addr;
    }
}

if (count($recipients) === 0) {
    http_response_code(400);
    echo json_encode(["error" => "No valid recipients"]);
    exit;
}

if ($SMTP_PASS === "" || $SMTP_PASS === "ここにメールアカウントのパスワード") {
    http_response_code(500);
    echo json_encode(["error" => "SMTP_PASS is not configured on server"]);
    exit;
}

/**
 * さくら SMTP（587 STARTTLS + AUTH LOGIN）
 */
function sendViaSakuraSmtp(
    string $host,
    int $port,
    string $user,
    string $pass,
    string $fromEmail,
    string $fromName,
    array $recipients,
    string $subject,
    string $body
): void {
    $fp = @stream_socket_client(
        "tcp://{$host}:{$port}",
        $errno,
        $errstr,
        30
    );
    if (!$fp) {
        throw new RuntimeException("SMTP connect failed: {$errstr} ({$errno})");
    }

    stream_set_timeout($fp, 30);

    $read = function () use ($fp): string {
        $data = "";
        while ($line = fgets($fp, 515)) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === " ") {
                break;
            }
        }
        return $data;
    };

    $write = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };

    $expect = function (string $resp, array $codes) use ($read): void {
        $code = (int) substr($resp, 0, 3);
        if (!in_array($code, $codes, true)) {
            throw new RuntimeException("SMTP error: {$resp}");
        }
    };

    $expect($read(), [220]);

    $write("EHLO localhost");
    $expect($read(), [250]);

    $write("STARTTLS");
    $expect($read(), [220]);

    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        throw new RuntimeException("STARTTLS failed");
    }

    $write("EHLO localhost");
    $expect($read(), [250]);

    $write("AUTH LOGIN");
    $expect($read(), [334]);
    $write(base64_encode($user));
    $expect($read(), [334]);
    $write(base64_encode($pass));
    $expect($read(), [235]);

    $write("MAIL FROM:<{$fromEmail}>");
    $expect($read(), [250]);

    foreach ($recipients as $rcpt) {
        $write("RCPT TO:<{$rcpt}>");
        $expect($read(), [250, 251]);
    }

    $write("DATA");
    $expect($read(), [354]);

    $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
    $encodedFromName = "=?UTF-8?B?" . base64_encode($fromName) . "?=";
    $toHeader = implode(", ", $recipients);

    $message = "From: {$encodedFromName} <{$fromEmail}>\r\n";
    $message .= "To: {$toHeader}\r\n";
    $message .= "Subject: {$encodedSubject}\r\n";
    $message .= "MIME-Version: 1.0\r\n";
    $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: base64\r\n";
    $message .= "\r\n";
    $message .= chunk_split(base64_encode($body));
    $message .= "\r\n.\r\n";

    fwrite($fp, $message);
    $expect($read(), [250]);

    $write("QUIT");
    fclose($fp);
}

try {
    sendViaSakuraSmtp(
        $SMTP_HOST,
        $SMTP_PORT,
        $SMTP_USER,
        $SMTP_PASS,
        $FROM_EMAIL,
        $FROM_NAME,
        $recipients,
        $subject,
        $text
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "SMTP send failed", "detail" => $e->getMessage()]);
    exit;
}

echo json_encode([
    "ok" => true,
    "to" => $recipients,
    "from" => $FROM_EMAIL
]);
