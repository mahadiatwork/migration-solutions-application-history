import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
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

const getContactId = (contact) =>
  contact?.id || contact?.Contact?.id || null;

const getContactName = (contact) =>
  contact?.Full_Name ||
  contact?.full_name ||
  contact?.name ||
  contact?.Contact?.name ||
  `${contact?.First_Name || ""} ${contact?.Last_Name || ""}`.trim() ||
  "";

const formatMultiSelect = (value) => {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    const joined = value.filter(Boolean).join(", ");
    return joined || null;
  }
  return String(value);
};

const formatDuration = (value) => {
  if (value == null || value === "" || value === "N/A") return null;
  return String(value);
};

export const ContactDialog = ({
  openContactDialog,
  handleContactDialogClose,
  contacts = [],
  ZOHO,
  handleDelete,
  selectedRowData,
  formData,
  selectedOwner,
  historyContacts = [],
  currentModuleData,
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

    if (!selectedRowData?.id) {
      setSnackbar({
        open: true,
        message: "History record data is missing. Please close and try again.",
        severity: "error",
      });
      return;
    }

    const selectedContact =
      displayContacts.find((c) => c.id === selectedContactId) ||
      contacts.find((c) => c.id === selectedContactId);

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
      const contactsToLink = new Map();
      const addContact = (contact) => {
        const id = getContactId(contact);
        if (!id) return;
        const key = String(id);
        if (!contactsToLink.has(key)) {
          contactsToLink.set(key, { ...contact, id: key });
        }
      };

      (Array.isArray(historyContacts) ? historyContacts : []).forEach(addContact);
      (Array.isArray(formData?.Participants) ? formData.Participants : []).forEach(addContact);

      try {
        const relatedParticipants = await ZOHO.CRM.API.getRelatedRecords({
          Entity: "Applications_History",
          RecordID: selectedRowData.id,
          RelatedList: "Contacts4",
          page: 1,
          per_page: 200,
        });
        (relatedParticipants?.data || []).forEach((record) => {
          addContact({
            id: record?.Contact?.id,
            Full_Name: record?.Contact?.name,
          });
        });
      } catch (relatedError) {
        console.warn("Could not fetch Contacts4 participants for move:", relatedError);
      }

      addContact(selectedContact);

      if (contactsToLink.size === 0) {
        setSnackbar({
          open: true,
          message: "No contacts associated with this history. Please add at least one contact.",
          severity: "error",
        });
        return;
      }

      const linkedContacts = Array.from(contactsToLink.values());
      const joinedNames = linkedContacts
        .map(getContactName)
        .filter(Boolean)
        .join(", ");
      const historyName =
        getContactName(selectedContact) || joinedNames || "Contact History";

      const stakeHolder =
        formData?.stakeHolder ??
        formData?.stakeHolder ??
        selectedRowData?.stakeHolder ??
        selectedRowData?.stakeHolder;
      const stakeholderId =
        stakeHolder && typeof stakeHolder === "object"
          ? stakeHolder.id ?? stakeHolder.Id ?? stakeHolder.ID
          : null;
      const stakeholderForApi =
        stakeholderId != null ? { id: String(stakeholderId) } : null;

      const ownerForApi = selectedOwner?.id
        ? { id: selectedOwner.id }
        : selectedRowData?.Owner?.id
          ? { id: selectedRowData.Owner.id }
          : null;

      const dateValue = formData?.date_time ?? formData?.date_time ?? selectedRowData?.date_time;
      const formattedDate = dateValue
        ? dayjs(dateValue).format("YYYY-MM-DDTHH:mm:ssZ")
        : null;

      const apiData = {
        Name: historyName,
        History_Details_Plain: formData?.details ?? selectedRowData?.details ?? "",
        History_Result: formData?.result ?? selectedRowData?.result ?? "",
        History_Type: formData?.type ?? selectedRowData?.type ?? "",
        Regarding: formData?.regarding ?? selectedRowData?.regarding ?? "",
        Duration: formatDuration(formData?.duration ?? selectedRowData?.duration),
        Date: formattedDate,
        Stakeholder: stakeholderForApi,
        ...(ownerForApi ? { Owner: ownerForApi } : {}),
      };

      const currentApplicationId = currentModuleData?.id;
      const matterFields = currentApplicationId
        ? {
            Matter: { id: currentApplicationId },
            Matter_No: currentModuleData?.Name || null,
            Current_Stage: currentModuleData?.Current_Stage || null,
            Matter_Progress: formatMultiSelect(currentModuleData?.Matter_Progress),
          }
        : {};

      const insertHistory1 = (payload) =>
        ZOHO.CRM.API.insertRecord({
          Entity: "History1",
          APIData: payload,
          Trigger: ["workflow"],
        });

      let createContactHistory = await insertHistory1({ ...apiData, ...matterFields });
      if (
        createContactHistory?.data?.[0]?.code !== "SUCCESS" &&
        Object.keys(matterFields).length > 0
      ) {
        createContactHistory = await insertHistory1(apiData);
      }

      if (createContactHistory?.data?.[0]?.code === "SUCCESS") {
        const newHistoryId = createContactHistory.data[0].details.id;

        for (const contact of linkedContacts) {
          const contactId = getContactId(contact);
          if (!contactId) continue;
          try {
            await ZOHO.CRM.API.insertRecord({
              Entity: "History_X_Contacts",
              APIData: {
                Contact_History_Info: { id: newHistoryId },
                Contact_Details: { id: contactId },
              },
              Trigger: ["workflow"],
            });
          } catch (juncError) {
            console.error(
              `Error inserting History_X_Contacts for contact ID ${contactId}:`,
              juncError
            );
          }
        }

        let attachmentWarning = false;
        try {
          await ZOHO.CRM.FUNCTIONS.execute(
            "copy_attachment_form_contact_history_to_applicatio",
            {
              arguments: JSON.stringify({
                fromModule: "Applications_History",
                toModule: "History1",
                fromID: selectedRowData.id,
                ToID: newHistoryId,
              }),
            }
          );
        } catch (funcError) {
          attachmentWarning = true;
          console.warn("Attachment copy function warning/error:", funcError);
        }

        await handleDelete();

        setSnackbar({
          open: true,
          message: attachmentWarning
            ? "History moved to Contact, but attachments may be missing."
            : "History moved to Contact successfully!",
          severity: attachmentWarning ? "warning" : "success",
        });

        if (onRecordMoved) {
          onRecordMoved(selectedRowData.id);
        }

        handleContactDialogClose();
      } else {
        const errMsg =
          createContactHistory?.data?.[0]?.message ||
          "Failed to create Contact history.";
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
