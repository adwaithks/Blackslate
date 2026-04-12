// Split a file path into breadcrumb pieces after stripping the project/skill root.
export function relativeParts(filePath: string, rootDir: string): string[] {
	const rel = filePath.startsWith(rootDir + "/")
		? filePath.slice(rootDir.length + 1)
		: filePath;
	return rel.split("/").filter(Boolean);
}
