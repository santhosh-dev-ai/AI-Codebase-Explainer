'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FolderFloatProps {
  children: React.ReactNode;
  isFolder?: boolean;
  isOpen?: boolean;
  itemCount?: number;
  className?: string;
}

/**
 * React Bits - Folder Float
 * A micro-interaction folder component where a folder's contents spring out
 * into a floating cloud / elevation micro-state on hover or press.
 */
export const FolderFloat: React.FC<FolderFloatProps> = ({
  children,
  isFolder = true,
  isOpen = false,
  itemCount,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center w-full ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="w-full flex items-center"
        animate={
          isHovered
            ? {
                y: -1.5,
                scale: isFolder ? 1.015 : 1.01,
                transition: { type: 'spring', stiffness: 400, damping: 25 },
              }
            : {
                y: 0,
                scale: 1,
                transition: { duration: 0.15, ease: 'easeOut' },
              }
        }
      >
        {children}
      </motion.div>

      {/* Floating mini-cloud particles on folder hover */}
      <AnimatePresence>
        {isFolder && isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: -6 }}
            exit={{ opacity: 0, scale: 0.8, y: 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="pointer-events-none absolute right-2 -top-1.5 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-400/40 shadow-[0_4px_12px_rgba(34,211,238,0.3)] text-[9px] font-mono text-cyan-300"
          >
            <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />
            <span>{isOpen ? 'open' : itemCount !== undefined ? `${itemCount} items` : 'folder'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
