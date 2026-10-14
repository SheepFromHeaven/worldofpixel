const KNOWN = new Set(['earth', 'water', 'fire', 'air', 'mud', 'clay-block', 'steam', 'spark']);

export function iconIdFor(resource: string | null | undefined): string {
  if (!resource) return 'ec-icon-dot';
  const slug = resource.toLowerCase().replace(/\s+/g, '-');
  if (KNOWN.has(slug)) return `ec-icon-${slug}`;
  return 'ec-icon-dot';
}

export function ElementIcon({
  resource,
  size = 15,
  color,
  className,
}: {
  resource: string | null | undefined;
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      className={className ? `ec-icon ${className}` : 'ec-icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      <use href={`#${iconIdFor(resource)}`} />
    </svg>
  );
}
