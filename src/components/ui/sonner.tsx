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
					"--width": "420px",
					fontFamily: "'Geist Mono Variable', 'GeistMono', monospace",
					fontSize: "11px",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
