import { TAGLINE } from "../../constants/brand";

/**
 * The line under the logo on Welcome. `src/constants/brand.ts` still holds a "[Tagline goes here]"
 * placeholder; until it is filled in, show a plain description of the app instead of the brackets.
 */
export const WELCOME_TAGLINE = TAGLINE.trim() === "" || TAGLINE.trim().startsWith("[")
  ? "Places and nights out, ranked for you."
  : TAGLINE;
