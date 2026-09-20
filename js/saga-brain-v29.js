/**
 * saga-brain.js
 * -------------------------------------------------------------------
 * Scroll-driven volumetric 3D narrative for the SAGA section.
 *
 *   Phase 01 — RAW DATA      (0.00 → 0.20)  scattered data points
 *   Phase 02 — INTERCONNECT  (0.20 → 0.50)  edges appear, mesh forms
 *   Phase 03 — COALESCE      (0.30 → 0.62)  closed brain surface
 *   Phase 04 — IGNITE        (0.52 → 0.68)  nucleus lights up
 *   Phase 05 — DEPLOY        (0.58 → 0.80)  7 unmanned systems arrive
 *   Phase 06 — OPERATIONAL   (0.78 → 1.00)  dashed links + packets
 *
 * THE BRAIN
 *   A hand-built INDEXED icosahedron: every vertex is stored once,
 *   every edge is shared between exactly two triangles. The mesh is
 *   guaranteed to be a closed manifold. The surface is deformed onto
 *   a smooth brain shape using only continuous functions — no vertex
 *   pushing, no cracks. Vertices become neural nodes; edges become
 *   neural wiring; both assemble from the same scatter positions.
 *
 * THE NUCLEUS
 *   A small amber core inside the brain that ignites once the mesh
 *   has fully assembled. Fresnel-lit inner icosahedron (dark center,
 *   hot rim) wrapped by a counter-rotating wireframe cage. Deliberately
 *   restrained — this is a nucleus, not a sun.
 *
 * SYSTEMS
 *   7 unmanned systems, no satellite. All render white. Amber is
 *   reserved strictly for the brain, nucleus, live links, and packets.
 * -------------------------------------------------------------------
 */

import * as THREE from 'three';

// ------------------------------------------------------------------
// Environment
// ------------------------------------------------------------------
const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isMobile =
  /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
  window.innerWidth < 768;

// ------------------------------------------------------------------
// Tunables
// ------------------------------------------------------------------
const SUBDIVISIONS = isMobile ? 2 : 3;

const PACKETS_PER_SYSTEM = 2;
const NODE_PIXEL_UNIT = isMobile ? 30.0 : 34.0;

// ------------------------------------------------------------------
// Pointer
// ------------------------------------------------------------------
const pointer = { x: 0, y: 0 };
const pointerSmooth = { x: 0, y: 0 };

function bindPointer() {
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth)  * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  window.addEventListener('pointerleave', () => {
    pointer.x = 0; pointer.y = 0;
  }, { passive: true });
}

// ------------------------------------------------------------------
// Math helpers
// ------------------------------------------------------------------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

// ==================================================================
// Indexed icosahedron builder
// ==================================================================
function buildIcosahedron(subdivisions) {
  const t = (1 + Math.sqrt(5)) / 2;

  const rawVerts = [
    [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
    [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
    [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1],
  ];
  const verts = rawVerts.map(([x, y, z]) => {
    const l = Math.sqrt(x*x + y*y + z*z);
    return [x/l, y/l, z/l];
  });

  let faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];

  for (let s = 0; s < subdivisions; s++) {
    const midCache = new Map();
    const newFaces = [];

    const getMid = (i, j) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (midCache.has(key)) return midCache.get(key);

      const a = verts[i], b = verts[j];
      let mx = (a[0] + b[0]) * 0.5;
      let my = (a[1] + b[1]) * 0.5;
      let mz = (a[2] + b[2]) * 0.5;
      const l = Math.sqrt(mx*mx + my*my + mz*mz);
      mx /= l; my /= l; mz /= l;

      const idx = verts.length;
      verts.push([mx, my, mz]);
      midCache.set(key, idx);
      return idx;
    };

    for (const [a, b, c] of faces) {
      const ab = getMid(a, b);
      const bc = getMid(b, c);
      const ca = getMid(c, a);
      newFaces.push([a, ab, ca]);
      newFaces.push([b, bc, ab]);
      newFaces.push([c, ca, bc]);
      newFaces.push([ab, bc, ca]);
    }
    faces = newFaces;
  }

  const edgeSet = new Set();
  for (const [a, b, c] of faces) {
    edgeSet.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    edgeSet.add(b < c ? `${b}-${c}` : `${c}-${b}`);
    edgeSet.add(c < a ? `${c}-${a}` : `${a}-${c}`);
  }
  const edges = [...edgeSet].map((k) => k.split('-').map(Number));

  return { verts, faces, edges };
}

