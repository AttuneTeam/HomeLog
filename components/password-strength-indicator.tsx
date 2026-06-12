"use client";

const CRITERIA = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number (0–9)", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const LEVELS = [
  { label: "Weak", color: "#ba1a1a" },
  { label: "Fair", color: "#d95f00" },
  { label: "Good", color: "#a67c00" },
  { label: "Strong", color: "#186832" },
];

function getLevel(password: string) {
  const met = CRITERIA.filter((c) => c.test(password)).length;
  if (met <= 1) return 0;
  if (met === 2) return 1;
  if (met === 3) return 2;
  return 3;
}

interface Props {
  password: string;
}

export function PasswordStrengthIndicator({ password }: Props) {
  if (!password) return null;

  const level = getLevel(password);
  const { label, color } = LEVELS[level];

  return (
    <div
      className="absolute left-0 right-0 z-20 rounded-md border p-3 shadow-md space-y-2 hidden group-focus-within:block"
      style={{
        bottom: "calc(100% + 4px)",
        backgroundColor: "var(--background, #fbf9f9)",
        borderColor: "var(--border, #e5e5e5)",
      }}
    >
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {LEVELS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-colors duration-300"
              style={{ backgroundColor: i <= level ? color : "#e5e5e5" }}
            />
          ))}
        </div>
        <span className="text-xs font-medium w-10 text-right" style={{ color }}>
          {label}
        </span>
      </div>

      {/* Criteria checklist */}
      <ul className="space-y-0.5">
        {CRITERIA.map((c) => {
          const met = c.test(password);
          return (
            <li key={c.label} className="flex items-center gap-1.5">
              <span
                className="text-xs leading-none"
                style={{ color: met ? "#186832" : "#a0a0a0" }}
              >
                {met ? "✓" : "×"}
              </span>
              <span
                className="text-xs"
                style={{ color: met ? "#186832" : "#a0a0a0" }}
              >
                {c.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
