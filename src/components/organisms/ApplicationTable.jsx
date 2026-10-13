import React, { useEffect, useState } from "react";
import { moveApplicationHistoryToMatter } from "../../services/moveApplicationHistory";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Radio,
  Button,
  Dialog as MUIDialog,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";


const ApplicationTable = ({
  applications,
  selectedApplicationId,
  setSelectedApplicationId,
  sourceMatterId,
}) => {
  const handleRowSelect = (id) => {
    setSelectedApplicationId(id);
  };

  return (
    <TableContainer>
      <Table sx={{ fontSize: "9pt" }}>
        <TableHead>
          <TableRow></TableRow>
          <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
            {" "}
            {/* Custom header color */}
            <TableCell />
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Application No
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Type of Application
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              File Status
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              File Progress
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Visa Grant Date
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(Array.isArray(applications) ? applications : []).map((app) => (
            <TableRow key={app.id}>
              <TableCell>
                <Radio
                  checked={selectedApplicationId === app.id}
                  onChange={() => handleRowSelect(app.id)}
                  disabled={String(app.id) === String(sourceMatterId)}
                  sx={{ padding: "4px" }} // Reduce padding
                />
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>{app.Name}</TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {app.Type_of_Application}
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>{app.File_Status}</TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {app.File_Progress || "-"}
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {app.Visa_Grant_Date || "N/A"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const ApplicationDialog = ({
  openApplicationDialog,
  handleApplicationDialogClose,
  applications,
  ZOHO,
  selectedRowData,
  currentContact,
  historySummary,
  sourceMatterId,
  onRecordMoved,
}) => {
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  useEffect(() => {
    if (openApplicationDialog) setSelectedApplicationId(null);
  }, [openApplicationDialog]);

  const handleApplicationSelect = async () => {
    if (isMoving) return;
    if (!selectedApplicationId) {
      setSnackbar({
        open: true,
        message: "Please select an application.",
        severity: "warning",
      });
      return;
    }
    if (!selectedRowData?.id || !currentContact?.id) {
      setSnackbar({
        open: true,
        message: "The History or Contact could not be resolved. Close and reopen the record.",
        severity: "error",
      });
      return;
    }
    if (String(selectedApplicationId) === String(sourceMatterId)) {
      setSnackbar({
        open: true,
        message: "Select a different Matter from the current Matter.",
        severity: "warning",
      });
      return;
    }

    setIsMoving(true);
    try {
      const result = await moveApplicationHistoryToMatter({
        ZOHO,
        sourceId: selectedRowData.id,
        destinationMatterId: selectedApplicationId,
        destinationContactId: currentContact.id,
        historySummary,
      });
      setIsMoving(false);
      setSnackbar({
        open: true,
        message: "History moved to the selected Matter successfully.",
        severity: "success",
      });
      handleApplicationDialogClose();
      onRecordMoved?.(result.sourceId);
    } catch (error) {
      console.error("Error moving history:", error);
      setIsMoving(false);
      setSnackbar({
        open: true,
        message: error?.message || "Failed to move History to the selected Matter.",
        severity: "error",
      });
    }
  };

  return (
    <>
      <MUIDialog
        open={openApplicationDialog}
        onClose={isMoving ? undefined : handleApplicationDialogClose}
        PaperProps={{
          sx: {
            minWidth: "600px",
            maxWidth: "800px",
            padding: "16px",
            fontSize: "9pt", // Global font size for the dialog
          },
        }}
      >
        <DialogContent>
          <ApplicationTable
            applications={applications}
            selectedApplicationId={selectedApplicationId}
            setSelectedApplicationId={setSelectedApplicationId}
            sourceMatterId={sourceMatterId}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleApplicationDialogClose} color="secondary" disabled={isMoving}>
            Cancel
          </Button>
          <Button
            onClick={handleApplicationSelect}
            color="primary"
            variant="contained"
            disabled={!selectedApplicationId || isMoving}
            sx={{ fontSize: "9pt", display: "flex", alignItems: "center", gap: 1 }}
          >
            {isMoving && <CircularProgress size={16} color="inherit" />}
            {isMoving ? "Moving..." : "Move"}
          </Button>
        </DialogActions>
      </MUIDialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ApplicationDialog;
