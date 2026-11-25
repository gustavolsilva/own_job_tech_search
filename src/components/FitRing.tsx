"use client";

export function FitRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    clamped >= 75
      ? "#34d399"
      : clamped >= 55
        ? "#fbbf24"
        : "#fb7185";

  const textColor =
    clamped >= 75
      ? "text-emerald-300"
      : clamped >= 55
        ? "text-amber-300"
        : "text-rose-300";

  return (
    <div className="relative h-14 w-14 flex items-center justify-center shrink-0">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className={`absolute text-xs font-bold ${textColor}`}>
        {clamped}%
      </div>
    </div>
  );
}

