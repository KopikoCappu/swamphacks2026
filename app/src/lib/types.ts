// All stored coordinates are in "page space". The viewport (zoom/pan) maps page -> screen.

export type Point = [x: number, y: number, pressure: number];

export type Tool = 'pen' | 'highlighter' | 'shape' | 'eraser' | 'lasso' | 'text';

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';

export type Paper = 'blank' | 'lined' | 'grid' | 'dots';

export type Stroke = {
  id: string;
  /** shape strokes are plain polylines (no pressure), drawn with a fixed width */
  tool: 'pen' | 'highlighter' | 'shape';
  color: string;
  size: number;
  points: Point[];
  /** true when pressure came from a real stylus (S Pen); otherwise we simulate it */
  stylus: boolean;
};

export type TextBlock = { id: string; x: number; y: number; width: number; text: string; color?: string };

/** A rendered LaTeX equation on the page. w/h are an estimate used for hit-testing and selection. */
export type MathBlock = { id: string; x: number; y: number; w: number; h: number; latex: string; color?: string };

export type PageImage = { id: string; x: number; y: number; w: number; h: number; base64: string };

export type Rect = { x: number; y: number; w: number; h: number };

export type AnnotationKind = 'circle' | 'box' | 'underline' | 'strike' | 'check' | 'cross' | 'highlight' | 'arrow' | 'note';

/** Something the AI drew on the page, already mapped into page space. */
export type Annotation = {
  id: string;
  kind: AnnotationKind;
  rect: Rect;
  color: string;
  text?: string;
  /** arrow only: start point in page space; the arrow points at `rect` */
  from?: [number, number];
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
  maths?: MathBlock[];
  images: PageImage[];
  annotations: Annotation[];
  chat: ChatMessage[];
  paper?: Paper;
  /** page background color */
  bg?: string;
  folderId?: string | null;
};

export type Folder = { id: string; name: string; createdAt: number };

export type Selection = {
  strokeIds: string[];
  textIds: string[];
  mathIds: string[];
  imageIds: string[];
  bounds: Rect;
};