// ------------------------------------------------------------------
// Brain deformation — pure continuous function, no tearing
// ------------------------------------------------------------------
function brainDeform(x, y, z) {
  let X = x * 1.35;
  let Y = y * 0.92;
  let Z = z * 1.55;

  // Waist pinch at the equator
  const waist = 1 - 0.10 * Math.exp(-Math.pow(y * 5.0, 2));
  X *= waist;
  Z *= waist;

  // Very shallow midline groove (reads as an indentation, not a crack)
  const groove = 1 - 0.06 * Math.exp(-Math.pow(x / 0.10, 2));
  X *= groove;
  Y *= groove;
  Z *= groove;

  // Cortex folds
  const fold =
    0.030 * Math.sin(Z * 4.0 + Y * 3.0) +
    0.024 * Math.sin(X * 5.5 + Y * 4.0) +
    0.018 * Math.cos(Z * 6.5 + X * 4.5);
  const fk = 1 + fold;
  X *= fk;
  Y *= fk;
  Z *= fk;

  // Flatten the underside
  Y -= 0.06 * Math.max(0, -y) * Math.max(0, 1 - Math.abs(x) * 1.5);

  return [X, Y, Z];
}

function scatterPoint() {
  const r = 3.5 + Math.random() * 3.5;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
}

// ==================================================================
// Stage
// ==================================================================
class SagaBrain {
  constructor(section) {
    this.section    = section;
    this.canvas     = section.querySelector('[data-saga-canvas]');
    this.sticky     = section.querySelector('[data-sticky]');
    this.brand      = section.querySelector('.saga-v29__brand');
    this.progressBar = section.querySelector('[data-progress-bar]');

    this.progress = 0;
    this.targetProgress = 0;
    this.inView = true;
    this._baseCamZ = 10.2;

    this._initRenderer();
    this._initBrain();
    this._initNucleus();
    this._initSystems();
    this._bindResize();
    this._bindVisibility();
  }

