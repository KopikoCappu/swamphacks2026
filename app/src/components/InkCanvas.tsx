/** @format */

import {
	Canvas,
	Circle,
	DashPathEffect,
	Group,
	Image as SkiaImage,
	Path,
	Rect,
	Skia,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import {
	GestureDetector,
	PointerType,
	usePanGesture,
	usePinchGesture,
	useSimultaneousGestures,
} from "react-native-gesture-handler";
import Animated, {
	FadeIn,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";
import { MathView } from "@/components/MathView";
import { isDark, PaperBackground } from "@/components/PaperBackground";
import { annotationPath } from "@/lib/annotations";
import {
	buildPath,
	hitTest,
	IDENTITY,
	makeSelection,
	mapRect,
	mapX,
	mapY,
	mathBounds,
	rectContains,
	selectWithLasso,
	shapePoints,
	snapTextTop,
	strokePath,
	strokesHitAt,
	TEXT_LINE_HEIGHT,
	TEXT_SIZE,
	textBounds,
	textLineHeight,
	transformSelection,
	uid,
	type Transform,
} from "@/lib/ink";
import { skImageFor } from "@/lib/snapshot";
import { useStore } from "@/lib/store";
import { C } from "@/lib/theme";
import type {
	Annotation,
	Page,
	Point,
	Rect as PageRect,
	Selection,
	Stroke,
} from "@/lib/types";
import { clampZoom, toPage, zoomAt, type Viewport } from "@/lib/viewport";

type Props = {
	pageId: string;
	selection: Selection | null;
	onSelectionChange: (s: Selection | null) => void;
	viewport: Viewport;
	/** true while the selection is being moved/resized (hide the action bar meanwhile) */
	onTransformingChange?: (active: boolean) => void;
};

type Mode = "idle" | "draw" | "erase" | "pan" | "move" | "resize";

const SEL_PAD = 12; // page units of breathing room around a selection box
const padRect = (r: PageRect): PageRect => ({
	x: r.x - SEL_PAD,
	y: r.y - SEL_PAD,
	w: r.w + SEL_PAD * 2,
	h: r.h + SEL_PAD * 2,
});

export function InkCanvas({
	pageId,
	selection,
	onSelectionChange,
	viewport,
	onTransformingChange,
}: Props) {
	const page = useStore((s) => s.pages[pageId]);
	const tool = useStore((s) => s.tool);
	const color = useStore((s) => s.color);
	const highlighterColor = useStore((s) => s.highlighterColor);
	const sizes = useStore((s) => s.sizes);
	const shapeKind = useStore((s) => s.shapeKind);
	const updatePage = useStore((s) => s.updatePage);
	const [live, setLive] = useState<Point[]>([]);
	const [liveStylus, setLiveStylus] = useState(false);
	const [editingText, setEditingText] = useState<string | null>(null);
	const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
	const [eraserAt, setEraserAt] = useState<{ x: number; y: number } | null>(
		null,
	);
	/** live preview of a move/resize, committed to the page on release */
	const [xf, setXf] = useState<Transform | null>(null);
	const rootRef = useRef<ComponentRef<typeof View>>(null);

	// Gesture callbacks read from refs / getState() so they never see stale render values.
	const g = useRef({
		mode: "idle" as Mode,
		stylus: false,
		erasedOnce: false,
		points: [] as Point[],
		pan: { x: 0, y: 0, tx: 0, ty: 0 },
		tf: { x0: 0, y0: 0, ax: 0, ay: 0, w: 1, h: 1 },
		xf: IDENTITY,
	});
	const pinch0 = useRef({ active: false, s: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
	const onSelRef = useRef(onSelectionChange);
	const selRef = useRef(selection);
	const onXfRef = useRef(onTransformingChange);
	useEffect(() => {
		onSelRef.current = onSelectionChange;
		selRef.current = selection;
		onXfRef.current = onTransformingChange;
	}, [onSelectionChange, selection, onTransformingChange]);

	function setPreview(t: Transform | null) {
		g.current.xf = t ?? IDENTITY;
		setXf(t);
	}

	function cancelStroke() {
		if (g.current.mode === "move" || g.current.mode === "resize")
			onXfRef.current?.(false);
		g.current.mode = "idle";
		g.current.points = [];
		setLive([]);
		setEraserAt(null);
		setPreview(null);
	}

	const draw = usePanGesture({
		minDistance: 0,
		runOnJS: true,
		maxPointers: 1,
		onActivate: (e) => {
			if (pinch0.current.active) return;
			const { tool, penOnly } = useStore.getState();
			const isPen = e.pointerType === PointerType.STYLUS;
			g.current.stylus = isPen;
			g.current.erasedOnce = false;
			setLiveStylus(isPen);
			// Pen-only mode: fingers scroll the page instead of drawing (palm rejection).
			if (penOnly && !isPen) {
				g.current.mode = "pan";
				g.current.pan = {
					x: e.x,
					y: e.y,
					tx: viewport.tx.get(),
					ty: viewport.ty.get(),
				};
				return;
			}
			const [px, py] = toPage(viewport, e.x, e.y);

			// Lasso tool + existing selection: corner handle = resize, inside = move.
			const sel = selRef.current;
			if (tool === "lasso" && sel) {
				const b = padRect(sel.bounds);
				const tol = 22 / viewport.scale.get();
				const corners: [number, number][] = [
					[b.x, b.y],
					[b.x + b.w, b.y],
					[b.x, b.y + b.h],
					[b.x + b.w, b.y + b.h],
				];
				const ci = corners.findIndex(
					([cx, cy]) => Math.hypot(px - cx, py - cy) < tol,
				);
				if (ci >= 0) {
					const [ax, ay] = corners[3 - ci]; // the opposite corner stays put
					g.current.mode = "resize";
					g.current.tf = { x0: px, y0: py, ax, ay, w: b.w, h: b.h };
					setPreview({ ...IDENTITY, ax, ay });
					onXfRef.current?.(true);
					return;
				}
				if (rectContains(b, px, py)) {
					g.current.mode = "move";
					g.current.tf = { ...g.current.tf, x0: px, y0: py };
					setPreview(IDENTITY);
					onXfRef.current?.(true);
					return;
				}
			}
			if (tool !== "text") onSelRef.current(null);
			if (tool === "eraser") {
				g.current.mode = "erase";
				return erase(px, py);
			}
			g.current.mode = "draw";
			g.current.points = [[px, py, e.stylusData?.pressure ?? 0.5]];
			setLive(g.current.points);
		},
		onUpdate: (e) => {
			if (pinch0.current.active) return;
			const m = g.current.mode;
			if (m === "pan") {
				viewport.tx.set(g.current.pan.tx + e.x - g.current.pan.x);
				viewport.ty.set(g.current.pan.ty + e.y - g.current.pan.y);
				return;
			}
			const [px, py] = toPage(viewport, e.x, e.y);
			if (m === "move")
				return setPreview({
					...IDENTITY,
					dx: px - g.current.tf.x0,
					dy: py - g.current.tf.y0,
				});
			if (m === "resize") {
				const { ax, ay, w, h } = g.current.tf;
				const sc = Math.max(
					0.1,
					Math.max(Math.abs(px - ax) / w, Math.abs(py - ay) / h),
				);
				return setPreview({ ax, ay, s: sc, dx: 0, dy: 0 });
			}
			if (m === "erase") return erase(px, py);
			if (m !== "draw") return;
			const pt: Point = [px, py, e.stylusData?.pressure ?? 0.5];
			// Shapes only need the drag start + current point.
			g.current.points =
				useStore.getState().tool === "shape"
					? [g.current.points[0], pt]
					: [...g.current.points, pt];
			setLive(g.current.points);
		},
		onDeactivate: (e) => {
			const m = g.current.mode;
			const pts = g.current.points;
			const t = g.current.xf;
			cancelStroke();

			if ((m === "move" || m === "resize") && !e.canceled) {
				const sel = selRef.current;
				const moved =
					Math.abs(t.dx) + Math.abs(t.dy) > 0.5 || Math.abs(t.s - 1) > 0.005;
				if (sel && moved) {
					updatePage(pageId, (p) => transformSelection(p, sel, t), true); // one undo step
					onSelRef.current(
						makeSelection(useStore.getState().pages[pageId], sel),
					);
				}
				return;
			}
			if (m !== "draw" || e.canceled || !pts.length) return;

			const { tool, color, highlighterColor, sizes, shapeKind, pages } =
				useStore.getState();
			const page = pages[pageId];
			if (tool === "pen" || tool === "highlighter") {
				const stroke: Stroke = {
					id: uid(),
					tool,
					color: tool === "highlighter" ? highlighterColor : color,
					size: sizes[tool],
					points: pts,
					stylus: g.current.stylus,
				};
				updatePage(pageId, (p) => ({ strokes: [...p.strokes, stroke] }), true);
			} else if (tool === "shape") {
				const [a, b] = [pts[0], pts[pts.length - 1]];
				if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 3) return;
				const stroke: Stroke = {
					id: uid(),
					tool: "shape",
					color,
					size: sizes.pen,
					points: shapePoints(shapeKind, a[0], a[1], b[0], b[1], sizes.pen),
					stylus: false,
				};
				updatePage(pageId, (p) => ({ strokes: [...p.strokes, stroke] }), true);
			} else if (tool === "lasso") {
				// A tap (no real loop) selects the single object under the pen; a drag is a normal lasso.
				const xs = pts.map((p) => p[0]);
				const ys = pts.map((p) => p[1]);
				const extent =
					Math.max(
						Math.max(...xs) - Math.min(...xs),
						Math.max(...ys) - Math.min(...ys),
					) * viewport.scale.get();
				if (extent < 8)
					onSelRef.current(
						hitTest(page, pts[0][0], pts[0][1], 10 / viewport.scale.get()),
					);
				else
					onSelRef.current(
						selectWithLasso(
							pts,
							page.strokes,
							page.texts,
							page.images,
							page.maths,
						),
					);
			} else if (tool === "text") {
				const [x, y] = pts[0];
				const id = uid();
				// On ruled paper, snap typed text onto the nearest line.
				const top =
					(page.paper ?? "blank") === "blank"
						? y - TEXT_LINE_HEIGHT / 2
						: snapTextTop(y);
				updatePage(
					pageId,
					(p) => ({
						texts: [...p.texts, { id, x, y: top, width: 360, text: "" }],
					}),
					true,
				);
				setEditingText(id);
			}
		},
	});

	// Two fingers: pinch to zoom around the fingers, and move them to pan.
	const pinch = usePinchGesture({
		runOnJS: true,
		onActivate: (e) => {
			cancelStroke();
			pinch0.current = {
				active: true,
				s: viewport.scale.get(),
				tx: viewport.tx.get(),
				ty: viewport.ty.get(),
				fx: e.focalX,
				fy: e.focalY,
			};
		},
		onUpdate: (e) => {
			const p0 = pinch0.current;
			const s = clampZoom(p0.s * e.scale);
			const px = (p0.fx - p0.tx) / p0.s;
			const py = (p0.fy - p0.ty) / p0.s;
			viewport.scale.set(s);
			viewport.tx.set(e.focalX - px * s);
			viewport.ty.set(e.focalY - py * s);
		},
		onFinalize: () => {
			pinch0.current.active = false;
		},
	});

	const gesture = useSimultaneousGestures(draw, pinch);

	// Web: wheel/trackpad scrolls, Ctrl/Cmd+wheel (or trackpad pinch) zooms at the cursor.
	useEffect(() => {
		if (Platform.OS !== "web") return;
		const el = rootRef.current as unknown as HTMLElement | null;
		if (!el?.addEventListener) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const r = el.getBoundingClientRect();
			if (e.ctrlKey || e.metaKey)
				zoomAt(
					viewport,
					viewport.scale.get() * Math.exp(-e.deltaY * 0.01),
					e.clientX - r.left,
					e.clientY - r.top,
				);
			else {
				viewport.tx.set(viewport.tx.get() - e.deltaX);
				viewport.ty.set(viewport.ty.get() - e.deltaY);
			}
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [viewport]);

	function erase(x: number, y: number) {
		setEraserAt({ x, y });
		const { pages, sizes } = useStore.getState();
		const page = pages[pageId];
		if (!page) return;
		const hit = strokesHitAt(
			page.strokes,
			x,
			y,
			sizes.eraser / viewport.scale.get(),
		);
		// Typed text and equations are erased whole when the eraser touches them.
		const hitText = page.texts
			.filter((t) => rectContains(textBounds(t), x, y))
			.map((t) => t.id);
		const hitMath = (page.maths ?? [])
			.filter((m) => rectContains(mathBounds(m), x, y))
			.map((m) => m.id);
		if (!hit.length && !hitText.length && !hitMath.length) return;
		updatePage(
			pageId,
			(p) => ({
				strokes: p.strokes.filter((s) => !hit.includes(s.id)),
				texts: p.texts.filter((t) => !hitText.includes(t.id)),
				maths: (p.maths ?? []).filter((m) => !hitMath.includes(m.id)),
			}),
			!g.current.erasedOnce,
		);
		g.current.erasedOnce = true;
	}

	const livePath = useMemo(() => {
		if (!live.length || tool === "eraser" || tool === "text") return null;
		if (tool === "lasso") {
			const p = Skia.PathBuilder.Make();
			p.moveTo(live[0][0], live[0][1]);
			live.forEach(([x, y]) => p.lineTo(x, y));
			return p.detach();
		}
		if (tool === "shape") {
			const [a, b] = [live[0], live[live.length - 1]];
			return buildPath(
				shapePoints(shapeKind, a[0], a[1], b[0], b[1], sizes.pen),
				"shape",
				sizes.pen,
				false,
			);
		}
		return buildPath(live, tool, sizes[tool], liveStylus);
	}, [live, liveStylus, tool, sizes, shapeKind]);

	// Page -> screen transform for both the Skia layer and the RN overlays.
	const { scale, tx, ty } = viewport;
	const transform = useDerivedValue(() => [
		{ translateX: tx.get() },
		{ translateY: ty.get() },
		{ scale: scale.get() },
	]);
	const overlayStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: tx.get() },
			{ translateY: ty.get() },
			{ scale: scale.get() },
		],
	}));
	const eraserR = useDerivedValue(
		() => sizes.eraser / scale.get(),
		[sizes.eraser],
	);
	const hairline = useDerivedValue(() => 1.5 / scale.get());
	const handleR = useDerivedValue(() => 7 / scale.get()); // handles stay the same size on screen

	if (!page) return null;
	const bg = page.bg ?? "#FFFFFF";
	const textColor = isDark(bg) ? "#F2F2F2" : C.text;
	// While moving/resizing, selected items render through `xfTransform` instead of in place.
	const moving = !!(xf && selection);
	const selStrokes = new Set(moving ? selection!.strokeIds : []);
	const selImages = new Set(moving ? selection!.imageIds : []);
	const xfTransform = xf
		? [
				{ translateX: xf.ax + xf.dx },
				{ translateY: xf.ay + xf.dy },
				{ scale: xf.s },
				{ translateX: -xf.ax },
				{ translateY: -xf.ay },
			]
		: [];
	const selBox = selection
		? mapRect(xf ?? IDENTITY, padRect(selection.bounds))
		: null;
	const tFor = (ids: string[] | undefined, id: string) =>
		xf && ids?.includes(id) ? xf : IDENTITY;

	return (
		<View testID="ink-canvas-root"
			ref={rootRef}
			style={[styles.root, { backgroundColor: bg }]}
			onLayout={(e) => setCanvasSize(e.nativeEvent.layout)}
		>
			<GestureDetector gesture={gesture}>
				<View testID="ink-canvas-view" style={StyleSheet.absoluteFill} collapsable={false}>
					<Canvas style={StyleSheet.absoluteFill}>
						<Group transform={transform}>
							<PaperBackground
								paper={page.paper ?? "blank"}
								bg={bg}
								width={canvasSize.width}
								height={canvasSize.height}
								viewport={viewport}
							/>

							{page.images
								.filter((im) => !selImages.has(im.id))
								.map((im) => (
									<PageImageView key={im.id} im={im} />
								))}
							{page.strokes
								.filter((st) => !selStrokes.has(st.id))
								.map((st) => (
									<StrokeView key={st.id} s={st} />
								))}

							{moving && (
								<Group transform={xfTransform}>
									{page.images
										.filter((im) => selImages.has(im.id))
										.map((im) => (
											<PageImageView key={im.id} im={im} />
										))}
									{page.strokes
										.filter((st) => selStrokes.has(st.id))
										.map((st) => (
											<StrokeView key={st.id} s={st} />
										))}
								</Group>
							)}

							{livePath && tool === "lasso" && (
								<Path
									path={livePath}
									color={C.focus}
									style="stroke"
									strokeWidth={hairline}
								>
									<DashPathEffect intervals={[8, 6]} />
								</Path>
							)}
							{livePath && tool === "highlighter" && (
								<Path
									path={livePath}
									color={highlighterColor}
									opacity={0.35}
									style="stroke"
									strokeWidth={sizes.highlighter}
									strokeCap="round"
									strokeJoin="round"
								/>
							)}
							{livePath && tool === "shape" && (
								<Path
									path={livePath}
									color={color}
									style="stroke"
									strokeWidth={sizes.pen}
									strokeCap="round"
									strokeJoin="round"
								/>
							)}
							{livePath && tool === "pen" && (
								<Path path={livePath} color={color} />
							)}

							{eraserAt && tool === "eraser" && (
								<Circle
									cx={eraserAt.x}
									cy={eraserAt.y}
									r={eraserR}
									color={C.muted}
									style="stroke"
									strokeWidth={hairline}
								/>
							)}

							{selBox && (
								<>
									<Rect
										x={selBox.x}
										y={selBox.y}
										width={selBox.w}
										height={selBox.h}
										color={C.focus}
										style="stroke"
										strokeWidth={hairline}
									>
										<DashPathEffect intervals={[6, 5]} />
									</Rect>
									{tool === "lasso" &&
										[
											[selBox.x, selBox.y],
											[selBox.x + selBox.w, selBox.y],
											[selBox.x, selBox.y + selBox.h],
											[selBox.x + selBox.w, selBox.y + selBox.h],
										].map(([cx, cy], i) => (
											<Group key={i}>
												<Circle cx={cx} cy={cy} r={handleR} color="#FFFFFF" />
												<Circle
													cx={cx}
													cy={cy}
													r={handleR}
													color={C.focus}
													style="stroke"
													strokeWidth={hairline}
												/>
											</Group>
										))}
								</>
							)}

							{page.annotations.map((a) => (
								<AnnotationStroke key={a.id} a={a} />
							))}
						</Group>
					</Canvas>
				</View>
			</GestureDetector>

			{/* Typed text blocks: editable only with the text tool so drawing over them still works */}
			<Animated.View testID="ink-canvas-layer"
				style={[styles.layer, overlayStyle]}
				pointerEvents={tool === "text" ? "box-none" : "none"}
			>
				{page.texts.map((t) => (
					<TextInput testID="ink-canvas-text-block"
						key={t.id}
						value={t.text}
						multiline
						autoFocus={editingText === t.id}
						placeholder="Type…"
						placeholderTextColor={C.muted}
						onChangeText={(text) =>
							updatePage(pageId, (p) => ({
								texts: p.texts.map((x) => (x.id === t.id ? { ...x, text } : x)),
							}))
						}
						onBlur={() => {
							setEditingText(null);
							if (!t.text.trim())
								updatePage(pageId, (p) => ({
									texts: p.texts.filter((x) => x.id !== t.id),
								}));
						}}
						style={[
							styles.textBlock,
							textStyle(t, tFor(selection?.textIds, t.id), textColor),
							selection?.textIds.includes(t.id) && styles.textSelected,
						]}
					/>
				))}
			</Animated.View>

			{/* Equations (KaTeX on web). Their measured size feeds hit-testing, lasso and AI placement. */}
			<Animated.View testID="ink-canvas-layer" style={[styles.layer, overlayStyle]} pointerEvents="none">
				{(page.maths ?? []).map((m) => (
					<View testID="ink-canvas-math"
						key={m.id}
						style={[
							styles.math,
							{
								left: mapX(tFor(selection?.mathIds, m.id), m.x),
								top: mapY(tFor(selection?.mathIds, m.id), m.y),
							},
							selection?.mathIds.includes(m.id) && styles.textSelected,
						]}
						onLayout={(e) => {
							const { width, height } = e.nativeEvent.layout;
							if (
								!xf &&
								(Math.abs(width - m.w) > 2 || Math.abs(height - m.h) > 2)
							)
								updatePage(pageId, (p) => ({
									maths: (p.maths ?? []).map((x) =>
										x.id === m.id ? { ...x, w: width, h: height } : x,
									),
								}));
						}}
					>
						<MathView
							latex={m.latex}
							color={m.color ?? textColor}
							fontSize={(m.size ?? 24) * tFor(selection?.mathIds, m.id).s}
						/>
					</View>
				))}
			</Animated.View>

			{/* AI margin notes in handwriting font */}
			<Animated.View testID="ink-canvas-layer" style={[styles.layer, overlayStyle]} pointerEvents="none">
				{page.annotations
					.filter((a) => a.kind === "note" && a.text)
					.map((a) => (
						<AiNote key={a.id} a={a} />
					))}
			</Animated.View>
		</View>
	);
}

