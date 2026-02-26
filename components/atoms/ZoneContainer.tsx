import { Maybe } from '@/lib/typeHelpers';
import { ReactNode, Ref } from 'react';

interface ZoneContainerProps {
  children: ReactNode;
  isFocused?: boolean;
  isActive?: boolean;
  className?: string;
  ref?: Maybe<Ref<HTMLDivElement>>;
}

export function ZoneContainer({
  children,
  isFocused,
  isActive,
  className,
  ref,
}: ZoneContainerProps) {
  const widgetClass =
    'text-white rounded-xl bg-black/30 backdrop-blur-xs max-h-full overflow-hidden transition-all' +
    (isActive
      ? ' outline outline-2 outline-white/60'
      : isFocused
        ? ' outline outline-2 outline-white/30'
        : '') +
    (className ? ` ${className}` : '');
  return (
    <div tabIndex={0} className={widgetClass}>
      <div ref={ref} className="px-5 py-4 overflow-y-auto max-h-full">
        {children}
      </div>
    </div>
  );
}
