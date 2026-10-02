export const DEFAULT_VISION_MODEL = "qwen/qwen3.8-27b";
const retiredVisionModels = new Set([
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama-3.2-11b-vision-preview",
  "llama-3.2-90b-vision-preview",
  "qwen/qwen3.6-27b",
]);

export const activeVisionModels = (models: string[]): string[] => [...new Set([
  ...models.filter((model) => !retiredVisionModels.has(model)),
  DEFAULT_VISION_MODEL,
])];

export const buildVisionRequest = (dataUrl: string, prompt: string): Record<string, unknown> => ({
  messages: [{
    role: "user",
    content: [{
      type: "text",
      text: [
        "You identify visible local-service problems from user-uploaded photos for TrabaWho.",
        "Return JSON only with keys: problemTitle, problemSummary, likelyServiceTypes, materials, urgency, safetyNotes, confidence, searchQuery.",
        "likelyServiceTypes should be service labels such as Plumber, Electrician, Technician, Cleaner, Carpenter, Appliance Repair, Painter, or General Repair.",
        "materials must be an array of {name, quantity, searchTerm}. Use visible evidence and uncertainty. Do not infer identities or private details.",
        "If this is a logo, illustration, or unrelated image, describe what is visible in problemSummary, leave likelyServiceTypes and materials empty, and do not invent repair needs.",
        `User question: ${prompt}`,
      ].join("\n"),
    }, { type: "image_url", image_url: { url: dataUrl } }],
  }],
  reasoning_effort: "none",
  temperature: 0.1,
  max_completion_tokens: 1000,
  response_format: { type: "json_object" },
});
