import { describe, expect, it } from "vitest";
import { vaLoad } from "./load";

const nora = { id: "nora", firstName: "Nora" };
const pia = { id: "pia", firstName: "Pia" };

describe("VA load", () => {
  it("gives each VA the client's full week and counts a repeated pair once", () => {
    const rows = vaLoad(
      [pia, nora],
      [
        { vaId: "nora", clientId: "acme", hoursPerWeek: 20 },
        { vaId: "pia", clientId: "acme", hoursPerWeek: 20 },
        { vaId: "nora", clientId: "acme", hoursPerWeek: 20 },
        { vaId: "nora", clientId: "other", hoursPerWeek: null },
      ],
    );
    expect(rows.map((row) => [row.firstName, row.clients, row.hoursPerWeek])).toEqual([
      ["Nora", 2, 20],
      ["Pia", 1, 20],
    ]);
  });

  it("keeps an open VA with no assignment at zero clients and an em dash when nothing is done", () => {
    const [row] = vaLoad([nora], [], [{ vaId: "nora", done: 0, onTimeRate: null, overdue: 1 }]);
    expect(row).toMatchObject({ clients: 0, hoursPerWeek: 0, done: 0, onTimeRate: null, overdue: 1 });
  });
});
