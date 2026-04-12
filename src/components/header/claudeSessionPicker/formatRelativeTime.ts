// "3h ago" style text from a stored time string (for the session list).
export function formatRelativeTime(isoTimestamp: string): string {
	const now = Date.now();
	const then = new Date(isoTimestamp).getTime();
	if (Number.isNaN(then)) return "";
	const diffMs = now - then;
	const diffSec = Math.floor(diffMs / 1000);
	if (diffSec < 60) return "just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDay = Math.floor(diffHr / 24);
	if (diffDay < 7) return `${diffDay}d ago`;
	return new Date(isoTimestamp).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}
