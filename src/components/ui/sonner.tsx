import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useIsLightTheme } from "@/hooks/app/useIsLightTheme";

const Toaster = ({ ...props }: ToasterProps) => {
	const isLight = useIsLightTheme();

	return (
		<Sonner
			theme={isLight ? "light" : "dark"}
			className="toaster group"
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
					"--width": "420px", // acts as max-width; individual toasts override to fit-content below
					fontFamily: "'Geist Mono Variable', 'GeistMono', monospace",
					fontSize: "11px",
				} as React.CSSProperties
			}
			toastOptions={{
				style: {
					width: "fit-content",
					maxWidth: "420px",
					marginInline: "auto",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
