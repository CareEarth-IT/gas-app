import { formatStaffLabel, getStaffDisplayName } from "../lib/staffNames";

type Props = {
  email: string | null | undefined;
  nameMap: Map<string, string>;
  emptyLabel?: string;
  showEmailWhenNamed?: boolean;
  className?: string;
};

export function StaffNameText({
  email,
  nameMap,
  emptyLabel = "空き",
  showEmailWhenNamed = true,
  className = ""
}: Props) {
  if (!email?.trim()) {
    return <span className={className}>{emptyLabel}</span>;
  }

  const displayName = getStaffDisplayName(email, nameMap);
  const normalizedEmail = email.trim();

  if (displayName) {
    return (
      <span className={className}>
        <span className="font-medium">{displayName}</span>
        {showEmailWhenNamed && (
          <span className="block text-[11px] text-text-muted font-normal mt-0.5 break-all">
            {normalizedEmail}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={`${className} break-all`}>
      {formatStaffLabel(email, nameMap, emptyLabel)}
    </span>
  );
}
