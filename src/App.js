import * as React from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import DownloadIcon from "@mui/icons-material/Download";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { useZohoInit } from "./hook/useZohoInit";
import { zohoApi } from "./zohoApi";
import { Table } from "./components/organisms/Table";
import { Dialog } from "./components/organisms/Dialog";
import {
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { setCurrentGlobalContact } from "./GlobalState";
import { DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import { Dialog as MUIDialog } from "@mui/material";
import { useSnackbar } from "notistack";
import LinkifyText from "./components/atoms/LinkifyText";

dayjs.extend(utc);
dayjs.extend(timezone);

const ZOHO = window.ZOHO;

const parentContainerStyle = {
  borderTop: "1px solid #BABABA",
  minHeight: "calc(100vh - 1px)",
  p: "1em",
};

function isInLastNDays(date, pre) {
  const now = dayjs();
  const daysAgo = now.subtract(pre, "day");
  return dayjs(date).isAfter(daysAgo);
}

const dateOptions = [
  { label: "Default", preDay: null },
  { label: "Last 7 Days", preDay: 7 },
  { label: "Last 30 Days", preDay: 30 },
  { label: "Last 90 Days", preDay: 90 },
  { label: "Current Week", custom: () => dayjs().startOf("week").format() },
  { label: "Current Month", custom: () => dayjs().startOf("month").format() },
  {
    label: "Next Week",
    custom: () => dayjs().add(1, "week").startOf("week").format(),
  },
  { label: "Custom Range", customRange: true },
];

const App = () => {
  const { module, recordId } = useZohoInit();
  const { enqueueSnackbar } = useSnackbar();
  const [initPageContent, setInitPageContent] = React.useState(
    <CircularProgress />
  );
  const [relatedListData, setRelatedListData] = React.useState([]);
  const [, setSelectedRecordId] = React.useState(null);
  const [openEditDialog, setOpenEditDialog] = React.useState(false);
  const [openCreateDialog, setOpenCreateDialog] = React.useState(false);
  const [ownerList, setOwnerList] = React.useState([]);
  // Owner filter: no default (do not filter by logged-in user); user selects manually when needed
  const [selectedOwner, setSelectedOwner] = React.useState(null);
  const [typeList, setTypeList] = React.useState([]);
  const [selectedType, setSelectedType] = React.useState(null);
  const [dateRange, setDateRange] = React.useState(dateOptions[0]);
  const [keyword, setKeyword] = React.useState("");
  const [loggedInUser, setLoggedInUser] = React.useState(null);
  const [selectedRowData, setSelectedRowData] = React.useState(null);
  // eslint-disable-next-line no-unused-vars -- setter not used but state value is needed
  const [currentContact, setCurrentContact] = React.useState(null);
  const [regarding, setRegarding] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [selectedContacts, setSelectedContacts] = React.useState([]);
  const [currentModuleData, setCurrentModuleData] = React.useState(null);
  const [selectedParticipants, setSelectedParticipants] = React.useState([]);


  const [isCustomRangeDialogOpen, setIsCustomRangeDialogOpen] =
    React.useState(false);
  const [customRange, setCustomRange] = React.useState({
    startDate: null,
    endDate: null,
  });

  const handleClickOpenCreateDialog = () => {
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
  };

  const handleClickOpenEditDialog = (rowData) => {

    setSelectedRowData(rowData); // Set the selected row data
    // setRegarding(rowData?.regarding || ""); // Initialize regarding data
    // setDetails(rowData?.details || ""); // Initialize details data
    setOpenEditDialog(true); // Open the dialog
  };

  const handleCloseEditDialog = (updatedRowData) => {
    if (updatedRowData) {
      setRelatedListData((prevData) =>
        prevData.map((item) =>
          item.id === updatedRowData.id
            ? {
                ...item,
                ...updatedRowData,
                name: updatedRowData.Participants
                  ? updatedRowData.Participants.map((c) => c.Full_Name).join(
                      ", "
                    )
                  : item.name,
              }
            : item
        )
      );
      setHighlightedRecordId(updatedRowData.id); // Set the highlighted record ID
    }
    setSelectedRowData(null); // Clear selectedRowData
    setOpenEditDialog(false); // Close the dialog
    // setRegarding(""); // Clear the regarding field
    // setDetails(""); // Clear the details field
  };

  const fetchRLData = async (options = {}) => {
    if (!module || !recordId) return;
    try {
      let data = [];
      if (module === "Applications" || module === "Application" || module === "Deals") {
        try {
          data = await zohoApi.record.fetchApplicationHistoryViaCoqlV8(recordId, 2000, 0);
        } catch (coqlError) {
          console.warn("COQL v8 failed, falling back to getRelatedRecords:", coqlError);
          const resp = await zohoApi.record.getRecordsFromRelatedList({
            module,
            recordId,
            RelatedListAPI: "Application_History",
          });
          data = resp?.data || [];
        }
      } else {
        const resp = await zohoApi.record.getRecordsFromRelatedList({
          module,
          recordId,
          RelatedListAPI: "Application_History",
        });
        data = resp?.data || [];
      }

      const usersResponse = await ZOHO.CRM.API.getAllUsers({
        Type: "AllUsers",
      });
      const validUsers = usersResponse?.users?.filter(
        (user) =>
          user?.full_name &&
          user?.id &&
          (user?.status === "active" || user?.status === undefined)
      );
      setOwnerList(validUsers || []);

      const getOwnerDisplayName = (owner, users) => {
        if (owner == null) return "Unknown Owner";
        if (typeof owner === "string") {
          const u = users?.find((x) => x.id === owner);
          return u?.full_name || owner;
        }
        const name =
          owner.name ||
          owner.full_name ||
          owner.Name ||
          owner.Full_Name ||
          (owner.first_name && owner.last_name
            ? `${owner.first_name} ${owner.last_name}`.trim()
            : null);
        if (name) return name;
        const ownerId = owner.id ?? owner.Id;
        if (ownerId && users?.length) {
          const u = users.find((x) => x.id === ownerId);
          return u?.full_name || "Unknown Owner";
        }
        return "Unknown Owner";
      };

      const currentUserResponse = await ZOHO.CRM.CONFIG.getCurrentUser();
      setLoggedInUser(currentUserResponse?.users?.[0] || null);

      const currentModuleResponse = await ZOHO.CRM.API.getRecord({
        Entity: module,
        approved: "both",
        RecordID: recordId,
      });


      setCurrentModuleData(currentModuleResponse?.data?.[0] || null);
      
      if (currentContact) {
        setCurrentGlobalContact(currentContact);
      }


      const preserveFields = options?.preserveFieldsForRecordId;
      const tempData = data?.map((obj) => {
        const mappedStakeHolder = (() => {
          const flatId = obj["Contact_History_Info.Stakeholder.id"];
          const flatName = obj["Contact_History_Info.Stakeholder.Account_Name"];
          const nested = obj["Contact_History_Info.Stakeholder"];
          const junction = obj?.Stakeholder; // COQL or junction record

          const id = flatId ?? (nested && typeof nested === "object" ? nested.id : undefined) ?? (junction && typeof junction === "object" ? junction.id : undefined);
          const rawName = flatName ?? (nested && typeof nested === "object" ? (nested.Account_Name ?? nested.name) : undefined) ?? (junction && typeof junction === "object" ? (junction.Account_Name ?? junction.name) : undefined);

          return id !== null && id !== undefined ? { id, name: rawName || "" } : null;
        })();
        const item = {
          name: obj?.Name || "No Name",
          id: obj?.id,
          date_time: obj?.Date,
          type: obj?.History_Type || "Unknown Type",
          result: obj?.History_Result || "No Result",
          duration: (obj?.Duration_Min != null && String(obj.Duration_Min).trim() !== "") ? obj.Duration_Min : "N/A",
          regarding: obj?.Regarding || "No Regarding",
          details: obj?.History_Details || "No Details",
          icon: <DownloadIcon />,
          ownerName: getOwnerDisplayName(obj?.Owner, validUsers),
          stakeHolder: mappedStakeHolder,
          currentData: currentModuleData
        };
        // Preserve locally-updated fields when refetching after edit (COQL doesn't return Stakeholder)
        if (preserveFields?.id === obj?.id && preserveFields?.stakeHolder != null) {
          item.stakeHolder = preserveFields.stakeHolder;
        }
        return item;
      });

      setRelatedListData(tempData || []);
      
      const types = data
        ?.map((el) => el.History_Type)
        ?.filter((el) => el !== undefined && el !== null);

      const sortedTypes = [...new Set(types)].sort((a, b) =>
        a.localeCompare(b)
      ); // Sort alphabetically

      const additionalTypes = [
        "Meeting",
        "To-Do",
        "Call",
        "Appointment",
        "Boardroom",
        "Call Billing",
        "Email Billing",
        "Initial Consultation",
        "Mail",
        "Meeting Billing",
        "Personal Activity",
        "Room 1",
        "Room 2",
        "Room 3",
        "Todo Billing",
        "Vacation",
      ]; // Example additional options

      const sortedTypesWithAdditional = [
        ...new Set([...additionalTypes, ...sortedTypes]), // Merge additional options with existing ones
      ].sort((a, b) => a.localeCompare(b)); // Sort alphabetically

      setTypeList(sortedTypesWithAdditional);

      setInitPageContent(null);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (options.isBackground) {
        enqueueSnackbar("Failed to refresh data", { variant: "error" });
      } else {
        setInitPageContent("Error loading data.");
      }
    }
  };

  React.useEffect(() => {
    if (module && recordId) {
      fetchRLData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchRLData is stable, module and recordId are the only deps needed
  }, [module, recordId]);

  const [highlightedRecordId, setHighlightedRecordId] = React.useState(null);

  const handleRecordAdded = (newRecord) => {
    // Normalize the new record to match the existing structure
    let participantsArray = [];
    if (newRecord.Participants.length > 0) {
      participantsArray = newRecord.Participants.map((participant) => ({
        id: participant.id || "N/A",
        Full_Name: participant.Full_Name || "Unknown",
        Email: participant.Email || "No Email",
        Mobile: participant.Mobile || "N/A",
        First_Name: participant.First_Name || "Unknown",
        Last_Name: participant.Last_Name || "Unknown",
        ID_Number: participant.ID_Number || "N/A",
      }));
    }


    const updatedHistoryName = participantsArray
    .map((c) => c.Full_Name)
    .join(", ");

    const normalizedRecord = {
      id: newRecord.id,
      name: currentModuleData?.Name + " - " + updatedHistoryName,
      date_time: newRecord.Date || dayjs().format(), // Ensure date is consistent
      type: newRecord.History_Type || "Unknown Type",
      result: newRecord.History_Result || "No Result",
      duration: newRecord.Duration_Min || "N/A",
      regarding: newRecord.Regarding || "No Regarding",
      details: newRecord.History_Details || "No Details",
      ownerName: newRecord.Owner?.full_name || "Unknown Owner",
      stakeHolder: newRecord.Stakeholder || null,
      Participants: participantsArray,
    };

    // Add the normalized record to the top of the table
    const finalData = [normalizedRecord, ...relatedListData];

    setRelatedListData(finalData);

    // Highlight the newly added record
    setHighlightedRecordId(newRecord.id);

    setRegarding(normalizedRecord.regarding || "No Regarding");
    setDetails(normalizedRecord.details || "No Details");
    setSelectedContacts(newRecord.Participants);
    // Debug logs

    // Background refetch after create
    fetchRLData({ isBackground: true });
  };

  const handleRightSideDataShow = (currentRegarding, currentDetails) => {
    setRegarding(currentRegarding || "No Regarding");
    setDetails(currentDetails || "No Details");
  };

  const handleRecordUpdate = (updatedRecord) => {
    const participants = updatedRecord?.Participants ?? selectedParticipants ?? [];
    const updatedHistoryName = participants
      .map((c) => c?.Full_Name ?? c?.name)
      .filter(Boolean)
      .join(", ");

    // Normalize updatedRecord keys to match relatedListData keys
    const normalizedRecord = {
      ...updatedRecord,
      type: updatedRecord.History_Type,
      result: updatedRecord.History_Result,
      duration: updatedRecord.Duration_Min,
      regarding: updatedRecord.Regarding,
      details: updatedRecord.History_Details,
      ownerName: updatedRecord?.Owner?.full_name,
      date_time: updatedRecord?.Date, // Ensure date is consistent
      stakeHolder: updatedRecord?.Stakeholder,
      name: currentModuleData?.Name + " - " + updatedHistoryName,
    };

    console.log("Updated after by maddie:", updatedRecord);

    setRelatedListData((prevData) => {
      const updatedData = prevData.map((row) => {
        if (row.id === updatedRecord.id) {
          return {
            ...row,
            ...normalizedRecord,
          };
        }
        return row;
      });

      return updatedData;
    });
    console.log("updatedRecord.Regarding", updatedRecord.Regarding);
    setRegarding(updatedRecord.Regarding || "No Regarding");
    setDetails(updatedRecord.History_Details_Plain || "No Details");
    setHighlightedRecordId(updatedRecord.id); // Highlight the updated record

    // Background refetch after update; preserve stakeHolder (COQL doesn't return it)
    fetchRLData({
      isBackground: true,
      preserveFieldsForRecordId: {
        id: updatedRecord.id,
        stakeHolder: normalizedRecord.stakeHolder,
      },
    });
  };

  const filteredData = React.useMemo(() => {
    if (!relatedListData?.length) return [];
    return relatedListData
      .filter((el) =>
        selectedOwner ? el.ownerName === selectedOwner?.full_name : true
      )
      .filter((el) => (selectedType ? el?.type === selectedType : true))
      .filter((el) => {
        if (dateRange?.preDay) {
          const isValidDate = dayjs(el?.date_time).isValid();
          return isValidDate && isInLastNDays(el?.date_time, dateRange.preDay);
        }
        if (dateRange?.startDate && dateRange?.endDate) {
          const rowDate = dayjs(el?.date_time);
          const start = dayjs(dateRange.startDate).startOf("day");
          const end = dayjs(dateRange.endDate).endOf("day");
          return rowDate.isBetween(start, end, null, "[]");
        }
        if (dateRange?.custom) {
          const startDate = dayjs(dateRange.custom());
          const endDate = dayjs();
          return dayjs(el?.date_time).isBetween(startDate, endDate, null, "[]");
        }
        return true;
      })
      .filter((el) => {
        if (!keyword?.trim()) return true;
        const kw = keyword.trim().toLowerCase();
        return (
          el.name?.toLowerCase().includes(kw) ||
          el.details?.toLowerCase().includes(kw) ||
          el.regarding?.toLowerCase().includes(kw)
        );
      });
  }, [relatedListData, selectedOwner, selectedType, dateRange, keyword]);

  const getActiveFilterNames = () => {
    const active = [];
    if (dateRange?.preDay || dateRange?.startDate || dateRange?.custom) active.push("Date");
    if (selectedType) active.push("Type");
    if (selectedOwner) active.push("User");
    if (keyword?.trim()) active.push("Keyword");
    return active;
  };

  const handleClearFilters = () => {
    setDateRange(dateOptions[0]);
    setSelectedType(null);
    setSelectedOwner(null);
    setKeyword("");
    setCustomRange({ startDate: null, endDate: null });
    setIsCustomRangeDialogOpen(false);
  };

  const [applications, setApplications] = React.useState([]);
  const [openApplicationDialog, setOpenApplicationDialog] =
    React.useState(false);

  const handleMoveToApplication = async () => {
    try {
      // Fetch related applications for the current contact
      const response = await ZOHO.CRM.API.getRelatedRecords({
        Entity: "Accounts",
        RecordID: currentModuleData?.id,
        RelatedList: "Applications",
        page: 1,
        per_page: 200,
      });
      if (response?.data) {
        setApplications(response.data || []);
        setOpenApplicationDialog(true); // Open the application selection dialog
      } else {
        throw new Error("No related applications found.");
      }
    } catch (error) {
      console.error("Error fetching related applications:", error);
      // setSnackbar({
      //   open: true,
      //   message: "Failed to fetch related applications.",
      //   severity: "error",
      // });
    }
  };



  return (
    <React.Fragment>
      <Box sx={parentContainerStyle}>
        {initPageContent ? (
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {initPageContent}
          </span>
        ) : relatedListData?.length > 0 ? (
          <Grid container spacing={2}>
            <Grid
              item
              xs={9}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                "& > *": { flexGrow: 1, flexBasis: "0px" },
              }}
            >
              <Autocomplete
                size="small"
                options={
                  dateRange?.startDate && dateRange?.endDate
                    ? [...dateOptions, dateRange]
                    : dateOptions
                }
                value={dateRange}
                getOptionLabel={(option) => {
                  if (!option) return "";
                  if (option?.label) return option.label;
                  if (option?.startDate && option?.endDate) {
                    const start = dayjs(option.startDate).format("DD/MM/YYYY");
                    const end = dayjs(option.endDate).format("DD/MM/YYYY");
                    return `Custom: ${start} - ${end}`;
                  }
                  return "";
                }}
                isOptionEqualToValue={(option, value) => {
                  if (!option || !value) return false;
                  if (option?.label && value?.label) return option.label === value.label;
                  if (option?.startDate && value?.startDate) {
                    return (
                      dayjs(option.startDate).isSame(dayjs(value.startDate), "day") &&
                      dayjs(option.endDate).isSame(dayjs(value.endDate), "day")
                    );
                  }
                  return false;
                }}
                sx={{
                  "& .MuiInputBase-root": {
                    height: "33px",
                    fontSize: "9pt",
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "9pt",
                  },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Dates"
                    size="small"
                    InputLabelProps={{ style: { fontSize: "9pt" } }}
                  />
                )}
                componentsProps={{
                  popper: {
                    sx: {
                      "& .MuiAutocomplete-listbox": {
                        fontSize: "9pt",
                      },
                    },
                  },
                }}
                onChange={(e, value) => {
                  if (value?.customRange) {
                    setIsCustomRangeDialogOpen(true); // Open custom range dialog
                  } else {
                    setDateRange(value); // Set normal date range
                  }
                }}
              />

              <Autocomplete
                size="small"
                options={typeList}
                sx={{
                  width: "8rem",
                  "& .MuiInputBase-root": {
                    height: "33px",
                    fontSize: "9pt", // Adjust font size for selected value
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "9pt", // Adjust label font size
                  },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Types"
                    size="small"
                    InputLabelProps={{ style: { fontSize: "9pt" } }}
                  />
                )}
                componentsProps={{
                  popper: {
                    sx: {
                      "& .MuiAutocomplete-listbox": {
                        fontSize: "9pt", // Font size for dropdown options
                      },
                    },
                  },
                }}
                onChange={(e, value) => setSelectedType(value)}
              />

              <TextField
                size="small"
                label="Keyword"
                variant="outlined"
                sx={{
                  width: "8rem",
                  "& .MuiInputBase-root": {
                    height: "33px",
                    fontSize: "9pt", // Font size for input text
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "9pt", // Adjust label font size
                  },
                }}
                InputProps={{
                  style: {
                    fontSize: "9pt", // Additional inline styling for input text
                  },
                }}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Autocomplete
                size="small"
                options={ownerList || []}
                getOptionLabel={(option) => option?.full_name || "Unknown User"}
                value={selectedOwner || null}
                isOptionEqualToValue={(option, value) =>
                  option?.id === value?.id
                }
                sx={{
                  width: "8rem",
                  "& .MuiInputBase-root": {
                    height: "33px",
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "9pt", // Adjust label font size
                  },
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Users" size="small" />
                )}
                componentsProps={{
                  popper: {
                    sx: {
                      "& .MuiAutocomplete-listbox": {
                        fontSize: "9pt", // Font size for dropdown options
                      },
                    },
                  },
                }}
                onChange={(e, value) => setSelectedOwner(value)}
              />
            </Grid>
            <Grid
              item
              xs={3}
              sx={{ display: "flex", justifyContent: "flex-end" }}
            >
              <Button
                variant="contained"
                sx={{
                  flexGrow: 1,
                  padding: "4px 8px",
                  fontSize: "0.75rem",
                  minHeight: "33px",
                  maxHeight: "33px",
                  lineHeight: "1rem",
                }}
                onClick={handleClickOpenCreateDialog}
              >
                Create
              </Button>
            </Grid>
            <Grid item xs={9}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, fontSize: "9pt" }}>
                <span>Total Records {filteredData?.length ?? 0}</span>
                {getActiveFilterNames().length > 0 && (
                  <>
                    <span>•</span>
                    <span>Filter By: {getActiveFilterNames().join(", ")}</span>
                    <Button size="small" onClick={handleClearFilters} sx={{ ml: 1, fontSize: "9pt" }}>
                      Clear Filters
                    </Button>
                  </>
                )}
              </Box>
              <Table
                rows={filteredData}
                setSelectedRecordId={setSelectedRecordId}
                handleClickOpenEditDialog={handleClickOpenEditDialog}
                handleRightSideDataShow={handleRightSideDataShow}
                highlightedRecordId={highlightedRecordId} // Pass highlighted ID to the table
                keyword={keyword}
              />
            </Grid>
            <Grid item xs={3}>
              {/* sidebar - details component */}
              <Paper sx={{ height: "100%", position: "relative" }}>
                <Box
                  sx={{
                    position: "absolute",
                    inset: "1rem",
                    overflow: "auto",
                    wordWrap: "break-word",
                    whiteSpace: "normal",
                  }}
                >
                  {!!regarding && (
                    <span
                      style={{
                        display: "block",
                        marginBottom: "4px",
                        padding: "4px",
                        backgroundColor: "rgba(236, 240, 241, 1)",
                        borderRadius: "4px",
                        wordWrap: "break-word",
                        whiteSpace: "normal",
                        fontSize: "9pt",
                      }}
                    >
                      {regarding}
                    </span>
                  )}
                  <LinkifyText details={details} />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={2}>
            <Grid
              item
              xs={9}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                "& > *": { flexGrow: 1, flexBasis: "0px" },
              }}
            >
              <Autocomplete
                size="small"
                options={
                  dateRange?.startDate && dateRange?.endDate
                    ? [...dateOptions, dateRange]
                    : dateOptions
                }
                value={dateRange}
                getOptionLabel={(option) => {
                  if (!option) return "";
                  if (option?.label) return option.label;
                  if (option?.startDate && option?.endDate) {
                    const start = dayjs(option.startDate).format("DD/MM/YYYY");
                    const end = dayjs(option.endDate).format("DD/MM/YYYY");
                    return `Custom: ${start} - ${end}`;
                  }
                  return "";
                }}
                isOptionEqualToValue={(option, value) => {
                  if (!option || !value) return false;
                  if (option?.label && value?.label) return option.label === value.label;
                  if (option?.startDate && value?.startDate) {
                    return (
                      dayjs(option.startDate).isSame(dayjs(value.startDate), "day") &&
                      dayjs(option.endDate).isSame(dayjs(value.endDate), "day")
                    );
                  }
                  return false;
                }}
                sx={{
                  "& .MuiInputBase-root": {
                    height: "33px",
                    fontSize: "9pt",
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "9pt",
                  },
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Dates" size="small" />
                )}
                onChange={(e, value) => {
                  if (value?.customRange) {
                    setIsCustomRangeDialogOpen(true);
                  } else {
                    setDateRange(value);
                  }
                }}
              />
              <Autocomplete
                size="small"
                options={typeList}
                sx={{
                  width: "8rem",
                  "& .MuiInputBase-root": {
                    height: "33px",
                    fontSize: "9pt", // Adjust font size for selected value
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "9pt", // Adjust label font size
                  },
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Types" size="small" />
                )}
                onChange={(e, value) => setSelectedType(value)}
              />
              <TextField
                size="small"
                label="Keyword"
                variant="outlined"
                sx={{
                  width: "8rem",
                  "& .MuiInputBase-root": {
                    height: "33px",
                    fontSize: "9pt", // Font size for input text
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "9pt", // Adjust label font size
                  },
                }}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Autocomplete
                size="small"
                options={ownerList || []}
                getOptionLabel={(option) => option?.full_name || "Unknown User"}
                value={selectedOwner || null}
                isOptionEqualToValue={(option, value) =>
                  option?.id === value?.id
                }
                sx={{
                  width: "8rem",
                  "& .MuiInputBase-root": {
                    height: "33px",
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "9pt", // Adjust label font size
                  },
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Users" size="small" />
                )}
                onChange={(e, value) => setSelectedOwner(value)}
              />
            </Grid>
            <Grid
              item
              xs={3}
              sx={{
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="contained"
                sx={{
                  flexGrow: 1,
                  padding: "4px 8px",
                  fontSize: "0.75rem",
                  minHeight: "33px",
                  maxHeight: "33px",
                  lineHeight: "1rem",
                }}
                onClick={handleClickOpenCreateDialog}
              >
                Create
              </Button>
            </Grid>
            <Box mt={2}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Date & Time</TableCell>
                      <TableCell>Owner</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {relatedListData.length > 0 ? (
                      relatedListData.map((row) => (
                        <TableRow
                          key={row.id}
                          sx={{
                            backgroundColor:
                              row.id === highlightedRecordId
                                ? "rgba(0, 123, 255, 0.1)"
                                : "inherit", // Highlight if ID matches
                          }}
                        >
                          <TableCell>{row.name || "Unknown Name"}</TableCell>
                          <TableCell>{row.type || "Unknown Type"}</TableCell>
                          <TableCell>{row.result || "No Result"}</TableCell>
                          <TableCell>
                            {row.date_time
                              ? dayjs(row.date_time).format(
                                  "DD/MM/YYYY HH:mm A"
                                )
                              : "No Date"}
                          </TableCell>
                          <TableCell>
                            {row.ownerName || "Unknown Owner"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Grid>
        )}
      </Box>
      <Dialog
        openDialog={openEditDialog}
        handleCloseDialog={handleCloseEditDialog}
        title="Edit History"
        ownerList={ownerList}
        loggedInUser={loggedInUser}
        ZOHO={ZOHO}
        selectedRowData={selectedRowData}
        onRecordAdded={handleRecordUpdate} // Update the existing record
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
        buttonText="Update"
        handleMoveToApplication={handleMoveToApplication}
        applications={applications}
        openApplicationDialog={openApplicationDialog}
        setOpenApplicationDialog={setOpenApplicationDialog}
        currentModuleData={currentModuleData}
        selectedParticipants={selectedParticipants}
        setSelectedParticipants={setSelectedParticipants}
      />
      <Dialog
        openDialog={openCreateDialog}
        handleCloseDialog={handleCloseCreateDialog}
        title="Create"
        ownerList={ownerList}
        loggedInUser={loggedInUser}
        ZOHO={ZOHO}
        onRecordAdded={handleRecordAdded} // Pass the callback
        currentContact={currentModuleData}
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
        buttonText="Save"
        currentModuleData={currentModuleData}
        selectedParticipants={selectedParticipants}
        setSelectedParticipants={setSelectedParticipants}
      />
      {isCustomRangeDialogOpen && (
        <MUIDialog
          open={isCustomRangeDialogOpen}
          onClose={() => setIsCustomRangeDialogOpen(false)}
          fullWidth
          maxWidth="xs"
          sx={{
            "& .MuiDialogContent-root": {
              padding: "8px", // Reduce padding for compactness
            },
          }}
        >
          <DialogTitle sx={{ fontSize: "14px", padding: "8px" }}>
            Select Custom Date Range
          </DialogTitle>
          <DialogContent>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Box display="flex" flexDirection="column" gap={1.5}>
                <DatePicker
                  label="Start Date"
                  value={customRange.startDate}
                  onChange={(newValue) =>
                    setCustomRange((prev) => ({ ...prev, startDate: newValue }))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      variant="outlined"
                      sx={{
                        width: "8rem", // Match other fields
                        "& .MuiInputBase-root": {
                          height: "20px", // Match small field height
                          fontSize: "9pt",
                        },
                        "& .MuiInputLabel-root": {
                          fontSize: "9pt", // Match label size
                        },
                      }}
                    />
                  )}
                  slotProps={{
                    popper: { placement: "right-start" },
                    textField: { size: "small" },
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={customRange.endDate}
                  onChange={(newValue) =>
                    setCustomRange((prev) => ({ ...prev, endDate: newValue }))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      variant="outlined"
                      sx={{
                        width: "8rem", // Match other fields
                        "& .MuiInputBase-root": {
                          height: "20px", // Match small field height
                          fontSize: "12px",
                        },
                        "& .MuiInputLabel-root": {
                          fontSize: "9pt", // Match label size
                        },
                      }}
                    />
                  )}
                  slotProps={{
                    popper: { placement: "right-start" },
                    textField: { size: "small" },
                  }}
                />
              </Box>
            </LocalizationProvider>
          </DialogContent>
          <DialogActions sx={{ padding: "8px" }}>
            <Button
              onClick={() => setIsCustomRangeDialogOpen(false)}
              color="secondary"
              size="small"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setDateRange(customRange); // Save custom range to dateRange
                setIsCustomRangeDialogOpen(false);
              }}
              color="primary"
              size="small"
            >
              Apply
            </Button>
          </DialogActions>
        </MUIDialog>
      )}
    </React.Fragment>
  );
};

export default App;
