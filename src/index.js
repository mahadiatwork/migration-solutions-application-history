import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import CssBaseline from "@mui/material/CssBaseline";
import { SnackbarProvider } from "notistack";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <SnackbarProvider
      iconVariant={{
        error: "",
      }}
    >
      <CssBaseline />
      <App />
    </SnackbarProvider>
  </React.StrictMode>
);
