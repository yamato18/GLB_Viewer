import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const SHARED_CACHE_NAME = "glb-viewer-shared-files";

const BASE_URL = new URL("./", window.location.href);
const INDEX_URL = new URL("./index.html", BASE_URL);
const SHARED_FILE_URL = new URL("./shared.glb", BASE_URL);

// シーン生成
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

// カメラ設定
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// レンダラー設定
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// カメラコントロール設定
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 照明設定
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(hemisphereLight, ambientLight);

// 矢印表示用関数
const makeArrows = (size = 1) => {
  const group = new THREE.Group();

  const arrowSize = size;
  const headLength = 0.2 * size;
  const headWidth = 0.1 * size;

  // X軸（赤）
  const xArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    arrowSize,
    0xff0000,
    headLength, headWidth
  );

  // Y軸（緑）
  const yArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    arrowSize,
    0x00ff00,
    headLength, headWidth
  );

  // Z軸（青）
  const zArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, 0),
    arrowSize,
    0x0000ff,
    headLength, headWidth
  );

  group.add(xArrow, yArrow, zArrow);
  return group;
};
scene.add(makeArrows(0.5));

// 初期カメラ位置
camera.position.set(0, 1, 3);

// GLBローダー設定
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://unpkg.com/three@0.185.1/examples/jsm/libs/draco/");
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// GLBファイル読み込み関数
const loadGLB = (url) => {
  loader.load(
    url,
    (gltf) => {
      console.log("[INFO] Loaded:", gltf);
      scene.clear();
      scene.add(hemisphereLight, ambientLight, makeArrows(0.5));
      scene.add(gltf.scene);
      fitCameraToObject(camera, gltf.scene, controls);
      if (url.startsWith("blob:")) {
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    },
    (p) => {
      if (p.total > 0) {
        const progress = (p.loaded / p.total * 100);
        console.log(`[INFO] Loading ${progress.toFixed(1)}%`);
      } else {
        console.log(`[INFO] Loading ${p.loaded} bytes`);
      }
    },
    (err) => {
      console.error("[Error] ", err);
      if (url.startsWith("blob:")) {
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      alert("[Error]\nFailed to load model. Please check the file format and contents.");
    }
  );
};

// ローカルファイル選択イベント
document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadGLB(url);
  e.target.value = "";
});

// カメラ自動調整関数
const fitCameraToObject = (camera, object, controls) => {
  let box = new THREE.Box3().setFromObject(object);
  let size = box.getSize(new THREE.Vector3());
  let center = box.getCenter(new THREE.Vector3());

  if (size.length() < 0.0001) {
    console.warn("[WARN] Model too small, scaling up.");
    alert("[WARN]\nModel is too small, scaling up.");
    object.scale.set(100, 100, 100);
    box = new THREE.Box3().setFromObject(object);
    size = box.getSize(new THREE.Vector3());
    center = box.getCenter(new THREE.Vector3());
  }

  camera.position.copy(center).add(new THREE.Vector3(0, size.y * 2, size.z * 3));
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
};

// アニメーションループ
const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};
animate();

// ウィンドウリサイズ対応
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let shouldShowUpdateAlert = false;

// バージョン表示関数
const showVersion = (version) => {
  let div = document.getElementById("version-display");
  if (!div) {
    div = document.createElement("div");
    div.id = "version-display";
    div.style.position = "fixed";
    div.style.bottom = "10px";
    div.style.right = "10px";
    div.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
    div.style.color = "#fff";
    div.style.padding = "6px 12px";
    div.style.borderRadius = "8px";
    div.style.fontFamily = "Arial, sans-serif";
    div.style.fontSize = "14px";
    div.style.zIndex = "10000";
    document.body.appendChild(div);
  }
  div.textContent = `GLB Viewer: v${version}`;
};

const requestServiceWorkerVersion = (registration) => {
  const worker = 
    registration.active ||
    navigator.serviceWorker.controller ||
    registration.waiting ||
    registration.installing;

  if (worker) {
    worker.postMessage({ type: "GET_VERSION" });
  } else {
    console.warn("[WARN] Active ServiceWorker was not found.");
  }
};

// サービスワーカー登録
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "VERSION") {
      const currentVersion = event.data.version;
      showVersion(currentVersion);

      if (shouldShowUpdateAlert) {
        shouldShowUpdateAlert = false;
        alert(`【GLB_Viewer v${currentVersion}】\nWebアプリが更新されました。アプリを再起動してください。\nこの表示が何度も出る場合は更新が正しく適用されていない可能性があります。Webアプリを一度削除し、キャッシュの削除を実行の上で再度インストールしてください。`);
      }
    }
  });

  navigator.serviceWorker.register("./service-worker.js").then(
    async (registration) => {
      console.log("[INFO] ServiceWorker registration successful with scope: ", registration.scope);

      registration.addEventListener("updatefound", () => {
        const installWorker = registration.installing;
        if (installWorker != null) {
          const hadController = navigator.serviceWorker.controller !== null;
          installWorker.onstatechange = (e) => {
            if (e.target.state === "activated") {
              if (hadController) {
                shouldShowUpdateAlert = true;
              }
              e.target.postMessage({ type: "GET_VERSION" });
            }
          };
        }
      });

      const readyRegistration = await navigator.serviceWorker.ready;
      requestServiceWorkerVersion(readyRegistration);
    },
    (err) => {
      console.error("[ERROR] ServiceWorker registration failed: ", err);
    },
  );
} else {
  console.log("[WARN] ServiceWorkers are not supported.");
}

const showShareError = (errorType) => {
  if (errorType === "invalid-file") {
    alert("[ERROR]\n共有されたファイルはGLBファイルではありません。");
  } else if (errorType === "failed") {
    alert("[ERROR]\n共有ファイルの処理に失敗しました。");
  } else {
    alert("[ERROR]\n不明なエラーが発生しました。");
  }
};

const clearShareQuery = () => {
  window.history.replaceState(
    {},
    document.title,
    INDEX_URL.href
  );
};

// 共有ファイル読み込み
window.addEventListener("load", async () => {
  const params = new URLSearchParams(window.location.search);
  
  const shareError = params.get("share-error");
  if (shareError) {
    showShareError(shareError);
    clearShareQuery();
    return;
  }

  if (params.get("share-target") !== "1") {
    return;
  }

  if (!("caches" in window)) {
    console.error("[ERROR] Cache Storage API is not supported.");
    alert("[ERROR]\nこのブラウザはキャッシュストレージAPIをサポートしていません。");
    clearShareQuery();
    return;
  }

  try {
    const cache = await caches.open(SHARED_CACHE_NAME);
    const response = await cache.match(SHARED_FILE_URL.href);
    if (!response) {
      console.error("[ERROR] Shared GLB file was not found in cache.");
      alert("[ERROR]\n共有ファイルがキャッシュに見つかりませんでした。");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    loadGLB(url);
    await cache.delete(SHARED_FILE_URL.href);

    console.log("[INFO] Shared GLB file loaded.");

  } catch (error) {
    console.error("[ERROR] Failed to load shared GLB file: ", error);
    alert("[ERROR]\n共有ファイルの読み込みに失敗しました。");
  } finally {
    clearShareQuery();
  }
});