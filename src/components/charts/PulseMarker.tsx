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
  coreRadius = 3.2,
  pulseRadius = 10,
}: PulseMarkerProps) {
  if (cx === undefined || cy === undefined) return null;

  return (
    <g>
      <circle cx={cx} cy={cy} r={coreRadius} fill={color} fillOpacity={0.25}>
        <animate
          attributeName="r"
          values={`${coreRadius};${pulseRadius};${coreRadius}`}
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.75;0;0.75"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={cx} cy={cy} r={coreRadius} fill={color} />
    </g>
  );
}
