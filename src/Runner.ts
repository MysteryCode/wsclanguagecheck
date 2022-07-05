import path from "path";
import defaults from "defaults";
import fs from "fs";
import { XMLParser } from "fast-xml-parser";
import assert from "assert";

export class Runner {
  protected options: Options;
  protected languages: Array<Language> = [];
  protected comparisonBase: Language;

  constructor(options: Partial<Options> = {}) {
    this.options = defaults(options, {
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
    this.options.directory = path.resolve(this.options.cwd, this.options.directory);
  }

  public execute(): void {
    console.log(`Checking language files in directory '${this.getShortPath(this.options.directory)}'.`);

    fs.readdirSync(this.options.directory)
      .filter((file) => {
        const stat = fs.statSync(`${this.options.directory}/${file}`);

        return !stat.isDirectory() && stat.isFile() && !stat.isSymbolicLink() && file.match(/[a-z\-]+\.xml$/i);
      })
      .forEach((file) => {
        this.readFile(`${this.options.directory}/${file}`);
      });

    this.compareData();
  }

  protected readFile(path: string): void {
    console.log(`Reading language file '${this.getFilename(path)}'.`);

    const content = fs.readFileSync(path);
    const options = {
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    };
    const parser = new XMLParser(options);
    const parsed = parser.parse(content) as ParsedXML;

    if (parsed.language === undefined) {
      throw new Error(`Missing <language>-tag in file '${this.getFilename(path)}'`);
    }

    if (parsed.language["@_languagecode"] === undefined || parsed.language["@_languagecode"] === "") {
      throw new Error(`Missing or empty attribute 'languagecode' <language>-tag in file '${this.getFilename(path)}'.`);
    }
    const languageCode = parsed.language["@_languagecode"];

    // TODO check filename

    const language: Language = {
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
      console.log(
        `  ${language.import.categories.length} categories and ${language.import.items.length} language items marked for import.`,
      );
    } else if (parsed.language.category) {
      language.import = this.parseCategories(parsed.language.category, path, "import");
      console.log(
        `  ${language.import.categories.length} categories and ${language.import.items.length} language items marked for import.`,
      );
    }

    if (parsed.language.delete && parsed.language.delete.category) {
      language.delete = this.parseCategories(parsed.language.delete.category, path, "delete");
      console.log(
        `  ${language.delete.categories.length} categories and ${language.delete.items.length} language items marked for removal.`,
      );
    }

    this.languages.push(language);
  }

  protected parseCategories(input: ParsedCategory | Array<ParsedCategory>, path: string, action: "import" | "delete"): LanguageData {
    if (!Array.isArray(input)) {
      input = [input];
    }

    assert(input instanceof Array<ParsedCategory>);

    let categories: Array<string> = [];
    let items: Array<string> = [];
    input.forEach((category: ParsedCategory) => {
      if (category["@_name"] === undefined || category["@_name"] === "") {
        throw new Error(`Missing or empty attribute 'name' for a category in the <${action}>-block of file '${this.getFilename(path)}'.`);
      }

      const categoryName = category["@_name"] as string;
      const split = categoryName.split(".");
      if (split.length > 4) {
        throw new Error(`Invalid category name '${categoryName}' '${this.getFilename(path)}'.`);
      }

      categories.push(categoryName);
      switch (action) {
        case "delete":
          if (this.comparisonBase.delete?.categories.indexOf(categoryName) === -1) {
            this.comparisonBase.delete?.categories.push(categoryName);
          }
          break;
        case "import":
          if (this.comparisonBase.import?.categories.indexOf(categoryName) === -1) {
            this.comparisonBase.import?.categories.push(categoryName);
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

  protected parseItems(input: ParsedItem | Array<ParsedItem>, path, category, action: "import" | "delete"): string[] {
    if (!Array.isArray(input)) {
      input = [input];
    }

    assert(input instanceof Array<ParsedItem>);

    let items: Array<string> = [];
    input.forEach((item: ParsedItem) => {
      if (item["@_name"] === undefined || item["@_name"] === "") {
        throw new Error(
          `Missing or empty attribute 'name' for a language item located in category '${category}' in file '${this.getFilename(path)}'.`,
        );
      }
      const itemName = item["@_name"];

      items.push(itemName);

      switch (action) {
        case "delete":
          if (this.comparisonBase.delete?.items.indexOf(itemName) === -1) {
            this.comparisonBase.delete?.items.push(itemName);
          }
          break;
        case "import":
          if (this.comparisonBase.import?.items.indexOf(itemName) === -1) {
            this.comparisonBase.import?.items.push(itemName);
          }
          break;
      }
    });

    return items;
  }

  protected getShortPath(path: string): string {
    return path.replace(this.options.cwd, "").replace(/^(\/|\\)/, "");
  }

  protected getFilename(path: string): string {
    return path.replace(this.options.directory, "").replace(/^(\/|\\)/, "");
  }

  protected compareData(): void {
    const diff = {};
    let error = false;

    console.log("");
    console.log("---");
    console.log("");

    this.languages.forEach((source) => {
      console.log(`Checking sync of ${this.getFilename(source.path)}.`);

      let items: Array<string>;
      let categories: Array<string>;
      let tmpError = false;

      categories = source.import ? source.import.categories : [];
      this.comparisonBase.import?.categories
        .filter((x) => categories.indexOf(x) === -1)
        .forEach((categoryName: string) => {
          console.error(`  Category '${categoryName}' is MISSING for IMPORT in file '${this.getFilename(source.path)}'.`);
          tmpError = true;
        });

      items = source.import ? source.import.items : [];
      this.comparisonBase.import?.items
        .filter((x) => items.indexOf(x) === -1)
        .forEach((languageItem: string) => {
          console.error(`  Language item '${languageItem}' is MISSING for IMPORT in file '${this.getFilename(source.path)}'.`);
          tmpError = true;
        });

      categories = source.delete ? source.delete.categories : [];
      this.comparisonBase.delete?.categories
        .filter((x) => categories.indexOf(x) === -1)
        .forEach((categoryName: string) => {
          console.error(`  Category '${categoryName}' is MISSING for DELETE in file '${this.getFilename(source.path)}'.`);
          tmpError = true;
        });

      items = source.delete ? source.delete.items : [];
      this.comparisonBase.delete?.items
        .filter((x) => items.indexOf(x) === -1)
        .forEach((languageItem: string) => {
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

export default Runner;