  // ----------------------------------------------------------------
  _initRenderer() {
    const w = this.sticky.clientWidth;
    const h = this.sticky.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    this.camera.position.set(0, 0.35, this._baseCamZ);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !isMobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)
    );
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 0);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this._applyResponsiveCamera();
  }

  _applyResponsiveCamera() {
    const w = this.sticky.clientWidth;
    const h = this.sticky.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    const minAspect = 1.15;
    const camZ = aspect < minAspect
      ? this._baseCamZ * (minAspect / aspect)
      : this._baseCamZ;
    this.camera.position.z = camZ;
    this._camZ = camZ;
  }

  // ----------------------------------------------------------------
  // BRAIN
  // ----------------------------------------------------------------
  _initBrain() {
    const { verts, edges } = buildIcosahedron(SUBDIVISIONS);
    const nVerts = verts.length;

    const deformed = new Array(nVerts);
    for (let i = 0; i < nVerts; i++) {
      deformed[i] = brainDeform(verts[i][0], verts[i][1], verts[i][2]);
    }

    const scatter = new Array(nVerts);
    for (let i = 0; i < nVerts; i++) scatter[i] = scatterPoint();

    this._initNodes(deformed, scatter);
    this._initEdges(deformed, scatter, edges);
  }

  _initNodes(deformed, scatter) {
    const n = deformed.length;
    const startArr   = new Float32Array(n * 3);
    const targetArr  = new Float32Array(n * 3);
    const staggerArr = new Float32Array(n);
    const brightArr  = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const t = deformed[i];
      const s = scatter[i];

      startArr[i*3+0] = s.x; startArr[i*3+1] = s.y; startArr[i*3+2] = s.z;
      targetArr[i*3+0] = t[0]; targetArr[i*3+1] = t[1]; targetArr[i*3+2] = t[2];

      const shell = Math.sqrt(t[0]*t[0] + t[1]*t[1] + t[2]*t[2]);
      staggerArr[i] = Math.random() * 0.4 + clamp01(1.4 - shell) * 0.35;
      brightArr[i]  = 0.65 + Math.random() * 0.35;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(startArr, 3));
    geo.setAttribute('aTarget',  new THREE.BufferAttribute(targetArr, 3));
    geo.setAttribute('aStagger', new THREE.BufferAttribute(staggerArr, 1));
    geo.setAttribute('aBright',  new THREE.BufferAttribute(brightArr, 1));

    this.nodeUniforms = {
      uProgress:  { value: 0 },
      uTime:      { value: 0 },
      uPixelUnit: { value: NODE_PIXEL_UNIT },
      uColor:     { value: new THREE.Color(0xffb060) },
      uDeepColor: { value: new THREE.Color(0x5a7aab) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.nodeUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */`
        uniform float uProgress;
        uniform float uTime;
        uniform float uPixelUnit;
        attribute vec3 aTarget;
        attribute float aStagger;
        attribute float aBright;
        varying float vAlpha;
        varying float vDepth;
        varying float vBright;

        void main() {
          float window = 0.55;
          float p = clamp(
            (uProgress - aStagger * (1.0 - window)) / window,
            0.0, 1.0
          );
          p = p * p * (3.0 - 2.0 * p);

          float raw = 1.0 - p;
          float t = uTime * 0.4;
          vec3 pos = mix(position, aTarget, p);
          pos.x += sin(t + aStagger * 15.0) * 0.030 * raw;
          pos.y += cos(t * 0.8 + aStagger * 12.0) * 0.030 * raw;
          pos.z += sin(t * 0.9 + aStagger * 18.0) * 0.030 * raw;

          pos.x += sin(t * 1.1 + aStagger * 12.0) * 0.008 * p;
          pos.y += cos(t * 1.0 + aStagger * 9.0)  * 0.008 * p;
          pos.z += sin(t * 0.85 + aStagger * 15.0) * 0.008 * p;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;

          float sizePx = uPixelUnit / max(0.5, -mv.z);
          gl_PointSize = clamp(sizePx, 2.0, 6.0);

          vDepth = clamp((-mv.z - 2.0) / 10.0, 0.0, 1.0);
          vBright = aBright;

          float base = 0.45 + 0.45 * p;
          vAlpha = base * aBright * (1.0 - vDepth * 0.30);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform vec3 uDeepColor;
        varying float vAlpha;
        varying float vDepth;
        varying float vBright;

        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);

          float disc = 1.0 - smoothstep(0.42, 0.48, d);
          if (disc < 0.5) discard;

          float core = 1.0 - smoothstep(0.0, 0.14, d);

          vec3 baseCol  = mix(uDeepColor, uColor, 1.0 - vDepth * 0.45);
          vec3 finalCol = mix(baseCol, vec3(1.0, 0.94, 0.78), core * 0.55);

          gl_FragColor = vec4(finalCol, disc * vAlpha);
        }
      `,
    });

    this.nodes = new THREE.Points(geo, mat);
    this.world.add(this.nodes);
  }

  _initEdges(deformed, scatter, edges) {
    const edgeCount = edges.length;
    const vertCount = edgeCount * 2;

    const startArr   = new Float32Array(vertCount * 3);
    const targetArr  = new Float32Array(vertCount * 3);
    const staggerArr = new Float32Array(vertCount);

    for (let e = 0; e < edgeCount; e++) {
      const [i, j] = edges[e];
      const vi = e * 2;
      const vj = e * 2 + 1;

      const si = scatter[i];
      const sj = scatter[j];
      const ti = deformed[i];
      const tj = deformed[j];

      startArr[vi*3+0]=si.x; startArr[vi*3+1]=si.y; startArr[vi*3+2]=si.z;
      targetArr[vi*3+0]=ti[0]; targetArr[vi*3+1]=ti[1]; targetArr[vi*3+2]=ti[2];

      startArr[vj*3+0]=sj.x; startArr[vj*3+1]=sj.y; startArr[vj*3+2]=sj.z;
      targetArr[vj*3+0]=tj[0]; targetArr[vj*3+1]=tj[1]; targetArr[vj*3+2]=tj[2];

      const shellI = Math.sqrt(ti[0]*ti[0] + ti[1]*ti[1] + ti[2]*ti[2]);
      const shellJ = Math.sqrt(tj[0]*tj[0] + tj[1]*tj[1] + tj[2]*tj[2]);
      staggerArr[vi] = Math.random() * 0.4 + clamp01(1.4 - shellI) * 0.35;
      staggerArr[vj] = Math.random() * 0.4 + clamp01(1.4 - shellJ) * 0.35;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(startArr, 3));
    geo.setAttribute('aTarget',  new THREE.BufferAttribute(targetArr, 3));
    geo.setAttribute('aStagger', new THREE.BufferAttribute(staggerArr, 1));

    this.edgeUniforms = {
      uProgress: { value: 0 },
      uTime:     { value: 0 },
      uColor:    { value: new THREE.Color(0xff9a33) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.edgeUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */`
        uniform float uProgress;
        uniform float uTime;
        attribute vec3 aTarget;
        attribute float aStagger;
        varying float vAlpha;

        void main() {
          float window = 0.55;
          float p = clamp(
            (uProgress - aStagger * (1.0 - window)) / window,
            0.0, 1.0
          );
          p = p * p * (3.0 - 2.0 * p);

          vec3 pos = mix(position, aTarget, p);

          float gate = smoothstep(0.32, 0.50, uProgress);
          float shimmer = 0.88 + 0.12 * sin(uTime * 1.2 + aStagger * 20.0);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          vAlpha = p * gate * shimmer;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.01) discard;
          gl_FragColor = vec4(uColor, vAlpha * 0.42);
        }
      `,
    });

    this.edges = new THREE.LineSegments(geo, mat);
    this.world.add(this.edges);
  }

  // ----------------------------------------------------------------
  // NUCLEUS — small amber core that ignites once the mesh closes
  // ----------------------------------------------------------------
  _initNucleus() {
    // --- Inner core (fresnel-lit, dark center + hot rim) ---
    const coreGeo = new THREE.IcosahedronGeometry(0.14, 2);

    this.nucleusUniforms = {
      uProgress: { value: 0 },
      uTime:     { value: 0 },
      uColor:    { value: new THREE.Color(0xffb060) },
      uRim:      { value: new THREE.Color(0xff9a33) },
    };

    const coreMat = new THREE.ShaderMaterial({
      uniforms: this.nucleusUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform vec3 uRim;
        uniform float uProgress;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          float fres = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.4);
          float pulse = 0.88 + 0.12 * sin(uTime * 2.2);
          vec3 col = mix(uColor * 0.25, uRim, fres) * pulse;
          col += uColor * 0.10;
          float alpha = uProgress * (0.25 + fres * 0.85);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.nucleusCore = new THREE.Mesh(coreGeo, coreMat);
    this.world.add(this.nucleusCore);

    // --- Outer cage (counter-rotating wireframe) ---
    const cageGeo = new THREE.IcosahedronGeometry(0.28, 1);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0xff9a33,
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.nucleusCage = new THREE.Mesh(cageGeo, cageMat);
    this.world.add(this.nucleusCage);
  }

  // ----------------------------------------------------------------
  // 7 unmanned systems — NO SATELLITE
  // ----------------------------------------------------------------
  _initSystems() {
    this.systems = [];
    this.packets = [];

    const TWO_PI = Math.PI * 2;
    const step = TWO_PI / 7;

    const defs = [
      { make: makeFixedWingIcon,  angle: step * 0, radius: 3.9, yOff:  1.35 },
      { make: makeQuadcopterIcon, angle: step * 1, radius: 3.6, yOff:  0.75 },
      { make: makeLoiterIcon,     angle: step * 2, radius: 3.4, yOff:  0.15 },
      { make: makeUGVIcon,        angle: step * 3, radius: 3.3, yOff: -0.35 },
      { make: makeLeggedIcon,     angle: step * 4, radius: 3.5, yOff: -0.80 },
      { make: makeUSVIcon,        angle: step * 5, radius: 3.7, yOff: -1.25 },
      { make: makeUUVICon,        angle: step * 6, radius: 4.0, yOff: -1.65 },
    ];

    for (const d of defs) {
      const group = new THREE.Group();
      const icon = d.make();
      group.add(icon);

      const linkGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(d.radius, d.yOff, 0),
      ]);
      const linkMat = new THREE.LineDashedMaterial({
        color: 0xff9a33,
        dashSize: 0.09,
        gapSize: 0.08,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const link = new THREE.Line(linkGeo, linkMat);
      link.computeLineDistances();
      this.world.add(link);

      this.world.add(group);

      const system = {
        group, icon, link,
        angle: d.angle,
        radius: d.radius,
        yOff: d.yOff,
        speed: 0.09 + Math.random() * 0.05,
        bobPhase: Math.random() * Math.PI * 2,
        stagger: Math.random() * 0.08,
      };
      this.systems.push(system);

      for (let p = 0; p < PACKETS_PER_SYSTEM; p++) {
        const pGeo = new THREE.SphereGeometry(0.020, 8, 8);
        const pMat = new THREE.MeshBasicMaterial({
          color: 0xffd0a0,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(pGeo, pMat);
        this.world.add(mesh);
        this.packets.push({
          mesh, system,
          speed: 0.30 + Math.random() * 0.30,
          offset: (p / PACKETS_PER_SYSTEM) + Math.random() * 0.25,
          direction: p % 2,
        });
      }
    }
  }

  // ----------------------------------------------------------------
  _bindResize() {
    const doResize = () => {
      const w = this.sticky.clientWidth;
      const h = this.sticky.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      this._applyResponsiveCamera();
    };
    doResize();

    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(doResize);
      this._ro.observe(this.sticky);
    } else {
      window.addEventListener('resize', doResize, { passive: true });
    }
  }

  // ----------------------------------------------------------------
  _bindVisibility() {
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        for (const e of entries) this.inView = e.isIntersecting;
      }, { rootMargin: '200px 0px 200px 0px' });
      this._io.observe(this.section);
    }
  }

  // ----------------------------------------------------------------
  updateProgress() {
    const rect = this.section.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = rect.height - vh;
    if (total <= 0) { this.targetProgress = 0; return; }
    this.targetProgress = clamp01(-rect.top / total);
  }

  // ----------------------------------------------------------------
  update(dt, time) {
    this.progress = damp(this.progress, this.targetProgress, 11, dt);
    const p = this.progress;

    // Brain
    this.nodeUniforms.uProgress.value = p;
    this.nodeUniforms.uTime.value = time;
    this.edgeUniforms.uProgress.value = p;
    this.edgeUniforms.uTime.value = time;

    // ---- Nucleus ignition ----
    // Appears from 0.52 → 0.68, right as the mesh fully closes.
    const nucleusOn = smoothstep(0.52, 0.68, p);
    this.nucleusUniforms.uProgress.value = nucleusOn;
    this.nucleusUniforms.uTime.value = time;

    this.nucleusCore.rotation.x = time * 0.22;
    this.nucleusCore.rotation.y = time * 0.35;
    const breathe = 1 + Math.sin(time * 1.8) * 0.05 * nucleusOn;
    this.nucleusCore.scale.setScalar(nucleusOn * breathe);

    const cageOn = smoothstep(0.46, 0.62, p);
    this.nucleusCage.rotation.x = -time * 0.18;
    this.nucleusCage.rotation.y = -time * 0.28;
    this.nucleusCage.rotation.z = time * 0.12;
    this.nucleusCage.material.opacity = cageOn * 0.35;
    this.nucleusCage.scale.setScalar(cageOn * (1 + Math.sin(time * 1.4) * 0.04));

    // Cursor parallax
    pointerSmooth.x = damp(pointerSmooth.x, pointer.x, 5.5, dt);
    pointerSmooth.y = damp(pointerSmooth.y, pointer.y, 5.5, dt);

    // World rotation
    this.world.rotation.y =
      time * 0.06 + p * 0.7 + pointerSmooth.x * 0.30;
    this.world.rotation.x = -pointerSmooth.y * 0.22;
    this.world.position.y = Math.sin(time * 0.6) * 0.03;

    // Camera drift
    this.camera.position.x = pointerSmooth.x * 0.5;
    this.camera.position.y = 0.35 + pointerSmooth.y * 0.35;
    this.camera.lookAt(0, 0, 0);

    // Systems
    const sysArrive = smoothstep(0.58, 0.78, p);
    const linkOn    = smoothstep(0.78, 1.00, p);

    for (let i = 0; i < this.systems.length; i++) {
      const s = this.systems[i];
      const a = s.angle + time * s.speed;
      const x = Math.cos(a) * s.radius;
      const z = Math.sin(a) * s.radius;
      const y = s.yOff + Math.sin(time * 0.4 + s.bobPhase) * 0.10;

      const local = smoothstep(s.stagger, s.stagger + 0.18, sysArrive);
      s.group.position.set(x, y, z);
      s.group.rotation.y = -a;
      s.group.scale.setScalar(local * 0.9);
      s.group.visible = local > 0.01;

      s.icon.material.opacity = local * 0.95;

      const pos = s.link.geometry.attributes.position;
      pos.setXYZ(1, x, y, z);
      pos.needsUpdate = true;
      s.link.computeLineDistances();
      s.link.material.opacity = linkOn * 0.55;
      s.link.visible = linkOn > 0.01;
    }

    // Data packets
    for (const pk of this.packets) {
      const s = pk.system;
      const sx = s.group.position.x;
      const sy = s.group.position.y;
      const sz = s.group.position.z;

      const raw = (time * pk.speed + pk.offset) % 1;
      const t = pk.direction === 0 ? raw : 1 - raw;

      pk.mesh.position.set(sx * (1 - t), sy * (1 - t), sz * (1 - t));

      const fade = Math.min(t * 6, (1 - t) * 6, 1);
      pk.mesh.material.opacity = fade * linkOn * 0.95;
      pk.mesh.visible = linkOn > 0.01;
    }

    // Brand
    if (this.brand) {
      const on = smoothstep(0.25, 0.55, p);
      this.brand.classList.toggle('is-visible', on > 0.01);
      this.brand.style.opacity = String(on);
    }

    if (this.progressBar) {
      this.progressBar.style.width = (p * 100).toFixed(2) + '%';
    }
  }

  // ----------------------------------------------------------------
  renderStatic() {
    this.progress = 1;
    this.targetProgress = 1;

    this.nodeUniforms.uProgress.value = 1;
    this.nodeUniforms.uTime.value = 0;
    this.edgeUniforms.uProgress.value = 1;
    this.edgeUniforms.uTime.value = 0;

    // Nucleus at full brightness
    this.nucleusUniforms.uProgress.value = 1;
    this.nucleusUniforms.uTime.value = 0;
    this.nucleusCore.scale.setScalar(1);
    this.nucleusCore.rotation.set(0.3, 0.6, 0);
    this.nucleusCage.material.opacity = 0.35;
    this.nucleusCage.scale.setScalar(1);
    this.nucleusCage.rotation.set(0.2, -0.4, 0.1);

    this.world.rotation.set(-0.15, 0.55, 0);

    for (const s of this.systems) {
      const a = s.angle;
      const x = Math.cos(a) * s.radius;
      const z = Math.sin(a) * s.radius;
      s.group.position.set(x, s.yOff, z);
      s.group.rotation.y = -a;
      s.group.scale.setScalar(0.9);
      s.icon.material.opacity = 0.95;

      const pos = s.link.geometry.attributes.position;
      pos.setXYZ(1, x, s.yOff, z);
      pos.needsUpdate = true;
      s.link.computeLineDistances();
      s.link.material.opacity = 0.5;
    }

    if (this.brand) {
      this.brand.classList.add('is-visible');
      this.brand.style.opacity = '1';
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// ==================================================================
// Icon builders
// ==================================================================

const SYSTEM_COLOR = 0xffffff;

function lineMat(color = SYSTEM_COLOR, opacity = 0.95) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

function buildLines(verts, color = SYSTEM_COLOR) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return new THREE.LineSegments(geo, lineMat(color));
}

function addCircleToVerts(v, cx, cy, cz, r, axis, segments) {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    if (axis === 'y') {
      v.push(cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r,
             cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r);
    } else if (axis === 'x') {
      v.push(cx, cy + Math.cos(a0) * r, cz + Math.sin(a0) * r,
             cx, cy + Math.cos(a1) * r, cz + Math.sin(a1) * r);
    } else {
      v.push(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cz,
             cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cz);
    }
  }
}

