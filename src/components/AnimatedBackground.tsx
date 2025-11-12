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

      {/* Light sweep flare - reduced on prefers-reduced-motion */}
      <div className="absolute inset-0 motion-reduce:hidden">
        {/* Light sweep flare */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient( -35deg, hsl(var(--primary)/0) 20%, hsl(var(--primary)/0.14) 50%, hsl(var(--primary)/0) 80% )",
            maskImage: "radial-gradient(70% 50% at 50% 40%, black 40%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(70% 50% at 50% 40%, black 40%, transparent 100%)",
            animation: "lightSweep 12s linear infinite",
          }}
        />
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
