"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.header = header;
function header(oneLineDescription) {
    return "/* eslint-disable */\n    /**\n     * ".concat(oneLineDescription, "\n     *\n     * THIS CODE IS AUTOMATICALLY GENERATED.\n     *\n     * To regenerate, run `npx @smartbill/firestore-convex-style dev`.\n     * @module\n     */\n    ");
}
