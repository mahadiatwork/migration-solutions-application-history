import React from "react";
import {
  Radio,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

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
  matter?.Stakeholder_Auto ||
  matter?.Stakeholder_1 ||
  matter?.Stake_Holder ||
  matter?.Stakeholder ||
  null;

export default function MatterTable({
  matters,
  selectedMatterId,
  setSelectedMatterId,
  sourceMatterId,
}) {
  return (
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
            const isCurrentMatter =
              sourceMatterId != null && matterId === String(sourceMatterId);
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
}
