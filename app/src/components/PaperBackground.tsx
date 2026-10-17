/** @format */

import { Path, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { LINE_SPACING, MARGIN_X, RULE_TOP } from "@/lib/ink";
import type { Paper } from "@/lib/types";

const RULE_COLOR = "#C9DCF2";
const MARGIN_COLOR = "#F2B8B8";
const GRID_COLOR = "#E6E1D6";
const DOT_COLOR = "#CFC8B8";

/** Notebook paper drawn inside the Skia canvas. Not included in AI snapshots. */
export function PaperBackground({
	paper,
	width,
	height,
}: {
	paper: Paper;
	width: number;
	height: number;
}) {
	const paths = useMemo(() => {
		if (paper === "blank" || !width || !height) return null;
		const main = Skia.PathBuilder.Make();
		const margin = Skia.PathBuilder.Make();

		if (paper === "lined") {
			for (let y = RULE_TOP; y < height; y += LINE_SPACING) {
				main.moveTo(0, y);
				main.lineTo(width, y);
			}
			margin.moveTo(MARGIN_X, 0);
			margin.lineTo(MARGIN_X, height);
		} else if (paper === "grid") {
			for (let y = LINE_SPACING; y < height; y += LINE_SPACING) {
				main.moveTo(0, y);
				main.lineTo(width, y);
			}
			for (let x = LINE_SPACING; x < width; x += LINE_SPACING) {
				main.moveTo(x, 0);
				main.lineTo(x, height);
			}
		} else if (paper === "dots") {
			for (let y = LINE_SPACING; y < height; y += LINE_SPACING)
				for (let x = LINE_SPACING; x < width; x += LINE_SPACING)
					main.addCircle(x, y, 1.4);
		}
		return { main: main.detach(), margin: margin.detach() };
	}, [paper, width, height]);

	if (!paths) return null;
	return (
		<>
			{paper === "dots" ? (
				<Path path={paths.main} color={DOT_COLOR} />
			) : (
				<Path
					path={paths.main}
					color={paper === "grid" ? GRID_COLOR : RULE_COLOR}
					style="stroke"
					strokeWidth={1}
				/>
			)}
			{paper === "lined" && (
				<Path
					path={paths.margin}
					color={MARGIN_COLOR}
					style="stroke"
					strokeWidth={1.5}
				/>
			)}
		</>
	);
}
