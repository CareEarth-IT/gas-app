import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  checkFirebaseConnection,
  getAdminCredentialStatus
} from "./server/firebaseAdmin.ts";
import { corsMiddleware } from "./server/cors.ts";
import dataApiRouter from "./server/routes/dataApi.ts";

dotenv.config();

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const PORT = Number(process.env.PORT) || (isProduction ? 8080 : 3000);

  app.use(express.json({ limit: '10mb' }));
  app.use(corsMiddleware);
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/api/firebase-status", async (_req, res) => {
    const credentials = getAdminCredentialStatus();
    const firebase = await checkFirebaseConnection();
    res.status(firebase.connected ? 200 : 503).json({
      ok: firebase.connected,
      firebase,
      credentials,
    });
  });

  app.use("/api", dataApiRouter);

  const httpServer = http.createServer(app);

  // Vite middleware setup
  if (!isProduction) {
    const vite = await createViteServer({
      configFile: path.join(process.cwd(), "vite.config.ts"),
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      // ドライバー(index) + 管理(admin) の2エントリ。spa だと /admin が index に落ちる
      appType: "mpa",
    });

    async function sendHtml(
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
      htmlFile: "index.html" | "admin.html"
    ) {
      try {
        const htmlPath = path.join(process.cwd(), htmlFile);
        let template = fs.readFileSync(htmlPath, "utf-8");
        // transformIndexHtml はエントリ HTML のパスで渡す（URL パスではない）
        template = await vite.transformIndexHtml(`/${htmlFile}`, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (error) {
        next(error);
      }
    }

    // Vite より先に /admin を処理（管理画面がドライバーアプリに置き換わるのを防ぐ）
    app.get(["/admin", "/admin/", "/admin.html"], (req, res, next) => {
      void sendHtml(req, res, next, "admin.html");
    });

    app.use(vite.middlewares);

    // その他の HTML ルートはドライバーアプリ
    app.use(/^(?!\/api\/).*/, async (req, res, next) => {
      if (req.method !== "GET" || req.path.includes(".")) {
        next();
        return;
      }
      await sendHtml(req, res, next, "index.html");
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));

    app.get(['/admin', '/admin/*'], (_req, res) => {
      res.sendFile(path.join(distPath, 'admin.html'));
    });

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `\nポート ${PORT} は既に使用中です。別のターミナルで npm run dev が動いていないか確認してください。\n` +
          `Windows: netstat -ano | findstr :${PORT} で PID を確認し、taskkill /PID <PID> /F で停止できます。\n`
      );
    } else {
      console.error("サーバー起動エラー:", error);
    }
    process.exit(1);
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    const mode = isProduction ? "production" : "development";
    console.log(`Server running on port ${PORT} (${mode})`);
    if (!isProduction) {
      console.log("");
      console.log("ブラウザで次の URL を開いてください:");
      console.log(`  ドライバーアプリ: http://localhost:${PORT}/`);
      console.log(`  管理画面:        http://localhost:${PORT}/admin`);
      console.log("");
      console.log("※ http://localhost/gas-app （XAMPP）では動きません。");
      console.log("  必ず上記の :3000 付き URL を使ってください。");
      const creds = getAdminCredentialStatus();
      if (!creds.configured) {
        console.log("");
        console.log("⚠ Firebase Admin 認証情報が未設定です（管理画面 API が 401 になります）");
        console.log("  秘密鍵 JSON が使えない場合:");
        console.log("    A) .env に LOCAL_FIREBASE_ADC=true");
        console.log("       → gcloud auth application-default login --project ce-gr-drive-2605st");
        console.log("    B) .env に VITE_API_BASE_URL=https://gas-app-231655548437.asia-northeast1.run.app");
        console.log("       → 画面だけローカル、API は本番を利用");
        console.log("  詳細: secrets/README.md");
      } else {
        console.log(`  Firebase Admin: ${creds.source}`);
      }
      console.log("");
    }
  });
}

startServer().catch((error) => {
  console.error("サーバー起動に失敗しました:", error);
  process.exit(1);
});
