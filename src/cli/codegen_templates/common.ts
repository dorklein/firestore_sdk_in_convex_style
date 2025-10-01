export function header(oneLineDescription: string) {
  return `/* eslint-disable */
    /**
     * ${oneLineDescription}
     *
     * THIS CODE IS AUTOMATICALLY GENERATED.
     *
     * To regenerate, run \`npx @smartbill/firestore-convex-style dev\`.
     * @module
     */
    `;
}
