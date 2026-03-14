import React from "react";

export function NetworkErrorMessage({ message, dismiss }) {
  return (
    <div className="alert alert-danger" role="alert">
      {message}
      <button
        type="button"
        className="btn-close"
        data-bs-dismiss="alert"
        aria-label="Close"
        onClick={dismiss}
      />
    </div>
  );
}
