/**
 * Splitwise CSV importer (v1, one group per file).
 *
 * A row is one transaction: the people columns carry each person's impact on
 * their balance (positive = put money in, negative = owes). From that we
 * reconstruct the payer and the shares, and a `Pago`/`Payment` row becomes a
 * settlement. The file has no emails and no stable ids, so the caller maps
 * names to members and dedupes by batch.
 */

export interface ParsedShare {
  name: string;
  amount_minor: number;
}

export interface ParsedMovement {
  /** 1-based line in the file, for error messages. */
  line: number;
  occurred_on: string;
  description: string;
  category: string;
  kind: "expense" | "settlement";
  currency: string;
  amount_minor: number;
  payer: string;
  shares: ParsedShare[];
  /** The amount was derived from the impacts because `Cost` was empty. */
  derived: boolean;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  movements: ParsedMovement[];
  errors: ParseError[];
  /** Rows that were blank or only spaces. */
  skipped: number;
  currencies: string[];
  people: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["fecha", "date"],
  description: ["descripción", "descripcion", "description"],
  category: ["categoría", "categoria", "category"],
  cost: ["coste", "cost", "total"],
  currency: ["moneda", "currency"],
};

const PAYMENT = new Set(["pago", "payment"]);

/** CSV with quotes and escaped quotes; no multiline cells in this export. */
function splitCsvLine(line: string, delimiter = ","): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function cents(raw: string): number | null {
  if (raw === "") return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Math.round(Number(raw) * 100);
  return Number.isSafeInteger(value) ? value : null;
}

export function parseSplitwiseCsv(text: string): ParseResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const errors: ParseError[] = [];
  const movements: ParsedMovement[] = [];
  let skipped = 0;
  const headerIndex = lines.findIndex((line) => line.trim() !== "");
  if (headerIndex === -1) {
    return { movements, errors: [{ line: 1, message: "the file is empty" }], skipped, currencies: [], people: [] };
  }

  // Delimiter sniffing on the header: `,` or `;` (the export uses the locale's).
  const delimiter = (() => {
    const first = lines[headerIndex];
    const commas = first.split(",").length;
    const semicolons = first.split(";").length;
    return semicolons > commas ? ";" : ",";
  })();
  const header = splitCsvLine(lines[headerIndex], delimiter);
  const columns = new Map<string, number>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = header.findIndex((cell) => aliases.includes(cell.toLowerCase()));
    // The category is optional: a missing column only means no classification.
    if (index === -1 && field !== "category") {
      errors.push({ line: headerIndex + 1, message: `missing column for ${field}` });
    }
    columns.set(field, index);
  }
  const known = new Set(Object.values(HEADER_ALIASES).flat());
  const people = header.filter((cell) => !known.has(cell.toLowerCase()));
  if (new Set(people.map((name) => name.toLowerCase())).size !== people.length) {
    errors.push({ line: headerIndex + 1, message: "two people share a name" });
  }
  if (people.length === 0) errors.push({ line: headerIndex + 1, message: "no people columns" });
  if (errors.length > 0) {
    return { movements, errors, skipped, currencies: [], people: [] };
  }

  const currencies = new Set<string>();
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const cells = splitCsvLine(line, delimiter);
    if (cells.every((cell) => cell === "")) {
      skipped += 1;
      continue;
    }
    const at = (field: string) => {
      const position = columns.get(field)!;
      return position >= 0 ? (cells[position] ?? "") : "";
    };
    // A category column that does not exist reads as an empty string.
    const date = at("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ line: index + 1, message: "invalid date" });
      continue;
    }
    const currency = at("currency").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push({ line: index + 1, message: "invalid currency" });
      continue;
    }
    currencies.add(currency);

    const impacts = new Map<string, number | null>();
    for (const person of people) {
      const position = header.indexOf(person);
      impacts.set(person, cents(cells[position] ?? ""));
    }
    if ([...impacts.values()].every((value) => value === null)) {
      skipped += 1;
      continue;
    }

    const positive = [...impacts.entries()].filter(([, value]) => (value ?? 0) > 0);
    const negative = [...impacts.entries()].filter(([, value]) => (value ?? 0) < 0);
    if (positive.length !== 1 || negative.length === 0) {
      errors.push({ line: index + 1, message: "cannot tell who paid" });
      continue;
    }
    const [payer, impact] = positive[0] as [string, number];

    // Net impacts cancel out by definition; the cost cannot be recovered from
    // them when the payer also participates, so an expense needs its `Cost`.
    const negativeTotal = negative.reduce((sum, [, value]) => sum - (value as number), 0);
    if (Math.abs(impact - negativeTotal) > 1) {
      errors.push({ line: index + 1, message: "impacts are more than one cent apart" });
      continue;
    }
    if (impact !== negativeTotal) {
      // Splitwise rounds each share; the export can be one cent off. The cent
      // goes to the largest impact, which is the one with the most room.
      const [name, value] = [...impacts.entries()].sort(
        (left, right) => Math.abs(right[1] ?? 0) - Math.abs(left[1] ?? 0),
      )[0] as [string, number];
      impacts.set(name, value + (negativeTotal - impact));
    }

    const category = at("category");
    const kind = PAYMENT.has(category.toLowerCase()) ? "settlement" : "expense";
    const declared = cents(at("cost"));
    // A missing cost is derived from the impacts and flagged: the export does
    // this on a trailing row, and the preview asks the user to review it.
    const amount = declared ?? impact + negativeTotal;
    if (amount < impact) {
      errors.push({ line: index + 1, message: "the cost is lower than what the payer put in" });
      continue;
    }

    if (kind === "settlement" && negative.length !== 1) {
      errors.push({ line: index + 1, message: "a payment needs exactly one receiver" });
      continue;
    }

    const derived = declared === null;
    const shares: ParsedShare[] =
      kind === "settlement"
        ? [{ name: negative[0][0], amount_minor: amount }]
        : [
            { name: payer, amount_minor: amount - impact },
            ...negative.map(([name, value]) => ({ name, amount_minor: -(value as number) })),
          ].filter((share) => share.amount_minor > 0);

    movements.push({
      line: index + 1,
      occurred_on: date,
      description: at("description") || category || "Splitwise",
      category,
      kind,
      currency,
      amount_minor: amount,
      payer,
      shares,
      derived,
    });
  }

  return { movements, errors, skipped, currencies: [...currencies].sort(), people };
}
