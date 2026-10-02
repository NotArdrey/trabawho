import { activeVisionModels, buildVisionRequest, DEFAULT_VISION_MODEL } from "../../../supabase/functions/trabawho-chatbot/vision";

it("replaces retired vision overrides with a supported image-capable model", () => {
  expect(activeVisionModels(["meta-llama/llama-4-scout-17b-16e-instruct", "qwen/qwen3.6-27b"])).toEqual([DEFAULT_VISION_MODEL]);
  expect(activeVisionModels(["custom-vision", DEFAULT_VISION_MODEL])).toEqual(["custom-vision", DEFAULT_VISION_MODEL]);
});

it("sends the uploaded image with JSON instructions and disables the reasoning token budget", () => {
  const request = buildVisionRequest("data:image/png;base64,YWJj", "What is this logo?");
  expect(request).toMatchObject({ reasoning_effort: "none", response_format: { type: "json_object" }, messages: [{ role: "user", content: [{ type: "text", text: expect.stringContaining("What is this logo?") as unknown }, { type: "image_url", image_url: { url: "data:image/png;base64,YWJj" } }] }] });
});
