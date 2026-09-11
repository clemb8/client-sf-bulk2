import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getFileBody } from "../src/ingest/utils";

describe("getFileBody", () => {
  let dir: string;
  let csv: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "client-sf-bulk2-"));
    csv = join(dir, "accounts.csv");
    writeFileSync(csv, "Name,Type\nAcme,Customer\n", "utf8");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolves with the file's contents as UTF-8 text", async () => {
    await expect(getFileBody(csv)).resolves.toBe("Name,Type\nAcme,Customer\n");
  });

  it("resolves with a string, not a Buffer", async () => {
    expect(typeof (await getFileBody(csv))).toBe("string");
  });

  it("resolves an empty string for an empty file", async () => {
    const empty = join(dir, "empty.csv");
    writeFileSync(empty, "", "utf8");
    await expect(getFileBody(empty)).resolves.toBe("");
  });

  it("rejects with an Error when the file is missing", async () => {
    await expect(getFileBody(join(dir, "does-not-exist.csv"))).rejects.toBeInstanceOf(Error);
  });

  it("keeps the historical message text on the rejection", async () => {
    await expect(getFileBody(join(dir, "does-not-exist.csv"))).rejects.toThrow(
      /^Error while parsing the file :/,
    );
  });

  it("rejects with something that carries a stack", async () => {
    // The regression this locks in: getFileBody used to reject with a bare
    // template string, so consumers lost the stack entirely.
    const error = await getFileBody(join(dir, "does-not-exist.csv")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).stack).toBeTypeOf("string");
  });

  it("rejects when handed a directory rather than a file", async () => {
    await expect(getFileBody(dir)).rejects.toBeInstanceOf(Error);
  });
});
