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

/** Eight trapezoidal teeth standing on a circular body, hollow hub. The outline is generated
 * rather than hand-drawn -- teeth evenly spaced around the body arc at 8 teeth, body r=7.1,
 * outer r=10.2, tooth top/base 0.52/0.92 of the half-pitch -- so changing the tooth count or
 * depth later is a parameter change rather than a redraw. It replaces a ring of detached spokes
 * that read as a sun rather than a gear, which is also why the teeth meet the body here: the
 * silhouette has to survive at the 20px it's actually drawn at. */
export function GearIcon() {
  return (
    <svg {...commonProps} strokeWidth={1.7}>
      <path d="M9.49,5.36 L9.93,2.01 L14.07,2.01 L14.51,5.36 A7.1,7.1 0 0 1 14.92,5.53 L14.92,5.53 L17.60,3.47 L20.53,6.40 L18.47,9.08 A7.1,7.1 0 0 1 18.64,9.49 L18.64,9.49 L21.99,9.93 L21.99,14.07 L18.64,14.51 A7.1,7.1 0 0 1 18.47,14.92 L18.47,14.92 L20.53,17.60 L17.60,20.53 L14.92,18.47 A7.1,7.1 0 0 1 14.51,18.64 L14.51,18.64 L14.07,21.99 L9.93,21.99 L9.49,18.64 A7.1,7.1 0 0 1 9.08,18.47 L9.08,18.47 L6.40,20.53 L3.47,17.60 L5.53,14.92 A7.1,7.1 0 0 1 5.36,14.51 L5.36,14.51 L2.01,14.07 L2.01,9.93 L5.36,9.49 A7.1,7.1 0 0 1 5.53,9.08 L5.53,9.08 L3.47,6.40 L6.40,3.47 L9.08,5.53 A7.1,7.1 0 0 1 9.49,5.36 Z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  );
}
