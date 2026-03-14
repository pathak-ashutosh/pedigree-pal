import React from "react";

export function TransactionErrorMessage({ message, dismiss }) {
  return (
    <div className="alert alert-danger" role="alert">
      Error sending transaction: {message.substring(0, 100)}
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
