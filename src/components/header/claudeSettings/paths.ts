/** Path segments under `rootDir` for the breadcrumb above the file preview. */
export function relativeParts(filePath: string, rootDir: string): string[] {
	const rel = filePath.startsWith(rootDir + "/")
		? filePath.slice(rootDir.length + 1)
		: filePath;
	return rel.split("/").filter(Boolean);
}
