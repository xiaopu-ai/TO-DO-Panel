/*
 * TO-DO Panel visual effects.
 * The music shader is adapted from the open-source Vue Bits Color Bends
 * component and rewritten for the app's dependency-free renderer.
 */
(function bootstrapPanelEffects() {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const app = document.getElementById('app');
  const homePanel = document.getElementById('tab-home');
  const effectInstances = [];

  const VERTEX_SHADER = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const COLOR_BENDS_SHADER = `
    precision highp float;
    #define MAX_COLORS 8
    uniform vec2 uCanvas;
    uniform float uTime;
    uniform float uSpeed;
    uniform vec2 uRot;
    uniform int uColorCount;
    uniform vec3 uColors[MAX_COLORS];
    uniform int uTransparent;
    uniform float uScale;
    uniform float uFrequency;
    uniform float uWarpStrength;
    uniform vec2 uPointer;
    uniform float uMouseInfluence;
    uniform float uParallax;
    uniform float uNoise;
    uniform int uIterations;
    uniform float uIntensity;
    uniform float uBandWidth;
    varying vec2 vUv;

    void main() {
      float t = uTime * uSpeed;
      vec2 p = vUv * 2.0 - 1.0;
      p += uPointer * uParallax * 0.1;
      vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
      vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
      q /= max(uScale, 0.0001);
      q /= 0.5 + 0.2 * dot(q, q);
      q += 0.2 * cos(t) - 7.56;
      q += (uPointer - rp) * uMouseInfluence * 0.2;

      for (int j = 0; j < 5; j++) {
        if (j >= uIterations - 1) break;
        vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));
        q += (rr - q) * 0.15;
      }

      vec3 col = vec3(0.0);
      float a = 1.0;
      if (uColorCount > 0) {
        vec2 s = q;
        vec3 sumCol = vec3(0.0);
        float cover = 0.0;
        for (int i = 0; i < MAX_COLORS; ++i) {
          if (i >= uColorCount) break;
          s -= 0.01;
          vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
          float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
          float kBelow = clamp(uWarpStrength, 0.0, 1.0);
          float kMix = pow(kBelow, 0.3);
          float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
          vec2 warped = s + (r - s) * kBelow * gain;
          float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
          float m = mix(m0, m1, kMix);
          float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
          sumCol += uColors[i] * w;
          cover = max(cover, w);
        }
        col = clamp(sumCol, 0.0, 1.0);
        a = uTransparent > 0 ? cover : 1.0;
      } else {
        vec2 s = q;
        for (int k = 0; k < 3; ++k) {
          s -= 0.01;
          vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
          float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
          float kBelow = clamp(uWarpStrength, 0.0, 1.0);
          float kMix = pow(kBelow, 0.3);
          float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
          vec2 warped = s + (r - s) * kBelow * gain;
          float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
          float m = mix(m0, m1, kMix);
          col[k] = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
        }
        a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
      }

      col *= uIntensity;
      if (uNoise > 0.0001) {
        float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
        col = clamp(col + (n - 0.5) * uNoise, 0.0, 1.0);
      }
      vec3 rgb = uTransparent > 0 ? col * a : col;
      gl_FragColor = vec4(rgb, a);
    }
  `;

  const GRID_SCAN_SHADER = `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;
    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec2 uSkew;
    uniform float uTilt;
    uniform float uYaw;
    uniform float uLineThickness;
    uniform vec3 uLinesColor;
    uniform vec3 uScanColor;
    uniform float uGridScale;
    uniform float uLineStyle;
    uniform float uLineJitter;
    uniform float uScanOpacity;
    uniform float uScanDirection;
    uniform float uNoise;
    uniform float uBloomOpacity;
    uniform float uScanGlow;
    uniform float uScanSoftness;
    uniform float uPhaseTaper;
    uniform float uScanDuration;
    uniform float uScanDelay;
    varying vec2 vUv;

    float smoother01(float a, float b, float x) {
      float t = clamp((x - a) / max(1e-5, b - a), 0.0, 1.0);
      return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }

    void mainImage(out vec4 fragColor, in vec2 fragCoord) {
      vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
      vec3 ro = vec3(0.0);
      vec3 rd = normalize(vec3(p, 2.0));
      float cR = cos(uTilt), sR = sin(uTilt);
      rd.xy = mat2(cR, -sR, sR, cR) * rd.xy;
      float cY = cos(uYaw), sY = sin(uYaw);
      rd.xz = mat2(cY, -sY, sY, cY) * rd.xz;
      vec2 skew = clamp(uSkew, vec2(-0.7), vec2(0.7));
      rd.xy += skew * rd.z;

      float minT = 1e20;
      float gridScale = max(1e-5, uGridScale);
      vec2 gridUV = vec2(0.0);
      float hitIsY = 1.0;
      for (int i = 0; i < 4; i++) {
        float isY = float(i < 2);
        float pos = mix(-0.2, 0.2, float(i)) * isY + mix(-0.5, 0.5, float(i - 2)) * (1.0 - isY);
        float num = pos - (isY * ro.y + (1.0 - isY) * ro.x);
        float den = isY * rd.y + (1.0 - isY) * rd.x;
        float planeT = num / den;
        vec3 h = ro + rd * planeT;
        h.xy += skew * 0.15 * smoothstep(0.0, 3.0, h.z);
        bool usePlane = planeT > 0.0 && planeT < minT;
        gridUV = usePlane ? mix(h.zy, h.xz, isY) / gridScale : gridUV;
        minT = usePlane ? planeT : minT;
        hitIsY = usePlane ? isY : hitIsY;
      }

      vec3 hit = ro + rd * minT;
      float dist = length(hit - ro);
      float jitterAmt = clamp(uLineJitter, 0.0, 1.0);
      gridUV += vec2(
        sin(gridUV.y * 2.7 + iTime * 1.8),
        cos(gridUV.x * 2.3 - iTime * 1.6)
      ) * (0.15 * jitterAmt);

      float fx = fract(gridUV.x), fy = fract(gridUV.y);
      float ax = min(fx, 1.0 - fx), ay = min(fy, 1.0 - fy);
      float wx = fwidth(gridUV.x), wy = fwidth(gridUV.y);
      float halfPx = max(0.0, uLineThickness) * 0.5;
      float tx = halfPx * wx, ty = halfPx * wy;
      float lineX = 1.0 - smoothstep(tx, tx + wx, ax);
      float lineY = 1.0 - smoothstep(ty, ty + wy, ay);
      float primaryMask = max(lineX, lineY);

      vec2 gridUV2 = (hitIsY > 0.5 ? hit.xz : hit.zy) / gridScale;
      gridUV2 += vec2(
        cos(gridUV2.y * 2.1 - iTime * 1.4),
        sin(gridUV2.x * 2.5 + iTime * 1.7)
      ) * (0.15 * jitterAmt);
      float fx2 = fract(gridUV2.x), fy2 = fract(gridUV2.y);
      float ax2 = min(fx2, 1.0 - fx2), ay2 = min(fy2, 1.0 - fy2);
      float wx2 = fwidth(gridUV2.x), wy2 = fwidth(gridUV2.y);
      float lineX2 = 1.0 - smoothstep(halfPx * wx2, halfPx * wx2 + wx2, ax2);
      float lineY2 = 1.0 - smoothstep(halfPx * wy2, halfPx * wy2 + wy2, ay2);
      float edgeDistX = min(abs(hit.x + 0.5), abs(hit.x - 0.5));
      float edgeDistY = min(abs(hit.y + 0.2), abs(hit.y - 0.2));
      float edgeGate = 1.0 - smoothstep(gridScale * 0.5, gridScale * 2.0, mix(edgeDistY, edgeDistX, hitIsY));
      float lineMask = max(primaryMask, max(lineX2, lineY2) * edgeGate);
      float fade = exp(-dist * 2.0);

      float dur = max(0.05, uScanDuration);
      float del = max(0.0, uScanDelay);
      float phase = clamp((mod(iTime, dur + del) - del) / dur, 0.0, 1.0);
      if (uScanDirection > 0.5 && uScanDirection < 1.5) {
        phase = 1.0 - phase;
      } else if (uScanDirection > 1.5) {
        float t2 = mod(max(0.0, iTime - del), 2.0 * dur);
        phase = t2 < dur ? t2 / dur : 1.0 - (t2 - dur) / dur;
      }
      float dz = abs(hit.z - phase * 2.0);
      float sigma = max(0.001, 0.18 * max(0.1, uScanGlow) * uScanSoftness);
      float taper = clamp(uPhaseTaper, 0.0, 0.49);
      float phaseWindow = smoother01(0.0, taper, phase) * (1.0 - smoother01(1.0 - taper, 1.0, phase));
      float pulse = exp(-0.5 * (dz * dz) / (sigma * sigma)) * phaseWindow * clamp(uScanOpacity, 0.0, 1.0);
      float aura = exp(-0.5 * (dz * dz) / ((sigma * 2.0) * (sigma * 2.0))) * 0.25 * phaseWindow * clamp(uScanOpacity, 0.0, 1.0);

      vec3 color = uLinesColor * lineMask * fade + uScanColor * (pulse + aura);
      float noise = fract(sin(dot(gl_FragCoord.xy + vec2(iTime * 123.4), vec2(12.9898, 78.233))) * 43758.5453123);
      color = clamp(color + (noise - 0.5) * uNoise, 0.0, 1.0);
      float alpha = clamp(max(lineMask * fade, pulse + aura), 0.0, 1.0);
      fragColor = vec4(color, alpha);
    }

    void main() {
      vec4 color;
      mainImage(color, vUv * iResolution.xy);
      gl_FragColor = color;
    }
  `;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'WebGL shader compilation failed';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl, fragmentSource) {
    const program = gl.createProgram();
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'WebGL program linking failed';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function hexToDisplayRgb(hex) {
    const value = String(hex).replace('#', '');
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  }

  function createWebglEffect(canvas, fragmentSource, configure) {
    if (!canvas) return null;
    const container = canvas.parentElement;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
    });
    if (!gl) {
      container?.classList.add('effect-fallback');
      return null;
    }
    gl.getExtension('OES_standard_derivatives');

    let program;
    try {
      program = createProgram(gl, fragmentSource);
    } catch (error) {
      console.warn('[TO-DO Panel] visual effect unavailable:', error);
      container?.classList.add('effect-fallback');
      return null;
    }

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniformCache = new Map();
    const uniform = (name) => {
      if (!uniformCache.has(name)) uniformCache.set(name, gl.getUniformLocation(program, name));
      return uniformCache.get(name);
    };
    const state = { gl, program, canvas, container, uniform, pointer: { x: 0, y: 0, tx: 0, ty: 0 } };
    configure.setup(state);

    let raf = 0;
    let start = performance.now();
    let lastDraw = 0;
    let disposed = false;
    let effectEnabled = true;
    const frameInterval = 1000 / 30;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      return { width, height, dpr };
    };
    const isActive = () => Boolean(
      !disposed &&
      document.visibilityState === 'visible' &&
      app?.classList.contains('expanded') &&
      homePanel?.getAttribute('aria-hidden') !== 'true' &&
      !container?.hidden &&
      canvas.isConnected
    );
    const stopFrameLoop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      canvas.dataset.effectRunning = 'false';
    };
    const draw = (now, force = false) => {
      if (disposed || !effectEnabled) return;
      if (!isActive()) {
        stopFrameLoop();
        return;
      }
      if (force || now - lastDraw >= frameInterval) {
        const size = resize();
        gl.useProgram(program);
        configure.frame(state, reducedMotion.matches ? 0 : (now - start) / 1000, size);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        lastDraw = now;
      }
      raf = !reducedMotion.matches ? requestAnimationFrame(draw) : 0;
      canvas.dataset.effectRunning = String(Boolean(raf));
    };
    const syncActivity = () => {
      stopFrameLoop();
      if (!effectEnabled || !isActive()) return;
      start = performance.now();
      lastDraw = 0;
      draw(start, true);
    };

    const onPointerMove = (event) => {
      const rect = container.getBoundingClientRect();
      state.pointer.tx = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      state.pointer.ty = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    };
    const onPointerLeave = () => {
      state.pointer.tx = 0;
      state.pointer.ty = 0;
    };
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);
    reducedMotion.addEventListener('change', syncActivity);
    document.addEventListener('visibilitychange', syncActivity);
    document.addEventListener('notch:modechange', syncActivity);
    document.addEventListener('notch:tabchange', syncActivity);
    const resizeObserver = new ResizeObserver(() => {
      if (effectEnabled && isActive()) syncActivity();
    });
    resizeObserver.observe(canvas);
    syncActivity();

    return {
      redraw: () => { if (effectEnabled) syncActivity(); },
      setEnabled(enabled) {
        const next = enabled === true;
        if (next === effectEnabled) return;
        effectEnabled = next;
        syncActivity();
      },
      destroy() {
        disposed = true;
        stopFrameLoop();
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerleave', onPointerLeave);
        reducedMotion.removeEventListener('change', syncActivity);
        document.removeEventListener('visibilitychange', syncActivity);
        document.removeEventListener('notch:modechange', syncActivity);
        document.removeEventListener('notch:tabchange', syncActivity);
        resizeObserver.disconnect();
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      },
    };
  }

  const musicEffect = createWebglEffect(
    document.getElementById('music-color-bends'),
    COLOR_BENDS_SHADER,
    {
      setup({ gl, uniform }) {
        gl.uniform1f(uniform('uSpeed'), 0.59);
        gl.uniform1i(uniform('uColorCount'), 0);
        gl.uniform1i(uniform('uTransparent'), 1);
        gl.uniform1f(uniform('uScale'), 1);
        gl.uniform1f(uniform('uFrequency'), 1);
        gl.uniform1f(uniform('uWarpStrength'), 1);
        gl.uniform1f(uniform('uMouseInfluence'), 1);
        gl.uniform1f(uniform('uParallax'), 0.5);
        gl.uniform1f(uniform('uNoise'), 0.15);
        gl.uniform1i(uniform('uIterations'), 1);
        gl.uniform1f(uniform('uIntensity'), 1.5);
        gl.uniform1f(uniform('uBandWidth'), 6);
      },
      frame({ gl, uniform, pointer }, time, size) {
        pointer.x += (pointer.tx - pointer.x) * 0.08;
        pointer.y += (pointer.ty - pointer.y) * 0.08;
        const rotation = (90 - time) * Math.PI / 180;
        gl.uniform2f(uniform('uCanvas'), size.width, size.height);
        gl.uniform1f(uniform('uTime'), time);
        gl.uniform2f(uniform('uRot'), Math.cos(rotation), Math.sin(rotation));
        gl.uniform2f(uniform('uPointer'), pointer.x, pointer.y);
      },
    }
  );
  if (musicEffect) effectInstances.push(musicEffect);
  const syncHomeEffectVisibility = (event) => {
    const visibleIds = event.detail?.visibleIds;
    if (Array.isArray(visibleIds)) musicEffect?.setEnabled(visibleIds.includes('music'));
  };
  document.addEventListener('notch:home-modules-changed', syncHomeEffectVisibility);

  const LINE_LISTS = [
    ['#tab-todo .todo-list', '.todo-item'],
    ['#tab-links .link-list', '.link-item'],
    ['#tab-recordings .recording-list', '.recording-item'],
    ['#tab-credentials .credential-list', '.credential-item'],
    ['#tab-notes .notes-list', '.notes-list-item'],
  ];
  const lineStates = new WeakMap();
  let lineAnimation = 0;
  let lastLineFrame = performance.now();

  function runLineFrame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastLineFrame) / 1000));
    lastLineFrame = now;
    const blend = 1 - Math.exp(-dt / 0.1);
    let moving = false;
    document.querySelectorAll('[data-line-sidebar-item]').forEach((item) => {
      const state = lineStates.get(item) || { current: 0, target: 0 };
      const active = item.matches('.active, .multi-selected, [aria-current="true"], [aria-selected="true"]');
      const target = Math.max(state.target, active ? 0.72 : 0);
      state.current += (target - state.current) * blend;
      if (Math.abs(target - state.current) < 0.002) state.current = target;
      else moving = true;
      item.style.setProperty('--line-effect', state.current.toFixed(4));
      lineStates.set(item, state);
    });
    lineAnimation = moving ? requestAnimationFrame(runLineFrame) : 0;
  }

  function startLineFrame() {
    if (lineAnimation) return;
    lastLineFrame = performance.now();
    lineAnimation = requestAnimationFrame(runLineFrame);
  }

  function setLineTargets(list, clientY) {
    const radius = 100;
    list.querySelectorAll('[data-line-sidebar-item]').forEach((item) => {
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));
      const proximity = Math.max(0, 1 - distance / radius);
      const smooth = proximity * proximity * (3 - 2 * proximity);
      const state = lineStates.get(item) || { current: 0, target: 0 };
      state.target = smooth;
      lineStates.set(item, state);
    });
    startLineFrame();
  }

  function resetLineTargets(list) {
    list.querySelectorAll('[data-line-sidebar-item]').forEach((item) => {
      const state = lineStates.get(item) || { current: 0, target: 0 };
      state.target = 0;
      lineStates.set(item, state);
    });
    startLineFrame();
  }

  function decorateLineLists() {
    LINE_LISTS.forEach(([listSelector, itemSelector]) => {
      document.querySelectorAll(listSelector).forEach((list) => {
        list.classList.add('line-sidebar-list');
        list.querySelectorAll(itemSelector).forEach((item) => {
          item.dataset.lineSidebarItem = '';
          if (!lineStates.has(item)) lineStates.set(item, { current: 0, target: 0 });
        });
        if (list.dataset.lineSidebarBound === 'true') return;
        list.dataset.lineSidebarBound = 'true';
        list.addEventListener('pointermove', (event) => setLineTargets(list, event.clientY));
        list.addEventListener('pointerleave', () => resetLineTargets(list));
        list.addEventListener('focusin', (event) => {
          const item = event.target.closest('[data-line-sidebar-item]');
          if (!item) return;
          setLineTargets(list, item.getBoundingClientRect().top + item.offsetHeight / 2);
        });
        list.addEventListener('focusout', (event) => {
          if (!list.contains(event.relatedTarget)) resetLineTargets(list);
        });
      });
    });
  }

  decorateLineLists();
  const listObserver = new MutationObserver(decorateLineLists);
  const panels = document.getElementById('panels');
  if (panels) listObserver.observe(panels, { childList: true, subtree: true });

  window.DynamicPanelEffects = {
    redraw: () => effectInstances.forEach((effect) => effect.redraw()),
    refreshLists: decorateLineLists,
  };
  window.addEventListener('pagehide', () => {
    document.removeEventListener('notch:home-modules-changed', syncHomeEffectVisibility);
    listObserver.disconnect();
    cancelAnimationFrame(lineAnimation);
    effectInstances.forEach((effect) => effect.destroy());
  }, { once: true });
})();
