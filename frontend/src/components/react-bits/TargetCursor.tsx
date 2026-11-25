'use client';

import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';

export interface TargetCursorProps {
  /** Free-floating cursor color (defaults to cyan #22d3ee) */
  cursorColor?: string;
  /** Spin duration in seconds for reticle (defaults to 3s, 0 to disable) */
  spinDuration?: number;
  /** Whether to hide default OS cursor when inside window (defaults to true) */
  hideDefaultCursor?: boolean;
  /** Default width/height of reticle in pixels (defaults to 32) */
  size?: number;
  /** Length of the 4 corner bracket arms in pixels (defaults to 10) */
  cornerSize?: number;
  /** Border thickness of the corner brackets in pixels (defaults to 1.75) */
  thickness?: number;
  /** Diameter of central tracking dot in pixels (defaults to 3) */
  dotSize?: number;
  /** CSS mix-blend-mode (defaults to 'normal') */
  blendMode?: CSSProperties['mixBlendMode'];
  /** Whether cursor contracts and pulses on mouse click/press (defaults to true) */
  clickEffect?: boolean;
  /** Responsive follow speed factor (0.35 - 0.45, defaults to 0.42) */
  followSpeed?: number;
  /** Scope container (defaults to document.body) */
  container?: RefObject<HTMLElement | null> | HTMLElement | null;

  /** @deprecated Hover target locking is disabled by design */
  targetSelector?: string;
  /** @deprecated Hover target color shift is disabled by design */
  cursorColorOnTarget?: string;
  /** @deprecated Hover snap duration is disabled by design */
  hoverDuration?: number;
  /** @deprecated Parallax tracking is disabled by design */
  parallaxOn?: boolean;
  /** @deprecated Target padding is disabled by design */
  padding?: number;
  /** @deprecated Matching target radius is disabled by design */
  matchRadius?: boolean;
  /** @deprecated HUD labels are disabled by design */
  showLabel?: boolean;
}

const resolveElement = (value: TargetCursorProps['container']): HTMLElement | null =>
  (value && 'current' in value ? value.current : value) || null;

