import React, { useState, useEffect } from "react";
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
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const commonStyles = {
  fontSize: "9pt",
  "& .MuiOutlinedInput-input": { fontSize: "9pt" },
  "& .MuiInputBase-input": { fontSize: "9pt" },
  "& .MuiTypography-root": { fontSize: "9pt" },
  "& .MuiFormLabel-root": { fontSize: "9pt" },
};

export default function ApplicationField({ handleInputChange, ZOHO, selectedApplication }) {
  const [applications, setApplications] = useState([]);
  const [selectedApplications, setSelectedApplications] = useState(selectedApplication ? [selectedApplication] : []);
  const [searchType, setSearchType] = useState("Name");
  const [searchText, setSearchText] = useState("");
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (selectedApplication) {
      setSelectedApplications([selectedApplication]);
    }
  }, [selectedApplication]);

  const handleOpen = () => {
    setFilteredApplications([]);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleSearch = async () => {
    if (!ZOHO || !searchText.trim()) return;

    try {
      let searchResults = await ZOHO.CRM.API.searchRecord({
        Entity: "Applications",
        Type: "criteria",
        Query: `(${searchType}:equals:${searchText.trim()})`,
      });

      if (searchResults.data && searchResults.data.length > 0) {
        const formattedApplications = searchResults.data.map((app) => ({
          id: app.id,
          Name: app.Name || "N/A",
          File_Status: app.File_Status || "N/A",
          Owner: app.Owner?.name || "N/A",
        }));
        setFilteredApplications(formattedApplications);
      } else {
        setFilteredApplications([]);
      }
    } catch (error) {
      console.error("Error during search:", error);
      setFilteredApplications([]);
    }
  };

  const toggleApplicationSelection = (application) => {
    setSelectedApplications([application]);
    handleInputChange("Applications", application);
    setIsModalOpen(false);
  };

  return (
    <Box>
      <TextField
        fullWidth
        value={selectedApplications.length > 0 ? selectedApplications[0].Name : ""}
        variant="standard"
        placeholder="Select Application"
        InputProps={{ readOnly: true, onClick: handleOpen }}
        size="small"
        sx={commonStyles}
      />

      <Dialog open={isModalOpen} onClose={handleCancel} fullWidth maxWidth="md">
        <DialogActions sx={{ justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={handleCancel} endIcon={<CloseIcon />}>
            Cancel
          </Button>
        </DialogActions>
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
              <MenuItem value="Name">Application Name</MenuItem>
              <MenuItem value="File_Status">File Status</MenuItem>
              <MenuItem value="Owner">Owner</MenuItem>
            </TextField>

            <TextField
              label="Search Text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              fullWidth
              size="small"
              sx={commonStyles}
            />
            <Button variant="contained" onClick={handleSearch} sx={{ width: "150px", ...commonStyles }}>
              Search
            </Button>
          </Box>

          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Application Name</TableCell>
                  <TableCell>File Status</TableCell>
                  <TableCell>Owner</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredApplications.length > 0 ? (
                  filteredApplications.map((app) => (
                    <TableRow key={app.id} onClick={() => toggleApplicationSelection(app)} style={{ cursor: "pointer" }}>
                      <TableCell>{app.Name}</TableCell>
                      <TableCell>{app.File_Status}</TableCell>
                      <TableCell>{app.Owner}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
