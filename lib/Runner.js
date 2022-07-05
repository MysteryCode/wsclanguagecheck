"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runner = void 0;
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const defaults_1 = tslib_1.__importDefault(require("defaults"));
const fs_1 = tslib_1.__importDefault(require("fs"));
const fast_xml_parser_1 = require("fast-xml-parser");
const assert_1 = tslib_1.__importDefault(require("assert"));
class Runner {
    constructor(options = {}) {
        this.languages = [];
        this.options = (0, defaults_1.default)(options, {
            quiet: false,
            directory: "./language",
            cwd: process.cwd(),
        });
        this.comparisonBase = {
            languageCode: "__cmp",
            countryCode: "__cmp",
            path: "__cmp",
            import: {
                items: [],
                categories: [],
            },
            delete: {
                items: [],
                categories: [],
            },
        };
        // resolve paths into absolute paths
        this.options.directory = path_1.default.resolve(this.options.cwd, this.options.directory);
    }
    execute() {
        console.log(`Checking language files in directory '${this.getShortPath(this.options.directory)}'.`);
        fs_1.default.readdirSync(this.options.directory)
            .filter((file) => {
            const stat = fs_1.default.statSync(`${this.options.directory}/${file}`);
            return !stat.isDirectory() && stat.isFile() && !stat.isSymbolicLink() && file.match(/[a-z\-]+\.xml$/i);
        })
            .forEach((file) => {
            this.readFile(`${this.options.directory}/${file}`);
        });
        this.compareData();
    }
    readFile(path) {
        console.log(`Reading language file '${this.getFilename(path)}'.`);
        const content = fs_1.default.readFileSync(path);
        const options = {
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
        };
        const parser = new fast_xml_parser_1.XMLParser(options);
        const parsed = parser.parse(content);
        if (parsed.language === undefined) {
            throw new Error(`Missing <language>-tag in file '${this.getFilename(path)}'`);
        }
        if (parsed.language["@_languagecode"] === undefined || parsed.language["@_languagecode"] === "") {
            throw new Error(`Missing or empty attribute 'languagecode' <language>-tag in file '${this.getFilename(path)}'.`);
        }
        const languageCode = parsed.language["@_languagecode"];
        // TODO check filename
        const language = {
            path: path,
            languageCode: languageCode,
        };
        // optional attribute
        //if (parsed.language["@_countrycode"] === undefined || parsed.language["@_countrycode"] === "") {
        //  throw new Error(`Missing or empty attribute '_countrycode' <language>-tag in file '${this.getFilename(path)}'.`);
        //}
        if (parsed.language["@_countrycode"]) {
            language.countryCode = parsed.language["@_countrycode"];
        }
        // optional attribute
        //if (parsed.language["@_languagename"] === undefined || parsed.language["@_languagename"] === "") {
        //  throw new Error(`Missing or empty attribute 'languagename' <language>-tag in file '${this.getFilename(path)}'.`);
        //}
        if (parsed.language.category === undefined && parsed.language.import === undefined && parsed.language.delete === undefined) {
            throw new Error(`Missing either <import>-tag or <delete>-tag in file '${this.getFilename(path)}'`);
        }
        if (parsed.language.import && parsed.language.import.category) {
            language.import = this.parseCategories(parsed.language.import.category, path, "import");
            console.log(`  ${language.import.categories.length} categories and ${language.import.items.length} language items marked for import.`);
        }
        else if (parsed.language.category) {
            language.import = this.parseCategories(parsed.language.category, path, "import");
            console.log(`  ${language.import.categories.length} categories and ${language.import.items.length} language items marked for import.`);
        }
        if (parsed.language.delete && parsed.language.delete.category) {
            language.delete = this.parseCategories(parsed.language.delete.category, path, "delete");
            console.log(`  ${language.delete.categories.length} categories and ${language.delete.items.length} language items marked for removal.`);
        }
        this.languages.push(language);
    }
    parseCategories(input, path, action) {
        if (!Array.isArray(input)) {
            input = [input];
        }
        (0, assert_1.default)(input instanceof (Array));
        let categories = [];
        let items = [];
        input.forEach((category) => {
            var _a, _b, _c, _d;
            if (category["@_name"] === undefined || category["@_name"] === "") {
                throw new Error(`Missing or empty attribute 'name' for a category in the <${action}>-block of file '${this.getFilename(path)}'.`);
            }
            const categoryName = category["@_name"];
            const split = categoryName.split(".");
            if (split.length > 4) {
                throw new Error(`Invalid category name '${categoryName}' '${this.getFilename(path)}'.`);
            }
            categories.push(categoryName);
            switch (action) {
                case "delete":
                    if (((_a = this.comparisonBase.delete) === null || _a === void 0 ? void 0 : _a.categories.indexOf(categoryName)) === -1) {
                        (_b = this.comparisonBase.delete) === null || _b === void 0 ? void 0 : _b.categories.push(categoryName);
                    }
                    break;
                case "import":
                    if (((_c = this.comparisonBase.import) === null || _c === void 0 ? void 0 : _c.categories.indexOf(categoryName)) === -1) {
                        (_d = this.comparisonBase.import) === null || _d === void 0 ? void 0 : _d.categories.push(categoryName);
                    }
                    break;
            }
            items.push(...this.parseItems(category.item, path, categoryName, action));
        });
        return {
            items: items,
            categories: categories,
        };
    }
    parseItems(input, path, category, action) {
        if (!Array.isArray(input)) {
            input = [input];
        }
        (0, assert_1.default)(input instanceof (Array));
        let items = [];
        input.forEach((item) => {
            var _a, _b, _c, _d;
            if (item["@_name"] === undefined || item["@_name"] === "") {
                throw new Error(`Missing or empty attribute 'name' for a language item located in category '${category}' in file '${this.getFilename(path)}'.`);
            }
            const itemName = item["@_name"];
            items.push(itemName);
            switch (action) {
                case "delete":
                    if (((_a = this.comparisonBase.delete) === null || _a === void 0 ? void 0 : _a.items.indexOf(itemName)) === -1) {
                        (_b = this.comparisonBase.delete) === null || _b === void 0 ? void 0 : _b.items.push(itemName);
                    }
                    break;
                case "import":
                    if (((_c = this.comparisonBase.import) === null || _c === void 0 ? void 0 : _c.items.indexOf(itemName)) === -1) {
                        (_d = this.comparisonBase.import) === null || _d === void 0 ? void 0 : _d.items.push(itemName);
                    }
                    break;
            }
        });
        return items;
    }
    getShortPath(path) {
        return path.replace(this.options.cwd, "").replace(/^(\/|\\)/, "");
    }
    getFilename(path) {
        return path.replace(this.options.directory, "").replace(/^(\/|\\)/, "");
    }
    compareData() {
        const diff = {};
        let error = false;
        console.log("");
        console.log("---");
        console.log("");
        this.languages.forEach((source) => {
            var _a, _b, _c, _d;
            console.log(`Checking sync of ${this.getFilename(source.path)}.`);
            let items;
            let categories;
            let tmpError = false;
            categories = source.import ? source.import.categories : [];
            (_a = this.comparisonBase.import) === null || _a === void 0 ? void 0 : _a.categories.filter((x) => categories.indexOf(x) === -1).forEach((categoryName) => {
                console.error(`  Category '${categoryName}' is MISSING for IMPORT in file '${this.getFilename(source.path)}'.`);
                tmpError = true;
            });
            items = source.import ? source.import.items : [];
            (_b = this.comparisonBase.import) === null || _b === void 0 ? void 0 : _b.items.filter((x) => items.indexOf(x) === -1).forEach((languageItem) => {
                console.error(`  Language item '${languageItem}' is MISSING for IMPORT in file '${this.getFilename(source.path)}'.`);
                tmpError = true;
            });
            categories = source.delete ? source.delete.categories : [];
            (_c = this.comparisonBase.delete) === null || _c === void 0 ? void 0 : _c.categories.filter((x) => categories.indexOf(x) === -1).forEach((categoryName) => {
                console.error(`  Category '${categoryName}' is MISSING for DELETE in file '${this.getFilename(source.path)}'.`);
                tmpError = true;
            });
            items = source.delete ? source.delete.items : [];
            (_d = this.comparisonBase.delete) === null || _d === void 0 ? void 0 : _d.items.filter((x) => items.indexOf(x) === -1).forEach((languageItem) => {
                console.error(`  Language item '${languageItem}' is MISSING for DELETE in file '${this.getFilename(source.path)}'.`);
                tmpError = true;
            });
            if (!tmpError) {
                console.log("  File is good.");
            }
            error = error || tmpError;
        });
        if (error) {
            process.exit(1);
        }
    }
}
exports.Runner = Runner;
exports.default = Runner;
