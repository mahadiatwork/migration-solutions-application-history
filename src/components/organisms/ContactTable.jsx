import React, { useState, useEffect } from "react";
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
  Box,
  TextField,
  MenuItem,
  Typography,
  CircularProgress,
} from "@mui/material";

const commonStyles = {
  fontSize: "9pt",
  "& .MuiInputBase-root": { fontSize: "9pt" },
  "& .MuiInputLabel-root": { fontSize: "9pt" },
  "& .MuiButton-root": { fontSize: "9pt" },
  "& .MuiTableCell-root": { fontSize: "9pt" },
  "& .MuiMenuItem-root": { fontSize: "9pt" },
};

const ContactTable = ({
  contacts,
  selectedContactId,
  setSelectedContactId,
}) => {
  const handleRowSelect = (id) => {
    setSelectedContactId(id);
  };

  return (
    <TableContainer sx={{ maxHeight: 300 }}>
      <Table size="small" sx={{ fontSize: "9pt" }}>
        <TableHead>
          <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
            <TableCell width="40px" />
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              First Name
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Last Name
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Email
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Mobile
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              MS File Number
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contacts.length > 0 ? (
            contacts.map((contact) => (
              <TableRow
                key={contact.id}
                hover
                onClick={() => handleRowSelect(contact.id)}
                style={{ cursor: "pointer" }}
              >
                <TableCell padding="checkbox">
                  <Radio
                    checked={selectedContactId === contact.id}
                    onChange={() => handleRowSelect(contact.id)}
                    sx={{ padding: "4px" }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: "9pt" }}>
                  {contact.First_Name || contact.first_name || "N/A"}
                </TableCell>
                <TableCell sx={{ fontSize: "9pt" }}>
                  {contact.Last_Name || contact.last_name || "N/A"}
                </TableCell>
                <TableCell sx={{ fontSize: "9pt" }}>
                  {contact.Email || contact.email || "No Email"}
                </TableCell>
                <TableCell sx={{ fontSize: "9pt" }}>
                  {contact.Mobile || contact.mobile || "N/A"}
                </TableCell>
                <TableCell sx={{ fontSize: "9pt" }}>
                  {contact.ID_Number || contact.id_number || "N/A"}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ fontSize: "9pt" }}>
                No contacts found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export const ContactDialog = ({
  openContactDialog,
  handleContactDialogClose,
  contacts = [],
  ZOHO,
  handleDelete,
  selectedRowData,
  onRecordMoved,
}) => {
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [displayContacts, setDisplayContacts] = useState(contacts);
  const [searchType, setSearchType] = useState("First_Name");
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    setDisplayContacts(contacts);
  }, [contacts]);

  useEffect(() => {
    if (openContactDialog) {
      setSelectedContactId(null);
      setSearchText("");
      setIsSearching(false);
    }
  }, [openContactDialog]);

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const handleSearch = async () => {
    if (!ZOHO || !searchText.trim()) {
      setDisplayContacts(contacts);
      return;
    }

    setIsSearching(true);
    try {
      let searchResults = await ZOHO.CRM.API.searchRecord({
        Entity: "Contacts",
        Type: searchType === "Email" ? "email" : "criteria",
        Query:
          searchType === "Email"
            ? searchText.trim()
            : `(${searchType}:equals:${searchText.trim()})`,
      });

      if (searchResults.data && searchResults.data.length > 0) {
        const formattedContacts = searchResults.data.map((c) => ({
          id: c.id,
          First_Name: c.First_Name || "N/A",
          Last_Name: c.Last_Name || "N/A",
          Email: c.Email || "No Email",
          Mobile: c.Mobile || "N/A",
          Full_Name: `${c.First_Name || ""} ${c.Last_Name || ""}`.trim() || c.Full_Name || "Unknown",
          ID_Number: c.ID_Number || "N/A",
        }));

        // Merge with existing contacts avoiding duplicates
        const combinedMap = new Map();
        formattedContacts.forEach((item) => combinedMap.set(item.id, item));
        contacts.forEach((item) => {
          if (!combinedMap.has(item.id)) {
            combinedMap.set(item.id, item);
          }
        });
        setDisplayContacts(Array.from(combinedMap.values()));
      } else {
        setSnackbar({
          open: true,
          message: "No matching contacts found in CRM.",
          severity: "info",
        });
      }
    } catch (error) {
      console.error("Error searching contacts:", error);
      setSnackbar({
        open: true,
        message: "Failed to search contacts.",
        severity: "error",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleContactSelect = async () => {
    if (!selectedContactId) {
      setSnackbar({
        open: true,
        message: "Please select a contact.",
        severity: "warning",
      });
      return;
    }

    const selectedContact = displayContacts.find((c) => c.id === selectedContactId);
    if (!selectedContact) {
      setSnackbar({
        open: true,
        message: "Selected contact not found.",
        severity: "error",
      });
      return;
    }

    setIsMoving(true);
    try {
      const contactFullName =
        selectedContact.Full_Name ||
        `${selectedContact.First_Name || ""} ${selectedContact.Last_Name || ""}`.trim() ||
        "Contact History";

      // 1. Create a new record in History1 (Contact History)
      const createContactHistory = await ZOHO.CRM.API.insertRecord({
        Entity: "History1",
        APIData: {
          Name: contactFullName,
          History_Details: selectedRowData?.details || selectedRowData?.History_Details || "",
          History_Result: selectedRowData?.result || selectedRowData?.History_Result || "",
          History_Type: selectedRowData?.type || selectedRowData?.History_Type || "",
          Regarding: selectedRowData?.regarding || selectedRowData?.Regarding || "",
          Duration_Min: selectedRowData?.duration != null && selectedRowData?.duration !== "N/A"
            ? String(selectedRowData.duration)
            : "",
          Date: selectedRowData?.date_time || selectedRowData?.Date || new Date().toISOString(),
          Stakeholder: selectedRowData?.stakeHolder
            ? { id: selectedRowData.stakeHolder.id }
            : null,
          Owner: selectedRowData?.Owner ? { id: selectedRowData.Owner.id } : null,
        },
        Trigger: ["workflow"],
      });

      if (createContactHistory?.data?.[0]?.code === "SUCCESS") {
        const newHistoryId = createContactHistory.data[0].details.id;

        // 2. Insert junction record in History_X_Contacts linking to the selected Contact
        try {
          await ZOHO.CRM.API.insertRecord({
            Entity: "History_X_Contacts",
            APIData: {
              Contact_History_Info: { id: newHistoryId },
              Contact_Details: { id: selectedContact.id },
              Stakeholder: selectedRowData?.stakeHolder
                ? { id: selectedRowData.stakeHolder.id }
                : null,
            },
            Trigger: ["workflow"],
          });
        } catch (juncError) {
          console.error(`Error inserting History_X_Contacts for contact ID ${selectedContact.id}:`, juncError);
        }

        // 3. Copy attachments from Applications_History to History1
        var func_name = "copy_attachment_form_contact_history_to_applicatio";
        var req_data = {
          arguments: JSON.stringify({
            fromModule: "Applications_History",
            toModule: "History1",
            fromID: selectedRowData?.id,
            ToID: newHistoryId,
          }),
        };

        try {
          await ZOHO.CRM.FUNCTIONS.execute(func_name, req_data);
        } catch (funcError) {
          console.warn("Attachment copy function warning/error:", funcError);
        }

        // 4. Delete the original Applications_History record and its junction records
        await handleDelete();

        setSnackbar({
          open: true,
          message: "History moved to Contact successfully!",
          severity: "success",
        });

        if (onRecordMoved) {
          onRecordMoved(selectedRowData?.id);
        }
      } else {
        const errMsg = createContactHistory?.data?.[0]?.message || "Failed to create Contact history.";
        throw new Error(errMsg);
      }
    } catch (error) {
      console.error("Error moving history to Contact:", error);
      setSnackbar({
        open: true,
        message: `Failed to move history: ${error.message || "Unknown error"}`,
        severity: "error",
      });
    } finally {
      setIsMoving(false);
      handleContactDialogClose();
    }
  };

  return (
    <>
      <MUIDialog
        open={openContactDialog}
        onClose={handleContactDialogClose}
        PaperProps={{
          sx: {
            minWidth: "600px",
            maxWidth: "800px",
            padding: "16px",
            fontSize: "9pt",
          },
        }}
      >
        <DialogContent>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              select
              label="Search By"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              size="small"
              sx={{ width: "150px", ...commonStyles }}
            >
              <MenuItem value="First_Name">First Name</MenuItem>
              <MenuItem value="Last_Name">Last Name</MenuItem>
              <MenuItem value="Email">Email</MenuItem>
              <MenuItem value="Mobile">Mobile</MenuItem>
              <MenuItem value="ID_Number">MS File Number</MenuItem>
            </TextField>

            <TextField
              label="Search Contact"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              fullWidth
              size="small"
              sx={commonStyles}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={isSearching}
              sx={{ width: "120px", ...commonStyles }}
            >
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold", fontSize: "9pt" }}>
            Select Target Contact:
          </Typography>

          <ContactTable
            contacts={displayContacts}
            selectedContactId={selectedContactId}
            setSelectedContactId={setSelectedContactId}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleContactDialogClose} color="secondary" disabled={isMoving} sx={commonStyles}>
            Cancel
          </Button>
          <Button
            onClick={handleContactSelect}
            color="primary"
            variant="contained"
            disabled={!selectedContactId || isMoving}
            sx={{ ...commonStyles, display: "flex", alignItems: "center", gap: 1 }}
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

export default ContactDialog;
