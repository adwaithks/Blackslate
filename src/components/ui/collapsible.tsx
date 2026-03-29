import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { cn } from "@/lib/utils";

function Collapsible({
	className,
	...props
}: CollapsiblePrimitive.Root.Props) {
	return (
		<CollapsiblePrimitive.Root
			data-slot="collapsible"
			className={cn(className)}
			{...props}
		/>
	);
}

function CollapsibleTrigger({
	className,
	...props
}: CollapsiblePrimitive.Trigger.Props) {
	return (
		<CollapsiblePrimitive.Trigger
			data-slot="collapsible-trigger"
			className={cn(
				"cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

function CollapsibleContent({
	className,
	...props
}: CollapsiblePrimitive.Panel.Props) {
	return (
		<CollapsiblePrimitive.Panel
			data-slot="collapsible-content"
			className={cn("overflow-hidden outline-none", className)}
			{...props}
		/>
	);
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
