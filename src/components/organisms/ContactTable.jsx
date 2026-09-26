import React, { useState, useEffect } from "react";
import { moveApplicationHistoryToMain } from "../../services/moveApplicationHistory";
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
  Checkbox,
  FormControlLabel,
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

const getContactName = (contact) =>
  contact?.Full_Name ||
  contact?.full_name ||
  contact?.name ||
  contact?.Contact?.name ||
  `${contact?.First_Name || ""} ${contact?.Last_Name || ""}`.trim() ||
  "";

export const ContactDialog = ({
  openContactDialog,
  handleContactDialogClose,
  contacts = [],
  ZOHO,
  selectedRowData,
  onRecordMoved,
}) => {
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [displayContacts, setDisplayContacts] = useState(contacts);
  const [searchType, setSearchType] = useState("First_Name");
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [acknowledgedSavedVersion, setAcknowledgedSavedVersion] = useState(false);
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
      setAcknowledgedSavedVersion(false);
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
    if (!acknowledgedSavedVersion) return;
    if (!selectedContactId || !selectedRowData?.id) {
      setSnackbar({
        open: true,
        message: "Select a Contact and reopen the History entry if its record ID is missing.",
        severity: "error",
      });
      return;
    }

    const selectedContact =
      displayContacts.find((contact) => String(contact.id) === String(selectedContactId)) ||
      contacts.find((contact) => String(contact.id) === String(selectedContactId));
    if (!selectedContact) {
      setSnackbar({ open: true, message: "Selected Contact was not found.", severity: "error" });
      return;
    }

    setIsMoving(true);
    try {
      await moveApplicationHistoryToMain({
        ZOHO,
        sourceId: selectedRowData.id,
        destination: "contact",
        destinationId: selectedContactId,
        destinationName: getContactName(selectedContact),
      });
      if (onRecordMoved) onRecordMoved(selectedRowData.id);
      setSnackbar({ open: true, message: "History moved to Contact successfully.", severity: "success" });
      handleContactDialogClose();
    } catch (error) {
      console.error("Error moving History to Contact:", error);
      if (error.sourceDeleted) {
        if (onRecordMoved) onRecordMoved(selectedRowData.id);
        handleContactDialogClose();
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
      <MUIDialog
        open={openContactDialog}
        onClose={isMoving ? undefined : handleContactDialogClose}
        PaperProps={{
          sx: {
            minWidth: "600px",
            maxWidth: "800px",
            padding: "16px",
            fontSize: "9pt",
          },
        }}
      >
        <DialogContent sx={{ position: "relative" }}>
          {isMoving && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                zIndex: 1,
              }}
            >
              <CircularProgress size={48} />
            </Box>
          )}
          <Alert severity="warning" sx={{ mb: 2 }}>
            This move uses the last saved History entry. Unsaved changes in the edit form will be lost. Save them first, then reopen the entry to move it.
          </Alert>
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
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledgedSavedVersion}
                onChange={(event) => setAcknowledgedSavedVersion(event.target.checked)}
                disabled={isMoving}
              />
            }
            label="I understand that unsaved changes will not move."
            sx={{ mt: 1 }}
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
            disabled={!selectedContactId || !acknowledgedSavedVersion || isMoving}
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
