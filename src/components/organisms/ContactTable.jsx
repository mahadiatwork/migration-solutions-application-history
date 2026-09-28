import React, { useEffect, useRef, useState } from "react";
import {
  fetchContactMatters,
  moveApplicationHistoryToMain,
  moveApplicationHistoryToMatter,
} from "../../services/moveApplicationHistory";
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
  DialogTitle,
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
                    checked={String(selectedContactId) === String(contact.id)}
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

const displayValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(displayValue).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    return value.display_value || value.actual_value || value.name || value.Account_Name || "";
  }
  return value == null ? "" : String(value);
};

const matterStakeholder = (matter) =>
  matter?.Stakeholder_Auto || matter?.Stakeholder_1 || matter?.Stake_Holder || null;

const MatterTable = ({
  matters,
  selectedMatterId,
  setSelectedMatterId,
  sourceMatterId,
}) => (
  <TableContainer sx={{ maxHeight: 260, mt: 1, border: "1px solid #e0e0e0" }}>
    <Table size="small" sx={{ fontSize: "9pt" }}>
      <TableHead>
        <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
          <TableCell width="40px" />
          <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>Matter No</TableCell>
          <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>Current Stage</TableCell>
          <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>Matter Progress</TableCell>
          <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>Stakeholder</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {matters.map((matter) => {
          const matterId = String(matter.id);
          const isCurrentMatter = sourceMatterId != null &&
            matterId === String(sourceMatterId);
          const matterNumber = displayValue(matter.Name) || matterId;
          return (
            <TableRow
              key={matterId}
              hover={!isCurrentMatter}
              onClick={() => {
                if (!isCurrentMatter) setSelectedMatterId(matterId);
              }}
              sx={{
                cursor: isCurrentMatter ? "default" : "pointer",
                opacity: isCurrentMatter ? 0.55 : 1,
              }}
            >
              <TableCell padding="checkbox">
                <Radio
                  checked={String(selectedMatterId) === matterId}
                  onChange={() => setSelectedMatterId(matterId)}
                  disabled={isCurrentMatter}
                  inputProps={{ "aria-label": `Select Matter ${matterNumber}` }}
                  sx={{ padding: "4px" }}
                />
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {matterNumber}{isCurrentMatter ? " (Current Matter)" : ""}
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {displayValue(matter.Current_Stage) || "-"}
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {displayValue(matter.Matter_Progress) || "-"}
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {displayValue(matterStakeholder(matter)) || "-"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);

export const ContactDialog = ({
  openContactDialog,
  handleContactDialogClose,
  contacts = [],
  ZOHO,
  selectedRowData,
  sourceMatterId,
  onRecordMoved,
}) => {
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [displayContacts, setDisplayContacts] = useState(contacts);
  const [searchType, setSearchType] = useState("First_Name");
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matters, setMatters] = useState([]);
  const [selectedMatterId, setSelectedMatterId] = useState(null);
  const [mattersLoaded, setMattersLoaded] = useState(false);
  const [isLoadingMatters, setIsLoadingMatters] = useState(false);
  const matterRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const [movingDestination, setMovingDestination] = useState(null);
  const isMoving = movingDestination !== null;
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    setDisplayContacts(contacts);
  }, [contacts]);

  useEffect(() => {
    matterRequestRef.current += 1;
    searchRequestRef.current += 1;
    if (openContactDialog) {
      setSelectedContactId(null);
      setDisplayContacts(contacts);
      setSearchText("");
      setIsSearching(false);
      setMatters([]);
      setSelectedMatterId(null);
      setMattersLoaded(false);
      setIsLoadingMatters(false);
    } else {
      setIsSearching(false);
      setIsLoadingMatters(false);
    }
  }, [contacts, openContactDialog]);

  useEffect(() => {
    if (
      sourceMatterId != null &&
      selectedMatterId != null &&
      String(sourceMatterId) === String(selectedMatterId)
    ) {
      setSelectedMatterId(null);
    }
  }, [selectedMatterId, sourceMatterId]);

  const closeContactDialog = () => {
    matterRequestRef.current += 1;
    searchRequestRef.current += 1;
    setIsSearching(false);
    setIsLoadingMatters(false);
    handleContactDialogClose();
  };

  const handleContactChange = (contactId) => {
    if (String(contactId) !== String(selectedContactId)) {
      matterRequestRef.current += 1;
      setMatters([]);
      setSelectedMatterId(null);
      setMattersLoaded(false);
      setIsLoadingMatters(false);
    }
    setSelectedContactId(contactId);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const handleSearch = async () => {
    if (isSearching) return;
    matterRequestRef.current += 1;
    setSelectedContactId(null);
    setMatters([]);
    setSelectedMatterId(null);
    setMattersLoaded(false);
    setIsLoadingMatters(false);
    setDisplayContacts([]);

    if (!ZOHO || !searchText.trim()) {
      searchRequestRef.current += 1;
      setDisplayContacts(contacts);
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
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

      if (searchRequestRef.current !== requestId) return;
      if (searchResults.data && searchResults.data.length > 0) {
        const formattedContacts = searchResults.data.map((c) => ({
          id: c.id,
          First_Name: c.First_Name || "N/A",
          Last_Name: c.Last_Name || "N/A",
          Email: c.Email || "No Email",
          Mobile: c.Mobile || "N/A",
          Full_Name: `${c.First_Name || ""} ${c.Last_Name || ""}`.trim() || c.Full_Name || "Unknown",
          ID_Number: c.ID_Number || "N/A",
          Account_Name: c.Account_Name || null,
        }));

        setDisplayContacts(formattedContacts);
      } else {
        setDisplayContacts([]);
        setSnackbar({
          open: true,
          message: "No matching contacts found in CRM.",
          severity: "info",
        });
      }
    } catch (error) {
      if (searchRequestRef.current !== requestId) return;
      console.error("Error searching contacts:", error);
      setDisplayContacts([]);
      setSnackbar({
        open: true,
        message: "Failed to search contacts.",
        severity: "error",
      });
    } finally {
      if (searchRequestRef.current === requestId) setIsSearching(false);
    }
  };

  const handleLoadMatters = async () => {
    if (!selectedContactId) return;
    const requestId = matterRequestRef.current + 1;
    matterRequestRef.current = requestId;
    setIsLoadingMatters(true);
    setSelectedMatterId(null);
    try {
      const relatedMatters = await fetchContactMatters({
        ZOHO,
        contactId: selectedContactId,
      });
      if (!Array.isArray(relatedMatters)) {
        throw new Error("CRM did not return the Contact's Matters.");
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
          message: "This Contact has no other Matters. You can still move the History to Contact History.",
          severity: "info",
        });
      }
    } catch (error) {
      if (matterRequestRef.current !== requestId) return;
      console.error("Error loading Contact Matters:", error);
      setMatters([]);
      setMattersLoaded(false);
      setSnackbar({
        open: true,
        message: error.message || "Failed to load the Contact's Matters.",
        severity: "error",
      });
    } finally {
      if (matterRequestRef.current === requestId) setIsLoadingMatters(false);
    }
  };

  const handleContactSelect = async () => {
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

    setMovingDestination("contact");
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
      closeContactDialog();
    } catch (error) {
      console.error("Error moving History to Contact:", error);
      if (error.sourceDeleted) {
        if (onRecordMoved) onRecordMoved(selectedRowData.id);
        closeContactDialog();
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

  const handleMatterSelect = async () => {
    if (!selectedContactId || !selectedMatterId || !selectedRowData?.id) {
      setSnackbar({
        open: true,
        message: "Select a Contact and one of their Matters.",
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
      await moveApplicationHistoryToMatter({
        ZOHO,
        sourceId: selectedRowData.id,
        destinationMatterId: selectedMatterId,
        destinationContactId: selectedContactId,
      });
      if (onRecordMoved) onRecordMoved(selectedRowData.id);
      setSnackbar({
        open: true,
        message: "History moved to the selected Matter successfully.",
        severity: "success",
      });
      closeContactDialog();
    } catch (error) {
      console.error("Error moving History to Matter:", error);
      setSnackbar({
        open: true,
        message: error.message || "History could not be moved to the selected Matter.",
        severity: "error",
      });
    } finally {
      setMovingDestination(null);
    }
  };
  return (
    <>
      <MUIDialog
        open={openContactDialog}
        onClose={isMoving ? undefined : closeContactDialog}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            width: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
            maxWidth: "1000px",
            margin: { xs: "16px", sm: "32px" },
            padding: "16px",
            fontSize: "9pt",
          },
        }}
      >
        <DialogTitle sx={{ fontSize: "12pt" }}>Move History</DialogTitle>
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
          <Box
            display="flex"
            gap={2}
            mb={2}
            flexDirection={{ xs: "column", sm: "row" }}
          >
            <TextField
              select
              label="Search By"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              disabled={isSearching}
              size="small"
              sx={{ width: { xs: "100%", sm: "150px" }, ...commonStyles }}
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
              disabled={isSearching}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSearching) handleSearch();
              }}
              fullWidth
              size="small"
              sx={commonStyles}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={isSearching}
              sx={{ width: { xs: "100%", sm: "120px" }, ...commonStyles }}
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
            setSelectedContactId={handleContactChange}
          />
          <Box display="flex" justifyContent="flex-end" mt={1}>
            <Button
              variant="outlined"
              onClick={handleLoadMatters}
              disabled={
                !selectedContactId ||
                !sourceMatterId ||
                isLoadingMatters ||
                isSearching ||
                isMoving
              }
              sx={commonStyles}
            >
              {isLoadingMatters ? "Loading Matters..." : "View Contact Matters"}
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
                  This Contact has no Matters. You can still move the History to Contact History.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button onClick={closeContactDialog} color="secondary" disabled={isMoving} sx={commonStyles}>
            Cancel
          </Button>
          <Button
            onClick={handleContactSelect}
            color="success"
            variant="outlined"
            disabled={!selectedContactId || isSearching || isMoving}
            sx={{ ...commonStyles, display: "flex", alignItems: "center", gap: 1 }}
          >
            {movingDestination === "contact" && <CircularProgress size={16} color="inherit" />}
            {movingDestination === "contact" ? "Moving..." : "Move to Contact History"}
          </Button>
          <Button
            onClick={handleMatterSelect}
            color="primary"
            variant="contained"
            disabled={
              !selectedContactId ||
              !selectedMatterId ||
              !sourceMatterId ||
              isSearching ||
              isMoving
            }
            sx={{ ...commonStyles, display: "flex", alignItems: "center", gap: 1 }}
          >
            {movingDestination === "matter" && <CircularProgress size={16} color="inherit" />}
            {movingDestination === "matter" ? "Moving..." : "Move to Selected Matter"}
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