/* --------------------------------------------------------------
 * 1. QUADCOPTER
 * -------------------------------------------------------------- */
function makeQuadcopterIcon() {
  const v = [];
  const bx = 0.08, by = 0.04, bz = 0.08;

  v.push(-bx,-by,-bz,  bx,-by,-bz);
  v.push( bx,-by,-bz,  bx,-by, bz);
  v.push( bx,-by, bz, -bx,-by, bz);
  v.push(-bx,-by, bz, -bx,-by,-bz);
  v.push(-bx, by,-bz,  bx, by,-bz);
  v.push( bx, by,-bz,  bx, by, bz);
  v.push( bx, by, bz, -bx, by, bz);
  v.push(-bx, by, bz, -bx, by,-bz);
  v.push(-bx,-by,-bz, -bx, by,-bz);
  v.push( bx,-by,-bz,  bx, by,-bz);
  v.push( bx,-by, bz,  bx, by, bz);
  v.push(-bx,-by, bz, -bx, by, bz);

  const arm = 0.26, r = 0.10;
  const arms = [
    [ arm, 0,  arm], [-arm, 0,  arm],
    [ arm, 0, -arm], [-arm, 0, -arm],
  ];
  for (const [ax, ay, az] of arms) {
    v.push(0, 0, 0, ax, ay, az);
    addCircleToVerts(v, ax, ay, az, r, 'y', 16);
    addCircleToVerts(v, ax, ay, az, r * 0.20, 'y', 8);
  }

  v.push(-bx*0.7, -by - 0.05, -bz*0.7, -bx*0.7, -by, -bz*0.7);
  v.push( bx*0.7, -by - 0.05, -bz*0.7,  bx*0.7, -by, -bz*0.7);
  v.push(-bx*0.7, -by - 0.05,  bz*0.7, -bx*0.7, -by,  bz*0.7);
  v.push( bx*0.7, -by - 0.05,  bz*0.7,  bx*0.7, -by,  bz*0.7);

  return buildLines(v);
}