function StrokeView({ s }: { s: Stroke }) {
	if (s.tool === "pen") return <Path path={strokePath(s)} color={s.color} />;
	return (
		<Path
			path={strokePath(s)}
			color={s.color}
			opacity={s.tool === "highlighter" ? 0.35 : 1}
			style="stroke"
			strokeWidth={s.size}
			strokeCap="round"
			strokeJoin="round"
		/>
	);
}

function PageImageView({ im }: { im: Page["images"][number] }) {
	const sk = skImageFor(im);
	return sk ? (
		<SkiaImage
			image={sk}
			x={im.x}
			y={im.y}
			width={im.w}
			height={im.h}
			fit="fill"
		/>
	) : null;
}

/** Position + font size of a text block, through an optional live move/resize transform. */
function textStyle(t: Page["texts"][number], tt: Transform, color: string) {
	return {
		left: mapX(tt, t.x),
		top: mapY(tt, t.y),
		width: t.width * tt.s,
		fontSize: (t.size ?? TEXT_SIZE) * tt.s,
		lineHeight: textLineHeight(t) * tt.s,
		color: t.color ?? color,
	};
}

/** Delay (ms) before an annotation should start animating, or null if it's old and should just appear. */
function useAppearDelay(a: Annotation) {
	const [delay] = useState(() => {
		const age = Date.now() - a.createdAt;
		return age > 5000 ? null : Math.max(0, -age);
	});
	return delay;
}

