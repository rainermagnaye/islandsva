/**
 * A small trend line for a StatCard. Decorative to sight but summarised for screen readers: pass `summary`
 * ("Up from 18 to 34 over 6 weeks") or it is built from the first and last values.
 */
export function Sparkline({ data, labels, format = String, summary }: { data: readonly number[]; labels?: readonly string[]; format?: (value: number) => string; summary?: string }) {
  if (data.length < 2) return null;
  const width = 120;
  const height = 32;
  const min = Math.min(...data);
  const span = Math.max(...data) - min || 1;
  const points = data.map((value, i) => [(i / (data.length - 1)) * width, height - 2 - ((value - min) / span) * (height - 4)] as const);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  const text =
    summary ??
    `${labels?.[0] ? `${labels[0]}: ` : ""}${format(data[0])}, ${labels?.at(-1) ? `${labels.at(-1)}: ` : "now "}${format(data[data.length - 1])}`;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" className="overflow-visible text-action-secondary">
        <path d={`${path} L${width} ${height} L0 ${height} Z`} className="fill-current opacity-10" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r={3} className="fill-current" />
      </svg>
      <figcaption className="sr-only">{text}</figcaption>
    </figure>
  );
}
