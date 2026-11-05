import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import TrainingStandalone from "./pages/standalone/TrainingStandalone.jsx";
import "../public/theme.css";
import "./app.css";

// Separate entry point (see vite.standalone.config.js) that builds just this page as one
// self-contained HTML file, for embedding directly in a Streamlit app via
// st.components.v1.html() - see streamlit_training/. HashRouter (not BrowserRouter) because
// the built file is embedded in a sandboxed iframe with no real server behind it, so there's
// no path for the History API to push state against.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <TrainingStandalone />
    </HashRouter>
  </React.StrictMode>
);
