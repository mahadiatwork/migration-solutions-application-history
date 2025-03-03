import { useEffect, useState, useRef, useCallback } from "react";
import { Autocomplete, TextField } from "@mui/material";

export default function Stakeholder({
  formData,
  handleInputChange,
  ZOHO,
  currentModuleData,
  selectedRowData,
}) {
  const [stakeholders, setStakeholders] = useState([]);
  const [selectedStakeholder, setSelectedStakeholder] = useState(null);
  const [inputValue, setInputValue] = useState("");

  const debounceTimeoutRef = useRef(null);

  /**
   * Effect: Prepopulate selectedStakeholder (Runs Only Once when Mounted)
   */
  useEffect(() => {

    if (formData?.stakeHolder) {
      setSelectedStakeholder(formData.stakeHolder);
      setInputValue(formData.stakeHolder.name || "");
    } else if (!selectedRowData?.stakeHolder && currentModuleData?.Stake_Holder) {
      setSelectedStakeholder({
        id: currentModuleData?.Stake_Holder?.id,
        name: currentModuleData?.Stake_Holder?.name,
      });
      setInputValue(currentModuleData?.Stake_Holder?.name || "");
    } else if (selectedRowData?.stakeHolder) {
      setSelectedStakeholder({
        id: selectedRowData?.stakeHolder?.id,
        name: selectedRowData?.stakeHolder?.name,
      });
      setInputValue(selectedRowData?.stakeHolder?.name || ""); // Fixed inputValue source
    }
  }, []); // ✅ Runs only once when the component mounts

  /**
   * Fetch stakeholders from Zoho API based on query
   */
  const fetchStakeholders = useCallback(
    async (query) => {
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
    },
    [ZOHO]
  ); // ✅ Added ZOHO as a dependency

  /**
   * Debounced Input Change Handler
   */
  const handleInputChangeWithDebounce = useCallback(
    (event, newValue) => {
      setInputValue(newValue || "");

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        fetchStakeholders(newValue || "");
      }, 500);
    },
    [fetchStakeholders]
  );

  /**
   * Handle Stakeholder Selection
   */
  const handleChange = (event, newValue) => {
    setSelectedStakeholder(newValue);
    handleInputChange("stakeHolder", newValue);

    // ✅ If user clears the field, also clear input value
    if (!newValue) {
      setInputValue("");
    }
  };

  return (
    <Autocomplete
      options={stakeholders}
      getOptionLabel={(option) => option?.name || ""}
      value={selectedStakeholder}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChangeWithDebounce}
      clearOnEscape
      freeSolo
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