/* --------------------------------------------------------------
 * 2. FIXED-WING UAV
 * -------------------------------------------------------------- */
function makeFixedWingIcon() {
  const v = [];

  v.push(0, 0, -0.55, 0, 0, 0.55);

  const lA = [-0.72, 0, -0.05];
  const lB = [-0.06, 0,  0.15];
  const lC = [-0.06, 0, -0.20];
  const lD = [-0.72, 0, -0.30];
  v.push(...lA, ...lB);
  v.push(...lB, ...lC);
  v.push(...lC, ...lD);
  v.push(...lD, ...lA);

  const rA = [ 0.72, 0, -0.05];
  const rB = [ 0.06, 0,  0.15];
  const rC = [ 0.06, 0, -0.20];
  const rD = [ 0.72, 0, -0.30];
  v.push(...rA, ...rB);
  v.push(...rB, ...rC);
  v.push(...rC, ...rD);
  v.push(...rD, ...rA);

  const hA = [-0.28, 0, -0.55];
  const hB = [-0.03, 0, -0.42];
  const hC = [ 0.03, 0, -0.42];
  const hD = [ 0.28, 0, -0.55];
  v.push(...hA, ...hB);
  v.push(...hB, ...hC);
  v.push(...hC, ...hD);
  v.push(...hD, ...hA);

  v.push(0, 0.00, -0.38, 0, 0.22, -0.55);
  v.push(0, 0.22, -0.55, 0, 0.00, -0.55);
  v.push(0, 0.00, -0.55, 0, 0.00, -0.38);

  v.push(0, 0.04, 0.35, 0, 0.04, 0.55);

  return buildLines(v);
}

