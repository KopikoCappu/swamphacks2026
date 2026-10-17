// Shared request/response contract between the app and the server.
// Keep in sync with app/src/lib/api.ts.

export type Provider = 'claude' | 'gemini';
export type Mode = 'ask' | 'mistake' | 'explain' | 'transcribe';

export type ImagePart = { base64: string; width: number; height: number };

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

// Box is [ymin, xmin, ymax, xmax], normalized 0-1000 relative to the FIRST
// image of the latest user message (the Gemini grounding convention; works
// well for Claude too when told explicitly).
export type AnnotationKind = 'circle' | 'box' | 'underline' | 'strike' | 'check' | 'cross' | 'note';
export type AnnotationColor = 'red' | 'green' | 'blue' | 'orange';

export type ModelAnnotation = {
  kind: AnnotationKind;
  box: [number, number, number, number];
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
      description: 'Your answer to the student, in Markdown. Use $...$ for inline math.',
    },
    annotations: {
      type: 'array',
      description:
        'Marks to hand-draw on the student\'s page, positioned on the FIRST image of the latest user message. Empty array if no image or nothing to mark.',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['circle', 'box', 'underline', 'strike', 'check', 'cross', 'note'],
          },
          box: {
            type: 'array',
            items: { type: 'integer' },
            description: '[ymin, xmin, ymax, xmax] normalized to 0-1000 of the image.',
          },
          text: {
            type: 'string',
            description: 'Only for kind "note": a SHORT handwritten-style margin note (max ~8 words).',
          },
          color: { type: 'string', enum: ['red', 'green', 'blue', 'orange'] },
        },
        required: ['kind', 'box'],
        additionalProperties: false,
      },
    },
    transcription: {
      type: 'string',
      description: 'Only in transcribe mode: the handwriting converted to text (LaTeX for math).',
    },
  },
  required: ['reply', 'annotations'],
  additionalProperties: false,
} as const;
