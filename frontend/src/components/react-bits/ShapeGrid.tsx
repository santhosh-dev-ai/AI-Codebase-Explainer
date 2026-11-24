'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

export interface ShapeGridProps {
  shape?: 'square' | 'tile' | 'hexagon' | 'triangle' | 'diamond' | 'circle' | 'cross' | 'dot';
  cellSize?: number;
  lineWidth?: number;
  direction?: 'diagonal' | 'up' | 'down' | 'left' | 'right' | 'none';
  speed?: number;
  lineColor?: string;
  hoverColor?: string;
  hoverFillColor?: string;
  fillOpacity?: number;
  rainbow?: boolean;
  tiltX?: number;
  tiltY?: number;
  radius?: number;
  trail?: number;
  glow?: number;
  twinkle?: number;
  fade?: number;
  clickCascade?: boolean;
  intro?: boolean;
  opacity?: number;
  backgroundColor?: string;
  paused?: boolean;
  dpr?: number;
  className?: string;
  style?: CSSProperties;
}

interface Layout {
  stepX: number;
  stepY: number;
  radius?: number;
  side?: number;
}

interface View {
  x0: number;
  y0: number;
  width: number;
  height: number;
  inverse: number[] | null;
  transform: string;
  mist: number[] | null;
  far: number;
  reach: number;
}

interface Settings {
  shape: string;
  cellSize: number;
  lineWidth: number;
  direction: string;
  speed: number;
  lineColor: string;
  hoverColor: string;
  hoverFillColor: string;
  fillOpacity: number;
  rainbow: boolean;
  tone: number;
  tiltX: number;
  tiltY: number;
  radius: number;
  trail: number;
  glow: number;
  twinkle: number;
  clickCascade: boolean;
  intro: boolean;
  paused: boolean;
  dpr?: number;
}

interface Cascade {
  x: number;
  y: number;
  time: number;
  power: number;
  reach: number;
  hue: number;
}

interface Engine {
  redraw: () => void;
}

const SHAPES = ['square', 'tile', 'hexagon', 'triangle', 'diamond', 'circle', 'cross', 'dot'];
const DIRECTIONS: Record<string, number[]> = {
  right: [1, 0],
  left: [-1, 0],
  up: [0, -1],
  down: [0, 1],
  diagonal: [Math.SQRT1_2, -Math.SQRT1_2],
  none: [0, 0]
};
const SQRT3 = Math.sqrt(3);
const OFFSET = 32768;
const FAR = 2.5;
const MAX_PIXELS = 8e6;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

