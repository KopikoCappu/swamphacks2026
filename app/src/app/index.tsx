/** @format */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import {
	FlatList,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NoteThumb } from "@/components/NoteThumb";
import { IconBtn } from "@/components/Toolbar";
import { useStore } from "@/lib/store";
import { C, R, shadow } from "@/lib/theme";
import type { Folder, Page } from "@/lib/types";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
const ALL = "__all__";

export default function NotesHome() {
	const pages = useStore((s) => s.pages);
	const folders = useStore((s) => s.folders);
	const { createPage, createFolder } = useStore.getState();
	const [selected, setCurrent] = useState<string>(ALL);
	const [renaming, setRenaming] = useState<string | null>(null);
	const [cardMenu, setCardMenu] = useState<string | null>(null);
	const [mainWidth, setMainWidth] = useState(0);

	// If the open folder was deleted, fall back to All notes.
	const current = selected !== ALL && folders[selected] ? selected : ALL;
	const folderList = Object.values(folders).sort(
		(a, b) => a.createdAt - b.createdAt,
	);
	const inFolder =
		current === ALL
			? Object.values(pages)
			: Object.values(pages).filter((p) => p.folderId === current);
	const list = inFolder.sort((a, b) => b.updatedAt - a.updatedAt);
	const cols = Math.max(2, Math.floor((mainWidth - 64) / 220));
	const heading =
		current === ALL ? "All notes" : (folders[current]?.name ?? "All notes");

	function newFolder() {
		const id = createFolder();
		setCurrent(id);
		setRenaming(id);
	}

	return (
		<SafeAreaView testID="notes-home-root" style={styles.root}>
			<Stack.Screen options={{ headerShown: false }} />
			<View testID="notes-home-sidebar" style={styles.sidebar}>
				<Text testID="notes-home-brand" style={styles.brand}>InkBuddy</Text>
				<ScrollView testID="notes-home-scroll-view" contentContainerStyle={{ gap: 2 }}>
					<SideItem
						icon="note-multiple-outline"
						label="All notes"
						count={Object.keys(pages).length}
						active={current === ALL}
						onPress={() => setCurrent(ALL)}
					/>
					<Text testID="notes-home-side-label" style={styles.sideLabel}>Folders</Text>
					{folderList.map((f) => (
						<FolderItem
							key={f.id}
							folder={f}
							count={
								Object.values(pages).filter((p) => p.folderId === f.id).length
							}
							active={current === f.id}
							renaming={renaming === f.id}
							onPress={() => setCurrent(f.id)}
							onRename={() => setRenaming(f.id)}
							onDoneRename={() => setRenaming(null)}
						/>
					))}
					<Pressable testID="notes-home-side-item"
						onPress={newFolder}
						style={({ pressed }) => [
							styles.sideItem,
							pressed && { backgroundColor: C.selected },
						]}
					>
						<MaterialCommunityIcons
							name="folder-plus-outline"
							size={18}
							color={C.muted}
						/>
						<Text testID="notes-home-side-text" style={[styles.sideText, { color: C.muted }]}>
							New folder
						</Text>
					</Pressable>
				</ScrollView>
			</View>

			<View testID="notes-home-main"
				style={styles.main}
				onLayout={(e) => setMainWidth(e.nativeEvent.layout.width)}
			>
				<View testID="notes-home-header" style={styles.header}>
					<Text testID="notes-home-h1" style={styles.h1} numberOfLines={1}>
						{heading}
					</Text>
					<Pressable testID="notes-home-new-btn"
						style={styles.newBtn}
						onPress={() =>
							router.push(
								`/note/${createPage(current === ALL ? null : current)}`,
							)
						}
					>
						<MaterialCommunityIcons name="plus" size={18} color={C.onPrimary} />
						<Text testID="notes-home-new-text" style={styles.newText}>New note</Text>
					</Pressable>
				</View>

				{mainWidth > 0 && (
					<FlatList testID="notes-home-flat-list"
						data={list}
						key={`cols-${cols}`}
						numColumns={cols}
						keyExtractor={(p) => p.id}
						columnWrapperStyle={{ gap: 20 }}
						contentContainerStyle={{
							gap: 24,
							paddingHorizontal: 32,
							paddingBottom: 48,
						}}
						ListEmptyComponent={
							<Text testID="notes-home-empty" style={styles.empty}>
								{current === ALL ? "No notes yet." : "This folder is empty."}
							</Text>
						}
						renderItem={({ item }) => (
							<NoteCard
								page={item}
								width={(mainWidth - 64 - 20 * (cols - 1)) / cols}
								folders={folderList}
								menuOpen={cardMenu === item.id}
								setMenuOpen={(o) => setCardMenu(o ? item.id : null)}
							/>
						)}
					/>
				)}
			</View>
		</SafeAreaView>
	);
}

