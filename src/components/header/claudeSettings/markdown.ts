// Remove the --- header block at the top of markdown so the preview shows body text only.
export function stripFrontmatter(content: string): string {
	if (!content.startsWith("---")) return content;
	const rest = content.slice(3);
	const end = rest.indexOf("\n---");
	if (end === -1) return content;
	return rest.slice(end + 4).trimStart();
}
