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

  test("shows ordered Fruit Regarding options when only the Category has a mapping", () => {
    render(
      <RegardingField
        formData={{ type: "Fruit", result: "Apple", regarding: "Pear" }}
        handleInputChange={jest.fn()}
        selectedRowData={{ id: "history-fruit", regarding: "Pear" }}
        picklistConfig={{
          _source: "custom_module",
          regarding: { Fruit: ["Pear", "Peach"], _default: ["General"] },
        }}
      />
    );

    expect(screen.queryByLabelText("Custom Regarding")).toBeNull();
    expect(screen.getByRole("combobox").textContent).toContain("Pear");
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Pear", "Peach", "Custom",
    ]);
  });

  test.each([
    { activityOptions: ["Activity-specific"] },
    { activityOptions: [] },
  ])("preserves an explicit Activity Type mapping: $activityOptions", ({ activityOptions }) => {
    render(
      <RegardingField
        formData={{ type: "Fruit", result: "Apple", regarding: "" }}
        handleInputChange={jest.fn()}
        selectedRowData={null}
        picklistConfig={{
          _source: "custom_module",
          regarding: { Apple: activityOptions, Fruit: ["Pear"] },
        }}
      />
    );
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      ...activityOptions, "Custom",
    ]);
    expect(screen.queryByRole("option", { name: "Pear" })).toBeNull();
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

  test.each([
    ["CRM configuration is unavailable", undefined, "Call"],
    [
      "CRM configuration has no Regarding mappings",
      { _source: "custom_module", regarding: {} },
      "Unconfigured activity",
    ],
    [
      "the selected activity has an explicitly empty Regarding list",
      {
        _source: "custom_module",
        regarding: { "Unconfigured activity": [] },
      },
      "Unconfigured activity",
    ],
  ])("offers Custom when %s", (_description, config, result) => {
    render(
      <RegardingField
        formData={{
          type: "Communication & Meetings",
          result,
          regarding: "",
        }}
        handleInputChange={jest.fn()}
        selectedRowData={null}
        picklistConfig={config}
      />
    );

    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Custom" })).not.toBeNull();
  });

  test("reserves Custom for manual entry when CRM configuration contains reserved values", () => {
    const handleInputChange = jest.fn();
    render(
      <RegardingField
        formData={{
          type: "Communication & Meetings",
          result: "Call",
          regarding: "",
        }}
        handleInputChange={handleInputChange}
        selectedRowData={null}
        picklistConfig={{
          _source: "custom_module",
          regarding: {
            Call: ["Follow up", "Custom", "__custom_regarding__"],
          },
        }}
      />
    );

    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option", { name: "Custom" })).toHaveLength(1);
    expect(
      screen.queryByRole("option", { name: "__custom_regarding__" })
    ).toBeNull();

    fireEvent.click(screen.getByRole("option", { name: "Custom" }));
    expect(screen.getByLabelText("Custom Regarding")).not.toBeNull();
    expect(handleInputChange).toHaveBeenCalledWith("regarding", "");
    expect(handleInputChange).not.toHaveBeenCalledWith("regarding", "Custom");
  });

  test("always offers Custom and saves only the typed text", () => {
    const Harness = () => {
      const [formData, setFormData] = React.useState({
        type: "Communication & Meetings",
        result: "Call",
        regarding: "",
      });
      const handleInputChange = (field, value) => {
        setFormData((current) => ({ ...current, [field]: value }));
      };
      return (
        <>
          <RegardingField
            formData={formData}
            handleInputChange={handleInputChange}
            selectedRowData={null}
            picklistConfig={picklistConfig}
          />
          <span data-testid="saved-regarding">{formData.regarding}</span>
        </>
      );
    };

    render(<Harness />);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Custom" }));

    const customInput = screen.getByLabelText("Custom Regarding");
    fireEvent.change(customInput, { target: { value: "Client requested a callback" } });
    expect(screen.getByTestId("saved-regarding").textContent).toBe(
      "Client requested a callback"
    );

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Follow up" }));
    expect(screen.queryByLabelText("Custom Regarding")).toBeNull();
    expect(screen.getByTestId("saved-regarding").textContent).toBe("Follow up");
  });

  test("reopens a saved nonconfigured Regarding value in the Custom text box", () => {
    render(
      <RegardingField
        formData={{
          type: "Communication & Meetings",
          result: "Call",
          regarding: "Client-specific note",
        }}
        handleInputChange={jest.fn()}
        selectedRowData={{ id: "history-1", regarding: "Client-specific note" }}
        picklistConfig={picklistConfig}
      />
    );

    expect(screen.getByLabelText("Custom Regarding").value).toBe(
      "Client-specific note"
    );
  });

  test("keeps a configured Regarding value as a normal selection", () => {
    render(
      <RegardingField
        formData={{
          type: "Communication & Meetings",
          result: "Call",
          regarding: "Follow up",
        }}
        handleInputChange={jest.fn()}
        selectedRowData={{ id: "history-1", regarding: "Follow up" }}
        picklistConfig={picklistConfig}
      />
    );

    expect(screen.queryByLabelText("Custom Regarding")).toBeNull();
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Custom" })).not.toBeNull();
  });

  test("leaves Custom mode when refreshed configuration contains the saved value", () => {
    const props = {
      formData: {
        type: "Communication & Meetings",
        result: "Call",
        regarding: "CRM supplied option",
      },
      handleInputChange: jest.fn(),
      selectedRowData: { id: "history-1", regarding: "CRM supplied option" },
    };
    const { rerender } = render(
      <RegardingField {...props} picklistConfig={picklistConfig} />
    );
    expect(screen.getByLabelText("Custom Regarding").value).toBe(
      "CRM supplied option"
    );

    rerender(
      <RegardingField
        {...props}
        picklistConfig={{
          ...picklistConfig,
          regarding: {
            ...picklistConfig.regarding,
            Call: ["2nd Followup", "Follow up", "CRM supplied option"],
          },
        }}
      />
    );

    expect(screen.queryByLabelText("Custom Regarding")).toBeNull();
    expect(screen.getByRole("combobox").textContent).toContain(
      "CRM supplied option"
    );
  });
});
