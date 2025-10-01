#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_path_1 = require("node:path");
var node_fs_1 = require("node:fs");
var server_js_1 = require("./codegen_templates/server.js");
var dataModel_js_1 = require("./codegen_templates/dataModel.js");
var prettier_1 = require("prettier");
function generateTypes(options) {
    return __awaiter(this, void 0, void 0, function () {
        var outputDir, generatedDir, dataModelContent, prettierDataModelContent, _a, serverDTS, serverJS, prettierServerDTS, prettierServerJS;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    outputDir = options.outputDir;
                    generatedDir = (0, node_path_1.join)(outputDir, "_generated");
                    if (!(0, node_fs_1.existsSync)(generatedDir)) {
                        (0, node_fs_1.mkdirSync)(generatedDir, { recursive: true });
                    }
                    dataModelContent = (0, dataModel_js_1.dynamicDataModelDTS)();
                    return [4 /*yield*/, (0, prettier_1.format)(dataModelContent, {
                            parser: "typescript",
                        })];
                case 1:
                    prettierDataModelContent = _b.sent();
                    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(generatedDir, "dataModel.ts"), prettierDataModelContent);
                    _a = (0, server_js_1.serverCodegen)(), serverDTS = _a.DTS, serverJS = _a.JS;
                    return [4 /*yield*/, (0, prettier_1.format)(serverDTS, {
                            parser: "typescript",
                        })];
                case 2:
                    prettierServerDTS = _b.sent();
                    return [4 /*yield*/, (0, prettier_1.format)(serverJS, {
                            parser: "typescript",
                        })];
                case 3:
                    prettierServerJS = _b.sent();
                    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(generatedDir, "server.d.ts"), prettierServerDTS);
                    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(generatedDir, "server.js"), prettierServerJS);
                    console.log("\u2705 Generated types in ".concat(generatedDir));
                    return [2 /*return*/];
            }
        });
    });
}
var defaultRootDirectory = (0, node_path_1.join)(process.cwd(), "examples");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, watchMode, possibleSchemaPaths, schemaArgIndex, schemaPath, outputDir, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    args = process.argv.slice(2);
                    watchMode = args.includes("--watch") || args.includes("-w");
                    possibleSchemaPaths = [(0, node_path_1.join)(defaultRootDirectory, "schema.ts")];
                    schemaArgIndex = args.indexOf("--schema");
                    if (schemaArgIndex !== -1 && args[schemaArgIndex + 1]) {
                        possibleSchemaPaths.unshift((0, node_path_1.join)(process.cwd(), args[schemaArgIndex + 1]));
                    }
                    schemaPath = possibleSchemaPaths.find(function (p) { return (0, node_fs_1.existsSync)(p); });
                    if (!schemaPath) {
                        console.error("❌ Could not find schema.ts file.");
                        console.error("   Looked in:");
                        possibleSchemaPaths.forEach(function (p) { return console.error("   - ".concat(p)); });
                        console.error("\n   You can specify a custom path with --schema <path>");
                        process.exit(1);
                    }
                    console.log("\uD83D\uDCC4 Found schema at ".concat(schemaPath));
                    outputDir = (0, node_path_1.dirname)(schemaPath);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    if (!watchMode) return [3 /*break*/, 3];
                    console.log("\uD83D\uDC40 Watching for changes to ".concat(schemaPath, "..."));
                    // Initial generation
                    return [4 /*yield*/, generateTypes({ schemaPath: schemaPath, outputDir: outputDir })];
                case 2:
                    // Initial generation
                    _a.sent();
                    // Watch for file changes
                    (0, node_fs_1.watch)(schemaPath, function (eventType) { return __awaiter(_this, void 0, void 0, function () {
                        var error_2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!(eventType === "change")) return [3 /*break*/, 4];
                                    console.log("\n\uD83D\uDD04 Schema changed, regenerating types...");
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, generateTypes({ schemaPath: schemaPath, outputDir: outputDir })];
                                case 2:
                                    _a.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_2 = _a.sent();
                                    console.error("❌ Error regenerating types:", error_2);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Keep the process running
                    process.stdin.resume();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, generateTypes({ schemaPath: schemaPath, outputDir: outputDir })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    console.error("❌ Error:", error_1);
                    process.exit(1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
});