function SideItem({
	icon,
	label,
	count,
	active,
	onPress,
}: {
	icon: IconName;
	label: string;
	count: number;
	active: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable testID="notes-home-side-item"
			onPress={onPress}
			style={({ pressed }) => [
				styles.sideItem,
				(active || pressed) && { backgroundColor: C.selected },
			]}
		>
			<MaterialCommunityIcons
				name={icon}
				size={18}
				color={active ? C.text : C.icon}
			/>
			<Text testID="notes-home-side-text"
				style={[styles.sideText, active && { fontWeight: "600" }]}
				numberOfLines={1}
			>
				{label}
			</Text>
			<Text testID="notes-home-count" style={styles.count}>{count}</Text>
		</Pressable>
	);
}

type FolderItemProps = {
	folder: Folder;
	count: number;
	active: boolean;
	renaming: boolean;
	onPress: () => void;
	onRename: () => void;
	onDoneRename: () => void;
};

function FolderItem({
	folder,
	count,
	active,
	renaming,
	onPress,
	onRename,
	onDoneRename,
}: FolderItemProps) {
	const { renameFolder, deleteFolder } = useStore.getState();
	const [name, setName] = useState(folder.name);
	const [confirm, setConfirm] = useState(false);
	useEffect(() => {
		if (!confirm) return;
		const t = setTimeout(() => setConfirm(false), 3000);
		return () => clearTimeout(t);
	}, [confirm]);

	if (renaming) {
		return (
			<View testID="notes-home-side-item" style={[styles.sideItem, { backgroundColor: C.selected }]}>
				<MaterialCommunityIcons
					name="folder-outline"
					size={18}
					color={C.text}
				/>
				<TextInput testID="notes-home-side-text"
					value={name}
					onChangeText={setName}
					autoFocus
					selectTextOnFocus
					onSubmitEditing={() => {
						renameFolder(folder.id, name.trim() || "Untitled folder");
						onDoneRename();
					}}
					onBlur={() => {
						renameFolder(folder.id, name.trim() || "Untitled folder");
						onDoneRename();
					}}
					style={[styles.sideText, styles.renameInput]}
				/>
			</View>
		);
	}

	return (
		<Pressable testID="notes-home-side-item"
			onPress={onPress}
			style={({ pressed }) => [
				styles.sideItem,
				(active || pressed) && { backgroundColor: C.selected },
			]}
		>
			<MaterialCommunityIcons
				name="folder-outline"
				size={18}
				color={active ? C.text : C.icon}
			/>
			<Text testID="notes-home-side-text"
				style={[styles.sideText, active && { fontWeight: "600" }]}
				numberOfLines={1}
			>
				{folder.name}
			</Text>
			{active ? (
				<View testID="notes-home-view" style={{ flexDirection: "row" }}>
					<SmallIcon icon="pencil-outline" onPress={onRename} />
					<SmallIcon
						icon={confirm ? "check" : "delete-outline"}
						danger={confirm}
						onPress={() =>
							confirm ? deleteFolder(folder.id) : setConfirm(true)
						}
					/>
				</View>
			) : (
				<Text testID="notes-home-count" style={styles.count}>{count}</Text>
			)}
		</Pressable>
	);
}

type NoteCardProps = {
	page: Page;
	width: number;
	folders: Folder[];
	menuOpen: boolean;
	setMenuOpen: (o: boolean) => void;
};

function NoteCard({
	page,
	width,
	folders,
	menuOpen,
	setMenuOpen,
}: NoteCardProps) {
	const { movePage } = useStore.getState();

	return (
		<View testID="notes-home-view" style={{ width, zIndex: menuOpen ? 10 : 0 }}>
			<Pressable testID="notes-home-pressable"
				onPress={() => router.push(`/note/${page.id}`)}
				onLongPress={() => setMenuOpen(true)}
			>
				<View testID="notes-home-card" style={[styles.card, shadow]}>
					<NoteThumb page={page} />
				</View>
			</Pressable>
			<View testID="notes-home-card-meta" style={styles.cardMeta}>
				<View testID="notes-home-view" style={{ flex: 1 }}>
					<Text testID="notes-home-title" style={styles.title} numberOfLines={1}>
						{page.title || "Untitled"}
					</Text>
					<Text testID="notes-home-meta" style={styles.meta}>
						{new Date(page.updatedAt).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})}
					</Text>
				</View>
				<IconBtn
					icon="dots-horizontal"
					size={18}
					active={menuOpen}
					onPress={() => setMenuOpen(!menuOpen)}
				/>
			</View>

			{menuOpen && (
				<View testID="notes-home-card-menu" style={[styles.cardMenu, shadow]}>
					<Text testID="notes-home-menu-label" style={styles.menuLabel}>Move to</Text>
					<MenuRow
						icon="inbox-outline"
						label="No folder"
						checked={!page.folderId}
						onPress={() => (movePage(page.id, null), setMenuOpen(false))}
					/>
					{folders.map((f) => (
						<MenuRow
							key={f.id}
							icon="folder-outline"
							label={f.name}
							checked={page.folderId === f.id}
							onPress={() => (movePage(page.id, f.id), setMenuOpen(false))}
						/>
					))}
					<View testID="notes-home-sep" style={styles.sep} />
					<DeleteRow pageId={page.id} />
				</View>
			)}
		</View>
	);
}