export const TargetCursor = ({
  cursorColor = '#22d3ee',
  spinDuration = 3,
  hideDefaultCursor = true,
  size = 32,
  cornerSize = 10,
  thickness = 1.75,
  dotSize = 3,
  blendMode = 'normal',
  clickEffect = true,
  followSpeed = 0.45,
  container
}: TargetCursorProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);

  const settings = {
    cursorColor,
    spinDuration,
    hideDefaultCursor,
    size: Math.max(12, size),
    cornerSize: Math.max(2, cornerSize),
    thickness: Math.max(0.5, thickness),
    dotSize: Math.max(1, dotSize),
    clickEffect,
    followSpeed,
    container
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const style = document.createElement('style');
    document.head.appendChild(style);

    const pointer = { x: 0, y: 0, inside: false, seen: false, pressed: false };
    const currentX = { current: 0 };
    const currentY = { current: 0 };
    const presence = { current: 1 };
    const press = { current: 0 };
    const angle = { current: 0 };
    const rippleTime = { current: 1 }; // > 0.35 means inactive
    let raf = 0;
    let last = 0;
    let lastScope: HTMLElement | null = null;

    const scopeOf = () => resolveElement(settingsRef.current.container);

    const hideCursor = () => {
      const s = settingsRef.current;
      const scope = scopeOf();
      if (scope !== lastScope) {
        lastScope?.removeAttribute('data-target-cursor-scope');
        scope?.setAttribute('data-target-cursor-scope', '');
        lastScope = scope;
      }
      const selector = scope ? '[data-target-cursor-scope]' : 'html';
      // Hide default cursor globally while preserving native text cursor in inputs, textareas, and code editors
      const rule =
        s.hideDefaultCursor && pointer.inside
          ? `${selector}, ${selector} * { cursor: none !important; }\n${selector} input, ${selector} textarea, ${selector} [contenteditable="true"], ${selector} .monaco-editor, ${selector} .monaco-editor * { cursor: auto !important; }`
          : '';
      if (style.textContent !== rule) style.textContent = rule;
    };

    const frame = (now: number) => {
      raf = 0;
      const s = settingsRef.current;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Position tracking with responsive linear interpolation
      if (!pointer.seen && pointer.inside) {
        currentX.current = pointer.x;
        currentY.current = pointer.y;
        pointer.seen = true;
      } else if (pointer.seen) {
        if (prefersReducedMotion) {
          currentX.current = pointer.x;
          currentY.current = pointer.y;
        } else {
          // Responsive linear interpolation (tuned factor 0.35–0.45, defaulting to 0.45 for snappy tracking)
          const baseLerp = Math.min(0.55, Math.max(0.35, s.followSpeed ?? 0.45));
          const followFactor = 1 - Math.pow(1 - baseLerp, dt * 60);

          currentX.current += (pointer.x - currentX.current) * followFactor;
          currentY.current += (pointer.y - currentY.current) * followFactor;

          // Snap when within 1.2px to eliminate trailing sluggishness while maintaining smoothness
          if (Math.abs(pointer.x - currentX.current) < 1.2) {
            currentX.current = pointer.x;
          }
          if (Math.abs(pointer.y - currentY.current) < 1.2) {
            currentY.current = pointer.y;
          }
        }
      }

      // Smooth presence fade in/out when entering/leaving window
      const presenceFactor = 1 - Math.exp(-24 * dt);
      presence.current += ((pointer.inside ? 1 : 0) - presence.current) * presenceFactor;

      // Continuous constant rotation regardless of underlying elements
      if (s.spinDuration > 0) {
        angle.current += ((Math.PI * 2) / s.spinDuration) * dt;
        if (angle.current > Math.PI * 2) angle.current -= Math.PI * 2;
      }

      // Smooth press contraction on mouse press
      const pressTarget = pointer.pressed && s.clickEffect ? 1 : 0;
      const pressFactor = 1 - Math.exp(-36 * dt);
      press.current += (pressTarget - press.current) * pressFactor;

      const degrees = (angle.current * 180) / Math.PI;
      const squeeze = 1 - press.current * 0.16;
      const dotScale = 1 - press.current * 0.35;
      const cx = currentX.current;
      const cy = currentY.current;

      // 1. Update rotating square / target outline
      // Directly centered on (cx, cy) and rotated continuously
      if (reticleRef.current) {
        reticleRef.current.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0) translate(-50%, -50%) rotate(${degrees.toFixed(2)}deg) scale(${squeeze.toFixed(3)})`;
      }

      // 2. Update center dot
      // Shares the exact same (cx, cy) center, guaranteeing 100% visual alignment
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0) translate(-50%, -50%) scale(${dotScale.toFixed(3)})`;
      }

      // 3. Update click ripple animation if active
      if (rippleRef.current && rippleTime.current < 0.35) {
        rippleTime.current += dt;
        const progress = Math.min(1, rippleTime.current / 0.35);
        const rippleScale = 0.8 + progress * 0.9;
        const rippleOpacity = (1 - progress) * 0.6;
        rippleRef.current.style.display = 'block';
        rippleRef.current.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0) translate(-50%, -50%) scale(${rippleScale.toFixed(3)})`;
        rippleRef.current.style.opacity = rippleOpacity.toFixed(3);
      } else if (rippleRef.current && rippleRef.current.style.display !== 'none') {
        rippleRef.current.style.display = 'none';
      }

      // 4. Update root opacity for smooth entrance/exit
      if (rootRef.current) {
        rootRef.current.style.opacity = Math.max(0, Math.min(1, presence.current)).toFixed(3);
      }

      // Keep animation frame running while cursor is inside or fading/animating
      const isVisible = pointer.inside || presence.current > 0.002;
      const isRippling = rippleTime.current < 0.35;
      const isPressing = Math.abs(pressTarget - press.current) > 0.002;
      const isMoving =
        Math.abs(pointer.x - currentX.current) + Math.abs(pointer.y - currentY.current) > 0.05;
      const isSpinning = s.spinDuration > 0 && pointer.inside;

      if (isVisible && (isSpinning || isMoving || isPressing || isRippling)) {
        raf = requestAnimationFrame(frame);
      } else {
        last = 0;
      }
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const insideScope = (x: number, y: number, element?: Element | null) => {
      const scope = scopeOf();
      if (!scope) return true;
      if (element && scope.contains(element)) return true;
      const box = scope.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    };

    const handlePointerMove = (event: MouseEvent | PointerEvent) => {
      if ('pointerType' in event && event.pointerType && event.pointerType !== 'mouse') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!pointer.seen) {
        currentX.current = pointer.x;
        currentY.current = pointer.y;
        pointer.seen = true;
      }
      const inside = insideScope(pointer.x, pointer.y, event.target as Element | null);
      if (inside !== pointer.inside) {
        pointer.inside = inside;
        hideCursor();
      }
      wake();
    };

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if ('pointerType' in event && event.pointerType && event.pointerType !== 'mouse') return;
      pointer.pressed = true;
      // Trigger click ripple animation
      if (settingsRef.current.clickEffect) {
        rippleTime.current = 0;
      }
      wake();
    };

    const handlePointerUp = () => {
      pointer.pressed = false;
      wake();
    };

    const onLeave = () => {
      pointer.inside = false;
      pointer.pressed = false;
      hideCursor();
      wake();
    };

    // Attach both pointer and mouse events for universal browser support
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('mousedown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('mouseup', handlePointerUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    // Initial wake to start rotation immediately
    wake();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      lastScope?.removeAttribute('data-target-cursor-scope');
      style.remove();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-target-cursor="root"
      className="pointer-events-none fixed inset-0 z-[2147483647]"
      style={{
        mixBlendMode: blendMode,
        opacity: 0,
        '--target-cursor-color': cursorColor
      } as CSSProperties}
      aria-hidden="true"
    >
      {/* 1. Rotating square / target outline */}
      <div
        ref={reticleRef}
        data-target-cursor="reticle"
        className="absolute top-0 left-0 box-border will-change-transform pointer-events-none"
        style={{
          width: size,
          height: size,
          transform: 'translate3d(-100px, -100px, 0) translate(-50%, -50%)',
        }}
      >
        {/* Top-Left Corner */}
        <span
          className="absolute top-0 left-0 box-border pointer-events-none"
          style={{
            width: cornerSize,
            height: cornerSize,
            borderTop: `${thickness}px solid ${cursorColor}`,
            borderLeft: `${thickness}px solid ${cursorColor}`,
            borderRadius: '1px 0 0 0',
          }}
        />
        {/* Top-Right Corner */}
        <span
          className="absolute top-0 right-0 box-border pointer-events-none"
          style={{
            width: cornerSize,
            height: cornerSize,
            borderTop: `${thickness}px solid ${cursorColor}`,
            borderRight: `${thickness}px solid ${cursorColor}`,
            borderRadius: '0 1px 0 0',
          }}
        />
        {/* Bottom-Right Corner */}
        <span
          className="absolute bottom-0 right-0 box-border pointer-events-none"
          style={{
            width: cornerSize,
            height: cornerSize,
            borderBottom: `${thickness}px solid ${cursorColor}`,
            borderRight: `${thickness}px solid ${cursorColor}`,
            borderRadius: '0 0 1px 0',
          }}
        />
        {/* Bottom-Left Corner */}
        <span
          className="absolute bottom-0 left-0 box-border pointer-events-none"
          style={{
            width: cornerSize,
            height: cornerSize,
            borderBottom: `${thickness}px solid ${cursorColor}`,
            borderLeft: `${thickness}px solid ${cursorColor}`,
            borderRadius: '0 0 0 1px',
          }}
        />
      </div>

      {/* 2. Central tracking dot */}
      <span
        ref={dotRef}
        data-target-cursor="dot"
        className="absolute top-0 left-0 rounded-full will-change-transform pointer-events-none"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: cursorColor,
          boxShadow: `0 0 6px ${cursorColor}88`,
          transform: 'translate3d(-100px, -100px, 0) translate(-50%, -50%)',
        }}
      />

      {/* 3. Click pulse/ripple ring */}
      <span
        ref={rippleRef}
        data-target-cursor="ripple"
        className="absolute top-0 left-0 rounded-full box-border will-change-transform pointer-events-none"
        style={{
          width: size,
          height: size,
          border: `${Math.max(1, thickness - 0.25)}px solid ${cursorColor}`,
          display: 'none',
          transform: 'translate3d(-100px, -100px, 0) translate(-50%, -50%)',
        }}
      />
    </div>
  );
};

export default TargetCursor;
