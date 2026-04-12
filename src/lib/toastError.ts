import { toast } from "sonner";

const DEFAULT_DURATION = 6000;

function messageFromUnknown(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === "string") return err;
	try {
		return JSON.stringify(err);
	} catch {
		return String(err);
	}
}

/** Surface a failure in Sonner (works in dev and production; avoids relying on console). */
export function toastError(title: string, err?: unknown): void {
	if (err !== undefined) {
		toast.error(title, {
			description: messageFromUnknown(err),
			duration: DEFAULT_DURATION,
		});
	} else {
		toast.error(title, { duration: DEFAULT_DURATION });
	}
}

const lastToastAt = new Map<string, number>();

/** Same as toastError but at most once per `cooldownMs` per `key` (e.g. noisy PTY paths). */
export function toastErrorThrottled(
	key: string,
	title: string,
	err: unknown,
	cooldownMs = 4000,
): void {
	const now = Date.now();
	const last = lastToastAt.get(key) ?? 0;
	if (now - last < cooldownMs) return;
	lastToastAt.set(key, now);
	toastError(title, err);
}