const hash = (i: number, j: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const keyOf = (i: number, j: number) => (i + OFFSET) * 65536 + (j + OFFSET);

const fadeMask = (amount: number) => {
  if (amount <= 0) return 'none';
  const edge = amount * 26;
  const stops: string[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    stops.push(`rgba(0, 0, 0, ${smootherstep(t).toFixed(3)}) ${(t * edge).toFixed(2)}%`);
  }
  const inner = stops.join(', ');
  const outer = [...stops]
    .reverse()
    .map(stop => stop.replace(/ ([\d.]+)%$/, (_: string, value: string) => ` ${(100 - parseFloat(value)).toFixed(2)}%`))
    .join(', ');
  const axis = (direction: string) => `linear-gradient(${direction}, ${inner}, ${outer})`;
  return `${axis('to right')}, ${axis('to bottom')}`;
};

const lightnessOf = (color: string) => {
  let hex = String(color).trim().replace(/^#/, '');
  if (hex.length === 3 || hex.length === 4) hex = hex.replace(/./g, '$&$&');
  hex = hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 0.6;
  const value = parseInt(hex, 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255];
  return (Math.max(...channels) + Math.min(...channels)) / 510;
};

const tint = (hue: number, lightness: number) =>
  `hsl(${(((hue % 360) + 360) % 360).toFixed(1)}, 90%, ${(lightness * 100).toFixed(1)}%)`;

const multiply = (a: number[], b: number[]) =>
  [0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => {
    const r = Math.floor(k / 3);
    const c = k % 3;
    return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  });

const invert = (m: number[]): number[] | null => {
  const d =
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (Math.abs(d) < 1e-8) return null;
  const id = 1 / d;
  return [
    (m[4] * m[8] - m[5] * m[7]) * id,
    (m[2] * m[7] - m[1] * m[8]) * id,
    (m[1] * m[5] - m[2] * m[4]) * id,
    (m[5] * m[6] - m[3] * m[8]) * id,
    (m[0] * m[8] - m[2] * m[6]) * id,
    (m[2] * m[3] - m[0] * m[5]) * id,
    (m[3] * m[7] - m[4] * m[6]) * id,
    (m[1] * m[6] - m[0] * m[7]) * id,
    (m[0] * m[4] - m[1] * m[3]) * id
  ];
};

const project = (m: number[] | null, x: number, y: number): [number, number] => {
  if (!m) return [x, y];
  const w = m[6] * x + m[7] * y + m[8];
  const iw = Math.abs(w) > 1e-6 ? 1 / w : 1;
  return [(m[0] * x + m[1] * y + m[2]) * iw, (m[3] * x + m[4] * y + m[5]) * iw];
};

const makeLayout = (shape: string, size: number): Layout => {
  switch (shape) {
    case 'hexagon': {
      const radius = size / SQRT3;
      return { stepX: size, stepY: radius * 1.5, radius };
    }
    case 'triangle': {
      const side = size * 1.1;
      return { stepX: side, stepY: (side * SQRT3) / 2, side };
    }
    case 'diamond': {
      return { stepX: size * 1.1, stepY: size * 0.75 };
    }
    case 'tile': {
      return { stepX: size * 1.08, stepY: size * 1.08 };
    }
    default: {
      return { stepX: size, stepY: size };
    }
  }
};

const pathOf = (shape: string, cx: number, cy: number, size: number, layout: Layout): Path2D => {
  const path = new Path2D();
  switch (shape) {
    case 'circle': {
      path.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
      break;
    }
    case 'dot': {
      path.arc(cx, cy, Math.max(1, size * 0.12), 0, Math.PI * 2);
      break;
    }
    case 'hexagon': {
      const r = layout.radius ?? size / SQRT3;
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 30);
        const px = cx + r * Math.cos(a);
        const py = cy + r * Math.sin(a);
        if (k === 0) path.moveTo(px, py);
        else path.lineTo(px, py);
      }
      path.closePath();
      break;
    }
    case 'triangle': {
      const side = layout.side ?? size;
      const h = (side * SQRT3) / 2;
      path.moveTo(cx, cy - (2 / 3) * h);
      path.lineTo(cx + side / 2, cy + h / 3);
      path.lineTo(cx - side / 2, cy + h / 3);
      path.closePath();
      break;
    }
    case 'diamond': {
      const hx = layout.stepX / 2;
      const hy = layout.stepY / 2;
      path.moveTo(cx, cy - hy);
      path.lineTo(cx + hx, cy);
      path.lineTo(cx, cy + hy);
      path.lineTo(cx - hx, cy);
      path.closePath();
      break;
    }
    case 'cross': {
      const arm = size * 0.42;
      const th = Math.max(1.5, size * 0.14);
      const hth = th / 2;
      path.moveTo(cx - hth, cy - arm);
      path.lineTo(cx + hth, cy - arm);
      path.lineTo(cx + hth, cy - hth);
      path.lineTo(cx + arm, cy - hth);
      path.lineTo(cx + arm, cy + hth);
      path.lineTo(cx + hth, cy + hth);
      path.lineTo(cx + hth, cy + arm);
      path.lineTo(cx - hth, cy + arm);
      path.lineTo(cx - hth, cy + hth);
      path.lineTo(cx - arm, cy + hth);
      path.lineTo(cx - arm, cy - hth);
      path.lineTo(cx - hth, cy - hth);
      path.closePath();
      break;
    }
    case 'tile': {
      const half = size * 0.46;
      const cr = Math.max(2, size * 0.1);
      path.roundRect(cx - half, cy - half, half * 2, half * 2, cr);
      break;
    }
    default: {
      const half = size / 2;
      path.rect(cx - half, cy - half, size, size);
      break;
    }
  }
  return path;
};

