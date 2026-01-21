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
  const expectedIdRef = useRef(null);
  const lastFetchedIdRef = useRef(null);

  /**
   * Effect: Handle formData.stakeHolder changes and fetch name if id exists but name is empty
   */
  useEffect(() => {
    if (!formData?.stakeHolder) {
      expectedIdRef.current = null;
      lastFetchedIdRef.current = null;
      setSelectedStakeholder(null);
      setInputValue("");
      return;
    }

    if (formData.stakeHolder.name) {
      setSelectedStakeholder(formData.stakeHolder);
      setInputValue(formData.stakeHolder.name);
      return;
    }

    const id = formData.stakeHolder.id;
    if (!id || !ZOHO) return;

    if (lastFetchedIdRef.current === id) {
      setSelectedStakeholder(formData.stakeHolder);
      setInputValue(formData.stakeHolder.name || "");
      return;
    }

    lastFetchedIdRef.current = id;
    expectedIdRef.current = id;

    ZOHO.CRM.API.getRecord({
      Entity: "Accounts",
      RecordID: id,
      approved: "both",
    })
      .then((response) => {
        if (expectedIdRef.current !== id) return;
        const name = response?.data?.[0]?.Account_Name || "";
        if (name) {
          const full = { id, name };
          handleInputChange("stakeHolder", full);
          setSelectedStakeholder(full);
          setInputValue(name);
        } else {
          setSelectedStakeholder(formData.stakeHolder);
          setInputValue("");
        }
      })
      .catch((err) => {
        if (expectedIdRef.current !== id) return;
        console.error("Error fetching stakeholder by id:", err);
        setSelectedStakeholder(formData.stakeHolder);
        setInputValue("");
      });
  }, [formData, ZOHO, handleInputChange]);

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
  );

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
