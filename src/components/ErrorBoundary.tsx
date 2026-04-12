import { Component, type ErrorInfo, type ReactNode } from "react";
import { LuRefreshCw } from "react-icons/lu";

import { Button } from "@/components/ui/button";

type Props = {
	children: ReactNode;
};

type State = {
	error: Error | null;
	errorInfo: ErrorInfo | null;
};

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null, errorInfo: null };

	static getDerivedStateFromError(error: Error): Partial<State> {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error("ErrorBoundary caught:", error, errorInfo);
		this.setState({ errorInfo });
	}

	private handleRetry = (): void => {
		this.setState({ error: null, errorInfo: null });
	};

	render(): ReactNode {
		const { error, errorInfo } = this.state;
		if (error) {
			const showStack =
				import.meta.env.DEV && errorInfo?.componentStack != null;
			return (
				<div className="flex h-screen min-h-0 w-screen flex-col items-center justify-center gap-6 bg-background p-6 text-foreground">
					<div className="flex max-w-lg flex-col gap-3 text-center">
						<h1 className="text-lg font-semibold tracking-tight">
							Something went wrong
						</h1>
						<p className="text-muted-foreground text-sm leading-relaxed">
							The app hit an unexpected error. Try again with the button below.
						</p>
						<p className="font-mono text-destructive text-xs break-all">
							{error.message}
						</p>
						{showStack ? (
							<pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-left font-mono text-[11px] leading-snug whitespace-pre-wrap text-muted-foreground">
								{errorInfo.componentStack}
							</pre>
						) : null}
					</div>
					<Button type="button" variant="default" onClick={this.handleRetry}>
						<LuRefreshCw className="size-3" aria-hidden />
						Try again
					</Button>
				</div>
			);
		}

		return this.props.children;
	}
}
