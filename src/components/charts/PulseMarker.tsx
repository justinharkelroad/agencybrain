interface PulseMarkerProps {
  cx?: number;
  cy?: number;
  color: string;
  coreRadius?: number;
  pulseRadius?: number;
}

export function PulseMarker({
  cx,
  cy,
  color,
  coreRadius = 4,
  pulseRadius = 14,
}: PulseMarkerProps) {
  if (cx === undefined || cy === undefined) return null;

  return (
    <g>
      <circle cx={cx} cy={cy} r={coreRadius} fill={color} fillOpacity={0.35}>
        <animate
          attributeName="r"
          values={`${coreRadius};${pulseRadius};${coreRadius}`}
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.9;0;0.9"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={cx} cy={cy} r={coreRadius + 1.8} fill={color} fillOpacity={0.18} />
      <circle cx={cx} cy={cy} r={coreRadius} fill={color} />
    </g>
  );
}
