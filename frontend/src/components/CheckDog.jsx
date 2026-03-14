import React from "react";
import { Search } from "lucide-react";

export function CheckDog({ retrieveDog, onCancel }) {
  return (
    <div className="flex justify-center p-2">
      <div className="card bg-base-100 shadow-xl w-full max-w-md animate-fade-in">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <Search className="h-6 w-6 text-secondary" />
            <h2 className="card-title text-xl">Check Pedigree</h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.target);
              const dogId = formData.get("dogId");
              if (dogId) {
                retrieveDog(dogId);
              }
            }}
          >
            <div className="form-control mb-4">
              <label className="label" htmlFor="dogId">
                <span className="label-text font-medium">Dog ID</span>
              </label>
              <div className="join w-full">
                <input
                  className="input input-bordered join-item flex-1"
                  type="number"
                  id="dogId"
                  name="dogId"
                  placeholder="Enter dog ID"
                  min="0"
                  required
                />
                <button className="btn btn-secondary join-item gap-1" type="submit">
                  <Search className="h-4 w-4" />
                  Look up
                </button>
              </div>
            </div>
            <div className="card-actions justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
