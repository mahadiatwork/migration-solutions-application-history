import React, { useState, useEffect } from "react";
import { FormControl, InputLabel, Select, MenuItem, TextField, Box } from "@mui/material";
import { getRegardingOptions } from "./helperFunc";

const RegardingField = ({ formData, handleInputChange, selectedRowData }) => {
  const existingValue = selectedRowData?.regarding || formData.regarding;
  const predefinedOptions = getRegardingOptions(formData.type, existingValue);

  const [selectedValue, setSelectedValue] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false); // New state to control visibility

  useEffect(() => {
    if (existingValue) {
      if (predefinedOptions.includes(existingValue)) {
        setSelectedValue(existingValue);
        setManualInput("");
      } else {
        setSelectedValue("Other");
        setManualInput(existingValue);
      }
    } else {
      setSelectedValue("");
      setManualInput("");
    }
    if (existingValue !== "Other") {
      setShowManualInput(false); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync with formData.type; existingValue/predefinedOptions derived
  }, [formData.type]);
  

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);
  
    if (value === "Other") {
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
          {predefinedOptions.map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
              {option}
            </MenuItem>
          ))}
          <MenuItem value="Other" sx={{ fontSize: "9pt" }}>
            Other (Manually enter)
          </MenuItem>
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
