import { describe, expect, test } from "bun:test";
import { collectPages } from "./pagination";

describe("complete habit history", () => {
  test("includes recent marks beyond the 1000-row API cap", async () => {
    const history = Array.from({ length: 1017 }, (_, id) => ({ id }));
    const result = await collectPages(async (from, to) => ({
      data: history.slice(from, to + 1), error: null,
    }));
    expect(result).toHaveLength(1017);
    expect(result[1016]).toEqual({ id: 1016 });
  });

  test("does not treat a failed page as empty history", async () => {
    await expect(collectPages(async () => ({ data: null, error: { message: "Falha de leitura" } })))
      .rejects.toThrow("Falha de leitura");
  });
});