import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import TrainingStandalone from "./pages/standalone/TrainingStandalone.jsx";
import "../public/theme.css";
import "./app.css";

// Separate entry point (see vite.standalone.config.js) that builds just this page as one
// self-contained HTML file, for embedding directly in a Streamlit app via
// st.components.v1.html() - see streamlit_training/. MemoryRouter, not HashRouter or
// BrowserRouter: components.html() renders this inside a sandboxed iframe whose document is
// loaded via srcdoc, so window.location.href is literally "about:srcdoc" - not a valid base
// URL. HashRouter's internal history implementation still calls new URL(..., location.href)
// to encode locations, which throws ("Failed to construct 'URL': Invalid URL") and crashes
// the mount before React ever renders, producing a blank page with no visible error in
// Streamlit itself (only in the iframe's own about:srcdoc console). MemoryRouter never reads
// or writes window.location at all, so it has no such dependency.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={["/"]}>
      <TrainingStandalone />
    </MemoryRouter>
  </React.StrictMode>
);
