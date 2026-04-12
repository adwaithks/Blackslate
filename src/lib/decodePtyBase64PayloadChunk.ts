// Backend sends each piece of shell output as base64; turn it into a text string for xterm.
// Decoder "streaming" mode keeps multi-byte characters correct when one emoji is split across two packets.
export function decodePtyBase64PayloadChunk(
	decoder: TextDecoder,
	base64Payload: string,
): string {
	const raw = atob(base64Payload);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return decoder.decode(bytes, { stream: true });
}
