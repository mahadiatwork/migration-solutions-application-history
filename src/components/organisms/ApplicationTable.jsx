import React, { useState } from "react";
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
} from "@mui/material";


const ApplicationTable = ({
  applications,
  selectedApplicationId,
  setSelectedApplicationId,
  currentContact,
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
          {applications.map((app) => (
            <TableRow key={app.id}>
              <TableCell>
                <Radio
                  checked={selectedApplicationId === app.id}
                  onChange={() => handleRowSelect(app.id)}
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
  handleDelete,
  formData,
  historyContacts,
  selectedRowData,
  currentContact,
}) => {
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const handleApplicationSelect = async () => {
    // console.log({ selectedRowData });
    // return;

    if (!selectedApplicationId) {
      setSnackbar({
        open: true,
        message: "Please select an application.",
        severity: "warning",
      });
      return;
    }

    try {


      // Create a new application history in the selected application
      const createApplicationHistory = await ZOHO.CRM.API.insertRecord({
        Entity: "Applications_History",
        APIData: {
          Name: historyContacts[0].Full_Name,
          Application: { id: selectedApplicationId },
          History_Details: selectedRowData.details,
          History_Result: selectedRowData.result,
          History_Type: selectedRowData.type,
          Regarding: selectedRowData.regarding,
          Duration_Min: selectedRowData.duration,
          Date: selectedRowData.date_time,
          Stakeholder: selectedRowData.stakeHolder,
        },
        Trigger: ["workflow"],
      });

      if (createApplicationHistory?.data[0]?.code === "SUCCESS") {
        const newHistoryId = createApplicationHistory.data[0].details.id;

        // Create ApplicationxContacts for all associated contacts
        for (const contact of historyContacts) {
          await ZOHO.CRM.API.insertRecord({
            Entity: "Application_Hstory",
            APIData: {
              Application_Hstory: { id: newHistoryId },
              Contact: { id: contact.id },
            },
            Trigger: ["workflow"],
          });
        }

        var func_name = "copy_attachment_form_contact_history_to_applicatio";
        var req_data = {
          arguments: JSON.stringify({
            fromModule: "History1",
            toModule: "Applications_History",
            fromID: selectedRowData?.id,
            ToID: newHistoryId,
          }),
        };

        await ZOHO.CRM.FUNCTIONS.execute(func_name, req_data).then(function (data) {
          console.log(data);
        });

        // Delete the current history and associated contacts
        await handleDelete();

        setSnackbar({
          open: true,
          message: "History moved successfully!",
          severity: "success",
        });
      } else {
        throw new Error("Failed to create new application history.");
      }
    } catch (error) {
      console.error("Error moving history:", error);
      setSnackbar({
        open: true,
        message: "Failed to move history.",
        severity: "error",
      });
    } finally {
      handleApplicationDialogClose();
    }
  };

  return (
    <>
      <MUIDialog
        open={openApplicationDialog}
        onClose={handleApplicationDialogClose}
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
            currentContact={currentContact}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleApplicationDialogClose} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={() => handleApplicationSelect(currentContact)}
            color="primary"
            disabled={!selectedApplicationId} // Disable if no application is selected
          >
            Move
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
