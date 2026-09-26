import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Radio,
  Snackbar,
  TextField,
} from "@mui/material";
import { moveApplicationHistoryToMain } from "../../services/moveApplicationHistory";

export default function StakeholderMoveDialog({
  open,
  onClose,
  ZOHO,
  selectedRowData,
  suggestedStakeholder,
  onRecordMoved,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [acknowledgedSavedVersion, setAcknowledgedSavedVersion] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const suggestedId = suggestedStakeholder?.id;
  const suggestedName = suggestedStakeholder?.name;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
    setAcknowledgedSavedVersion(false);
    setResults(suggestedId ? [{ id: suggestedId, name: suggestedName || "" }] : []);
  }, [open, suggestedId, suggestedName]);

  const search = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const response = await ZOHO.CRM.API.searchRecord({
        Entity: "Accounts",
        Type: "word",
        Query: query.trim(),
      });
      const rows = response?.statusText?.toLowerCase() === "nocontent" ? [] : response?.data;
      if (!Array.isArray(rows)) {
        throw new Error("CRM did not return Stakeholder search results.");
      }
      const stakeholders = rows
        .filter((record) => record?.id)
        .map((record) => ({ id: record.id, name: record.Account_Name || record.name || "" }));
      setResults(stakeholders);
      setSelected(null);
      if (!stakeholders.length) {
        setSnackbar({ open: true, message: "No matching Stakeholders found.", severity: "info" });
      }
    } catch (error) {
      setSnackbar({ open: true, message: error.message || "Stakeholder search failed.", severity: "error" });
    } finally {
      setIsSearching(false);
    }
  };

  const move = async () => {
    if (!selected?.id || !selectedRowData?.id || !acknowledgedSavedVersion) return;
    setIsMoving(true);
    try {
      await moveApplicationHistoryToMain({
        ZOHO,
        sourceId: selectedRowData.id,
        destination: "stakeholder",
        destinationId: selected.id,
        destinationName: selected.name,
      });
      if (onRecordMoved) onRecordMoved(selectedRowData.id);
      setSnackbar({ open: true, message: "History moved to Stakeholder successfully.", severity: "success" });
      onClose();
    } catch (error) {
      console.error("Error moving History to Stakeholder:", error);
      if (error.sourceDeleted) {
        if (onRecordMoved) onRecordMoved(selectedRowData.id);
        onClose();
      }
      setSnackbar({
        open: true,
        message: error.message || "History move failed.",
        severity: error.sourceDeleted ? "warning" : "error",
      });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={isMoving ? undefined : onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: "12pt" }}>Move History to Stakeholder</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This move uses the last saved History entry. Unsaved changes in the edit form will be lost. Save them first, then reopen the entry to move it.
          </Alert>
          <Box display="flex" gap={1} mt={1}>
            <TextField
              label="Search Stakeholders"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") search(); }}
              disabled={isMoving}
              size="small"
              fullWidth
            />
            <Button onClick={search} disabled={isSearching || isMoving || !query.trim()} variant="outlined">
              {isSearching ? <CircularProgress size={18} /> : "Search"}
            </Button>
          </Box>
          <List dense sx={{ maxHeight: 300, overflowY: "auto", mt: 1 }}>
            {results.map((stakeholder) => (
              <ListItemButton
                key={stakeholder.id}
                selected={String(selected?.id) === String(stakeholder.id)}
                onClick={() => setSelected(stakeholder)}
                disabled={isMoving}
              >
                <Radio checked={String(selected?.id) === String(stakeholder.id)} size="small" />
                <ListItemText primary={stakeholder.name || stakeholder.id} />
              </ListItemButton>
            ))}
          </List>
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledgedSavedVersion}
                onChange={(event) => setAcknowledgedSavedVersion(event.target.checked)}
                disabled={isMoving}
              />
            }
            label="I understand that unsaved changes will not move."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isMoving}>Cancel</Button>
          <Button onClick={move} disabled={!selected?.id || !acknowledgedSavedVersion || isMoving} variant="contained">
            {isMoving ? "Moving..." : "Move"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={8000} onClose={() => setSnackbar((state) => ({ ...state, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((state) => ({ ...state, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
