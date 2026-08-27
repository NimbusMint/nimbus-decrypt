import type { ThemePreference } from '../types/theme';

function SunIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
];

/**
 * Light/dark switch for the header, left of the offline badge.
 *
 * A segmented control rather than a single on/off switch, matching nimbus-fe's
 * ThemeToggle: both states are always present, so the current theme is readable
 * at a glance instead of having to be inferred from an icon that means "what
 * you will get" in some products and "what you have" in others. The labels the
 * web version shows alongside the icons are dropped — the header is 46px and
 * already carries the window controls — so each button names itself through
 * its title and aria-label instead.
 *
 * The sliding thumb is one absolutely-positioned element that translates,
 * rather than a background swapped between the two buttons, so the movement
 * animates. It is aria-hidden — the state it indicates is already carried by
 * aria-checked on the buttons.
 */
export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: ThemePreference;
  onChange: (next: ThemePreference) => void;
}) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme">
      <span
        aria-hidden="true"
        className={`theme-toggle__thumb${theme === 'dark' ? ' theme-toggle__thumb--dark' : ''}`}
      />
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${option.label} theme`}
            title={`${option.label} theme`}
            onClick={() => onChange(option.value)}
            className={`theme-toggle__btn${selected ? ' theme-toggle__btn--selected' : ''}`}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
