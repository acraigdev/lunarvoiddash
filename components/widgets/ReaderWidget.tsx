'use client';

interface Props {
  url: string | null;
  fallbackTitle: string | null;
  isFocused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  className?: string;
}

export function ReaderWidget({
  url,
  isFocused,
  isActive,
  onActivate,
  className,
}: Props) {
  const wrapperClass =
    'text-white rounded-xl bg-gray-dark/50 backdrop-blur-xs max-h-full overflow-hidden transition-all relative outline-offset-[-2px]' +
    (onActivate ? ' hover:outline hover:outline-2 hover:outline-white/30' : '') +
    (isActive
      ? ' outline outline-2 outline-white/60'
      : isFocused
        ? ' outline outline-2 outline-white/30'
        : '') +
    (className ? ` ${className}` : '');

  if (!url) {
    return (
      <div className={wrapperClass} onClick={onActivate}>
        <div className="flex items-center justify-center h-full min-h-40 px-5 py-4">
          <p className="text-sm opacity-40">Select a link to read</p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} onClick={onActivate}>
      <iframe
        src={`/api/proxy?url=${encodeURIComponent(url)}`}
        title="Reader"
        className="w-full h-full rounded-xl"
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
    </div>
  );
}