/* --------------------------------------------------------------
 * 3. LOITERING MUNITION
 * -------------------------------------------------------------- */
function makeLoiterIcon() {
  const v = [];

  v.push(0, 0, -0.55, 0, 0, 0.55);

  v.push(0, 0, 0.30, -0.50, 0, -0.40);
  v.push(-0.50, 0, -0.40, 0, 0, -0.40);
  v.push(0, 0, -0.40, 0, 0, 0.30);

  v.push(0, 0, 0.30, 0.50, 0, -0.40);
  v.push(0.50, 0, -0.40, 0, 0, -0.40);
  v.push(0, 0, -0.40, 0, 0, 0.30);

  v.push(0, 0.00, -0.35, 0, 0.18, -0.55);
  v.push(0, 0.18, -0.55, 0, 0.00, -0.55);
  v.push(0, 0.00, -0.55, 0, 0.00, -0.35);

  v.push(0, 0, 0.40, 0, 0, 0.55);

  return buildLines(v);
}

/* --------------------------------------------------------------
 * 4. UGV
 * -------------------------------------------------------------- */
function makeUGVIcon() {
  const v = [];
  const w = 0.34, h = 0.18, d = 0.24;

  v.push(-w, -h/2, -d,  w, -h/2, -d);
  v.push( w, -h/2, -d,  w, -h/2,  d);
  v.push( w, -h/2,  d, -w, -h/2,  d);
  v.push(-w, -h/2,  d, -w, -h/2, -d);

  const uw = w * 0.75, ud = d * 0.70;
  v.push(-uw, h/2, -ud,  uw, h/2, -ud);
  v.push( uw, h/2, -ud,  uw, h/2,  ud);
  v.push( uw, h/2,  ud, -uw, h/2,  ud);
  v.push(-uw, h/2,  ud, -uw, h/2, -ud);

  v.push(-w, -h/2, -d, -uw, h/2, -ud);
  v.push( w, -h/2, -d,  uw, h/2, -ud);
  v.push( w, -h/2,  d,  uw, h/2,  ud);
  v.push(-w, -h/2,  d, -uw, h/2,  ud);

  const wr = 0.075;
  const wheelPos = [
    [-w - 0.03, -h/2 - wr, -d * 0.7],
    [ w + 0.03, -h/2 - wr, -d * 0.7],
    [-w - 0.03, -h/2 - wr,  d * 0.7],
    [ w + 0.03, -h/2 - wr,  d * 0.7],
  ];
  for (const [wx, wy, wz] of wheelPos) {
    addCircleToVerts(v, wx, wy, wz, wr, 'x', 14);
    v.push(wx, wy - wr, wz, wx, wy + wr, wz);
    v.push(wx, wy, wz - wr, wx, wy, wz + wr);
  }

  v.push(0, h/2, -ud * 0.4, 0, h/2 + 0.14, -ud * 0.4);
  addCircleToVerts(v, 0, h/2 + 0.14, -ud * 0.4, 0.022, 'y', 8);

  return buildLines(v);
}

