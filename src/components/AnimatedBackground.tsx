import React from "react";

export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 -z-0 pointer-events-none" aria-hidden="true">
      {/* Soft base gradient using design tokens */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% 15%, hsl(var(--primary) / 0.25), transparent 60%)," +
            "radial-gradient(1000px 500px at 90% 20%, hsl(var(--accent) / 0.20), transparent 60%)," +
            "radial-gradient(900px 500px at 20% 85%, hsl(var(--secondary) / 0.18), transparent 55%)",
          filter: "blur(8px)",
        }}
      />

      {/* Subtle vignette for contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 800px at 50% 30%, transparent, hsl(var(--background) / 0.1))," +
            "linear-gradient(to bottom, hsl(var(--background) / 0.5), hsl(var(--background) / 0.85))",
        }}
      />

      {/* Floating brain elements - reduced on prefers-reduced-motion */}
      <div className="absolute inset-0 motion-reduce:hidden">
        <span
          role="img"
          aria-hidden="true"
          className="absolute top-[18%] left-[12%] text-5xl sm:text-6xl opacity-40 drop-shadow"
          style={{ animation: "floatDrift 12s ease-in-out infinite" }}
        >
          🧠
        </span>
        <span
          role="img"
          aria-hidden="true"
          className="absolute top-[50%] right-[18%] text-6xl sm:text-7xl opacity-35 drop-shadow"
          style={{ animation: "floatDrift 14s ease-in-out infinite", animationDelay: "-3s" }}
        >
          🧠
        </span>
        <span
          role="img"
          aria-hidden="true"
          className="absolute bottom-[14%] left-[35%] text-4xl sm:text-5xl opacity-30 drop-shadow"
          style={{ animation: "floatDrift 16s ease-in-out infinite", animationDelay: "-6s" }}
        >
          🧠
        </span>
      </div>

      {/* Very subtle grid for depth */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--foreground) / 0.12) 1px, transparent 1px)," +
            "linear-gradient(to bottom, hsl(var(--foreground) / 0.12) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(60% 40% at 50% 40%, black 60%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(60% 40% at 50% 40%, black 60%, transparent 100%)",
        }}
      />
    </div>
  );
}

export default AnimatedBackground;
