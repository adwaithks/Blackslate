/** Strip YAML frontmatter (---…---) from markdown content before showing in the preview. */
export function stripFrontmatter(content: string): string {
	if (!content.startsWith("---")) return content;
	const rest = content.slice(3);
	const end = rest.indexOf("\n---");
	if (end === -1) return content;
	return rest.slice(end + 4).trimStart();
}
