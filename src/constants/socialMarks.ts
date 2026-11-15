import type { ImageSourcePropType } from "react-native";

/**
 * Official sign-in marks. Use the files Google and Apple publish for sign-in buttons (don't redraw them):
 *  - Google: https://developers.google.com/identity/branding-guidelines → download the "G" logo PNG
 *  - Apple:  https://developer.apple.com/design/resources/ → Sign in with Apple → logo PNG (black)
 * Put them in assets/brand/ and swap `null` for the require below, e.g.
 *   export const GOOGLE_MARK: ImageSourcePropType | null = require("../../assets/brand/google-g.png");
 * Until then the buttons show text only.
 */
export const GOOGLE_MARK: ImageSourcePropType | null = null;
export const APPLE_MARK: ImageSourcePropType | null = null;
