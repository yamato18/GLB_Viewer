const VERSION = "0.8.1";

const CACHE_NAME = `glb-viewer-${VERSION}`;
const SHARED_CACHE_NAME = "glb-viewer-shared-files";

const BASE_URL = new URL("./", self.location.href);
const INDEX_URL = new URL("./index.html", BASE_URL);
const SHARED_TARGET_URL = new URL("./share-target", BASE_URL);
const SHARED_FILE_URL = new URL("./shared.glb", BASE_URL);

const ASSETS = [
  BASE_URL.href,
  INDEX_URL.href,
  new URL("./style.css", BASE_URL).href,
  new URL("./app.js", BASE_URL).href,
  new URL("./manifest.json", BASE_URL).href,

  "https://unpkg.com/three@0.185.1/build/three.module.js",
  "https://unpkg.com/three@0.185.1/examples/jsm/controls/OrbitControls.js",
  "https://unpkg.com/three@0.185.1/examples/jsm/loaders/GLTFLoader.js",
  "https://unpkg.com/three@0.185.1/examples/jsm/loaders/DRACOLoader.js"
];

// 共有ファイル処理関数
const handleShare = async (request) => {
  try {
    const data = await request.formData();
    const file = data.get("file");

    if (file && file.name && file.name.toLowerCase().endsWith(".glb")) {
      const fileData = await file.arrayBuffer();
      const cache = await caches.open(SHARED_CACHE_NAME);

      await cache.put(
        SHARED_FILE_URL.href,
        new Response(fileData, {
          headers: {
            "Content-Type": file.type || "model/gltf-binary"
          }
        })
      );

      console.log(`[INFO] Shared file cached: ${file.name}`);

      return Response.redirect(
        `${INDEX_URL.href}?share-target=1`,
        303
      );
    }

    console.log("[ERROR] Shared file is not a GLB file.");

    return Response.redirect(
      `${INDEX_URL.href}?share-error=invalid-file`,
      303
    );

  } catch (error) {
    console.error("[ERROR] Failed to process shared file:", error);
  }

  return Response.redirect(
    `${INDEX_URL.href}?share-error=failed`,
    303
  );
};

// インストールイベント
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        await cache.addAll(ASSETS);
        console.log("[INFO] ServiceWorker installed.");
      } catch (error) {
        console.error("[WARN] Some assets failed to cache: ", error);
      }
      await self.skipWaiting();
    })());
});

// フェッチイベント
self.addEventListener("fetch", (event) => {

  // 共有ファイルのPOSTリクエスト処理
  const url = new URL(event.request.url);
  if (url.origin === SHARED_TARGET_URL.origin && url.pathname === SHARED_TARGET_URL.pathname && event.request.method === "POST") {
    event.respondWith(handleShare(event.request));
    return;
  }

  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        console.log("[INFO] ServiceWorker fetched.");
        return response;
      } catch (error) {
        const resource = await caches.match(event.request);
        if (resource) {
          console.log(`[WARN] ServiceWorker fetch failed, using cache: ${event.request.url}`);
          return resource;
        }
        console.error(`[ERROR] ServiceWorker fetch failed, no cache available: ${event.request.url}`);
        return new Response(null, { status: 404 });
      }
    })(),
  );
});

// アクティベートイベント
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME && name !== SHARED_CACHE_NAME) {
            return caches.delete(name);
          }
        }),
      );
      await clients.claim();
    })()
  );
  console.log("[INFO] ServiceWorker activated.");
});

// バージョン取得メッセージ処理
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "GET_VERSION") {
    event.source.postMessage({ type: "VERSION", version: VERSION });
  }
});