const buildView = (width: number, height: number, tiltX: number, tiltY: number): View => {
  const cx = width / 2;
  const cy = height / 2;
  const f = (width + height) / 2;
  const radX = (tiltX * Math.PI) / 180;
  const radY = (tiltY * Math.PI) / 180;
  const cosX = Math.cos(radX);
  const sinX = Math.sin(radX);
  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);

  const tToCenter = [1, 0, -cx, 0, 1, -cy, 0, 0, 1];
  const tFromCenter = [1, 0, cx, 0, 1, cy, 0, 0, 1];
  const rotX = [1, 0, 0, 0, cosX, 0, 0, -sinX / f, cosX];
  const rotY = [cosY, 0, 0, 0, 1, 0, sinY / f, 0, cosY];
  const forward = multiply(tFromCenter, multiply(rotX, multiply(rotY, tToCenter)));
  const inverse = invert(forward);

  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ];
  const proj = corners.map(([x, y]) => project(inverse, x, y));
  const minX = Math.min(...proj.map(p => p[0]));
  const maxX = Math.max(...proj.map(p => p[0]));
  const minY = Math.min(...proj.map(p => p[1]));
  const maxY = Math.max(...proj.map(p => p[1]));

  const x0 = minX;
  const y0 = minY;
  const w = maxX - minX;
  const h = maxY - minY;

  const a = forward[0];
  const b = forward[3];
  const c = forward[1];
  const d = forward[4];
  const e = forward[2];
  const g = forward[5];
  const p = forward[6];
  const q = forward[7];
  const r = forward[8];
  const transform = `matrix3d(${a},${b},0,${p},${c},${d},0,${q},0,0,1,0,${e},${g},0,${r})`;

  let mist: number[] | null = null;
  if (Math.abs(tiltX) > 2) {
    const topDistance = forward[7] * -cy + forward[8];
    const bottomDistance = forward[7] * cy + forward[8];
    mist = [topDistance, bottomDistance];
  }

  return {
    x0,
    y0,
    width: w,
    height: h,
    inverse,
    transform,
    mist,
    far: FAR,
    reach: Math.hypot(width, height) / 2
  };
};

