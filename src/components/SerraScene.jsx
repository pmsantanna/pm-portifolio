import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { serraHeight } from '../noise';

export default function SerraScene({ theme = 'noir' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // modo holo: foil holográfico — base pérola fria, wireframe e garoa iridescentes
    const holo = theme === 'holo';
    const P = holo
      ? {
          bg: 0xf0f0f3,
          fogDensity: 0.046,
          wireOpacity: 0.72,
          rainOpacity: 0.55,
        }
      : {
          bg: 0x0a0a0a,
          wire: 0x45443f,
          rain: 0x8a8880,
          fogDensity: 0.052,
          wireOpacity: 0.5,
          rainOpacity: 0.45,
        };

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(P.bg, P.fogDensity);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
    camera.position.set(0, 4.6, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(P.bg, 1);
    mount.appendChild(renderer.domElement);

    // --- terreno ---
    const geo = new THREE.PlaneGeometry(70, 70, 88, 88);
    geo.rotateX(-Math.PI / 2);

    const solid = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: P.bg }),
    );
    const wire = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: holo ? 0xffffff : P.wire,
        vertexColors: holo,
        wireframe: true,
        transparent: true,
        opacity: P.wireOpacity,
      }),
    );
    wire.position.y = 0.015;
    scene.add(solid, wire);

    const pos = geo.attributes.position;
    const baseX = new Float32Array(pos.count);
    const baseZ = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      baseX[i] = pos.getX(i);
      baseZ[i] = pos.getZ(i);
    }

    // --- iridescência do foil: bandas de espectro deslizando pelo terreno ---
    let colorAttr = null;
    const tint = new THREE.Color();
    if (holo) {
      colorAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
      geo.setAttribute('color', colorAttr);
    }
    const paintFoil = (t) => {
      if (!colorAttr) return;
      for (let i = 0; i < pos.count; i++) {
        // bandas diagonais largas, deriva lenta de matiz com o tempo
        const hue = (baseX[i] * 0.011 + baseZ[i] * 0.017 + t * 0.02) % 1;
        tint.setHSL(hue < 0 ? hue + 1 : hue, 0.52, 0.6);
        colorAttr.setXYZ(i, tint.r, tint.g, tint.b);
      }
      colorAttr.needsUpdate = true;
    };
    paintFoil(0);

    const displace = (t) => {
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, serraHeight(baseX[i], baseZ[i] + t) - 2.2);
      }
      pos.needsUpdate = true;
    };
    displace(0);

    // --- garoa ---
    const RAIN = 420;
    const rainGeo = new THREE.BufferGeometry();
    const rp = new Float32Array(RAIN * 3);
    for (let i = 0; i < RAIN; i++) {
      rp[i * 3] = (Math.random() - 0.5) * 50;
      rp[i * 3 + 1] = Math.random() * 16;
      rp[i * 3 + 2] = (Math.random() - 0.5) * 40 - 4;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    if (holo) {
      // cada gota com um pastel fixo do espectro
      const rc = new Float32Array(RAIN * 3);
      for (let i = 0; i < RAIN; i++) {
        tint.setHSL(Math.random(), 0.5, 0.62);
        rc[i * 3] = tint.r;
        rc[i * 3 + 1] = tint.g;
        rc[i * 3 + 2] = tint.b;
      }
      rainGeo.setAttribute('color', new THREE.BufferAttribute(rc, 3));
    }
    const rain = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({
        color: holo ? 0xffffff : P.rain,
        vertexColors: holo,
        size: 0.045,
        transparent: true,
        opacity: P.rainOpacity,
        depthWrite: false,
      }),
    );
    scene.add(rain);

    // --- mouse parallax ---
    const mouse = { x: 0, y: 0 };
    const look = { x: 0, y: 0 };
    const onMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    let raf;
    const clock = new THREE.Clock();

    const tick = () => {
      const t = clock.getElapsedTime();

      displace(reduced ? 0 : t * 0.55);
      if (holo && !reduced) paintFoil(t);

      if (!reduced) {
        const arr = rainGeo.attributes.position.array;
        for (let i = 0; i < RAIN; i++) {
          arr[i * 3 + 1] -= 0.014 + (i % 5) * 0.003;
          arr[i * 3] += Math.sin(t * 0.4 + i) * 0.0016;
          if (arr[i * 3 + 1] < -1) arr[i * 3 + 1] = 15;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }

      look.x += (mouse.x * 0.06 - look.x) * 0.02;
      look.y += (mouse.y * 0.03 - look.y) * 0.02;
      camera.rotation.y = -look.x;
      camera.rotation.x = -0.14 - look.y;
      camera.position.y = 4.6 + (reduced ? 0 : Math.sin(t * 0.18) * 0.12);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', resize);
      geo.dispose();
      rainGeo.dispose();
      solid.material.dispose();
      wire.material.dispose();
      rain.material.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [theme]);

  return <div ref={mountRef} className="scene-mount" aria-hidden="true" />;
}
