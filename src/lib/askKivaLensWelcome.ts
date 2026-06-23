// The "Need help getting started?" CTA always sends this EXACT prompt. The widget
// short-circuits it client-side and replies with WELCOME_REPLY instead of making
// an OpenAI call, so simply clicking the button never costs credits. Keep the
// prompt here (single source of truth) so the CTA and the short-circuit match.
export const WELCOME_PROMPT = "I'm new to KivaLens — can you help me find loans to fund?"

export const WELCOME_REPLY =
  "Of course! I'd be happy to help you find loans to fund. To get started, could you tell me what specific criteria or preferences you have in mind? For example, are you interested in a particular country, sector, or type of borrower?"
