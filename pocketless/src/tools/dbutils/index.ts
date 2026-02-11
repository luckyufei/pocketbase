/**
 * T021 — tools/dbutils/index.ts
 * 对照 Go 版 tools/dbutils/index.go
 * SQL CREATE INDEX 语句的解析和构建
 */

export interface IndexColumn {
  name: string;
  opClass: string;
  collate: string;
  sort: string;
}

export interface Index {
  schemaName: string;
  indexName: string;
  tableName: string;
  method: string;
  where: string;
  columns: IndexColumn[];
  unique: boolean;
  optional: boolean;
  isValid(): boolean;
  build(): string;
  buildForPostgres(): string;
}

const INDEX_REGEX = /(?:create)\s+(unique\s+)?\s*index\s*(if\s+not\s+exists\s+)?(\S+)\s+on\s+(\S+)\s*(?:using\s+(\w+)\s*)?\(([\s\S]*)\)(?:\s*where\s+([\s\S]*))?/i;
const INDEX_COLUMN_REGEX = /^([\s\S]+?)(?:\s+([\w_]+_ops))?(?:\s+collate\s+([\w]+))?(?:\s+(asc|desc))?$/i;
const TRIM_CHARS = /^[`"'\[\]\r\n\t\f\v ]+|[`"'\[\]\r\n\t\f\v ]+$/g;

function trimQuotes(s: string): string {
  return s.replace(TRIM_CHARS, "");
}

function splitDotQualified(s: string): string[] {
  const trimmed = s.trim();
  const parts: string[] = [];
  let current = "";
  let inQuote = "";

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (!inQuote && (ch === "`" || ch === '"' || ch === "'")) {
      inQuote = ch;
      current += ch;
    } else if (inQuote && ch === inQuote) {
      inQuote = "";
      current += ch;
    } else if (!inQuote && ch === ".") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function splitColumns(s: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inQuote = "";

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!inQuote && (ch === "`" || ch === '"' || ch === "'")) {
      inQuote = ch;
      current += ch;
    } else if (inQuote && ch === inQuote) {
      inQuote = "";
      current += ch;
    } else if (!inQuote && ch === "(") {
      depth++;
      current += ch;
    } else if (!inQuote && ch === ")") {
      depth--;
      current += ch;
    } else if (!inQuote && depth === 0 && ch === ",") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function buildIndex(idx: Index, quote: string): string {
  if (!idx.isValid()) return "";

  let str = "CREATE ";
  if (idx.unique) str += "UNIQUE ";
  str += "INDEX ";
  if (idx.optional) str += "IF NOT EXISTS ";

  if (idx.schemaName) {
    str += `${quote}${idx.schemaName}${quote}.`;
  }
  str += `${quote}${idx.indexName}${quote} `;
  str += `ON ${quote}${idx.tableName}${quote} `;

  if (idx.method) {
    str += `USING ${idx.method.toUpperCase()} `;
  }

  str += "(";
  if (idx.columns.length > 1) str += "\n  ";

  let hasCol = false;
  for (const col of idx.columns) {
    const trimmedName = col.name.trim();
    if (!trimmedName) continue;

    if (hasCol) str += ",\n  ";

    if (trimmedName.includes("(") || trimmedName.includes(" ")) {
      str += trimmedName;
    } else {
      str += `${quote}${trimmedName}${quote}`;
    }

    if (col.opClass) str += ` ${col.opClass}`;
    if (col.collate) str += ` COLLATE ${col.collate}`;
    if (col.sort) str += ` ${col.sort.toUpperCase()}`;

    hasCol = true;
  }

  if (hasCol && idx.columns.length > 1) str += "\n";
  str += ")";

  if (idx.where) {
    let whereClause = idx.where;
    if (quote === '"') {
      whereClause = whereClause.replace(/`/g, '"');
    } else if (quote === "`") {
      whereClause = whereClause.replace(/"/g, "`");
    }
    str += ` WHERE ${whereClause}`;
  }

  return str;
}

export function parseIndex(createIndexExpr: string): Index {
  const result: Index = {
    schemaName: "",
    indexName: "",
    tableName: "",
    method: "",
    where: "",
    columns: [],
    unique: false,
    optional: false,
    isValid() {
      return this.indexName !== "" && this.tableName !== "" && this.columns.length > 0;
    },
    build() {
      return buildIndex(this, "`");
    },
    buildForPostgres() {
      return buildIndex(this, '"');
    },
  };

  const matches = createIndexExpr.match(INDEX_REGEX);
  if (!matches || matches.length < 7) return result;

  // Unique
  result.unique = (matches[1] || "").trim() !== "";

  // Optional (IF NOT EXISTS)
  result.optional = (matches[2] || "").trim() !== "";

  // SchemaName and IndexName
  const nameParts = splitDotQualified(matches[3]);
  if (nameParts.length === 2) {
    result.schemaName = trimQuotes(nameParts[0]);
    result.indexName = trimQuotes(nameParts[1]);
  } else {
    result.indexName = trimQuotes(nameParts[0]);
  }

  // TableName (strip schema prefix if present)
  const tableParts = splitDotQualified(matches[4]);
  result.tableName = trimQuotes(tableParts[tableParts.length - 1]);

  // Method (PostgreSQL)
  result.method = (matches[5] || "").trim().toUpperCase();

  // Columns
  const rawColumns = splitColumns(matches[6]);
  for (const col of rawColumns) {
    const colMatches = col.trim().match(INDEX_COLUMN_REGEX);
    if (!colMatches || colMatches.length < 5) continue;

    const trimmedName = trimQuotes(colMatches[1]);
    if (!trimmedName) continue;

    result.columns.push({
      name: trimmedName,
      opClass: (colMatches[2] || "").trim(),
      collate: (colMatches[3] || "").trim(),
      sort: (colMatches[4] || "").toUpperCase(),
    });
  }

  // WHERE
  result.where = (matches[7] || "").trim();

  return result;
}

export function findSingleColumnUniqueIndex(indexes: string[], column: string): Index | null {
  for (const idx of indexes) {
    const parsed = parseIndex(idx);
    if (parsed.unique && parsed.columns.length === 1 && parsed.columns[0].name.toLowerCase() === column.toLowerCase()) {
      return parsed;
    }
  }
  return null;
}
