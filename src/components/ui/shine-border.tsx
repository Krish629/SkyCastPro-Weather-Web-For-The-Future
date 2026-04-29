"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import React from "react";

type ShineBorderProps = {
  children: React.ReactNode;
  className?: string;
  color?: string | string[];
  borderWidth?: number;
  duration?: number;
  isFocused?: boolean;
};

/**
 * Shine Border Component
 * @param color - The color of the shine effect. Can be a single color or an array of colors.
 * @param borderWidth - The width of the border.
 * @param duration - The duration of the animation in seconds.
 * @param isFocused - Whether the shine effect should be visible.
 */
export function ShineBorder({
  children,
  className,
  color = ["#4ade80", "#3b82f6", "#22d3ee"],
  borderWidth = 1,
  duration = 8,
  isFocused = false,
}: ShineBorderProps) {
  return (
    <div
      className={cn(
        "relative rounded-[inherit] transition-all duration-300",
        isFocused ? "shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]" : "shadow-none",
        className
      )}
    >
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "circOut" }}
            className="absolute inset-0 z-0 pointer-events-none rounded-[inherit]"
          >
            <div
              style={
                {
                  "--border-width": `${borderWidth}px`,
                  "--duration": `${duration}s`,
                  "--mask-linear-gradient": `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
                  "--background-radial-gradient": `radial-gradient(transparent,transparent, ${
                    Array.isArray(color) ? color.join(",") : color
                  },transparent,transparent)`,
                } as React.CSSProperties
              }
              className={`absolute inset-[-150%] aspect-square size-[400%] rounded-[inherit] p-[var(--border-width)] will-change-[background-position] ![-webkit-mask-composite:xor] ![mask-composite:exclude] [background-image:var(--background-radial-gradient)] [background-size:200%_200%] [mask:var(--mask-linear-gradient)] animate-shine opacity-60`}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative z-10 w-full h-full rounded-[inherit] bg-inherit overflow-hidden">
        {children}
      </div>
    </div>
  );
}
