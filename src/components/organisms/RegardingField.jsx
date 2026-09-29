import React, { useState, useEffect, useRef } from "react";
import { FormControl, InputLabel, Select, MenuItem, TextField, Box } from "@mui/material";
import {
  CUSTOM_REGARDING_VALUE,
  getRegardingOptions,
} from "./helperFunc";

const RegardingField = ({ formData, handleInputChange, selectedRowData, picklistConfig }) => {
  const existingValue = formData?.regarding ?? selectedRowData?.regarding ?? "";
  const configuredOptions = React.useMemo(
    () => getRegardingOptions(formData?.result, undefined, picklistConfig),
    [formData?.result, picklistConfig]
  );

  const [selectedValue, setSelectedValue] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const optionSetKey = configuredOptions.join("\u0000");
  const contextKey = `${selectedRowData?.id ?? "new"}:${formData?.result ?? ""}:${optionSetKey}`;
  const previousContext = useRef(contextKey);

  useEffect(() => {
    const contextChanged = previousContext.current !== contextKey;
    previousContext.current = contextKey;

    // Manual text is mirrored into formData. Ignore that controlled value echo
    // so the editor stays open while the user types.
    if (!contextChanged && showManualInput && existingValue === manualInput) return;

    if (existingValue) {
      if (configuredOptions.includes(existingValue)) {
        setSelectedValue(existingValue);
        setManualInput("");
        setShowManualInput(false);
      } else {
        setSelectedValue(CUSTOM_REGARDING_VALUE);
        setManualInput(existingValue);
        setShowManualInput(true);
      }
    } else {
      setSelectedValue("");
      setManualInput("");
      setShowManualInput(false);
    }
  }, [configuredOptions, contextKey, existingValue, manualInput, showManualInput]);

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);

    if (value === CUSTOM_REGARDING_VALUE) {
      setShowManualInput(true);
      setManualInput("");
      handleInputChange("regarding", "");
    } else {
      setShowManualInput(false);
      setManualInput("");
      handleInputChange("regarding", value);
    }
  };

  const handleManualInputChange = (event) => {
    const value = event.target.value;
    setManualInput(value);
    handleInputChange("regarding", value);
  };

  return (
    <Box sx={{ width: "100%", mt: "3px" }}>
      <FormControl fullWidth size="small" variant="standard">
        <InputLabel id="regarding-label" sx={{ fontSize: "9pt" }}>
          Regarding
        </InputLabel>
        <Select
          labelId="regarding-label"
          id="regarding-select"
          value={selectedValue}
          onChange={handleSelectChange}
          sx={{ "& .MuiInputBase-root": { padding: "0 !important" }, fontSize: "9pt" }}
        >
          {configuredOptions.map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
              {option}
            </MenuItem>
          ))}
          <MenuItem value={CUSTOM_REGARDING_VALUE} sx={{ fontSize: "9pt" }}>
            Custom
          </MenuItem>
        </Select>
      </FormControl>

      {showManualInput ?
        <TextField
          label="Custom Regarding"
          fullWidth
          variant="standard"
          size="small"
          value={manualInput}
          onChange={handleManualInputChange}
          sx={{
            mt: 2,
            "& .MuiInputBase-input": { fontSize: "9pt" },
            "& .MuiInputLabel-root": { fontSize: "9pt" },
            "& .MuiFormHelperText-root": { fontSize: "9pt" },
          }}
        /> : <></>
      }
    </Box>
  );
};

export default RegardingField;
