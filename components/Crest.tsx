/** The Wins Pool's brand mark -- an outline shield with a bold W, matching app/icon.svg. Kept
 * as inline JSX (not an <img src="/icon.svg">) so callers can size and recolor it freely. */
export function Crest({ size = 24, color = "var(--color-accent)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 3.6 L12 1.4 L20 3.6 L20 11.2 C20 16.9 16.4 20.9 12 22.9 C7.6 20.9 4 16.9 4 11.2 Z"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5.3 7.4 L8.7 16.8 L12 9.6 L15.3 16.8 L18.7 7.4"
        stroke={color}
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
