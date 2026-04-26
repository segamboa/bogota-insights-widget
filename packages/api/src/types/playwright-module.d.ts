/**
 * Stub type declaration for playwright.
 * The playwright scraper is an optional tool that requires `playwright` to be installed manually.
 * This declaration allows TypeScript compilation without the dependency.
 */
declare module 'playwright' {
  export const chromium: any;
  export type Browser = any;
  export type Page = any;
}
