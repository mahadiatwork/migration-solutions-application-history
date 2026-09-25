import React, { useState, useEffect, useRef } from "react";
import { FormControl, InputLabel, Select, MenuItem, TextField, Box } from "@mui/material";
import { getRegardingOptions, shouldOfferManualOther } from "./helperFunc";

const RegardingField = ({ formData, handleInputChange, selectedRowData, picklistConfig }) => {
  const existingValue = formData?.regarding ?? selectedRowData?.regarding ?? "";
  const configuredOptions = React.useMemo(
    () => getRegardingOptions(formData?.type, undefined, picklistConfig),
    [formData?.type, picklistConfig]
  );
  const predefinedOptions = React.useMemo(
    () =>
      getRegardingOptions(
        formData?.type,
        selectedRowData ? existingValue : undefined,
        picklistConfig
      ),
    [existingValue, formData?.type, picklistConfig, selectedRowData]
  );
  const manualOtherEnabled = shouldOfferManualOther(
    picklistConfig,
    configuredOptions
  );
  const selectOptions = manualOtherEnabled
    ? predefinedOptions.filter((option) => option !== "Other")
    : predefinedOptions;

  const [selectedValue, setSelectedValue] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false); // New state to control visibility
  const previousType = useRef(formData?.type);

  useEffect(() => {
    const typeChanged = previousType.current !== formData?.type;
    previousType.current = formData?.type;

    // Manual text is mirrored into formData, so do not collapse the editor on
    // every keystroke.
    if (!typeChanged && manualOtherEnabled && showManualInput) return;

    if (existingValue) {
      if (predefinedOptions.includes(existingValue)) {
        setSelectedValue(existingValue);
        setManualInput("");
        setShowManualInput(
          manualOtherEnabled && existingValue === "Other"
        );
      } else if (manualOtherEnabled) {
        setSelectedValue("Other");
        setManualInput(existingValue);
        setShowManualInput(true);
      } else {
        setSelectedValue("");
        setManualInput("");
        setShowManualInput(false);
      }
    } else {
      setSelectedValue("");
      setManualInput("");
      setShowManualInput(false);
    }
  }, [existingValue, formData?.type, manualOtherEnabled, predefinedOptions, showManualInput]);
  

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);
  
    if (value === "Other" && manualOtherEnabled) {
      setShowManualInput(true); 
      setManualInput(""); 
      handleInputChange("regarding", "Other"); // ✅ Set "Other" in formData
    } else {
      console.log({value})
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
          {selectOptions.map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
              {option}
            </MenuItem>
          ))}
          {manualOtherEnabled && (
            <MenuItem value="Other" sx={{ fontSize: "9pt" }}>
              Other (Manually enter)
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {showManualInput ? 
        <TextField
          label="Enter your custom regarding"
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
