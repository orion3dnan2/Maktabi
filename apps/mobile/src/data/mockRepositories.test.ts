import { describe, expect, it } from "vitest";
import { createMockRepositories, OFFICE_ID } from "./mockRepositories";
import type { Client } from "@maktabi/domain";
const fresh: Client = {
  id: "new",
  officeId: OFFICE_ID,
  kind: "PERSON",
  displayName: "سارة — تجريبي",
  phone: "+249000000199",
  whatsapp: "+249000000199",
  createdAt: "2026-09-24T00:00:00Z",
};
describe("mock client repository", () => {
  it("creates, edits, isolates copies and scopes office lists", async () => {
    const { clientRepository: r } = createMockRepositories();
    await r.save(fresh);
    await r.save({ ...fresh, displayName: "سارة المعدل" });
    const saved = await r.getById(fresh.id);
    expect(saved?.displayName).toBe("سارة المعدل");
    saved!.displayName = "mutated";
    expect((await r.getById(fresh.id))?.displayName).toBe("سارة المعدل");
    expect(await r.listByOffice("other")).toEqual([]);
    expect(
      (await r.listByOffice(OFFICE_ID)).filter((c) => c.id === fresh.id),
    ).toHaveLength(1);
    expect(await r.getById("missing")).toBeNull();
  });
  it("rejects invalid data and cross-office clients", async () => {
    const { clientRepository: r } = createMockRepositories();
    await expect(r.save({ ...fresh, displayName: "" })).rejects.toThrow();
    await expect(r.save({ ...fresh, officeId: "other" })).rejects.toThrow();
  });
  it("propagates a client rename to matter party labels", async () => {
    const { clientRepository: c, matterRepository: m } =
      createMockRepositories();
    const existing = (await c.getById("c1"))!;
    await c.save({ ...existing, displayName: "اسم معدل" });
    expect(
      (await m.listByClient("c1")).every((m) =>
        m.parties
          .filter((p) => p.clientId === "c1")
          .every((p) => p.displayName === "اسم معدل"),
      ),
    ).toBe(true);
  });
});
describe("mock matter relationships", () => {
  it("finds primary and secondary client links", async () => {
    const { matterRepository: r } = createMockRepositories();
    expect((await r.listByClient("c1")).length).toBeGreaterThan(1);
    expect((await r.listByClient("c2")).some((m) => m.id === "m1")).toBe(true);
    expect(await r.listByClient("missing")).toEqual([]);
  });
  it("saves a multi-party matter and refreshes profile activity", async () => {
    const { matterRepository: r, profileRepository: p } =
      createMockRepositories();
    const m = (await r.getById("m1"))!;
    await r.save({
      ...m,
      id: "new-m",
      reference: "NEW-1",
      parties: m.parties.map((p) => ({ ...p, matterId: "new-m" })),
    });
    expect((await r.listByClient("c2")).some((m) => m.id === "new-m")).toBe(
      true,
    );
    expect((await p.getByClient("c2")).activity[0]?.title).toContain("NEW-1");
  });
  it("rejects missing primary, unknown client, cross-office and duplicate reference", async () => {
    const { matterRepository: r } = createMockRepositories();
    const m = (await r.getById("m1"))!;
    await expect(r.save({ ...m, parties: [] })).rejects.toThrow();
    await expect(
      r.save({
        ...m,
        parties: m.parties.map((p) => ({ ...p, clientId: "missing" })),
      }),
    ).rejects.toThrow();
    await expect(r.save({ ...m, officeId: "other" })).rejects.toThrow();
    await expect(
      r.save({
        ...m,
        id: "duplicate",
        parties: m.parties.map((p) => ({ ...p, matterId: "duplicate" })),
      }),
    ).rejects.toThrow("رقم الملف مستخدم بالفعل");
  });
  it("returns isolated data and filters active office matters", async () => {
    const { matterRepository: r } = createMockRepositories();
    const m = (await r.getById("m1"))!;
    m.parties[0]!.displayName = "mutated";
    expect((await r.getById("m1"))?.parties[0]?.displayName).not.toBe(
      "mutated",
    );
    expect(
      (await r.listActive(OFFICE_ID)).every((m) => m.status === "ACTIVE"),
    ).toBe(true);
    expect(await r.listByOffice("other")).toEqual([]);
  });
  it("keeps trust, fees and expenses separate and new clients at zero", async () => {
    const { profileRepository: r, clientRepository: c } =
      createMockRepositories();
    const p = await r.getByClient("c1");
    expect(p).toMatchObject({
      agreedFees: 18000000,
      paidFees: 6000000,
      trustBalance: 2500000,
      expenses: 1000000,
    });
    await c.save(fresh);
    expect(await r.getByClient(fresh.id)).toMatchObject({
      agreedFees: 0,
      paidFees: 0,
      trustBalance: 0,
      expenses: 0,
      receipts: [],
      documents: [],
    });
  });
});
