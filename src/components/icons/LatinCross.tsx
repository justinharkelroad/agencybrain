import React from 'react';

interface LatinCrossProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const LatinCross: React.FC<LatinCrossProps> = ({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  className = '',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2v20" />
    <path d="M7 7h10" />
  </svg>
);
