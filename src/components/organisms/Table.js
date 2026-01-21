import * as React from "react";
import dayjs from "dayjs";
import Box from "@mui/material/Box";
import { Table as MUITable } from "@mui/material";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import AttachmentIcon from "@mui/icons-material/Attachment";
import CircularProgress from "@mui/material/CircularProgress";
import { visuallyHidden } from "@mui/utils";
import { useSnackbar } from "notistack";
import { zohoApi } from "../../zohoApi";
import DownloadIcon from "@mui/icons-material/Download";


const highlightText = (text, keyword) => {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} style={{ backgroundColor: "yellow" }}>
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const DownloadButton = ({ rowId, rowIcon, isSelected }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [waitingForDownload, setWaitingForDownload] = React.useState(false);


  console.log({ rowId })
  return (
    <IconButton
      sx={{ fontSize: "12pt" }}
      disableRipple
      onClick={async () => {
        setWaitingForDownload(true);
        const { data } = await zohoApi.file.getAttachments({
          module: "Applications_History",
          recordId: rowId,
        });



        if (data?.length > 0) {
          const downloadResp = await zohoApi.file.downloadAttachmentById({
            module: "Applications_History",
            recordId: rowId,
            attachmentId: data?.[0]?.id,
            fileName: data?.[0]?.File_Name,
          });
          console.log({ data, rowId, downloadResp });
          setWaitingForDownload(false);
        } else {
          enqueueSnackbar("No file.", { variant: "error" });
          setWaitingForDownload(false);
        }
      }}
    >
      {waitingForDownload ? (
        <CircularProgress
          size={16}
          sx={{ color: isSelected ? "white" : "primary.main" }}
        />
      ) : (
        rowIcon
      )}
    </IconButton>
  );
};

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function EnhancedTableHead({ order, orderBy, handleRequestSort }) {
  const createSortHandler = (property) => (event) => {
    handleRequestSort(event, property);
  };

  const headCells = [
    { id: "date_time", numeric: false, label: "Date & Time" },
    { id: "type", numeric: false, label: "Type" },
    { id: "result", numeric: false, label: "Result" },
    { id: "duration", numeric: false, label: "Duration" },
    {
      id: "regarding",
      numeric: false,
      label: "Regarding & Details",
      width: "400px",
    }, // Set width here
    {
      id: "icon",
      numeric: false,
      label: <AttachmentIcon />,
      dontShowSort: true,
    },
    { id: "ownerName", numeric: false, label: "Record Owner" },
    { id: "name", numeric: false, label: "Name" }
  ];

  return (
    <TableHead sx={{ bgcolor: "rgba(236, 240, 241, 1)" }}>
      <TableRow>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.numeric ? "right" : "left"}
            size="small"
            sx={{
              padding: "4px 8px",
              fontSize: "9pt",
              width: headCell.width || "auto", // Apply width here
            }}
          >
            {!headCell.dontShowSort ? (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : "asc"}
                onClick={createSortHandler(headCell.id)}
              >
                {headCell.label}
                {orderBy === headCell.id ? (
                  <Box component="span" sx={visuallyHidden}>
                    {order === "desc"
                      ? "sorted descending"
                      : "sorted ascending"}
                  </Box>
                ) : null}
              </TableSortLabel>
            ) : (
              headCell.label
            )}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

export function Table({
  rows,
  highlightedRecordId,
  handleClickOpenEditDialog,
  handleRightSideDataShow,
  keyword
}) {
  const [order, setOrder] = React.useState("desc");
  const [orderBy, setOrderBy] = React.useState("date_time");
  const [selectedRowId, setSelectedRowId] = React.useState(highlightedRecordId); // Sync with highlightedRecordId

  // Ensure selectedRowId matches highlightedRecordId on updates
  React.useEffect(() => {
    setSelectedRowId(highlightedRecordId);
  }, [highlightedRecordId]);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleRowClick = (row) => {
    if (row.id === selectedRowId) {
      // Deselect row if already selected
      setSelectedRowId(null);
    } else {
      // Select the clicked row
      setSelectedRowId(row.id);
      handleRightSideDataShow(row.regarding, row.details);
    }
  };

  const visibleRows = React.useMemo(
    () => [...(rows || [])].sort(getComparator(order, orderBy)),
    [order, rows, orderBy]
  );


  return (
    <Paper sx={{ height: "25.5rem", overflowY: "auto" }}>
      <TableContainer>
        <MUITable
          aria-labelledby="tableTitle"
          size="small"
          sx={{
            tableLayout: "fixed",
            borderCollapse: "collapse",
          }}
        >
          <EnhancedTableHead
            order={order}
            orderBy={orderBy}
            handleRequestSort={handleRequestSort}
            rowCount={rows?.length}
          />
          <TableBody>
            {rows === undefined || rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  align="center"
                  sx={{ fontStyle: "italic", color: "gray" }}
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row, index) => {
                if (!row || typeof row.name === "undefined") {
                  console.warn("Skipping malformed row:", row);
                  return null;
                }

                const isSelected = row.id === selectedRowId;

                return (
                  <TableRow
                    key={row.id || index}
                    sx={{
                      cursor: "pointer",
                      borderBottom: "1px solid #ddd",
                      backgroundColor: isSelected ? "primary.main" : "inherit",
                      color: isSelected ? "white" : "inherit",
                      "& .MuiTableCell-root": {
                        color: isSelected ? "white" : "inherit",
                        padding: "4px 8px",
                        fontSize: "9pt",
                        borderBottom: "1px solid #ddd",
                      },
                    }}
                    onDoubleClick={() => handleClickOpenEditDialog(row)}
                    onClick={() => handleRowClick(row)}
                  >
                    <TableCell size="small">
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                        }}
                      >
                        <span>{dayjs(row.date_time).format("DD/MM/YYYY")}</span>
                        <span>{dayjs(row.date_time).format("h:mm A")}</span>
                      </Box>
                    </TableCell>
                    <TableCell size="small">
                      {row.type || "Unknown Type"}
                    </TableCell>
                    <TableCell size="small">
                      {row.result || "No Result"}
                    </TableCell>
                    <TableCell size="small">{row.duration || "N/A"}</TableCell>
                    <TableCell
                      size="small"
                      sx={{
                        width: "400px",
                        whiteSpace: "normal",
                        wordWrap: "break-word",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 8,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "normal",
                          padding: "4px",
                        }}
                      >
                        {highlightText(row.regarding || "No Regarding", keyword)}
                      </Box>
                      <Box
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 8,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "normal",
                          padding: "4px",
                          lineHeight: 1
                        }}
                      >
                        {highlightText(row.details || "No Details", keyword)}
                      </Box>
                    </TableCell>
                    <TableCell size="small">
                      <DownloadButton
                        // rowId={row?.id}
                        isSelected={isSelected}
                        rowId={row?.id}
                        rowIcon={<DownloadIcon />}
                      />
                    </TableCell>
                    <TableCell size="small">
                      {row.ownerName || "Unknown Owner"}
                    </TableCell>
                    <TableCell
                      size="small"
                      sx={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        color: isSelected ? "white" : "primary.main",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const historyId = row.history_id || row.historyDetails?.id || row.id;
                        if (historyId) {
                          window.open(
                            `https://crm.zoho.com.au/crm/org7004396182/tab/CustomModule2/${historyId}`,
                            "_blank"
                          );
                        }
                      }}
                    >
                      {row.name || "Unknown Name"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </MUITable>
      </TableContainer>
    </Paper>
  );
}
