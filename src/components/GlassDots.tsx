import React from "react";

export function GlassDots() {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="w-3 h-3 bg-foreground/30 rounded-full backdrop-blur-md shadow-elegant animate-pulse"></div>
      <div className="w-3 h-3 bg-foreground/30 rounded-full backdrop-blur-md shadow-elegant animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      <div className="w-3 h-3 bg-foreground/30 rounded-full backdrop-blur-md shadow-elegant animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </div>
  );
}

export default GlassDots;
