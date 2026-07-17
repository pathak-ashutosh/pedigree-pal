import React from "react";
import ReactDOM from "react-dom/client";
import { Dapp } from "./components/Dapp";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installGlobalErrorLogging } from "./lib/logger";

import "./index.css";

// This is the entry point of your application, but it just renders the Dapp
// react component. All of the logic is contained in it.

const root = ReactDOM.createRoot(document.getElementById("root"));
installGlobalErrorLogging();

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Dapp />
    </ErrorBoundary>
  </React.StrictMode>
);
