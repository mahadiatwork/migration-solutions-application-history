import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Radio,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import {
  fetchStakeholderMatters,
  moveApplicationHistoryToMain,
  moveApplicationHistoryToStakeholderMatter,
} from "../../services/moveApplicationHistory";
import MatterTable from "./MatterTable";

const commonStyles = {
  fontSize: "9pt",
  "& .MuiInputBase-root": { fontSize: "9pt" },
  "& .MuiInputLabel-root": { fontSize: "9pt" },
  "& .MuiButton-root": { fontSize: "9pt" },
  "& .MuiTableCell-root": { fontSize: "9pt" },
};

export default function StakeholderMoveDialog({
  open,
  onClose,
  ZOHO,
  selectedRowData,
  suggestedStakeholder,
  sourceMatterId,
  historySummary,
  matterSummaryReady = true,
  onRecordMoved,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [matters, setMatters] = useState([]);
  const [selectedMatterId, setSelectedMatterId] = useState(null);
  const [mattersLoaded, setMattersLoaded] = useState(false);
  const [isLoadingMatters, setIsLoadingMatters] = useState(false);
  const [movingDestination, setMovingDestination] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const matterRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const isMoving = movingDestination !== null;
  const suggestedId = suggestedStakeholder?.id;
  const suggestedName = suggestedStakeholder?.name;

  useEffect(() => {
    matterRequestRef.current += 1;
    searchRequestRef.current += 1;
    if (open) {
      setQuery("");
      setSelected(null);
      setResults(suggestedId ? [{ id: suggestedId, name: suggestedName || "" }] : []);
      setMatters([]);
      setSelectedMatterId(null);
      setMattersLoaded(false);
      setIsSearching(false);
      setIsLoadingMatters(false);
    } else {
      setIsSearching(false);
      setIsLoadingMatters(false);
    }
  }, [open, suggestedId, suggestedName]);

  useEffect(() => {
    if (
      sourceMatterId != null &&
      selectedMatterId != null &&
      String(sourceMatterId) === String(selectedMatterId)
    ) {
      setSelectedMatterId(null);
    }
  }, [selectedMatterId, sourceMatterId]);

  const clearMatters = () => {
    matterRequestRef.current += 1;
    setMatters([]);
    setSelectedMatterId(null);
    setMattersLoaded(false);
    setIsLoadingMatters(false);
  };

  const closeDialog = () => {
    clearMatters();
    searchRequestRef.current += 1;
    setIsSearching(false);
    onClose();
  };

  const selectStakeholder = (stakeholder) => {
    if (String(stakeholder?.id) !== String(selected?.id)) clearMatters();
    setSelected(stakeholder);
  };

  const search = async () => {
    if (!query.trim() || isSearching) return;
    clearMatters();
    setSelected(null);
    setResults([]);
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setIsSearching(true);
    try {
      const response = await ZOHO.CRM.API.searchRecord({
        Entity: "Accounts",
        Type: "word",
        Query: query.trim(),
      });
      if (searchRequestRef.current !== requestId) return;
      const rows = response?.statusText?.toLowerCase() === "nocontent" ? [] : response?.data;
      if (!Array.isArray(rows)) {
        throw new Error("CRM did not return Stakeholder search results.");
      }
      const stakeholders = rows
        .filter((record) => record?.id)
        .map((record) => ({ id: record.id, name: record.Account_Name || record.name || "" }));
      setResults(stakeholders);
      if (!stakeholders.length) {
        setSnackbar({ open: true, message: "No matching Stakeholders found.", severity: "info" });
      }
    } catch (error) {
      if (searchRequestRef.current !== requestId) return;
      setSnackbar({
        open: true,
        message: error.message || "Stakeholder search failed.",
        severity: "error",
      });
    } finally {
      if (searchRequestRef.current === requestId) setIsSearching(false);
    }
  };

  const loadMatters = async () => {
    if (!selected?.id) return;
    const requestId = matterRequestRef.current + 1;
    matterRequestRef.current = requestId;
    setIsLoadingMatters(true);
    setSelectedMatterId(null);
    try {
      const relatedMatters = await fetchStakeholderMatters({
        ZOHO,
        stakeholderId: selected.id,
      });
      if (!Array.isArray(relatedMatters)) {
        throw new Error("CRM did not return the Stakeholder's Matters.");
      }
      if (matterRequestRef.current !== requestId) return;
      setMatters(relatedMatters);
      setMattersLoaded(true);
      const selectableMatters = relatedMatters.filter(
        (matter) => sourceMatterId == null || String(matter?.id) !== String(sourceMatterId)
      );
      if (!selectableMatters.length) {
        setSnackbar({
          open: true,
          message:
            "This Stakeholder has no other Matters. You can still move the History to Stakeholder History.",
          severity: "info",
        });
      }
    } catch (error) {
      if (matterRequestRef.current !== requestId) return;
      console.error("Error loading Stakeholder Matters:", error);
      setMatters([]);
      setMattersLoaded(false);
      setSnackbar({
        open: true,
        message: error.message || "Failed to load the Stakeholder's Matters.",
        severity: "error",
      });
    } finally {
      if (matterRequestRef.current === requestId) setIsLoadingMatters(false);
    }
  };

  const moveToStakeholderHistory = async () => {
    if (!selected?.id || !selectedRowData?.id) return;
    setMovingDestination("stakeholder");
    try {
      await moveApplicationHistoryToMain({
        ZOHO,
        sourceId: selectedRowData.id,
        destination: "stakeholder",
        destinationId: selected.id,
        destinationName: selected.name,
      });
      if (onRecordMoved) onRecordMoved(selectedRowData.id);
      setSnackbar({
        open: true,
        message: "History moved to Stakeholder History successfully.",
        severity: "success",
      });
      closeDialog();
    } catch (error) {
      console.error("Error moving History to Stakeholder:", error);
      if (error.sourceDeleted) {
        if (onRecordMoved) onRecordMoved(selectedRowData.id);
        closeDialog();
      }
      setSnackbar({
        open: true,
        message: error.message || "History move failed.",
        severity: error.sourceDeleted ? "warning" : "error",
      });
    } finally {
      setMovingDestination(null);
    }
  };

  const moveToStakeholderMatter = async () => {
    if (!matterSummaryReady) {
      setSnackbar({
        open: true,
        message: "Wait for the History Matter summary to finish loading.",
        severity: "info",
      });
      return;
    }
    if (!selected?.id || !selectedMatterId || !selectedRowData?.id) {
      setSnackbar({
        open: true,
        message: "Select a Stakeholder and one of their Matters.",
        severity: "error",
      });
      return;
    }
    if (sourceMatterId != null && String(selectedMatterId) === String(sourceMatterId)) {
      setSnackbar({
        open: true,
        message: "Select a different Matter from the current Matter.",
        severity: "warning",
      });
      return;
    }

    setMovingDestination("matter");
    try {
      await moveApplicationHistoryToStakeholderMatter({
        ZOHO,
        sourceId: selectedRowData.id,
        destinationMatterId: selectedMatterId,
        destinationStakeholderId: selected.id,
        historySummary,
      });
      if (onRecordMoved) onRecordMoved(selectedRowData.id);
      setSnackbar({
        open: true,
        message: "History moved to the selected Stakeholder Matter successfully.",
        severity: "success",
      });
      closeDialog();
    } catch (error) {
      console.error("Error moving History to Stakeholder Matter:", error);
      setSnackbar({
        open: true,
        message: error.message || "History could not be moved to the selected Stakeholder Matter.",
        severity: "error",
      });
    } finally {
      setMovingDestination(null);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={isMoving ? undefined : closeDialog}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: { maxWidth: "1000px", fontSize: "9pt" } }}
      >
        <DialogTitle sx={{ fontSize: "12pt" }}>Move History to Stakeholder</DialogTitle>
        <DialogContent>
          <Box display="flex" gap={1} mt={1}>
            <TextField
              label="Search Stakeholders"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") search();
              }}
              disabled={isSearching || isMoving}
              size="small"
              fullWidth
              sx={commonStyles}
            />
            <Button
              onClick={search}
              disabled={isSearching || isMoving || !query.trim()}
              variant="outlined"
              sx={commonStyles}
            >
              {isSearching ? <CircularProgress size={18} /> : "Search"}
            </Button>
          </Box>
          <List dense sx={{ maxHeight: 240, overflowY: "auto", mt: 1 }}>
            {results.map((stakeholder) => (
              <ListItemButton
                key={stakeholder.id}
                selected={String(selected?.id) === String(stakeholder.id)}
                onClick={() => selectStakeholder(stakeholder)}
                disabled={isSearching || isMoving}
              >
                <Radio
                  checked={String(selected?.id) === String(stakeholder.id)}
                  size="small"
                  inputProps={{
                    "aria-label": `Select Stakeholder ${stakeholder.name || stakeholder.id}`,
                  }}
                />
                <ListItemText primary={stakeholder.name || stakeholder.id} />
              </ListItemButton>
            ))}
          </List>
          <Box display="flex" justifyContent="flex-end" mt={1}>
            <Button
              variant="outlined"
              onClick={loadMatters}
              disabled={
                !selected?.id ||
                !sourceMatterId ||
                isLoadingMatters ||
                isSearching ||
                isMoving
              }
              sx={commonStyles}
            >
              {isLoadingMatters ? "Loading Matters..." : "View Stakeholder Matters"}
            </Button>
          </Box>

          {mattersLoaded && (
            <Box mt={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: "bold", fontSize: "9pt" }}>
                Select Target Matter:
              </Typography>
              {matters.length > 0 ? (
                <MatterTable
                  matters={matters}
                  selectedMatterId={selectedMatterId}
                  setSelectedMatterId={setSelectedMatterId}
                  sourceMatterId={sourceMatterId}
                />
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>
                  This Stakeholder has no Matters. You can still move the History to Stakeholder History.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button onClick={closeDialog} disabled={isMoving}>
            Cancel
          </Button>
          <Button
            onClick={moveToStakeholderHistory}
            disabled={!selected?.id || isSearching || isMoving}
            variant="outlined"
            color="success"
            sx={{ ...commonStyles, display: "flex", alignItems: "center", gap: 1 }}
          >
            {movingDestination === "stakeholder" && (
              <CircularProgress size={16} color="inherit" />
            )}
            {movingDestination === "stakeholder"
              ? "Moving..."
              : "Move to Stakeholder History"}
          </Button>
          <Button
            onClick={moveToStakeholderMatter}
            disabled={
              !selected?.id ||
              !selectedMatterId ||
              !sourceMatterId ||
              !matterSummaryReady ||
              isSearching ||
              isMoving
            }
            variant="contained"
            color="primary"
            sx={{ ...commonStyles, display: "flex", alignItems: "center", gap: 1 }}
          >
            {movingDestination === "matter" && <CircularProgress size={16} color="inherit" />}
            {movingDestination === "matter" ? "Moving..." : "Move to Selected Matter"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={8000}
        onClose={() => setSnackbar((state) => ({ ...state, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((state) => ({ ...state, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
