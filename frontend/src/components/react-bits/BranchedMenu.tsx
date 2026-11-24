'use client';

import React from 'react';

interface BranchedMenuProps {
  depth: number;
  isLast?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  isActive?: boolean;
  className?: string;
}

export const BranchedMenu: React.FC<BranchedMenuProps> = ({
  depth,
  isLast = false,
  hasChildren = false,
  isExpanded = false,
  isActive = false,
  className = '',
}) => {
  if (depth <= 0) return null;

  return (
    <div
      aria-hidden="true"
      className={`absolute left-0 top-0 bottom-0 pointer-events-none flex items-center ${className}`}
      style={{
        width: `${depth * 14}px`,
      }}
    >
      {/* Vertical continuation guide lines for ancestor depths */}
      {Array.from({ length: depth - 1 }).map((_, index) => (
        <div
          key={index}
          className="absolute top-0 bottom-0 w-[1px] bg-slate-800/60"
          style={{ left: `${(index + 1) * 14 - 7}px` }}
        />
      ))}

      {/* Main branch connector for current item */}
      <div
        className="absolute w-[1px] bg-slate-800/80"
        style={{
          left: `${depth * 14 - 7}px`,
          top: 0,
          bottom: isLast ? '50%' : 0,
        }}
      />

      {/* Horizontal arm connecting to the node icon */}
      <div
        className={`absolute h-[1px] transition-colors duration-200 ${
          isActive ? 'bg-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.5)]' : 'bg-slate-800/80'
        }`}
        style={{
          left: `${depth * 14 - 7}px`,
          width: '7px',
          top: '50%',
        }}
      />

      {/* Subtle indicator dot at connector elbow if node is active or has expanded children */}
      {hasChildren && isExpanded && (
        <div
          className="absolute w-1 h-1 rounded-full bg-cyan-500/60"
          style={{
            left: `${depth * 14 - 9}px`,
            top: 'calc(50% - 2px)',
          }}
        />
      )}
    </div>
  );
};
