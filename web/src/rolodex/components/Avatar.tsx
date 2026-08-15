import { avatarColor, initials } from "../format";

export function Avatar({
  name,
  photo,
  size = "",
  title,
}: {
  name: string;
  photo?: string | null;
  size?: "" | "sm" | "lg" | "xl";
  title?: string;
}) {
  const cls = size ? `avatar avatar-${size}` : "avatar";
  if (photo)
    return (
      <div
        className={cls}
        title={title ?? name}
        style={{ backgroundImage: `url(${photo})` }}
      />
    );
  return (
    <div
      className={cls}
      title={title ?? name}
      style={{ background: avatarColor(name) }}
    >
      {initials(name)}
    </div>
  );
}
