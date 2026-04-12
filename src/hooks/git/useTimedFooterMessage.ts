import { useEffect, useState } from "react";

const CLEAR_MS = 2800;

// Short message under the git toolbar that clears itself (errors, "already added", etc.).
export function useTimedFooterMessage() {
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		if (!message) return;
		const t = window.setTimeout(() => setMessage(null), CLEAR_MS);
		return () => clearTimeout(t);
	}, [message]);

	return [message, setMessage] as const;
}
