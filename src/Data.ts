interface Options {
  quiet: boolean;
  directory: string;
  cwd: string;
}

interface LanguageData {
  items: string[];
  categories: string[];
}

interface Language {
  path: string;
  languageCode: string;
  countryCode?: string;
  import?: LanguageData;
  delete?: LanguageData;
}

interface ParsedItem {
  "@_name": string;
}

interface ParsedCategory {
  item: ParsedItem | Array<ParsedItem>;
  "@_name": string;
}

interface ParsedImport {
  category: ParsedCategory | Array<ParsedCategory>;
}

interface ParsedLanguage {
  import?: ParsedImport;
  delete?: ParsedImport;
  category?: ParsedCategory | Array<ParsedCategory>;
}

interface ParsedXML {
  language?: ParsedLanguage;
}