/* --------------------------------------------------------------
 * 5. LEGGED ROBOT
 * -------------------------------------------------------------- */
function makeLeggedIcon() {
  const v = [];
  const bw = 0.14, bh = 0.07, bd = 0.22;

  v.push(-bw,-bh,-bd,  bw,-bh,-bd);
  v.push( bw,-bh,-bd,  bw,-bh, bd);
  v.push( bw,-bh, bd, -bw,-bh, bd);
  v.push(-bw,-bh, bd, -bw,-bh,-bd);
  v.push(-bw, bh,-bd,  bw, bh,-bd);
  v.push( bw, bh,-bd,  bw, bh, bd);
  v.push( bw, bh, bd, -bw, bh, bd);
  v.push(-bw, bh, bd, -bw, bh,-bd);
  v.push(-bw,-bh,-bd, -bw, bh,-bd);
  v.push( bw,-bh,-bd,  bw, bh,-bd);
  v.push( bw,-bh, bd,  bw, bh, bd);
  v.push(-bw,-bh, bd, -bw, bh, bd);

  const zPos = [-bd * 0.65, bd * 0.65];
  for (const side of [-1, 1]) {
    for (const z of zPos) {
      const hx = side * bw,           hy = 0,     hz = z;
      const kx = side * (bw + 0.14),  ky = -0.04, kz = z;
      const fx = side * (bw + 0.22),  fy = -0.13, fz = z;
      v.push(hx, hy, hz, kx, ky, kz);
      v.push(kx, ky, kz, fx, fy, fz);
      addCircleToVerts(v, kx, ky, kz, 0.022, 'z', 8);
      addCircleToVerts(v, fx, fy, fz, 0.022, 'z', 8);
      addCircleToVerts(v, hx, hy, hz, 0.026, 'z', 8);
    }
  }

  v.push(0, bh, 0, 0, bh + 0.07, 0);
  addCircleToVerts(v, 0, bh + 0.07, 0, 0.022, 'y', 8);

  return buildLines(v);
}

/* --------------------------------------------------------------
 * 6. USV
 * -------------------------------------------------------------- */
