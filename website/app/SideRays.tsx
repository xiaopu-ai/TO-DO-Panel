'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Renderer, Program, Triangle, Mesh } from 'ogl';
import './SideRays.css';

export type SideRaysOrigin =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left';

export interface SideRaysProps {
  speed?: number;
  rayColor1?: string;
  rayColor2?: string;
  intensity?: number;
  spread?: number;
  origin?: SideRaysOrigin;
  tilt?: number;
  saturation?: number;
  blend?: number;
  falloff?: number;
  opacity?: number;
  className?: string;
}

type Vec2 = [number, number];
type Vec3 = [number, number, number];

interface SideRaysUniforms {
  iTime: { value: number };
  iResolution: { value: Vec2 };
  iSpeed: { value: number };
  iRayColor1: { value: Vec3 };
  iRayColor2: { value: Vec3 };
  iIntensity: { value: number };
  iSpread: { value: number };
  iFlipX: { value: number };
  iFlipY: { value: number };
  iTilt: { value: number };
  iSaturation: { value: number };
  iBlend: { value: number };
  iFalloff: { value: number };
  iOpacity: { value: number };
}

type WebGLStatus = 'loading' | 'ready' | 'failed';

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`;

const hexToRgb = (hex: string): Vec3 => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [
        Number.parseInt(match[1], 16) / 255,
        Number.parseInt(match[2], 16) / 255,
        Number.parseInt(match[3], 16) / 255,
      ]
    : [1, 1, 1];
};

const originToFlip = (origin: SideRaysOrigin): Vec2 => {
  switch (origin) {
    case 'top-left':
      return [1, 0];
    case 'bottom-right':
      return [0, 1];
    case 'bottom-left':
      return [1, 1];
    default:
      return [0, 0];
  }
};

export default function SideRays({
  speed = 2.5,
  rayColor1 = '#EAB308',
  rayColor2 = '#96c8ff',
  intensity = 2,
  spread = 2,
  origin = 'top-right',
  tilt = 0,
  saturation = 1.5,
  blend = 0.75,
  falloff = 1.6,
  opacity = 1,
  className = '',
}: SideRaysProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef<SideRaysUniforms | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const isIntersectingRef = useRef(false);
  const pageVisibleRef = useRef(true);
  const reducedMotionRef = useRef(false);
  const syncPlaybackRef = useRef<() => void>(() => {});
  const latestPropsRef = useRef({
    speed,
    rayColor1,
    rayColor2,
    intensity,
    spread,
    origin,
    tilt,
    saturation,
    blend,
    falloff,
    opacity,
  });
  const [webglStatus, setWebglStatus] = useState<WebGLStatus>('loading');

  useEffect(() => {
    latestPropsRef.current = {
      speed,
      rayColor1,
      rayColor2,
      intensity,
      spread,
      origin,
      tilt,
      saturation,
      blend,
      falloff,
      opacity,
    };
  }, [
    speed,
    rayColor1,
    rayColor2,
    intensity,
    spread,
    origin,
    tilt,
    saturation,
    blend,
    falloff,
    opacity,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!('IntersectionObserver' in window)) {
      isIntersectingRef.current = true;
      syncPlaybackRef.current();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersectingRef.current = entry?.isIntersecting ?? false;
        syncPlaybackRef.current();
      },
      { threshold: 0.1 },
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => {
      reducedMotionRef.current = mediaQuery.matches;
      syncPlaybackRef.current();
    };

    updateMotionPreference();
    mediaQuery.addEventListener?.('change', updateMotionPreference);

    return () => mediaQuery.removeEventListener?.('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const updatePageVisibility = () => {
      pageVisibleRef.current = !document.hidden;
      syncPlaybackRef.current();
    };

    updatePageVisibility();
    document.addEventListener('visibilitychange', updatePageVisibility);
    return () => document.removeEventListener('visibilitychange', updatePageVisibility);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let failed = false;
    let renderer: Renderer | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cleanupResize = () => {};

    const stopAnimation = () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };

    const releaseRenderer = (loseContext: boolean) => {
      if (!renderer) return;
      try {
        if (loseContext) renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // Context cleanup is best-effort; the CSS fallback remains available.
      }
      if (canvas?.parentNode === container) canvas.remove();
    };

    const markWebGLFailed = () => {
      if (failed || disposed) return;
      failed = true;
      stopAnimation();
      releaseRenderer(false);
      rendererRef.current = null;
      uniformsRef.current = null;
      meshRef.current = null;
      setWebglStatus('failed');
    };

    const renderScene = () => {
      const activeRenderer = rendererRef.current;
      const mesh = meshRef.current;
      if (!activeRenderer || !mesh || failed || disposed) return false;
      try {
        activeRenderer.render({ scene: mesh });
        return true;
      } catch {
        markWebGLFailed();
        return false;
      }
    };

    const animate = (timestamp: number) => {
      animationIdRef.current = null;
      if (
        failed ||
        disposed ||
        reducedMotionRef.current ||
        !isIntersectingRef.current ||
        !pageVisibleRef.current
      ) {
        lastFrameTimeRef.current = null;
        return;
      }

      if (lastFrameTimeRef.current !== null) {
        const delta = Math.min((timestamp - lastFrameTimeRef.current) / 1000, 0.1);
        elapsedSecondsRef.current += Math.max(0, delta);
      }
      lastFrameTimeRef.current = timestamp;
      if (uniformsRef.current) uniformsRef.current.iTime.value = elapsedSecondsRef.current;

      if (renderScene()) animationIdRef.current = requestAnimationFrame(animate);
    };

    const syncPlayback = () => {
      if (failed || disposed || !rendererRef.current || !meshRef.current) return;

      const canDraw = isIntersectingRef.current && pageVisibleRef.current;
      if (reducedMotionRef.current) {
        stopAnimation();
        elapsedSecondsRef.current = 0;
        if (uniformsRef.current) uniformsRef.current.iTime.value = 0;
        if (canDraw) renderScene();
        return;
      }

      if (!canDraw) {
        stopAnimation();
      } else if (animationIdRef.current === null) {
        lastFrameTimeRef.current = null;
        animationIdRef.current = requestAnimationFrame(animate);
      }
    };

    syncPlaybackRef.current = syncPlayback;

    const initializeWebGL = () => {
      if (disposed || !containerRef.current) return;

      try {
        const initialProps = latestPropsRef.current;
        renderer = new Renderer({
          dpr: Math.min(window.devicePixelRatio || 1, 2),
          alpha: true,
        });
        rendererRef.current = renderer;

        const gl = renderer.gl;
        canvas = gl.canvas as HTMLCanvasElement;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.addEventListener('webglcontextlost', markWebGLFailed, { once: true });
        container.replaceChildren(canvas);

        const [flipX, flipY] = originToFlip(initialProps.origin);
        const uniforms: SideRaysUniforms = {
          iTime: { value: 0 },
          iResolution: { value: [1, 1] },
          iSpeed: { value: initialProps.speed },
          iRayColor1: { value: hexToRgb(initialProps.rayColor1) },
          iRayColor2: { value: hexToRgb(initialProps.rayColor2) },
          iIntensity: { value: initialProps.intensity },
          iSpread: { value: initialProps.spread },
          iFlipX: { value: flipX },
          iFlipY: { value: flipY },
          iTilt: { value: initialProps.tilt },
          iSaturation: { value: initialProps.saturation },
          iBlend: { value: initialProps.blend },
          iFalloff: { value: initialProps.falloff },
          iOpacity: { value: initialProps.opacity },
        };
        uniformsRef.current = uniforms;

        const geometry = new Triangle(gl);
        const program = new Program(gl, {
          vertex: VERTEX_SHADER,
          fragment: FRAGMENT_SHADER,
          uniforms,
        });
        meshRef.current = new Mesh(gl, { geometry, program });

        const updateSize = () => {
          if (disposed || failed || !renderer || !containerRef.current) return;
          const { clientWidth: width, clientHeight: height } = containerRef.current;
          if (width <= 0 || height <= 0) return;
          renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
          renderer.setSize(width, height);
          uniforms.iResolution.value = [width * renderer.dpr, height * renderer.dpr];
          syncPlayback();
        };

        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(updateSize);
          resizeObserver.observe(container);
        }
        window.addEventListener('resize', updateSize);
        updateSize();
        if (failed) return;

        setWebglStatus('ready');
        syncPlayback();

        syncPlaybackRef.current = syncPlayback;
        cleanupResize = () => window.removeEventListener('resize', updateSize);
      } catch {
        markWebGLFailed();
      }
    };

    const initializeTimer = window.setTimeout(initializeWebGL, 10);

    return () => {
      disposed = true;
      window.clearTimeout(initializeTimer);
      stopAnimation();
      resizeObserver?.disconnect();
      cleanupResize();
      if (canvas) canvas.removeEventListener('webglcontextlost', markWebGLFailed);
      releaseRenderer(!failed);
      if (rendererRef.current === renderer) rendererRef.current = null;
      uniformsRef.current = null;
      meshRef.current = null;
      syncPlaybackRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms || webglStatus !== 'ready') return;

    uniforms.iSpeed.value = speed;
    uniforms.iRayColor1.value = hexToRgb(rayColor1);
    uniforms.iRayColor2.value = hexToRgb(rayColor2);
    uniforms.iIntensity.value = intensity;
    uniforms.iSpread.value = spread;
    const [flipX, flipY] = originToFlip(origin);
    uniforms.iFlipX.value = flipX;
    uniforms.iFlipY.value = flipY;
    uniforms.iTilt.value = tilt;
    uniforms.iSaturation.value = saturation;
    uniforms.iBlend.value = blend;
    uniforms.iFalloff.value = falloff;
    uniforms.iOpacity.value = opacity;
    syncPlaybackRef.current();
  }, [
    webglStatus,
    speed,
    rayColor1,
    rayColor2,
    intensity,
    spread,
    origin,
    tilt,
    saturation,
    blend,
    falloff,
    opacity,
  ]);

  const fallbackStyle = {
    '--side-rays-color-1': rayColor1,
    '--side-rays-color-2': rayColor2,
    '--side-rays-opacity': String(Math.min(Math.max(opacity, 0), 1)),
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`side-rays-container ${className}`.trim()}
      data-origin={origin}
      data-webgl-status={webglStatus}
      style={fallbackStyle}
      aria-hidden="true"
    />
  );
}
