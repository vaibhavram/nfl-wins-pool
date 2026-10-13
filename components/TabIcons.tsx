const commonProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PodiumIcon() {
  return (
    <svg {...commonProps}>
      <path d="M4 21V13H9V21" />
      <path d="M9 21V9H15V21" />
      <path d="M15 21V15H20V21" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg {...commonProps}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
      <path d="M3.5 9.5H20.5" />
      <path d="M8 3V6.5" />
      <path d="M16 3V6.5" />
    </svg>
  );
}

export function FootballIcon() {
  return (
    <svg {...commonProps}>
      <g transform="rotate(-38 12 12)">
        <ellipse cx="12" cy="12" rx="8.5" ry="5" />
        <path d="M6.5 12H17.5" />
        <path d="M9.5 10.3V13.7" />
        <path d="M12 10.3V13.7" />
        <path d="M14.5 10.3V13.7" />
      </g>
    </svg>
  );
}

export function DraftResultsIcon() {
  return (
    <svg {...commonProps}>
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <path d="M9 4.5V3.3C9 2.6 9.6 2 10.3 2H13.7C14.4 2 15 2.6 15 3.3V4.5" />
      <path d="M8.5 10H15.5" />
      <path d="M8.5 13.5H15.5" />
      <path d="M8.5 17H12.5" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg {...commonProps}>
      <path d="M3.5 8.5H6L7.5 6H16.5L18 8.5H20.5V19H3.5V8.5Z" />
      <circle cx="12" cy="13.5" r="3.4" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg {...commonProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5V6M12 18V20.5M20.5 12H18M6 12H3.5M18.01 6L16.25 7.76M7.75 16.25L5.99 18.01M18.01 18.01L16.25 16.25M7.75 7.75L5.99 5.99" />
    </svg>
  );
}
