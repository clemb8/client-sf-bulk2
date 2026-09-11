import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import BulkAPI from "../../src/BulkAPI";
import type { E2eConfig } from "./env";

export function createClient(config: E2eConfig, accessToken: string): BulkAPI {
  return new BulkAPI({
    accessToken,
    apiVersion: config.apiVersion,
    instanceUrl: config.instanceUrl,
  });
}

/**
 * A marker unique to one suite run, written into every record this suite
 * creates. It is what makes cleanup targeted: a failed run leaves records that
 * can be found and removed by hand without guessing which are ours.
 */
export function runTag(): string {
  return `client-sf-bulk2-e2e-${randomUUID().slice(0, 8)}`;
}

/** Minimal RFC-4180 field quoting. Enough for the values this suite writes. */
function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildInsertCsv(config: E2eConfig, tag: string): string {
  const header = quote(config.labelField);
  const rows = Array.from(
    { length: config.recordCount },
    (_unused, index) => quote(`${tag} ${String(index + 1).padStart(3, "0")}`),
  );
  return [header, ...rows].join("\n") + "\n";
}

export function buildDeleteCsv(ids: string[]): string {
  return ['"Id"', ...ids.map(quote)].join("\n") + "\n";
}

/**
 * Parse a Bulk API CSV response into objects.
 *
 * Deliberately small rather than a dependency: the suite only reads results
 * this library produced, and adding a CSV parser to devDependencies would
 * widen the audit surface of a package whose point is a clean audit.
 */
export function parseCsv(csv: string): Record<string, string>[] {
  const rows = splitRows(csv);
  const header = rows.shift();
  if (header === undefined) return [];
  return rows
    .filter((row) => row.length > 0 && row.some((cell) => cell.length > 0))
    .map((row) => {
      const record: Record<string, string> = {};
      header.forEach((name, index) => {
        record[name] = row[index] ?? "";
      });
      return record;
    });
}

function splitRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (inQuotes) {
      if (char === '"') {
        if (csv[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * A scratch directory for the CSV files `uploadJobData` reads.
 *
 * The library's upload takes a *filename*, not a buffer, so the suite has to
 * put its payload on disk. Files go to the system temp dir, never the project
 * root — the README and every example write `./accounts.csv` there, and this
 * suite is not going to add to that.
 */
export class TempFiles {
  private readonly dir: string;

  constructor() {
    this.dir = mkdtempSync(join(tmpdir(), "client-sf-bulk2-e2e-"));
  }

  write(name: string, content: string): string {
    const path = join(this.dir, name);
    writeFileSync(path, content, "utf8");
    return path;
  }

  dispose(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** Record ids from a successfulResults CSV, which carries an `sf__Id` column. */
export function idsFromSuccessfulResults(csv: string): string[] {
  return parseCsv(csv)
    .map((row) => row.sf__Id ?? row.Id ?? "")
    .filter((id) => id.length > 0);
}

/**
 * Delete the records this suite created, through the same Bulk API path.
 *
 * Best-effort by design: a cleanup failure is reported but must not mask the
 * assertion failure that preceded it. The run tag on every record means a
 * missed cleanup is recoverable by hand.
 */
export async function deleteRecords(
  client: BulkAPI,
  config: E2eConfig,
  files: TempFiles,
  ids: string[],
): Promise<{ deleted: number; error?: string }> {
  if (ids.length === 0) return { deleted: 0 };
  try {
    const path = files.write("delete.csv", buildDeleteCsv(ids));
    const job = await client.createAndStartJob(
      { object: config.object, operation: "delete" },
      path,
    );
    const state = await client.waitJobEnd(job.id, config.pollDelayMs);
    if (state !== "JobComplete") {
      return { deleted: 0, error: `delete job ended in state ${state}` };
    }
    return { deleted: ids.length };
  } catch (error) {
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
