// Shared request/response contract between the app and the server.
// Keep in sync with app/src/lib/api.ts and app/src/lib/annotations.ts.

export type Provider = 'claude' | 'gemini';
export type Mode = 'ask' | 'mistake' | 'explain' | 'transcribe';

/** `label` is shown to the model right before the image, e.g. "Image 0 — your selection". */
export type ImagePart = { base64: string; width: number; height: number; label?: string };

export type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  images?: ImagePart[];
};

export type AskRequest = {
  provider: Provider;
  mode: Mode;
  messages: ChatMessage[];
};

// Coordinates: `box` is [ymin, xmin, ymax, xmax] normalized 0-1000 on image #`image`
// of the LATEST user message (the Gemini grounding convention; works well for Claude too).
export type AnnotationKind =
  | 'circle' | 'box' | 'underline' | 'strike' | 'check' | 'cross' | 'highlight' | 'arrow' // marks
  | 'note' | 'text' | 'math'; // writing
export type AnnotationColor = 'red' | 'green' | 'blue' | 'orange';

export type ModelAnnotation = {
  kind: AnnotationKind;
  image: number;
  box: [number, number, number, number];
  /** arrow only: start point [y, x] (0-1000); the arrow points at `box` */
  from?: [number, number];
  /** note/text: the words. math: LaTeX without $ delimiters. */
  text?: string;
  color?: AnnotationColor;
};

export type AskResponse = {
  reply: string;
  annotations: ModelAnnotation[];
  transcription?: string;
};

export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: 'Your chat answer in Markdown. Use $...$ for inline math and $$...$$ for display math.',
    },
    annotations: {
      type: 'array',
      description: 'Things to draw or write on the student\'s page. Empty array if nothing should go on the page.',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['circle', 'box', 'underline', 'strike', 'check', 'cross', 'highlight', 'arrow', 'note', 'text', 'math'],
          },
          image: { type: 'integer', description: 'Index of the image (in the latest user message) that `box` refers to.' },
          box: {
            type: 'array',
            items: { type: 'integer' },
            description: '[ymin, xmin, ymax, xmax] normalized to 0-1000 of that image. For note/text/math: where to place it (top-left corner + width).',
          },
          from: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Only for kind "arrow": start point [y, x] normalized 0-1000. The arrow points from here at `box`.',
          },
          text: {
            type: 'string',
            description: 'note: short handwritten-style words. text: typed text to put on the page. math: LaTeX source with NO $ delimiters.',
          },
          color: { type: 'string', enum: ['red', 'green', 'blue', 'orange'] },
        },
        required: ['kind', 'image', 'box'],
        additionalProperties: false,
      },
    },
    transcription: {
      type: 'string',
      description: 'Only in transcribe mode: the handwriting converted to text (Markdown, $...$ for math).',
    },
  },
  required: ['reply', 'annotations'],
  additionalProperties: false,
} as const;