/** Two-tap delete; lives inside the menu so its confirm state resets whenever the menu closes. */
function DeleteRow({ pageId }: { pageId: string }) {
	const [confirm, setConfirm] = useState(false);
	return (
		<MenuRow
			icon="delete-outline"
			label={confirm ? "Tap again to delete" : "Delete note"}
			danger
			onPress={() =>
				confirm ? useStore.getState().deletePage(pageId) : setConfirm(true)
			}
		/>
	);
}

function MenuRow({
	icon,
	label,
	onPress,
	checked,
	danger,
}: {
	icon: IconName;
	label: string;
	onPress: () => void;
	checked?: boolean;
	danger?: boolean;
}) {
	return (
		<Pressable testID="notes-home-menu-row"
			onPress={onPress}
			style={({ pressed }) => [
				styles.menuRow,
				pressed && { backgroundColor: C.selected },
			]}
		>
			<MaterialCommunityIcons
				name={icon}
				size={18}
				color={danger ? C.danger : C.icon}
			/>
			<Text testID="notes-home-menu-text"
				style={[styles.menuText, danger && { color: C.danger }]}
				numberOfLines={1}
			>
				{label}
			</Text>
			{checked && (
				<MaterialCommunityIcons name="check" size={16} color={C.text} />
			)}
		</Pressable>
	);
}

function SmallIcon({
	icon,
	onPress,
	danger,
}: {
	icon: IconName;
	onPress: () => void;
	danger?: boolean;
}) {
	return (
		<Pressable testID="notes-home-small-icon" onPress={onPress} hitSlop={6} style={styles.smallIcon}>
			<MaterialCommunityIcons
				name={icon}
				size={16}
				color={danger ? C.danger : C.muted}
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, flexDirection: "row", backgroundColor: C.bg },
	sidebar: {
		width: 240,
		backgroundColor: C.surface,
		borderRightWidth: StyleSheet.hairlineWidth,
		borderColor: C.border,
		paddingHorizontal: 12,
		paddingTop: 20,
	},
	brand: {
		fontSize: 15,
		fontWeight: "700",
		color: C.text,
		paddingHorizontal: 10,
		marginBottom: 16,
	},
	sideLabel: {
		fontSize: 11,
		fontWeight: "600",
		color: C.muted,
		textTransform: "uppercase",
		letterSpacing: 0.6,
		paddingHorizontal: 10,
		marginTop: 18,
		marginBottom: 4,
	},
	sideItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 10,
		height: 38,
		borderRadius: R.sm,
	},
	sideText: { flex: 1, fontSize: 14, color: C.text },
	renameInput: {
		paddingVertical: 4,
		borderBottomWidth: 1,
		borderColor: C.text,
	},
	count: { fontSize: 12, color: C.muted, fontVariant: ["tabular-nums"] },
	smallIcon: {
		width: 26,
		height: 26,
		alignItems: "center",
		justifyContent: "center",
	},

	main: { flex: 1 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 32,
		paddingTop: 24,
		paddingBottom: 20,
		gap: 16,
	},
	h1: {
		fontSize: 28,
		fontWeight: "700",
		color: C.text,
		letterSpacing: -0.5,
		flexShrink: 1,
	},
	newBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: C.primary,
		paddingHorizontal: 16,
		height: 38,
		borderRadius: R.pill,
	},
	newText: { color: C.onPrimary, fontWeight: "600", fontSize: 14 },
	empty: { color: C.muted, textAlign: "center", marginTop: 80, fontSize: 15 },

	card: {
		aspectRatio: 0.77,
		backgroundColor: C.paper,
		borderRadius: R.md,
		overflow: "hidden",
	},
	cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 8 },
	title: { fontSize: 14, fontWeight: "600", color: C.text },
	meta: { fontSize: 12, color: C.muted, marginTop: 2 },
	cardMenu: {
		position: "absolute",
		top: 40,
		right: 0,
		left: 0,
		backgroundColor: C.surface,
		borderRadius: R.md,
		padding: 6,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: C.border,
	},
	menuLabel: {
		fontSize: 11,
		fontWeight: "600",
		color: C.muted,
		textTransform: "uppercase",
		letterSpacing: 0.6,
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	menuRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 8,
		height: 36,
		borderRadius: R.sm,
	},
	menuText: { flex: 1, fontSize: 14, color: C.text },
	sep: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: C.border,
		marginVertical: 4,
	},
});
