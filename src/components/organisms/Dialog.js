import * as React from "react";
import dayjs from "dayjs";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import {
  Autocomplete,
  TextField,
  Dialog as MUIDialog,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  Grid,
  InputAdornment,
  Modal,
  Paper,
  Typography,
  CircularProgress,
} from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { getRegardingOptions, getResultOptions } from "./helperFunc";
import {
  durationOptions as fallbackDurationOptions,
  typeOptions as fallbackTypeOptions,
  resultMapping as fallbackResultMapping,
  typeMapping as fallbackTypeMapping,
} from "./dialogConstants";
import {
  getTypeOptionsFromConfig,
  getDurationOptionsFromConfig,
  getResultMappingFromConfig,
} from "../../services/picklistConfigService";
import ContactField from "./ContactFields";
import RegardingField from "./RegardingField";
import IconButton from "@mui/material/IconButton"; // For the clickable icon button
import { styled } from "@mui/material/styles";
import { zohoApi } from "../../zohoApi";
import ApplicationDialog from "./ApplicationTable";
import ContactDialog from "./ContactTable";
import Stakeholder from "../atoms/Stakeholder";
import { Close } from "@mui/icons-material";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

export function Dialog({
  openDialog,
  handleCloseDialog,
  ownerList,
  loggedInUser,
  ZOHO, // Zoho instance for API calls
  selectedRowData,
  currentContact,
  onRecordAdded,
  selectedContacts,
  setSelectedContacts,
  buttonText = "Save",
  handleMoveToApplication,
  applications,
  openApplicationDialog,
  setOpenApplicationDialog,
  handleMoveToContact,
  contacts,
  openContactDialog,
  setOpenContactDialog,
  currentModuleData,
  selectedParticipants,
  setSelectedParticipants,
  picklistConfig = null,
}) {
  const durationOptions = picklistConfig
    ? getDurationOptionsFromConfig(picklistConfig)
    : fallbackDurationOptions;
  const resultMapping = picklistConfig
    ? getResultMappingFromConfig(picklistConfig)
    : fallbackResultMapping;
  const typeMapping = React.useMemo(() => {
    if (picklistConfig?.results) {
      const mapping = {};
      for (const [type, list] of Object.entries(picklistConfig.results)) {
        if (type === "_default") continue;
        for (const result of list) {
          mapping[result] = type;
        }
      }
      if (Object.keys(mapping).length > 0) return mapping;
    }
    return fallbackTypeMapping;
  }, [picklistConfig]);
  const typeOptions = picklistConfig
    ? getTypeOptionsFromConfig(picklistConfig)
    : fallbackTypeOptions;

  const [, setHistoryName] = React.useState("");
  const [historyContacts, setHistoryContacts] = React.useState([]);
  const [selectedOwner, setSelectedOwner] = React.useState(
    ownerList?.find(
      (owner) => owner?.full_name === selectedRowData?.ownerName
    ) ||
    loggedInUser ||
    null
  );
  // const [selectedType, setSelectedType] = React.useState("Meeting");
  const [loadedAttachmentFromRecord, setLoadedAttachmentFromRecord] =
    React.useState();
  const [formData, setFormData] = React.useState(selectedRowData || {}); // Form data state
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // console.log({ formData });
  const [snackbar, setSnackbar] = React.useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleSelectFile = async (e) => {
    e.preventDefault();
    if ([...e.target.files]?.length > 1) {
      return;
    }
    if (e.target.files) {
      const el = [...e?.target?.files]?.[0];
      if (el) {
        handleInputChange("attachment", el);
      }
    }
  };

  React.useEffect(() => {
    let load = true;
    const getAttachment = async ({ rowData }) => {
      // Use main record id (e.g., historyDetails?.id or history_id), not the junction row id
      const mainRecordId = rowData?.historyDetails?.id || rowData?.history_id || rowData?.id;
      const { data } = await zohoApi.file.getAttachments({
        module: "Applications_History",
        recordId: mainRecordId,
      });
      setFormData((prev) => ({
        ...prev,
        attachment: { name: data?.[0]?.File_Name },
      }));
      setLoadedAttachmentFromRecord(data);
    };
    const mainRecordId = selectedRowData?.historyDetails?.id || selectedRowData?.history_id || selectedRowData?.id;
    if (mainRecordId && load) {
      load = false;
      getAttachment({ rowData: selectedRowData });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch attachment; zohoApi stable
  }, [selectedRowData]);

  // console.log({ selectedRowData })

  // Reinitialize dialog state when `openDialog` or `obj` changes
  React.useEffect(() => {
    if (openDialog) {
      setIsSubmitting(false);
      setFormData((prev) => {
        const defaultType = selectedRowData?.type || typeOptions[0] || "Meeting";
        const defaultResult =
          selectedRowData?.result ||
          resultMapping[defaultType] ||
          getResultOptions(defaultType, picklistConfig)[0] ||
          "Meeting Held";
        const base = {
          Participants: selectedRowData?.Participants || [],
          result: defaultResult,
          type: defaultType,
          duration: (() => {
            const d = selectedRowData?.duration;
            if (d == null || d === "N/A" || d === "") return 60;
            const n = Number(d);
            return Number.isFinite(n) ? n : 60;
          })(),
          regarding: selectedRowData?.regarding || "",
          details: selectedRowData?.details || "",
          stakeHolder: (selectedRowData?.stakeHolder && typeof selectedRowData.stakeHolder === "object" && selectedRowData.stakeHolder?.id !== null && selectedRowData.stakeHolder?.id !== undefined)
            ? selectedRowData.stakeHolder
            : null,
          date_time: selectedRowData?.date_time
            ? dayjs(selectedRowData.date_time)
            : dayjs(),
        };
        return {
          ...base,
          attachment: selectedRowData ? prev?.attachment : undefined,
        };
      });
      setSelectedContacts(
        selectedContacts || []
      );
      setHistoryName(
        selectedRowData?.Participants?.map((p) => p.Full_Name).join(", ") || ""
      );
      // setSelectedOwner(loggedInUser || null);
      setSelectedOwner(
        ownerList?.find(
          (owner) => owner?.full_name === selectedRowData?.ownerName
        ) ||
        loggedInUser ||
        null
      );

      setHistoryContacts(selectedContacts || []);
    } else {
      // Reset formData to avoid stale data
      setFormData({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form init; ownerList/setSelectedContacts stable
  }, [openDialog, selectedRowData, loggedInUser, currentContact]);

  React.useEffect(() => {
    const fetchHistoryData = async () => {
      if (selectedRowData?.id) {
        try {
          const data = await ZOHO.CRM.API.getRelatedRecords({
            Entity: "Applications_History",
            RecordID: selectedRowData?.id,
            RelatedList: "Contacts4",
            page: 1,
            per_page: 200,
          });

          const contactDetailsArray = data.data.map((record) => ({
            Full_Name: record.Contact.name,
            id: record.Contact.id,
          }));

          setHistoryContacts(contactDetailsArray);
          setSelectedContacts(contactDetailsArray);
          setFormData((prevFormData) => ({
            ...prevFormData, // Spread the previous formData
            Participants: contactDetailsArray, // Update only the Participants field
          }));
        } catch (error) {
          console.error("Error fetching related contacts:", error);
        }
      }
    };

    if (openDialog) {
      fetchHistoryData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch history data; ZOHO/setSelectedContacts stable
  }, [selectedRowData?.historyDetails, openDialog]);

  React.useEffect(() => {
    const names = selectedContacts
      .map((contact) => contact?.Full_Name)
      .join(", ");
    setHistoryName(names);
  }, [selectedContacts]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    let selectedParticipants = [];

    if (formData.Participants) {
      selectedParticipants = formData.Participants;
    }

    if (selectedParticipants.length === 0) {
      selectedParticipants = selectedContacts;
    }

    if (selectedParticipants.length === 0 && currentModuleData?.Contact_Name?.id) {
      selectedParticipants = [{
        id: currentModuleData.Contact_Name.id,
        Full_Name: currentModuleData.Contact_Name.name
      }];
    }

    // Generate history name based on selected contacts
    const updatedHistoryName = selectedParticipants
      .map((c) => c.Full_Name)
      .join(", ");


    const finalData = {
      Name: currentModuleData?.Name + " - " + updatedHistoryName,
      History_Details: formData.details,
      Regarding: formData.regarding,
      Owner: selectedOwner,
      History_Result: Array.isArray(formData.result) && formData.result.length > 0
        ? formData.result[0]
        : formData.result,
      Stakeholder: formData.stakeHolder
        ? { id: formData.stakeHolder?.id, name: formData.stakeHolder?.name }
        : { id: currentModuleData?.Stake_Holder?.id, name: currentModuleData?.Stake_Holder?.name },
      History_Type: formData.type || "",
      Duration_Min: formData.duration ? String(formData.duration) : null,
      Date: formData.date_time
        ? dayjs(formData.date_time).format("YYYY-MM-DDTHH:mm:ssZ")
        : null,
      Application: { id: currentModuleData?.id }
    };

    try {
      if (selectedRowData) {
        await updateHistory(selectedRowData, finalData, selectedParticipants, currentModuleData);
      } else {
        await createHistory(finalData, selectedParticipants);
      }
    } catch (error) {
      console.error("Error saving records:", error);
      setSnackbar({
        open: true,
        message: error.message || "An error occurred.",
        severity: "error",
      });
    } finally {
      setIsSubmitting(false);
      handleCloseDialog();
    }
  };

  const createHistory = async (finalData, selectedParticipants) => {
    try {
      // Step 1: Create the main Applications_History record
      const createConfig = {
        Entity: "Applications_History",
        APIData: { ...finalData },
        Trigger: ["workflow"],
      };

      const createResponse = await ZOHO.CRM.API.insertRecord(createConfig);

      if (createResponse?.data?.[0]?.code !== "SUCCESS") {
        throw new Error(
          createResponse?.data?.[0]?.message ||
            "Failed to create Applications_History record."
        );
      }

      const historyId = createResponse.data[0].details.id;

      // Step 2: Notify parent right away so the new record shows immediately.
      // The history record already exists in CRM — anything below (attachment
      // upload, participant links) must not turn this create into an error.
      const updatedRecord = {
        ...finalData,
        id: historyId,
        Participants: selectedParticipants,
        stakeHolder: finalData?.Stakeholder,
      };

      if (onRecordAdded) onRecordAdded(updatedRecord);

      // Step 3: Upload attachment if it exists and is a File object (new file selected)
      if (formData?.attachment && formData.attachment instanceof File) {
        try {
          const fileResp = await zohoApi.file.uploadAttachment({
            module: "Applications_History",
            recordId: historyId,
            data: formData.attachment,
          });
          console.log({ fileResp });
          if (fileResp.error) {
            console.error("Error uploading attachment:", fileResp.error);
          }
        } catch (error) {
          console.error("Error uploading attachment:", error);
        }
      }

      // Step 4: Link participants via junction records (skip contacts without an id).
      // A failed link must not fail the whole create — the record already exists.
      const participantsWithId = (selectedParticipants || []).filter(
        (contact) => contact?.id
      );

      const contactResults = await Promise.allSettled(
        participantsWithId.map((contact) =>
          ZOHO.CRM.API.insertRecord({
            Entity: "Application_Hstory",
            APIData: {
              Application_Hstory: { id: historyId },
              Contact: { id: contact.id },
            },
            Trigger: ["workflow"],
          })
        )
      );

      let failedLinks = 0;
      contactResults.forEach((result, index) => {
        const failed =
          result.status === "rejected" ||
          result.value?.data?.[0]?.code !== "SUCCESS";
        if (failed) {
          failedLinks += 1;
          console.warn(
            `Failed to link contact ID ${participantsWithId[index].id} to history ${historyId}:`,
            result.status === "rejected" ? result.reason : result.value?.data?.[0]
          );
        }
      });

      // Step 5: Final feedback — warning (not error) if some contacts could not be linked
      setSnackbar({
        open: true,
        message:
          failedLinks > 0
            ? `Record created, but ${failedLinks} contact(s) could not be linked.`
            : "Record created successfully!",
        severity: failedLinks > 0 ? "warning" : "success",
      });
    } catch (error) {
      console.error("Error creating history:", error);
      setSnackbar({
        open: true,
        message: `Error: ${error?.message || "An error occurred."}`,
        severity: "error",
      });
      throw error;
    }
  };
  


  const updateHistory = async (
    selectedRowData,
    finalData,
    selectedParticipants,
    currentModuleData
  ) => {
    try {
      const updatedHistoryName = selectedParticipants
        .map((c) => c.Full_Name)
        .join(", ");

      const updateConfig = {
        Entity: "Applications_History",
        RecordID: selectedRowData?.id,
        APIData: {
          id: selectedRowData?.id,
          Name: currentModuleData?.Name + " - " + updatedHistoryName,
          ...finalData
        },
        Trigger: ["workflow"],
      };

      const updateResponse = await ZOHO.CRM.API.updateRecord(updateConfig);

      console.log({updateResponse})

      if (updateResponse?.data[0]?.code === "SUCCESS") {
        const historyId = selectedRowData?.id;

        // Upload attachment if a new file was selected (File object, not just metadata)
        if (formData?.attachment && formData.attachment instanceof File) {
          try {
            // If there's an existing attachment, delete it first
            if (loadedAttachmentFromRecord?.[0]?.id) {
              await zohoApi.file.deleteAttachment({
                module: "Applications_History",
                recordId: historyId,
                attachment_id: loadedAttachmentFromRecord[0].id,
              });
            }
            // Upload the new attachment
            const fileResp = await zohoApi.file.uploadAttachment({
              module: "Applications_History",
              recordId: historyId,
              data: formData.attachment,
            });
            console.log({ fileResp });
            if (fileResp.error) {
              console.error("Error uploading attachment:", fileResp.error);
            }
          } catch (error) {
            console.error("Error uploading attachment:", error);
          }
        }

        // Fetch related contacts from Applications_History
        const relatedRecordsResponse = await ZOHO.CRM.API.getRelatedRecords({
          Entity: "Applications_History",
          RecordID: historyId,
          RelatedList: "Contacts4",
        });

        const existingContacts = relatedRecordsResponse?.data || [];
        const existingContactIds = existingContacts.map(
          (contact) => contact.Contact_Details?.id
        );

        // Find which contacts need to be deleted
        const selectedContactIds = selectedParticipants.map((c) => c.id);
        const toDeleteContactIds = existingContactIds.filter(
          (id) => !selectedContactIds.includes(id)
        );


        // Delete removed contacts
        for (const id of toDeleteContactIds) {
          const recordToDelete = existingContacts.find(
            (contact) => contact.Contact_Details?.id === id
          );

          if (recordToDelete?.id) {
            console.log("Deleting record:", recordToDelete.id);

            await ZOHO.CRM.API.deleteRecord({
              Entity: "Application_Hstory", // ✅ Ensure this is correct
              RecordID: recordToDelete.id,
            });
          }
        }

        // Find new contacts that need to be added
        const toAddContacts = selectedParticipants.filter(
          (contact) => !existingContactIds.includes(contact.id)
        );

        // Add new contacts
        for (const contact of toAddContacts) {
          try {
            console.log("Adding contact:", contact.id);

            await ZOHO.CRM.API.insertRecord({
              Entity: "Application_Hstory", // ✅ Ensure this is correct
              APIData: {
                Contact: { id: contact.id },
                Application_Hstory: { id: historyId },
              },
              Trigger: ["workflow"],
            });
          } catch (error) {
            console.error(`Error inserting record for contact ID ${contact.id}:`, error);
          }
        }

        const updatedRecord = {
          id: selectedRowData.id || null,
          ...finalData,
          Participants: selectedParticipants,
          stakeHolder: finalData?.Stakeholder,
        };

        if (onRecordAdded) onRecordAdded(updatedRecord);

        // ✅ Ensure state is updated properly
        setSelectedParticipants((prev) =>
          prev.filter((p) => selectedContactIds.includes(p.id))
        );

        setSnackbar({
          open: true,
          message: "Record and contacts updated successfully!",
          severity: "success",
        });
      } else {
        throw new Error("Failed to update record.");
      }
    } catch (error) {
      console.error("Error updating history:", error);
      throw error;
    }
  };


  const handleDelete = async () => {
    if (!selectedRowData) return; // No record selected

    try {
      // Delete related records first
      if (selectedRowData?.id) {
        const relatedRecordsResponse = await ZOHO.CRM.API.getRelatedRecords({
          Entity: "Applications_History",
          RecordID: selectedRowData?.id,
          RelatedList: "Contacts4",
        });

        const relatedRecords = relatedRecordsResponse?.data || [];

        const deletePromises = relatedRecords.map((record) =>
          ZOHO.CRM.API.deleteRecord({
            Entity: "Application_Hstory",
            RecordID: record.id,
          })
        );

        await Promise.all(deletePromises);
      }



      // Delete the main record
      const response = await ZOHO.CRM.API.deleteRecord({
        Entity: "Applications_History",
        RecordID: selectedRowData?.id,
      });

      if (response?.data[0]?.code === "SUCCESS") {
        setSnackbar({
          open: true,
          message: "Record and related records deleted successfully!",
          severity: "success",
        });

        // Notify parent to remove the record from the table
        handleCloseDialog({ deleted: true, id: selectedRowData.id });
        window.location.reload();
      } else {
        throw new Error("Failed to delete record.");
      }
    } catch (error) {
      console.error("Error deleting record or related records:", error);
      setSnackbar({
        open: true,
        message: "Error deleting records.",
        severity: "error",
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const handleApplicationDialogClose = () => {
    setOpenApplicationDialog(false);
  };

  const [openConfirmDialog, setOpenConfirmDialog] = React.useState(false);

  const handleAttachmentDelete = async () => {
    await zohoApi.file.deleteAttachment({
      module: "Applications_History",
      recordId: selectedRowData?.id,
      attachment_id: loadedAttachmentFromRecord?.[0]?.id,
    });
    // Update state to remove attachment
    setFormData((prev) => ({
      ...prev,
      attachment: null,
    }));

    setOpenConfirmDialog(false); // Close confirmation dialog

  }

  return (
    <>
      <MUIDialog
        open={openDialog}
        onClose={handleCloseDialog}
        PaperProps={{
          component: "form",
          onSubmit: handleSubmit,
          sx: {
            minWidth: "60%",
            maxHeight: "90vh", // Prevent scrolling
            overflow: "hidden", // Hide overflow if content exceeds
            "& *": {
              fontSize: "9pt", // Apply 9pt globally
            },
          },
        }}
      >
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: "8px", // Reduce spacing between fields
          }}
        >
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <FormControl
                fullWidth
                variant="standard"
                sx={{ fontSize: "9pt" }}
              >
                <InputLabel sx={{ fontSize: "9pt" }}>Type</InputLabel>
                <Select
                  value={formData.type || ""} // Ensure a fallback value
                  onChange={(e) => {
                    const type = e.target.value;
                    handleInputChange("type", type);
                    const results = getResultOptions(type, picklistConfig);
                    handleInputChange(
                      "result",
                      resultMapping[type] || results[0] || ""
                    );
                    handleInputChange(
                      "regarding",
                      getRegardingOptions(type, undefined, picklistConfig)[0] || ""
                    );
                  }}
                  label="Type"
                  sx={{
                    "& .MuiSelect-select": {
                      fontSize: "9pt",
                    },
                  }}
                >
                  {typeOptions.map((type) => (
                    <MenuItem key={type} value={type} sx={{ fontSize: "9pt" }}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl
                fullWidth
                variant="standard"
                sx={{ fontSize: "9pt" }}
              >
                <InputLabel sx={{ fontSize: "9pt" }}>Result</InputLabel>
                <Select
                  value={formData.result || ""} // Ensure a fallback value
                  onChange={(e) => {
                    const selectedResult = e.target.value;
                    handleInputChange("result", selectedResult);

                    // Autopopulate the type if a mapping exists
                    const correspondingType = typeMapping[selectedResult];
                    if (correspondingType) {
                      handleInputChange("type", correspondingType);
                    }
                  }}
                  label="Result"
                  sx={{
                    "& .MuiSelect-select": {
                      fontSize: "9pt",
                    },
                  }}
                >
                  {getResultOptions(formData.type, picklistConfig).map((result) => (
                    <MenuItem
                      key={result}
                      value={result}
                      sx={{ fontSize: "9pt" }}
                    >
                      {result}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <ContactField
            handleInputChange={handleInputChange}
            ZOHO={ZOHO}
            selectedRowData={selectedRowData}
            currentContact={currentContact}
            selectedContacts={historyContacts}
            currentModuleData={currentModuleData}
            selectedParticipants={selectedParticipants}
            setSelectedParticipants={setSelectedParticipants}
          />

          <Stakeholder
            formData={formData}
            handleInputChange={handleInputChange}
            ZOHO={ZOHO}
            currentModuleData={currentModuleData}
            selectedRowData={selectedRowData}
          />

          <Grid container spacing={1}>
            <Grid
              item
              xs={6}
              sx={
                {
                  //overflow: "hidden", // Ensure the grid container doesn't allow overflow
                  // width: "98%",
                }
              }
            >
              <Box>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DemoContainer
                    components={["DateTimePicker"]}
                    sx={{
                      // overflow: "hidden", // Prevent overflow in the DemoContainer
                      pt: 0,
                    }}
                  >
                    <DateTimePicker
                      id="date_time"
                      label="Date & Time"
                      name="date_time"
                      value={formData.date_time || dayjs()}
                      onChange={(newValue) =>
                        handleInputChange("date_time", newValue || dayjs())
                      }
                      format="DD-MM-YYYY hh:mm A"
                      sx={{
                        // bgcolor: "green",
                        "& .MuiInputBase-input": {
                          fontSize: "9pt",
                        },
                        "& .MuiInputAdornment-root": {
                          marginLeft: "-31px", // Move the icon slightly to the left
                        },
                        "& .MuiSvgIcon-root": {
                          fontSize: "20px", // Adjust the icon size
                          p: 0,
                        },
                        overflow: "hidden", // Prevent overflow in the DateTimePicker
                      }}
                      slotProps={{
                        popper: {
                          modifiers: [
                            {
                              name: "offset",
                              options: {
                                offset: [80, -180], // You can adjust the offset if necessary
                              },
                            },
                          ],
                        },
                        textField: {
                          variant: "standard",
                          margin: "dense",
                        },
                      }}
                    />
                  </DemoContainer>
                </LocalizationProvider>
              </Box>
            </Grid>

            <Grid item xs={6}>
              <Autocomplete
                freeSolo
                options={durationOptions}
                getOptionLabel={(option) => (option != null ? option.toString() : "")}
                value={formData?.duration != null ? Number(formData.duration) : null}
                isOptionEqualToValue={(option, value) => option === value || Number(option) === Number(value)}
                onChange={(event, newValue) => {
                  const val = typeof newValue === "string" ? Number(newValue) || null : newValue;
                  handleInputChange("duration", val);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Duration (Min)"
                    variant="standard"
                    sx={{
                      "& .MuiInputBase-input": {
                        fontSize: "9pt", // Font size for the input
                      },
                      "& .MuiInputLabel-root": {
                        fontSize: "9pt", // Font size for the label
                      },
                      "& .MuiFormHelperText-root": {
                        fontSize: "9pt", // Font size for helper text (if any)
                      },
                    }}
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
                sx={{
                  "& .MuiAutocomplete-input": {
                    fontSize: "9pt", // Font size for the input field inside the Autocomplete
                  },
                }}
              />
            </Grid>
          </Grid>

          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Autocomplete
                options={ownerList}
                getOptionLabel={(option) => option.full_name || ""}
                value={selectedOwner}
                onChange={(event, newValue) => {
                  setSelectedOwner(newValue);
                  // handleInputChange("ownerName", newValue)
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Record Owner"
                    name="history_owner"
                    variant="standard"
                    sx={{
                      "& .MuiInputLabel-root": { fontSize: "9pt" }, // Label size
                      "& .MuiInputBase-input": { fontSize: "9pt" }, // Input text size
                    }}
                  />
                )}
                slotProps={{
                  popper: {
                    modifiers: [
                      {
                        name: "preventOverflow",
                        options: {
                          boundary: "window",
                        },
                      },
                    ],
                  },
                  paper: {
                    sx: {
                      "& .MuiAutocomplete-listbox": {
                        fontSize: "9pt", // Option size
                      },
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <RegardingField
                formData={formData}
                handleInputChange={handleInputChange}
                selectedRowData={selectedRowData}
                picklistConfig={picklistConfig}
              />
            </Grid>
          </Grid>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              mt: 2,
              fontSize: "9pt",
            }}
          >
               <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: "100%",
              }}
            >
              <TextField
                variant="standard"
                sx={{
                  flexGrow: 1,
                  "& .MuiInputBase-input": {
                    fontSize: "9pt",
                  },
                }}
                value={formData?.attachment?.name || ""}
                placeholder="No file selected"
                InputProps={{
                  readOnly: true,
                  endAdornment: formData?.attachment?.name ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        // onClick={handleAttachmentDelete}
                        onClick={() => setOpenConfirmDialog(true)}
                        sx={{ padding: 0.5 }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />

              <Button
                variant="outlined"
                size="small"
                component="label"
                sx={{
                  flexShrink: 0,
                  minWidth: "80px",
                  textTransform: "none",
                  fontSize: "9pt",
                }}
              >
                Attachment
                <VisuallyHiddenInput type="file" onChange={handleSelectFile} />
              </Button>
            </Box>
          </Box>
          <Modal
            open={openConfirmDialog}
            onClose={() => setOpenConfirmDialog(false)}
          >
            <Paper sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              padding: 3,
              width: 300,
              textAlign: "center",
              boxShadow: 24,
            }}>
              <Typography id="confirm-delete-modal" variant="h6">
                Confirm Deletion
              </Typography>
              <Typography variant="body2" sx={{ marginY: 2 }}>
                Are you sure you want to delete this attachment? This action cannot be undone.
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <Button onClick={() => setOpenConfirmDialog(false)} color="primary">
                  Cancel
                </Button>
                <Button onClick={handleAttachmentDelete} color="error">
                  Delete
                </Button>
              </Box>
            </Paper>

            {/* <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogContent>
            Are you sure you want to delete this attachment? This action cannot be undone.
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenConfirmDialog(false)} color="primary">
                Cancel
              </Button>
              <Button onClick={handleAttachmentDelete} color="error">
                Delete
              </Button>
            </DialogActions> */}
          </Modal>

          <Box>
            <TextField
              margin="dense"
              id="history_details"
              name="history_details"
              label="History Details"
              fullWidth
              multiline
              variant="standard"
              minRows={3}
              value={formData?.details || ""} // Use controlled input
              onChange={(e) => handleInputChange("details", e.target.value)}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "9pt", // Input text font size
                },
                "& .MuiInputLabel-root": {
                  fontSize: "9pt", // Label font size
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions
          sx={{ display: "flex", justifyContent: "space-between" }}
        >
          {selectedRowData !== undefined ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                onClick={handleDelete}
                variant="outlined"
                color="error"
                disabled={isSubmitting}
                sx={{
                  fontSize: "9pt",
                  textTransform: "none",
                  padding: "4px 8px",
                }}
              >
                Delete
              </Button>
              {handleMoveToContact && (
                <Button
                  onClick={handleMoveToContact}
                  variant="outlined"
                  color="success"
                  disabled={isSubmitting}
                  sx={{
                    fontSize: "9pt",
                    textTransform: "none",
                    padding: "4px 8px",
                  }}
                >
                  Move to Contact
                </Button>
              )}
              {handleMoveToApplication && (
                <Button
                  onClick={handleMoveToApplication}
                  variant="outlined"
                  color="primary"
                  disabled={isSubmitting}
                  sx={{
                    fontSize: "9pt",
                    textTransform: "none",
                    padding: "4px 8px",
                  }}
                >
                  Move to Application
                </Button>
              )}
            </div>
          ) : (
            <div></div>
          )}
          <Box sx={{ display: "flex", gap: 1 }}>
            {" "}
            <Button
              onClick={handleCloseDialog}
              variant="outlined"
              disabled={isSubmitting}
              sx={{ fontSize: "9pt" }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={isSubmitting}
              sx={{ fontSize: "9pt", display: "flex", alignItems: "center", gap: 1 }}
            >
              {isSubmitting && <CircularProgress size={16} />}
              {isSubmitting ? "Saving..." : buttonText}
            </Button>
          </Box>
        </DialogActions>
      </MUIDialog>
      <ApplicationDialog
        openApplicationDialog={openApplicationDialog}
        handleApplicationDialogClose={handleApplicationDialogClose}
        applications={applications}
        ZOHO={ZOHO}
        handleDelete={handleDelete}
        formData={formData}
        historyContacts={historyContacts}
        selectedRowData={selectedRowData}
        currentContact={currentContact}
      />
      <ContactDialog
        openContactDialog={openContactDialog}
        handleContactDialogClose={() => setOpenContactDialog && setOpenContactDialog(false)}
        contacts={contacts}
        ZOHO={ZOHO}
        handleDelete={handleDelete}
        selectedRowData={selectedRowData}
        formData={formData}
        selectedOwner={selectedOwner}
        historyContacts={[
          ...(Array.isArray(historyContacts) ? historyContacts : []),
          ...(Array.isArray(selectedParticipants) ? selectedParticipants : []),
        ]}
        currentModuleData={currentModuleData}
        onRecordMoved={(movedId) => {
          if (handleCloseDialog) handleCloseDialog({ deleted: true, id: movedId });
        }}
      />
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
}
