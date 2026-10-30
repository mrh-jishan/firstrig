import * as THREE from 'three';

// Custom GLSL materials. Each returns a fresh material; callers drive uTime / uPower from useFrame.

const hsv = /* glsl */ `
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}`;

/** Addressable-RGB strip: a rainbow that chases along the UV x axis. Values above 1 feed the bloom pass. */
export function rgbMaterial(opts: { speed?: number; offset?: number; mode?: 'rainbow' | 'solid'; color?: string } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 0 },
      uSpeed: { value: opts.speed ?? 0.25 },
      uOffset: { value: opts.offset ?? 0 },
      uSolid: { value: new THREE.Color(opts.color ?? '#3ba7ff') },
      uRainbow: { value: opts.mode === 'solid' ? 0 : 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${hsv}
      uniform float uTime, uPower, uSpeed, uOffset, uRainbow;
      uniform vec3 uSolid;
      varying vec2 vUv;
      void main() {
        float h = fract(vUv.x + uOffset - uTime * uSpeed);
        vec3 c = mix(uSolid, hsv2rgb(vec3(h, 0.85, 1.0)), uRainbow);
        // Diffuser falloff across the strip width.
        float d = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0);
        vec3 off = vec3(0.04);
        gl_FragColor = vec4(mix(off, c * (1.2 + 2.2 * d), uPower), 1.0);
      }`,
    toneMapped: false,
  });
}

/** Holographic placement ghost: fresnel rim + rising scanlines. Shows where a part is about to go. */
export function ghostMaterial(color = '#3ba7ff') {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vN = normalize(normalMatrix * normal);
        vec4 mv = viewMatrix * wp;
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
        float scan = smoothstep(0.75, 1.0, sin(vWorld.y * 3.0 - uTime * 4.0) * 0.5 + 0.5);
        float a = (0.08 + fres * 0.9 + scan * 0.18) * uOpacity;
        gl_FragColor = vec4(uColor * (1.3 + fres * 1.5), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/** Infinity-mirror pump cap: concentric glowing rings receding into the surface. */
export function infinityMirrorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      ${hsv}
      uniform float uTime, uPower; varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x) / 6.2831 + 0.5;
        float rings = 0.0;
        for (int i = 0; i < 6; i++) {
          float rr = 0.9 - float(i) * 0.13;
          rings += smoothstep(0.03, 0.0, abs(r - rr)) * (1.0 - float(i) * 0.15);
        }
        vec3 c = hsv2rgb(vec3(fract(a - uTime * 0.2), 0.8, 1.0)) * rings * 2.5;
        vec3 glass = vec3(0.02, 0.025, 0.03) + vec3(0.25) * pow(1.0 - r, 6.0) * 0.2;
        gl_FragColor = vec4(glass + c * uPower, 1.0);
      }`,
    toneMapped: false,
  });
}