/** AI ink that "draws itself" in with a stroke-trim animation. */
function AnnotationStroke({ a }: { a: Annotation }) {
	const path = useMemo(() => annotationPath(a), [a]);
	const delay = useAppearDelay(a);
	const end = useSharedValue(delay === null ? 1 : 0);
	useEffect(() => {
		if (delay !== null)
			end.set(withDelay(delay, withTiming(1, { duration: 700 })));
	}, [delay, end]);
	const fade = useDerivedValue(() => end.get() * 0.28);
	if (!path) return null;
	// Highlights fade in as a translucent fill; everything else "draws itself" with a stroke trim.
	if (a.kind === "highlight")
		return <Path path={path} color={a.color} opacity={fade} />;
	return (
		<Path
			path={path}
			color={a.color}
			style="stroke"
			strokeWidth={3.5}
			strokeCap="round"
			strokeJoin="round"
			end={end}
		/>
	);
}

/** AI margin note in a handwriting font. */
function AiNote({ a }: { a: Annotation }) {
	const delay = useAppearDelay(a);
	return (
		<Animated.Text testID="ink-canvas-note"
			entering={delay === null ? undefined : FadeIn.delay(delay).duration(600)}
			style={[
				styles.note,
				{
					left: a.rect.x,
					top: a.rect.y,
					maxWidth: Math.max(180, a.rect.w),
					color: a.color,
				},
			]}
		>
			{a.text}
		</Animated.Text>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, overflow: "hidden" },
	// Overlays share the canvas transform; origin top-left so page (0,0) maps like the Skia group.
	layer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		transformOrigin: "left top",
	},
	textBlock: {
		position: "absolute",
		paddingHorizontal: 4,
		paddingVertical: 0,
	},
	textSelected: { backgroundColor: "rgba(47,111,235,0.10)", borderRadius: 4 },
	note: {
		position: "absolute",
		fontFamily: "Caveat_600SemiBold",
		fontSize: 26,
		lineHeight: 28,
	},
	math: { position: "absolute", paddingHorizontal: 4, borderRadius: 4 },
});
