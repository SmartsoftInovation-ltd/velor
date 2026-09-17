// TODO: move the Platform Console access code to the backend (hashed, per operator).
// For now it only hides the console from someone using the owner's open dashboard;
// the API still requires the platform store owner's session.
const PLATFORM_CONSOLE_CODE = "taufik";

export const isPlatformConsoleCode = (code: string) => code.trim() === PLATFORM_CONSOLE_CODE;
