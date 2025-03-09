import React, { useState, useEffect } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
} from "@mui/material";
import { getRegardingOptions } from "./helperFunc";


const RegardingField = ({ formData, handleInputChange }) => {
  const predefinedOptions = getRegardingOptions(formData.type) || []; // Get predefined options dynamically

  const [selectedValue, setSelectedValue] = useState("");
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    if (formData.regarding) {
      if (predefinedOptions.includes(formData.regarding)) {
        setSelectedValue(formData.regarding);
        setManualInput("");
      } else {
        setSelectedValue("Other");
        setManualInput(formData.regarding);
      }
    } else {
      setSelectedValue("");
      setManualInput("");
    }
  }, [formData.regarding, predefinedOptions]);

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);

    if (value !== "Other") {
      setManualInput(""); // Clear manual input if predefined option is selected
      handleInputChange("regarding", value); // Pass the selected value to parent
    } else {
      handleInputChange("regarding", ""); // Clear regarding in parent
    }
  };

  const handleManualInputChange = (event) => {
    const value = event.target.value;
    setManualInput(value);
    handleInputChange("regarding", value); // Pass the manual input to parent
  };

  return (
    <Box sx={{ width: "100%", mt: "3px" }}>
      <FormControl fullWidth size="small" variant="standard">
        <InputLabel
          id="regarding-label"
          sx={{
            fontSize: "9pt",
          }}
        >
          Regarding
        </InputLabel>
        <Select
          labelId="regarding-label"
          id="regarding-select"
          value={selectedValue}
          onChange={handleSelectChange}
          sx={{
            "& .MuiInputBase-root": {
              padding: "0 !important",
            },
            fontSize: "9pt",
          }}
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
      {selectedValue === "Other" && (
        <TextField
          label="Enter your custom regarding"
          fullWidth
          variant="standard"
          size="small"
          value={manualInput}
          onChange={handleManualInputChange}
          sx={{
            mt: 2,
            "& .MuiInputBase-input": {
              fontSize: "9pt", // Set input text size
            },
            "& .MuiInputLabel-root": {
              fontSize: "9pt", // Set label text size
            },
            "& .MuiFormHelperText-root": {
              fontSize: "9pt", // Set helper text size if needed
            },
          }}
        />
      )}
    </Box>
  );
};

export default RegardingField;
