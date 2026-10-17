/** @format */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AgentPanel } from "@/components/AgentPanel";
import { InkCanvas } from "@/components/InkCanvas";
import {
	ColorMenu,
	MoreMenu,
	SideControls,
	TopBar,
	type Menu,
} from "@/components/Toolbar";
import { uid } from "@/lib/ink";
import { renderSelection } from "@/lib/snapshot";
import { useStore } from "@/lib/store";
import { C, R, shadow } from "@/lib/theme";
import type { Chip, Selection, Tool } from "@/lib/types";

const TOOL_KEYS: Record<string, Tool> = {
	p: "pen",
	h: "highlighter",
	e: "eraser",
	l: "lasso",
	t: "text",
};

export default function NoteScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const page = useStore((s) => s.pages[id]);
	const updatePage = useStore((s) => s.updatePage);
	const [selection, setSelection] = useState<Selection | null>(null);
	const [chips, setChips] = useState<Chip[]>([]);
	const [agentOpen, setAgentOpen] = useState(false);
	const [menu, setMenu] = useState<Menu>(null);

	// Keyboard shortcuts (web / tablets with a keyboard): Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, P H E L T, Esc
	useEffect(() => {
		if (Platform.OS !== "web" || !id) return;
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			)
				return;
			const { undoPage, redoPage, setTool } = useStore.getState();
			const mod = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();
			if (mod && key === "z") {
				e.preventDefault();
				if (e.shiftKey) redoPage(id);
				else undoPage(id);
			} else if (mod && key === "y") {
				e.preventDefault();
				redoPage(id);
			} else if (!mod && TOOL_KEYS[key]) {
				setTool(TOOL_KEYS[key]);
			} else if (key === "escape") {
				setSelection(null);
				setMenu(null);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [id]);

	if (!page) return <Text style={{ padding: 24 }}>Note not found.</Text>;

	function addSelectionToAI() {
		if (!selection) return;
		setChips([
			...chips,
			renderSelection(useStore.getState().pages[id], selection),
		]);
		setSelection(null);
		setAgentOpen(true);
	}

	async function addImage(source: "camera" | "library") {
		if (source === "camera") {
			const perm = await ImagePicker.requestCameraPermissionsAsync();
			if (!perm.granted) return;
		}
		const opts: ImagePicker.ImagePickerOptions = {
			mediaTypes: ["images"],
			base64: true,
			quality: 0.6,
		};
		const res =
			source === "camera"
				? await ImagePicker.launchCameraAsync(opts)
				: await ImagePicker.launchImageLibraryAsync(opts);
		const asset = res.canceled ? null : res.assets[0];
		if (!asset?.base64) return;
		const w = Math.min(480, asset.width);
		const h = (asset.height / asset.width) * w;
		updatePage(
			id,
			(p) => ({
				images: [
					...p.images,
					{ id: uid(), x: 40, y: 40, w, h, base64: asset.base64! },
				],
			}),
			true,
		);
	}

	return (
		<SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
			<Stack.Screen options={{ headerShown: false }} />
			<TopBar
				pageId={id}
				agentOpen={agentOpen}
				onToggleAgent={() => setAgentOpen(!agentOpen)}
				menu={menu}
				setMenu={setMenu}
			/>
			<View style={styles.body}>
				<View style={{ flex: 1 }}>
					<InkCanvas
						pageId={id}
						selection={selection}
						onSelectionChange={setSelection}
					/>
					<SideControls pageId={id} />
					{selection && (
						<Pressable
							style={[
								styles.askBtn,
								shadow,
								{
									left: Math.max(
										64,
										selection.bounds.x + selection.bounds.w - 150,
									),
									top: selection.bounds.y + selection.bounds.h + 20,
								},
							]}
							onPress={addSelectionToAI}
						>
							<MaterialCommunityIcons
								name="creation"
								size={16}
								color={C.onPrimary}
							/>
							<Text style={styles.askText}>Ask about this</Text>
						</Pressable>
					)}
				</View>
				{agentOpen && (
					<AgentPanel
						pageId={id}
						chips={chips}
						setChips={setChips}
						onClose={() => setAgentOpen(false)}
					/>
				)}
			</View>

			{menu && (
				<>
					<Pressable
						style={StyleSheet.absoluteFill}
						onPress={() => setMenu(null)}
					/>
					{menu === "color" ? (
						<ColorMenu />
					) : (
						<MoreMenu
							pageId={id}
							onAddImage={(src) => {
								setMenu(null);
								addImage(src);
							}}
						/>
					)}
				</>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: C.surface },
	body: { flex: 1, flexDirection: "row" },
	askBtn: {
		position: "absolute",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: C.primary,
		paddingHorizontal: 14,
		height: 38,
		borderRadius: R.pill,
	},
	askText: { color: C.onPrimary, fontWeight: "600", fontSize: 14 },
});
