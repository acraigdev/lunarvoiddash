import { Nullable } from '@/lib/typeHelpers';

interface BadgeInfo {
  initial: string;
  color: string;
}

function Badge({ initial, color }: BadgeInfo) {
  return (
    <div
      className="w-4 h-4 text-xs absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center text-white font-bold border border-black/20"
      style={{
        backgroundColor: color,
      }}
    >
      {initial}
    </div>
  );
}

interface UserAvatarProps {
  email: string;
  displayName?: string;
  photoUrl?: string;
  badge?: Nullable<BadgeInfo>;
  borderColor?: Nullable<string>;
}

export function UserAvatar({
  email,
  displayName,
  photoUrl,
  badge,
  borderColor,
}: UserAvatarProps) {
  const avatar = photoUrl ? (
    <img
      src={photoUrl}
      alt={displayName ?? email}
      className={`rounded-full object-cover shrink-0 w-8 h-8 border-2`}
      style={{
        borderColor: borderColor ? borderColor : 'transparent',
      }}
      referrerPolicy="no-referrer"
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white font-medium w-8 h-8 bg-fuchsia-950"
      title={displayName ?? email}
    >
      {displayName?.[0] ?? email[0]}
    </div>
  );

  if (!badge) return avatar;

  return (
    <div className="relative shrink-0 w-8 h-8">
      {avatar}
      <Badge initial={badge.initial} color={badge.color} />
    </div>
  );
}
