import { useEffect, useState, useRef, useCallback } from "react";
import { Autocomplete, TextField } from "@mui/material";

export default function Stakeholder({ formData, handleInputChange, ZOHO, currentModuleData }) {
  const [stakeholders, setStakeholders] = useState([]);
  const [selectedStakeholder, setSelectedStakeholder] = useState(null);
  const [inputValue, setInputValue] = useState("");

  const debounceTimeoutRef = useRef(null);

  console.log("mahadi", { currentModuleData, selectedStakeholder });

  /**
   * Effect 1: Prepopulate selectedStakeholder
   * Priority order:
   * 1. If formData has a selected stakeholder, use that.
   * 2. Else, use currentModuleData (fallback).
   */
  useEffect(() => {
    if (formData?.stakeHolder) {
      setSelectedStakeholder(formData.stakeHolder);
      setInputValue(formData.stakeHolder.name || "");
    } else if (currentModuleData) {
      setSelectedStakeholder({
        id: currentModuleData.id,
        name: currentModuleData.Account_Name,
      });
      setInputValue(currentModuleData.Account_Name || "");
    } else {
      setSelectedStakeholder(null);
      setInputValue("");
    }
  }, [formData, currentModuleData]);

  /**
   * Fetch stakeholders from Zoho API based on query
   */
  const fetchStakeholders = async (query) => {
    if (!ZOHO || !query.trim()) return;

    try {
      const results = await ZOHO.CRM.API.searchRecord({
        Entity: "Accounts",
        Type: "word",
        Query: query.trim(),
      });

      if (results.data) {
        const formattedResults = results.data.map((record) => ({
          id: record.id,
          name: record.Account_Name,
        }));
        setStakeholders(formattedResults);
      }
    } catch (error) {
      console.error("Error fetching stakeholders:", error);
    }
  };

  /**
   * Debounced input change handler
   */
  const handleInputChangeWithDebounce = useCallback(
    (event, newValue) => {
      setInputValue(newValue);

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        fetchStakeholders(newValue);
      }, 500);
    },
    [fetchStakeholders]
  );

  /**
   * Handle stakeholder selection
   */
  const handleChange = (event, newValue) => {
    setSelectedStakeholder(newValue);
    handleInputChange("stakeHolder", newValue);
  };

  return (
    <Autocomplete
      options={stakeholders}
      getOptionLabel={(option) => option?.name || ""}
      value={selectedStakeholder}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChangeWithDebounce}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Stakeholder"
          variant="standard"
          sx={{
            "& .MuiInputLabel-root": { fontSize: "9pt" }, // Label size
            "& .MuiInputBase-input": { fontSize: "9pt" }, // Input text size
          }}
        />
      )}
    />
  );
}
