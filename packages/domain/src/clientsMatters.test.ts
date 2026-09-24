import { describe, expect, it } from "vitest";
import {
  clientKinds,
  filterClients,
  filterMatters,
  matterTypes,
  normalizeArabic,
  typeFields,
  validateClient,
  validateMatter,
  type Client,
  type Matter,
  type MatterFilters,
  type MatterType,
} from "./index";
const client: Client = {
  id: "c1",
  officeId: "o1",
  displayName: "أَمـجد إدريس",
  kind: "PERSON",
  phone: "+249000000101",
  whatsapp: "+249000000101",
  createdAt: "2026-09-24T00:00:00Z",
};
const matter: Matter = {
  id: "m1",
  officeId: "o1",
  reference: "M-1",
  title: "مطالبة مدنية",
  type: "CIVIL",
  authority: "محكمة تجريبية",
  openedAt: "2026-09-24",
  status: "ACTIVE",
  details: {},
  parties: [
    {
      id: "p1",
      matterId: "m1",
      clientId: "c1",
      displayName: client.displayName,
      role: "CLIENT",
      isPrimary: true,
    },
  ],
};
const filters: MatterFilters = {
  query: "",
  status: "",
  type: "",
  authority: "",
  sort: "recent",
};
describe("client validation and Arabic search", () => {
  it("rejects punctuation-only phone numbers", () => {
    expect(validateClient({ ...client, phone: "-------" }).phone).toBeTruthy();
  });
  it("accepts an individual without optional fields", () =>
    expect(validateClient(client)).toEqual({}));
  it("rejects blank required fields and malformed contact data", () => {
    expect(
      validateClient({
        ...client,
        displayName: " ",
        phone: "bad",
        whatsapp: "",
        email: "invalid",
      }),
    ).toMatchObject({
      displayName: expect.any(String),
      phone: expect.any(String),
      whatsapp: expect.any(String),
      email: expect.any(String),
    });
  });
  it("requires organization contact, email and address", () => {
    const result = validateClient({ ...client, kind: "ORGANIZATION" });
    expect(Object.keys(result).sort()).toEqual([
      "address",
      "contactPerson",
      "email",
    ]);
    expect(
      validateClient({
        ...client,
        kind: "ORGANIZATION",
        contactPerson: "سلمى",
        email: "test@example.test",
        address: "عنوان",
      }),
    ).toEqual({});
  });
  it("normalizes diacritics, tatweel, alef, ya and Arabic digits", () => {
    expect(normalizeArabic(" أَمـجد إدريس ١٢٣ ")).toBe("امجد ادريس 123");
    expect(normalizeArabic("على")).toBe("علي");
    expect(filterClients([client], "امجد ادريس")).toHaveLength(1);
    expect(filterClients([client], "٠٠٠٠٠٠١٠١")).toHaveLength(1);
  });
  it("combines query and type without mutating the input", () => {
    expect(filterClients([client], "امجد", "ORGANIZATION")).toEqual([]);
    expect(filterClients([client], "missing")).toEqual([]);
    expect(filterClients([client], "", Object.keys(clientKinds)[0])).toEqual([
      client,
    ]);
  });
});
describe("matter invariants", () => {
  it("rejects a second primary flag even on an opposing party", () => {
    expect(
      validateMatter({
        ...matter,
        parties: [
          ...matter.parties,
          {
            id: "opponent",
            matterId: matter.id,
            displayName: "طرف مقابل",
            role: "OPPONENT",
            isPrimary: true,
          },
        ],
      }).parties,
    ).toBeTruthy();
  });
  it.each(Object.keys(matterTypes) as MatterType[])(
    "accepts %s with a primary party",
    (type) => {
      expect(validateMatter({ ...matter, type })).toEqual({});
      expect(typeFields[type]).toBeDefined();
    },
  );
  it("requires exactly one primary registered client", () => {
    for (const parties of [
      [],
      [{ ...matter.parties[0]!, isPrimary: false }],
      [{ ...matter.parties[0]!, role: "OPPONENT" as const }],
      [{ ...matter.parties[0]!, clientId: undefined }],
      [matter.parties[0]!, { ...matter.parties[0]!, id: "p2" }],
    ])
      expect(validateMatter({ ...matter, parties }).parties).toBeTruthy();
  });
  it("allows additional clients and opposing parties", () =>
    expect(
      validateMatter({
        ...matter,
        parties: [
          ...matter.parties,
          {
            id: "p2",
            matterId: "m1",
            displayName: "طرف",
            role: "OPPONENT",
            isPrimary: false,
          },
        ],
      }),
    ).toEqual({}));
  it("rejects parties linked to another matter and blank names", () => {
    expect(
      validateMatter({
        ...matter,
        parties: [{ ...matter.parties[0]!, matterId: "other" }],
      }).parties,
    ).toBeTruthy();
    expect(
      validateMatter({
        ...matter,
        parties: [{ ...matter.parties[0]!, displayName: " " }],
      }).parties,
    ).toBeTruthy();
  });
  it("validates mandatory fields and real calendar dates", () => {
    expect(
      validateMatter({
        ...matter,
        reference: " ",
        title: "",
        authority: "",
        openedAt: "2026-02-30",
      }),
    ).toMatchObject({
      reference: expect.any(String),
      title: expect.any(String),
      authority: expect.any(String),
      openedAt: expect.any(String),
    });
  });
  it("rejects unsupported types/statuses", () => {
    expect(
      validateMatter({ ...matter, type: "INVALID" as MatterType }).type,
    ).toBeTruthy();
    expect(
      validateMatter({ ...matter, status: "INVALID" as Matter["status"] })
        .status,
    ).toBeTruthy();
  });
  it("validates labour dates and chronology", () => {
    expect(
      validateMatter({
        ...matter,
        type: "LABOUR",
        details: { employmentStart: "2026-02-30" },
      }).employmentStart,
    ).toBeTruthy();
    expect(
      validateMatter({
        ...matter,
        type: "LABOUR",
        details: { employmentStart: "2026-03-01", employmentEnd: "2026-01-01" },
      }).employmentEnd,
    ).toBeTruthy();
  });
});
describe("matter filtering and ordering", () => {
  const second: Matter = {
    ...matter,
    id: "m2",
    reference: "M-2",
    type: "LABOUR",
    status: "CLOSED",
    authority: "جهة أخرى",
    openedAt: "2026-09-25",
    nextEventAt: "2026-10-01T09:00:00Z",
  };
  it("searches Arabic party names", () =>
    expect(filterMatters([matter], { ...filters, query: "امجد" })).toEqual([
      matter,
    ]));
  it("combines status, type and authority", () => {
    expect(
      filterMatters([matter, second], {
        ...filters,
        status: "CLOSED",
        type: "LABOUR",
        authority: "جهة أخرى",
      }),
    ).toEqual([second]);
    expect(filterMatters([matter], { ...filters, type: "CRIMINAL" })).toEqual(
      [],
    );
  });
  it("orders by open date, reference and next event with undated last", () => {
    const source = [matter, second];
    expect(filterMatters(source, filters)[0]?.id).toBe("m2");
    expect(
      filterMatters(source, { ...filters, sort: "reference" })[0]?.id,
    ).toBe("m1");
    expect(filterMatters(source, { ...filters, sort: "next" })[0]?.id).toBe(
      "m2",
    );
    expect(source[0]?.id).toBe("m1");
  });
});
