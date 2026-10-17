// All coordinates are in "page space" (canvas points). No zoom/pan yet, so page == view.

export type Point = [x: number, y: number, pressure: number];

export type Tool = 'pen' | 'highlighter' | 'eraser' | 'lasso' | 'text';

export type Paper = 'blank' | 'lined' | 'grid' | 'dots';

export type Stroke = {
  id: string;
  tool: 'pen' | 'highlighter';
  color: string;
  size: number;
  points: Point[];
  /** true when pressure came from a real stylus (S Pen); otherwise we simulate it */
  stylus: boolean;
};

export type TextBlock = { id: string; x: number; y: number; width: number; text: string };

export type PageImage = { id: string; x: number; y: number; w: number; h: number; base64: string };

export type Rect = { x: number; y: number; w: number; h: number };

export type AnnotationKind = 'circle' | 'box' | 'underline' | 'strike' | 'check' | 'cross' | 'note';

/** Something the AI drew on the page, already mapped into page space. */
export type Annotation = {
  id: string;
  kind: AnnotationKind;
  rect: Rect;
  color: string;
  text?: string;
  createdAt: number;
};

/** A piece of the page attached to an AI request. */
export type Chip = {
  id: string;
  /** Page-space bounds of the selection (used to map annotations back) */
  bounds: Rect;
  /** Crisp re-render of the selected strokes/images, PNG base64 (no data: prefix) */
  image?: { base64: string; width: number; height: number };
  /** Typed text inside the selection */
  text?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chips?: Chip[];
  transcription?: string;
  error?: boolean;
};

export type Page = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  strokes: Stroke[];
  texts: TextBlock[];
  images: PageImage[];
  annotations: Annotation[];
  chat: ChatMessage[];
  paper?: Paper;
};

export type Selection = {
  strokeIds: string[];
  textIds: string[];
  imageIds: string[];
  bounds: Rect;
};
