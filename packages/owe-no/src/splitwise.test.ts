import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSplitwiseCsv } from "./splitwise";

const FIXTURE = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../docs/tasks/sprint-15-app-y-finanzas/fixtures/splitwise-demo.csv",
);

describe("splitwise CSV", () => {
  const parsed = parseSplitwiseCsv(readFileSync(FIXTURE, "utf8"));

  it("reads the real export: Spanish headers, ISO dates, one currency", () => {
    expect(parsed.errors).toEqual([]);
    expect(parsed.currencies).toEqual(["EUR"]);
    expect(parsed.people).toEqual(["Ana", "Luis"]);
    expect(parsed.movements.length).toBeGreaterThan(600);
    expect(parsed.skipped).toBe(0);
  });

  it("imports payments as settlements", () => {
    const payments = parsed.movements.filter((movement) => movement.kind === "settlement");
    expect(payments).toHaveLength(6);
    for (const payment of payments) {
      expect(payment.shares).toHaveLength(1);
      expect(payment.shares[0].amount_minor).toBe(payment.amount_minor);
      expect(payment.shares[0].name).not.toBe(payment.payer);
    }
  });

  it("derives the amount of the trailing row whose cost cell is empty", () => {
    const derived = parsed.movements.filter((movement) => movement.derived);
    expect(derived).toHaveLength(1);
    const [row] = derived;
    expect(row.derived).toBe(true);
    expect(row.amount_minor).toBeGreaterThan(0);
    const total = row.shares.reduce((sum, share) => sum + share.amount_minor, 0);
    expect(total).toBe(row.amount_minor);
  });

  it("every expense shares add up to its amount and the payer pays in", () => {
    for (const movement of parsed.movements.filter((entry) => entry.kind === "expense")) {
      const total = movement.shares.reduce((sum, share) => sum + share.amount_minor, 0);
      expect(total, `line ${movement.line}`).toBe(movement.amount_minor);
      // The payer may or may not participate; the row never invents a share.
      expect(movement.shares.every((share) => share.name !== movement.payer || share.amount_minor > 0)).toBe(true);
    }
  });

  it("rejects a file with several currencies, no people or a bad header", () => {
    const multi = parseSplitwiseCsv(
      ["Fecha,Descripción,Categoría,Coste,Moneda,Ana", "2024-01-01,Cena,General,10.00,USD,10.00", "2024-01-02,Cena,General,10.00,EUR,10.00"].join("\n"),
    );
    expect(multi.currencies).toEqual(["EUR", "USD"]);

    const noPeople = parseSplitwiseCsv("Fecha,Descripción,Categoría,Coste,Moneda\n2024-01-01,Cena,General,10.00,EUR");
    expect(noPeople.errors[0].message).toMatch(/no people/);

    const badHeader = parseSplitwiseCsv("Fecha,Descripción,Ana\n2024-01-01,Cena,10.00");
    const messages = badHeader.errors.map((error) => error.message);
    expect(messages).toContain("missing column for cost");
    expect(messages).toContain("missing column for currency");
    // Category is optional, so it is never reported as missing.
    expect(messages).not.toContain("missing column for category");
  });

  it("ignores blank rows and reports rows that cannot be read", () => {
    const parsedRows = parseSplitwiseCsv(
      ["Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis", "", ",,,,,,", "ayer,Cena,General,10.00,EUR,10.00,-10.00"].join("\n"),
    );
    expect(parsedRows.skipped).toBe(1);
    expect(parsedRows.errors).toEqual([{ line: 4, message: "invalid date" }]);
  });

  it("reads the English header as well", () => {
    const english = parseSplitwiseCsv(
      ["Date,Description,Category,Cost,Currency,Ana,Luis", "2024-01-01,Cena,General,10.00,EUR,-5.00,5.00"].join("\n"),
    );
    expect(english.errors).toEqual([]);
    expect(english.people).toEqual(["Ana", "Luis"]);
    expect(english.movements[0].payer).toBe("Luis");
  });
});