function makeUSVIcon() {
  const v = [];

  const bow     = [0, 0, 0.55];
  const portFwd = [-0.22, 0, 0.10];
  const portAft = [-0.16, 0, -0.40];
  const stbdAft = [ 0.16, 0, -0.40];
  const stbdFwd = [ 0.22, 0, 0.10];

  v.push(...bow, ...portFwd);
  v.push(...portFwd, ...portAft);
  v.push(...portAft, ...stbdAft);
  v.push(...stbdAft, ...stbdFwd);
  v.push(...stbdFwd, ...bow);

  const ky = -0.06;
  v.push(0, 0, 0.55, 0, ky, 0.48);
  v.push(-0.16, 0, -0.40, -0.12, ky, -0.38);
  v.push( 0.16, 0, -0.40,  0.12, ky, -0.38);
  v.push(0, ky, 0.48, 0, ky, -0.38);
  v.push(0, ky, -0.38, -0.12, ky, -0.38);
  v.push(0, ky, -0.38,  0.12, ky, -0.38);

  const sw = 0.10, sh = 0.10, sd = 0.11, cy = 0.03;
  v.push(-sw, cy, -sd,  sw, cy, -sd);
  v.push( sw, cy, -sd,  sw, cy,  sd);
  v.push( sw, cy,  sd, -sw, cy,  sd);
  v.push(-sw, cy,  sd, -sw, cy, -sd);
  v.push(-sw, cy+sh, -sd,  sw, cy+sh, -sd);
  v.push( sw, cy+sh, -sd,  sw, cy+sh,  sd);
  v.push( sw, cy+sh,  sd, -sw, cy+sh,  sd);
  v.push(-sw, cy+sh,  sd, -sw, cy+sh, -sd);
  v.push(-sw, cy, -sd, -sw, cy+sh, -sd);
  v.push( sw, cy, -sd,  sw, cy+sh, -sd);
  v.push( sw, cy,  sd,  sw, cy+sh,  sd);
  v.push(-sw, cy,  sd, -sw, cy+sh,  sd);

  v.push(0, cy + sh, 0, 0, cy + sh + 0.22, 0);
  addCircleToVerts(v, 0, cy + sh + 0.22, 0, 0.075, 'y', 12);

  return buildLines(v);
}

/* --------------------------------------------------------------
 * 7. UUV
 * -------------------------------------------------------------- */
function makeUUVICon() {
  const v = [];
  const R = 0.10;
  const L = 0.55;

  const rings = [
    { z:  L * 0.75, r: R * 0.35 },
    { z:  L * 0.35, r: R * 0.75 },
    { z:  0,        r: R },
    { z: -L * 0.35, r: R * 0.85 },
    { z: -L * 0.75, r: R * 0.45 },
  ];
  const N_RING = 16;

  for (const rp of rings) {
    addCircleToVerts(v, 0, 0, rp.z, rp.r, 'z', N_RING);
  }

  for (let i = 0; i < N_RING; i++) {
    const a = (i / N_RING) * Math.PI * 2;
    const cx = Math.cos(a), sy = Math.sin(a);
    for (let k = 0; k < rings.length - 1; k++) {
      const r0 = rings[k], r1 = rings[k + 1];
      v.push(cx * r0.r, sy * r0.r, r0.z,
             cx * r1.r, sy * r1.r, r1.z);
    }
  }

  const sailW = 0.055, sailD = 0.11;
  const y0 = R, y1 = R + 0.10;
  v.push(-sailW, y0, -sailD,  sailW, y0, -sailD);
  v.push( sailW, y0, -sailD,  sailW, y0,  sailD);
  v.push( sailW, y0,  sailD, -sailW, y0,  sailD);
  v.push(-sailW, y0,  sailD, -sailW, y0, -sailD);
  v.push(-sailW, y1, -sailD,  sailW, y1, -sailD);
  v.push( sailW, y1, -sailD,  sailW, y1,  sailD);
  v.push( sailW, y1,  sailD, -sailW, y1,  sailD);
  v.push(-sailW, y1,  sailD, -sailW, y1, -sailD);
  v.push(-sailW, y0, -sailD, -sailW, y1, -sailD);
  v.push( sailW, y0, -sailD,  sailW, y1, -sailD);
  v.push( sailW, y0,  sailD,  sailW, y1,  sailD);
  v.push(-sailW, y0,  sailD, -sailW, y1,  sailD);

  const sternZ = -L * 1.00;
  const finExt = R * 2.4;
  v.push(-finExt, 0, sternZ,  finExt, 0, sternZ);
  v.push(-finExt, 0, sternZ, -finExt, 0, sternZ - 0.10);
  v.push( finExt, 0, sternZ,  finExt, 0, sternZ - 0.10);
  v.push(0, -finExt, sternZ, 0,  finExt, sternZ);
  v.push(0, -finExt, sternZ, 0, -finExt, sternZ - 0.10);
  v.push(0,  finExt, sternZ, 0,  finExt, sternZ - 0.10);

  return buildLines(v);
}

// ==================================================================
// Boot
// ==================================================================
function boot() {
  bindPointer();

  const section = document.querySelector('[data-saga-section]');
  if (!section) return;

  let stage;
  try {
    stage = new SagaBrain(section);
  } catch (err) {
    // No WebGL, blocked GPU, etc. Fall back to the static SAGA title
    // instead of leaving the visitor under the boot veil.
    console.warn('SAGA scene unavailable:', err);
    document.documentElement.classList.add('saga-failed');
    return;
  }
  document.documentElement.dataset.saga = 'ready';
  const bootOverlay = document.getElementById('boot');

  if (prefersReducedMotion) {
    stage.updateProgress();
    stage.renderStatic();
    bootOverlay?.classList.add('is-hidden');
    return;
  }

  let last = performance.now();

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;

    stage.updateProgress();

    if (stage.inView) {
      stage.update(dt, time);
      stage.renderer.render(stage.scene, stage.camera);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bootOverlay?.classList.add('is-hidden');
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}