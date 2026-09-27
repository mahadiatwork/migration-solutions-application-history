import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RegardingField from "./RegardingField";

describe("RegardingField", () => {
  const picklistConfig = {
    _source: "custom_module",
    regarding: {
      Call: ["2nd Followup", "Follow up"],
      Meeting: ["Meeting agenda"],
    },
  };

  test("loads Regarding options from Activity Type rather than Category", () => {
    render(
      <RegardingField
        formData={{
          type: "Communication & Meetings",
          result: "Call",
          regarding: "",
        }}
        handleInputChange={jest.fn()}
        selectedRowData={null}
        picklistConfig={picklistConfig}
      />
    );

    fireEvent.mouseDown(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "2nd Followup" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Follow up" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Meeting agenda" })).toBeNull();
  });

  test("refreshes options when Activity Type changes", () => {
    const props = {
      handleInputChange: jest.fn(),
      selectedRowData: null,
      picklistConfig,
    };
    const { rerender } = render(
      <RegardingField
        {...props}
        formData={{
          type: "Communication & Meetings",
          result: "Call",
          regarding: "",
        }}
      />
    );
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "2nd Followup" })).not.toBeNull();

    rerender(
      <RegardingField
        {...props}
        formData={{
          type: "Communication & Meetings",
          result: "Meeting",
          regarding: "",
        }}
      />
    );

    expect(screen.getByRole("option", { name: "Meeting agenda" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "2nd Followup" })).toBeNull();
  });
});
