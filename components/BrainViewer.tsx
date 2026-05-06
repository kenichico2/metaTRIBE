"use client";

import { useEffect, useRef, useState } from "react";
import type { ResultPayload } from "@/lib/types";
import { resolveBackendAsset } from "@/lib/storage";

function buildFireLUT(): Float32Array {
  const lut = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r: number, g: number, b: number;
    if (t < 0.33) {
      r = t / 0.33;
      g = 0;
      b = 0;
    } else if (t < 0.66) {
      r = 1;
      g = (t - 0.33) / 0.33;
      b = 0;
    } else {
      r = 1;
      g = 1;
      b = Math.min(1, (t - 0.66) / 0.34);
    }
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

function f16ToF32(u16: number): number {
  const sign = (u16 & 0x8000) >> 15;
  const exp = (u16 & 0x7c00) >> 10;
  const frac = u16 & 0x03ff;
  if (exp === 0) {
    if (frac === 0) return sign ? -0 : 0;
    return (sign ? -1 : 1) * Math.pow(2, -14) * (frac / 1024);
  } else if (exp === 0x1f) {
    return frac === 0 ? (sign ? -Infinity : Infinity) : NaN;
  }
  return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

type ViewerState = {
  applyFrame: (timeIdx: number, threshold: number) => void;
  T: number;
  V: number;
  dispose: () => void;
};

export default function BrainViewer({
  backend,
  result,
}: {
  backend: string;
  result: ResultPayload;
  currentTime?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ViewerState | null>(null);
  const [threshold, setThreshold] = useState(0.6);
  const [status, setStatus] = useState("初期化中...");
  const [timeIdx, setTimeIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import(
          "three/addons/controls/OrbitControls.js"
        );
        if (cancelled) return;

        const meshUrl = resolveBackendAsset(backend, result.mesh_url);
        const predsUrl = resolveBackendAsset(backend, result.preds_url);

        setStatus("mesh をロード中...");
        const meshRes = await fetch(meshUrl, { mode: "cors" });
        if (!meshRes.ok)
          throw new Error(`mesh fetch failed: HTTP ${meshRes.status}`);
        const meshBuf = await meshRes.arrayBuffer();
        if (cancelled) return;

        const dv = new DataView(meshBuf);
        let off = 0;
        const nVL = dv.getUint32(off, true);
        off += 4;
        const nFL = dv.getUint32(off, true);
        off += 4;
        const nVR = dv.getUint32(off, true);
        off += 4;
        const nFR = dv.getUint32(off, true);
        off += 4;
        const lvert = new Float32Array(meshBuf.slice(off, off + nVL * 12));
        off += nVL * 12;
        const lface = new Uint32Array(meshBuf.slice(off, off + nFL * 12));
        off += nFL * 12;
        const lsulc = new Float32Array(meshBuf.slice(off, off + nVL * 4));
        off += nVL * 4;
        const rvert = new Float32Array(meshBuf.slice(off, off + nVR * 12));
        off += nVR * 12;
        const rface = new Uint32Array(meshBuf.slice(off, off + nFR * 12));
        off += nFR * 12;
        const rsulc = new Float32Array(meshBuf.slice(off, off + nVR * 4));
        off += nVR * 4;

        const buildGeom = (
          verts: Float32Array,
          faces: Uint32Array,
          sulc: Float32Array
        ) => {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
          g.setIndex(new THREE.BufferAttribute(faces, 1));
          let smin = Infinity,
            smax = -Infinity;
          for (const v of sulc) {
            if (v < smin) smin = v;
            if (v > smax) smax = v;
          }
          const srange = smax - smin || 1;
          const colors = new Float32Array(verts.length);
          for (let i = 0; i < sulc.length; i++) {
            const t = (sulc[i] - smin) / srange;
            const v = 0.3 + 0.45 * t;
            colors[i * 3] = v;
            colors[i * 3 + 1] = v;
            colors[i * 3 + 2] = v;
          }
          g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          g.computeVertexNormals();
          return { geom: g, smin, smax, srange };
        };

        const L = buildGeom(lvert, lface, lsulc);
        const R = buildGeom(rvert, rface, rsulc);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x05070b);
        const mat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.85,
          metalness: 0.0,
          flatShading: false,
        });
        const lmesh = new THREE.Mesh(L.geom, mat);
        const rmesh = new THREE.Mesh(R.geom, mat);
        scene.add(lmesh, rmesh);
        scene.add(new THREE.AmbientLight(0xffffff, 0.45));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(1, 1, 1);
        scene.add(dirLight);

        const container = containerRef.current!;
        const rect = container.getBoundingClientRect();
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(rect.width, rect.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.innerHTML = "";
        container.appendChild(renderer.domElement);
        renderer.domElement.classList.add("brain-canvas");

        const camera = new THREE.PerspectiveCamera(
          45,
          rect.width / rect.height,
          0.1,
          5000
        );
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const sizeLen = box.getSize(new THREE.Vector3()).length();
        camera.position
          .copy(center)
          .add(new THREE.Vector3(0, 0, sizeLen * 1.2));
        camera.lookAt(center);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(center);
        controls.enableDamping = true;
        controls.update();

        const onResize = () => {
          const r = container.getBoundingClientRect();
          renderer.setSize(r.width, r.height);
          camera.aspect = r.width / r.height;
          camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", onResize);

        let alive = true;
        const animate = () => {
          if (!alive) return;
          controls.update();
          renderer.render(scene, camera);
          requestAnimationFrame(animate);
        };
        animate();

        setStatus("predictions をロード中...");
        const predsRes = await fetch(predsUrl, { mode: "cors" });
        if (!predsRes.ok)
          throw new Error(`preds fetch failed: HTTP ${predsRes.status}`);
        const predsBuf = await predsRes.arrayBuffer();
        if (cancelled) return;
        const u16 = new Uint16Array(predsBuf);
        const T = result.preds_shape[0];
        const V = result.preds_shape[1];
        const preds = new Float32Array(u16.length);
        let pmin = Infinity,
          pmax = -Infinity;
        for (let i = 0; i < u16.length; i++) {
          const v = f16ToF32(u16[i]);
          preds[i] = v;
          if (v < pmin) pmin = v;
          if (v > pmax) pmax = v;
        }
        const prange = pmax - pmin || 1;

        const lut = buildFireLUT();

        const lcolorsAttr = L.geom.attributes.color as THREE.BufferAttribute;
        const rcolorsAttr = R.geom.attributes.color as THREE.BufferAttribute;
        const lcolors = lcolorsAttr.array as Float32Array;
        const rcolors = rcolorsAttr.array as Float32Array;

        const applyFrame = (timeIdx: number, thresh: number) => {
          const ti = Math.max(0, Math.min(T - 1, timeIdx));
          const base = ti * V;
          for (let i = 0; i < nVL; i++) {
            const norm = (preds[base + i] - pmin) / prange;
            if (norm < thresh) {
              const t = (lsulc[i] - L.smin) / L.srange;
              const g = 0.3 + 0.45 * t;
              lcolors[i * 3] = g;
              lcolors[i * 3 + 1] = g;
              lcolors[i * 3 + 2] = g;
            } else {
              const cidx = Math.min(255, Math.max(0, Math.floor(norm * 255)));
              lcolors[i * 3] = lut[cidx * 3];
              lcolors[i * 3 + 1] = lut[cidx * 3 + 1];
              lcolors[i * 3 + 2] = lut[cidx * 3 + 2];
            }
          }
          for (let i = 0; i < nVR; i++) {
            const norm = (preds[base + nVL + i] - pmin) / prange;
            if (norm < thresh) {
              const t = (rsulc[i] - R.smin) / R.srange;
              const g = 0.3 + 0.45 * t;
              rcolors[i * 3] = g;
              rcolors[i * 3 + 1] = g;
              rcolors[i * 3 + 2] = g;
            } else {
              const cidx = Math.min(255, Math.max(0, Math.floor(norm * 255)));
              rcolors[i * 3] = lut[cidx * 3];
              rcolors[i * 3 + 1] = lut[cidx * 3 + 1];
              rcolors[i * 3 + 2] = lut[cidx * 3 + 2];
            }
          }
          lcolorsAttr.needsUpdate = true;
          rcolorsAttr.needsUpdate = true;
        };

        applyFrame(0, threshold);
        setStatus(`mesh: ${nVL + nVR} verts · preds: ${T} × ${V}`);

        dispose = () => {
          alive = false;
          window.removeEventListener("resize", onResize);
          renderer.dispose();
          L.geom.dispose();
          R.geom.dispose();
          mat.dispose();
        };

        stateRef.current = {
          applyFrame,
          T,
          V,
          dispose,
        };
      } catch (e) {
        if (!cancelled) {
          setStatus("読み込み失敗: " + (e instanceof Error ? e.message : String(e)));
        }
      }
    })();

    return () => {
      cancelled = true;
      stateRef.current?.dispose();
      stateRef.current = null;
      if (dispose) dispose();
    };
  }, [backend, result]);

  // Re-apply colors when threshold or timeIdx changes
  useEffect(() => {
    stateRef.current?.applyFrame(timeIdx, threshold);
  }, [threshold, timeIdx]);

  return (
    <div>
      <div ref={containerRef} className="brain-canvas" />
      <div className="row" style={{ marginTop: 10 }}>
        <label className="field">
          表示しきい値 / Threshold: {threshold.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
          />
        </label>
        <label className="field">
          フレーム / Time index: {timeIdx} /{" "}
          {Math.max(0, (stateRef.current?.T ?? 1) - 1)}
          <input
            type="range"
            min={0}
            max={Math.max(0, (stateRef.current?.T ?? 1) - 1)}
            step={1}
            value={timeIdx}
            onChange={(e) => setTimeIdx(parseInt(e.target.value, 10))}
          />
        </label>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>
        {status}
      </div>
    </div>
  );
}