export const ShapeGrid = ({
  shape = 'square',
  cellSize = 44,
  lineWidth = 1,
  direction = 'diagonal',
  speed = 0.35,
  lineColor = 'rgba(56, 189, 248, 0.08)',
  hoverColor = '#22d3ee',
  hoverFillColor = 'rgba(6, 182, 212, 0.12)',
  fillOpacity = 0.15,
  rainbow = false,
  tiltX = 20,
  tiltY = -5,
  radius = 2.4,
  trail = 0.25,
  glow = 0.4,
  twinkle = 0.15,
  fade = 0.3,
  clickCascade = true,
  intro = true,
  opacity = 1,
  backgroundColor = 'transparent',
  paused = false,
  dpr,
  className = '',
  style
}: ShapeGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  const shapeKey = SHAPES.includes(shape) ? shape : 'square';
  const dirKey = DIRECTIONS[direction] ? direction : 'diagonal';

  const settings: Settings = {
    shape: shapeKey,
    cellSize: Math.max(8, cellSize),
    lineWidth: Math.max(0.5, lineWidth),
    direction: dirKey,
    speed: Math.max(0, speed),
    lineColor,
    hoverColor,
    hoverFillColor,
    fillOpacity: clamp(fillOpacity, 0, 1),
    rainbow,
    tone: lightnessOf(hoverColor),
    tiltX: clamp(tiltX, -85, 85),
    tiltY: clamp(tiltY, -85, 85),
    radius: Math.max(0.5, radius),
    trail: clamp(trail, 0.01, 1),
    glow: Math.max(0, glow),
    twinkle: clamp(twinkle, 0, 1),
    clickCascade,
    intro,
    paused,
    dpr
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const state = {
      alive: true,
      raf: 0,
      last: 0,
      time: 0,
      visible: true,
      width: 1,
      height: 1,
      ratio: 1,
      view: buildView(1, 1, 0, 0),
      pointerX: -99999,
      pointerY: -99999,
      targetX: -99999,
      targetY: -99999,
      inside: false,
      moves: 0,
      cascades: [] as Cascade[],
      hovered: new Map<number, { cellX: number; cellY: number; power: number; hue: number }>()
    };

    const wake = () => {
      if (!state.raf && state.alive) {
        state.last = 0;
        state.raf = requestAnimationFrame(frame);
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const cssWidth = Math.max(1, Math.round(rect.width));
      const cssHeight = Math.max(1, Math.round(rect.height));
      const pixelRatio = settingsRef.current.dpr || Math.min(window.devicePixelRatio || 1, 2);
      state.ratio = pixelRatio;

      let drawWidth = Math.round(cssWidth * pixelRatio);
      let drawHeight = Math.round(cssHeight * pixelRatio);
      const total = drawWidth * drawHeight;
      if (total > MAX_PIXELS) {
        const factor = Math.sqrt(MAX_PIXELS / total);
        drawWidth = Math.round(drawWidth * factor);
        drawHeight = Math.round(drawHeight * factor);
      }

      state.width = drawWidth;
      state.height = drawHeight;
      canvas.width = drawWidth;
      canvas.height = drawHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      state.view = buildView(drawWidth, drawHeight, settingsRef.current.tiltX, settingsRef.current.tiltY);
      canvas.style.transform = state.view.transform;
    };

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const inside = rawX >= 0 && rawX <= rect.width && rawY >= 0 && rawY <= rect.height;
      state.inside = inside;
      if (!inside) {
        state.targetX = -99999;
        state.targetY = -99999;
        return;
      }
      const scaleX = state.width / rect.width;
      const scaleY = state.height / rect.height;
      const canvasX = rawX * scaleX;
      const canvasY = rawY * scaleY;
      const [gridX, gridY] = project(state.view.inverse, canvasX, canvasY);
      state.targetX = gridX;
      state.targetY = gridY;
      state.moves++;
      wake();
    };

    const onDown = (e: PointerEvent) => {
      if (!settingsRef.current.clickCascade) return;
      const rect = container.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      if (rawX < 0 || rawX > rect.width || rawY < 0 || rawY > rect.height) return;
      const scaleX = state.width / rect.width;
      const scaleY = state.height / rect.height;
      const [gx, gy] = project(state.view.inverse, rawX * scaleX, rawY * scaleY);
      state.cascades.push({
        x: gx,
        y: gy,
        time: 0,
        power: 1,
        reach: state.view.reach * 1.2,
        hue: (state.time * 60) % 360
      });
      wake();
    };

    const onLeave = () => {
      state.inside = false;
      state.targetX = -99999;
      state.targetY = -99999;
    };

    const cellCenter = (i: number, j: number, layout: Layout, shape: string): [number, number] => {
      const { stepX, stepY } = layout;
      let cx = i * stepX;
      let cy = j * stepY;
      if (shape === 'hexagon' && (j & 1) !== 0) {
        cx += stepX / 2;
      } else if (shape === 'triangle') {
        const parity = ((i + j) % 2 + 2) % 2;
        if (parity === 1) cy += (layout.side ?? stepX) * (SQRT3 / 6);
      }
      return [cx, cy];
    };

    const draw = () => {
      const s = settingsRef.current;
      const { width, height, view, hovered, cascades } = state;
      ctx.clearRect(0, 0, width, height);

      const layout = makeLayout(s.shape, s.cellSize * state.ratio);
      const vec = DIRECTIONS[s.direction] || DIRECTIONS.diagonal;
      const dist = state.time * s.speed * 32 * state.ratio;
      const shiftX = vec[0] * dist;
      const shiftY = vec[1] * dist;

      const minX = view.x0 - shiftX - layout.stepX * 2;
      const maxX = view.x0 + view.width - shiftX + layout.stepX * 2;
      const minY = view.y0 - shiftY - layout.stepY * 2;
      const maxY = view.y0 + view.height - shiftY + layout.stepY * 2;

      const i0 = Math.floor(minX / layout.stepX);
      const i1 = Math.ceil(maxX / layout.stepX);
      const j0 = Math.floor(minY / layout.stepY);
      const j1 = Math.ceil(maxY / layout.stepY);

      const radiusPx = s.radius * s.cellSize * state.ratio;
      const falloff = 1 / (radiusPx * radiusPx);
      const elapsed = state.time;
      const introRadius = s.intro && !reduce ? elapsed * view.reach * 1.8 : Infinity;

      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const [cx, cy] = cellCenter(i, j, layout, s.shape);
          const drawX = cx + shiftX;
          const drawY = cy + shiftY;

          if (s.intro && !reduce) {
            const originDist = Math.hypot(drawX - width / 2, drawY - height / 2);
            if (originDist > introRadius) continue;
          }

          const dx = drawX - state.pointerX;
          const dy = drawY - state.pointerY;
          const d2 = dx * dx + dy * dy;
          let directPower = 0;
          if (state.inside && d2 < radiusPx * radiusPx) {
            const norm = d2 * falloff;
            directPower = (1 - norm) * (1 - norm);
          }

          let cascadePower = 0;
          let cascadeHue = 0;
          for (let k = 0; k < cascades.length; k++) {
            const cas = cascades[k];
            const cdist = Math.hypot(drawX - cas.x, drawY - cas.y);
            const front = cas.time * 650 * state.ratio;
            const diff = Math.abs(cdist - front);
            const band = 80 * state.ratio;
            if (diff < band) {
              const ring = (1 - diff / band) * cas.power;
              if (ring > cascadePower) {
                cascadePower = ring;
                cascadeHue = cas.hue;
              }
            }
          }

          const key = keyOf(i, j);
          let record = hovered.get(key);
          if (!record && (directPower > 0.001 || cascadePower > 0.001)) {
            record = { cellX: drawX, cellY: drawY, power: 0, hue: 0 };
            hovered.set(key, record);
          }

          if (record) {
            const targetPower = Math.max(directPower, cascadePower);
            if (cascadePower > directPower) record.hue = cascadeHue;
            else if (s.rainbow) record.hue = (elapsed * 50 + i * 9 + j * 7) % 360;
            else record.hue = 0;

            if (targetPower > record.power) {
              record.power = targetPower;
            } else {
              record.power += (targetPower - record.power) * s.trail;
            }

            if (record.power < 0.003 && !state.inside) {
              hovered.delete(key);
              record = undefined;
            }
          }

          let power = record ? record.power : 0;
          if (s.twinkle > 0 && !reduce) {
            const rnd = hash(i, j);
            const tw = Math.sin(elapsed * 2.5 + rnd * Math.PI * 2);
            if (tw > 0.6) {
              const boost = (tw - 0.6) * 2.5 * s.twinkle * rnd;
              power = Math.min(1, power + boost);
            }
          }

          const path = pathOf(s.shape, drawX, drawY, s.cellSize * state.ratio, layout);

          if (power > 0.01) {
            let fillColor: string;
            let strokeColor: string;
            if (s.rainbow || (record && record.hue)) {
              const h = record ? record.hue : (elapsed * 50) % 360;
              fillColor = tint(h, s.tone);
              strokeColor = tint(h, Math.min(1, s.tone * 1.3));
            } else {
              fillColor = s.hoverFillColor;
              strokeColor = s.hoverColor;
            }

            ctx.save();
            ctx.fillStyle = fillColor;
            ctx.globalAlpha = power * s.fillOpacity;
            ctx.fill(path);

            ctx.strokeStyle = strokeColor;
            ctx.globalAlpha = Math.min(1, power * 1.1);
            ctx.lineWidth = s.lineWidth * state.ratio;
            if (s.glow > 0) {
              ctx.shadowColor = strokeColor;
              ctx.shadowBlur = s.glow * 18 * state.ratio * power;
            }
            ctx.stroke(path);
            ctx.restore();
          } else {
            ctx.strokeStyle = s.lineColor;
            ctx.lineWidth = s.lineWidth * state.ratio;
            ctx.stroke(path);
          }
        }
      }
    };

    const frame = (now: number) => {
      state.raf = 0;
      if (!state.alive || !state.visible) return;

      const s = settingsRef.current;
      const dt = state.last ? Math.min(0.1, (now - state.last) / 1000) : 1 / 60;
      state.last = now;

      if (!s.paused && !reduce) {
        state.time += dt;
      }

      if (state.inside) {
        const follow = 1 - Math.exp(-dt * 20);
        state.pointerX += (state.targetX - state.pointerX) * follow;
        state.pointerY += (state.targetY - state.pointerY) * follow;
      }

      for (let k = state.cascades.length - 1; k >= 0; k--) {
        const cas = state.cascades[k];
        cas.time += dt;
        cas.power *= 1 - dt * 1.2;
        if (cas.time * 650 * state.ratio > cas.reach || cas.power < 0.02) {
          state.cascades.splice(k, 1);
        }
      }

      draw();

      const shouldAnimate =
        !s.paused &&
        (s.speed > 0 ||
          state.inside ||
          state.cascades.length > 0 ||
          state.hovered.size > 0 ||
          (s.intro && state.time < 3));

      if (shouldAnimate) {
        wake();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
      wake();
    });
    resizeObserver.observe(container);

    const visibility = new IntersectionObserver(entries => {
      state.visible = entries.some(entry => entry.isIntersecting);
      if (state.visible) wake();
    });
    visibility.observe(container);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    engineRef.current = {
      redraw: () => {
        resize();
        draw();
        wake();
      }
    };

    resize();
    wake();

    return () => {
      state.alive = false;
      cancelAnimationFrame(state.raf);
      resizeObserver.disconnect();
      visibility.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.redraw();
  });

  const mask = fadeMask(clamp(fade, 0, 1));

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${className}`.trim()}
      style={{
        opacity: clamp(opacity, 0, 1),
        backgroundColor,
        ...(mask === 'none'
          ? null
          : { maskImage: mask, WebkitMaskImage: mask, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }),
        ...style
      }}
    >
      <canvas ref={canvasRef} className="absolute left-0 top-0 block origin-top-left" />
    </div>
  );
};

export default ShapeGrid;
