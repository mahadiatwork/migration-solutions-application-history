import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
} from "@mui/material";

const commonStyles = {
  fontSize: "9pt", // Uniform font size
  "& .MuiOutlinedInput-input": { fontSize: "9pt" }, // Input text
  "& .MuiInputBase-input": { fontSize: "9pt" }, // Base input text
  "& .MuiTypography-root": { fontSize: "9pt" }, // Typography text
  "& .MuiFormLabel-root": { fontSize: "9pt" }, // Form labels
};

export default function ContactField({
  handleInputChange,
  ZOHO,
  selectedRowData = {}, // Default to an empty object
  currentContact, // New prop
}) {


  console.log("nothing else matters,", selectedRowData)
  const [contacts, setContacts] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [searchType, setSearchType] = useState("First_Name");
  const [searchText, setSearchText] = useState("");
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const commonStyles = {
    "& .MuiInputBase-root": {
      fontSize: "9pt",
    },
    "& .MuiInputLabel-root": {
      fontSize: "9pt",
    },
    "& .MuiButton-root": {
      fontSize: "9pt",
    },
    "& .MuiTypography-root": {
      fontSize: "9pt",
    },
    "& .MuiTableCell-root": {
      fontSize: "9pt",
    },
    "& .MuiMenuItem-root": {
      fontSize: "9pt",
    },
  };

  const selectedContact = selectedRowData?.historyDetails?.id
    ? selectedRowData
    : currentContact;

  useEffect(() => {
    const fetchParticipantsDetails = async () => {
      if (selectedRowData?.id && ZOHO) {
        try {
          // Fetch related list data to get contact IDs
          const relatedListData = await ZOHO.CRM.API.getRelatedRecords({
            Entity: "History1",
            RecordID: selectedRowData?.id,
            RelatedList: "Contacts3",
            page: 1,
            per_page: 200,
          });
          

          // Fetch full contact details for each contact ID
          const participants = await Promise.all(
            relatedListData.data.map(async (record) => {
              try {
                const contactDetails = await ZOHO.CRM.API.getRecord({
                  Entity: "Contacts",
                  RecordID: record.Contact_Details.id,
                });

                if (contactDetails.data && contactDetails.data.length > 0) {
                  const contact = contactDetails.data[0];
                  return {
                    id: contact.id,
                    First_Name: contact.First_Name || "N/A",
                    Last_Name: contact.Last_Name || "N/A",
                    Email: contact.Email || "No Email",
                    Mobile: contact.Mobile || "N/A",
                    Full_Name: `${contact.First_Name || "N/A"} ${
                      contact.Last_Name || "N/A"
                    }`,
                    ID_Number: contact.ID_Number || "N/A",
                  };
                } else {
                  return null; // Return null for invalid records
                }
              } catch (error) {
                console.error(
                  `Error fetching contact details for ID ${record.Contact_Details.id}:`,
                  error
                );
                return null; // Return null for failed fetches
              }
            })
          );

          // Filter out null participants and update state
          setSelectedParticipants(
            participants.filter((participant) => participant !== null)
          );
        } catch (error) {
          console.error("Error fetching related contacts:", error);
        }
      }
    };

    fetchParticipantsDetails();
  }, [selectedRowData, ZOHO]);

  const handleOpen = () => {
    setFilteredContacts([]);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleSearch = async () => {
    if (!ZOHO || !searchText.trim()) return;

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
        const formattedContacts = searchResults.data.map((contact) => ({
          id: contact.id,
          First_Name: contact.First_Name || "N/A",
          Last_Name: contact.Last_Name || "N/A",
          Email: contact.Email || "No Email",
          Mobile: contact.Mobile || "N/A",
          Full_Name: `${contact.First_Name || "N/A"} ${
            contact.Last_Name || "N/A"
          }`,
          ID_Number: contact.ID_Number || "N/A",
        }));
        setFilteredContacts(formattedContacts);
      } else {
        setFilteredContacts([]);
      }
    } catch (error) {
      console.error("Error during search:", error);
      setFilteredContacts([]);
    }
  };

  const toggleContactSelection = (contact) => {
    setSelectedParticipants((prev) =>
      prev.some((c) => c.id === contact.id)
        ? prev.filter((c) => c.id !== contact.id)
        : [...prev, contact]
    );
  };

  const handleOk = () => {
    const updatedParticipants = selectedParticipants.map((participant) => ({
      Full_Name:
        participant.Full_Name ||
        `${participant.First_Name} ${participant.Last_Name}`,
      Email: participant.Email,
      participant: participant.id,
      type: "contact",
      id: participant.id,
    }));

    handleInputChange("Participants", updatedParticipants);
    setIsModalOpen(false);
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2}>
        <TextField
          fullWidth
          value={selectedParticipants
            .filter((c) => c && (c.Full_Name || c.First_Name || c.Last_Name))
            .map(
              (c) =>
                c.Full_Name ||
                `${c.First_Name || "N/A"} ${c.Last_Name || "N/A"}`
            )
            .join(", ")}
          variant="standard"
          placeholder="Selected contacts"
          InputProps={{
            readOnly: true,
          }}
          size="small"
          sx={commonStyles}
        />
        <Button
          variant="contained"
          onClick={handleOpen}
          sx={{ width: "100px", ...commonStyles }}
        >
          Contacts
        </Button>
      </Box>

      <Dialog open={isModalOpen} onClose={handleCancel} fullWidth maxWidth="md">
        <DialogContent sx={commonStyles}>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              select
              label="Search By"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              fullWidth
              size="small"
              sx={commonStyles}
            >
              <MenuItem value="First_Name" sx={{ fontSize: "9pt" }}>
                First Name
              </MenuItem>
              <MenuItem value="Last_Name" sx={{ fontSize: "9pt" }}>
                Last Name
              </MenuItem>
              <MenuItem value="Email" sx={{ fontSize: "9pt" }}>
                Email
              </MenuItem>
              <MenuItem value="Mobile" sx={{ fontSize: "9pt" }}>
                Mobile
              </MenuItem>
              <MenuItem value="ID_Number" sx={{ fontSize: "9pt" }}>
                MS File Number
              </MenuItem>
            </TextField>

            <TextField
              label="Search Text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              fullWidth
              size="small"
              sx={commonStyles}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              sx={{ width: "150px", ...commonStyles }}
            >
              Search
            </Button>
          </Box>

          {/* Results Table */}
          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>First Name</TableCell>
                  <TableCell>Last Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>MS File Number</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedParticipants.some(
                            (c) => c.id === contact.id
                          )}
                          onChange={() => toggleContactSelection(contact)}
                          sx={commonStyles}
                        />
                      </TableCell>
                      <TableCell>{contact.First_Name}</TableCell>
                      <TableCell>{contact.Last_Name}</TableCell>
                      <TableCell>{contact.Email}</TableCell>
                      <TableCell>{contact.Mobile}</TableCell>
                      <TableCell>{contact.ID_Number}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Box mt={3}>
              <Typography variant="h6">Selected Contacts:</Typography>
              <TableContainer>
                <Table
                  size="small"
                  sx={{ tableLayout: "fixed", fontSize: "9pt" }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{ fontWeight: "bold", width: "5%" }}
                      ></TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        First Name
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Last Name
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", width: "30%" }}>
                        Email
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Mobile</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        MS File Number
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedParticipants.map((contact) => (
                      <TableRow key={contact?.id}>
                        <TableCell>
                          <Checkbox
                            checked
                            onChange={() => toggleContactSelection(contact)}
                          />
                        </TableCell>
                        <TableCell>{contact?.First_Name}</TableCell>
                        <TableCell>{contact?.Last_Name}</TableCell>
                        <TableCell>{contact?.Email}</TableCell>
                        <TableCell>{contact?.Mobile}</TableCell>
                        <TableCell>{contact?.ID_Number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} variant="outlined" sx={commonStyles}>
            Cancel
          </Button>
          <Button
            onClick={handleOk}
            variant="contained"
            color="primary"
            disabled={selectedParticipants.length === 0}
            sx={commonStyles}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
