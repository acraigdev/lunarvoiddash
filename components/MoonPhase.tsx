import React from 'react';

export const MoonPhases = {
  NEW_MOON: 'rounded-full left-0',
  WAXING_CRESCENT: 'rounded-full right-1/5',
  FIRST_QUARTER: 'rounded-l-none right-1/2',
  WAXING_GIBBOUS:
    'rounded-full !bg-transparent !opacity-100 shadow-[0_0_0_999px_rgba(0,0,0,0.7)] left-[30%]',
  FULL_MOON: 'hidden',
  WANING_GIBBOUS:
    'rounded-full !bg-transparent !opacity-100 shadow-[0_0_0_999px_rgba(0,0,0,0.7)] right-[30%]',
  LAST_QUARTER: 'rounded-r-none left-1/2',
  WANING_CRESCENT: 'rounded-full left-1/5',
} as const;

interface MoonPhaseProps {
  phase: keyof typeof MoonPhases;
}

export function MoonPhase({ phase }: MoonPhaseProps) {
  return (
    <div className="bg-[url(/moon.png)] bg-cover size-11 relative overflow-hidden rounded-full inline-block">
      <div
        className={`size-11 opacity-70 bg-black absolute ${MoonPhases[phase]}`}
      ></div>
    </div>
  );
}
