// A figure with its cents, or a dash for a figure that does not exist yet.
export function Amount({ value }: { value?: string }) {
 return value ? <span>{value}</span> : <span className="none"><span aria-hidden="true">—</span><span className="sr">none</span></span>
}
