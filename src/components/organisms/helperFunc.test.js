import { resolveModuleStakeholder } from "./helperFunc";

describe("resolveModuleStakeholder", () => {
  test("uses the live Matter Stakeholder_1 lookup", () => {
    expect(
      resolveModuleStakeholder({
        Stakeholder_Auto: null,
        Stake_Holder: null,
        Stakeholder_1: { id: "account-1", name: "XYZ Pty Ltd" },
      })
    ).toEqual({ id: "account-1", name: "XYZ Pty Ltd" });
  });

  test("skips invalid legacy values and keeps legacy lookup support", () => {
    expect(
      resolveModuleStakeholder({
        Stakeholder_1: "",
        Stake_Holder: {},
        Stakeholder: { id: "account-2", name: "Legacy Account" },
      })
    ).toEqual({ id: "account-2", name: "Legacy Account" });
  });

  test("returns null when no usable lookup is present", () => {
    expect(resolveModuleStakeholder({ Stake_Holder: null })).toBeNull();
  });
});
