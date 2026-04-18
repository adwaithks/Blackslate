import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { useApplyAppTheme } from "@/hooks/app/useApplyAppTheme";
import { useAppConfigStore, appThemeValue } from "@/store/appConfig";

export default function App() {
	const appTheme = useAppConfigStore((s) => s.appTheme);
	useApplyAppTheme(appThemeValue(appTheme));

	return (
		<>
			<ErrorBoundary>
				<AppLayout />
			</ErrorBoundary>
			<Toaster position="top-center" />
		</>
	);
}
