import React from "react";
import { PawPrint } from "lucide-react";

export function RegisterDog({ registerDog, onCancel }) {
  return (
    <div className="flex justify-center p-2">
      <div className="card bg-base-100 shadow-xl w-full max-w-lg animate-fade-in">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <PawPrint className="h-6 w-6 text-primary" />
            <h2 className="card-title text-xl">Register a Dog</h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.target);
              const name = formData.get("name");
              const breed = formData.get("breed");
              const sex = formData.get("sex");
              const age = formData.get("age");
              const mother = formData.get("mother");
              const father = formData.get("father");
              if (name && breed && sex && age && mother !== null && father !== null) {
                registerDog(name, breed, sex, age, mother, father);
              }
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-control sm:col-span-2">
                <label className="label" htmlFor="name">
                  <span className="label-text font-medium">Name</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  id="name"
                  type="text"
                  name="name"
                  placeholder="e.g. Rex"
                  required
                />
              </div>
              <div className="form-control sm:col-span-2">
                <label className="label" htmlFor="breed">
                  <span className="label-text font-medium">Breed</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  id="breed"
                  type="text"
                  name="breed"
                  placeholder="e.g. Golden Retriever"
                  required
                />
              </div>
              <div className="form-control">
                <label className="label" htmlFor="age">
                  <span className="label-text font-medium">Age (years)</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  id="age"
                  type="number"
                  name="age"
                  placeholder="e.g. 3"
                  min="0"
                  required
                />
              </div>
              <div className="form-control">
                <label className="label" htmlFor="sex">
                  <span className="label-text font-medium">Sex</span>
                </label>
                <select className="select select-bordered w-full" id="sex" name="sex" required>
                  <option value="">Select...</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label" htmlFor="mother">
                  <span className="label-text font-medium">Mother ID</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  id="mother"
                  type="number"
                  name="mother"
                  placeholder="Dog ID (0 if none)"
                  min="0"
                  required
                />
              </div>
              <div className="form-control">
                <label className="label" htmlFor="father">
                  <span className="label-text font-medium">Father ID</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  id="father"
                  type="number"
                  name="father"
                  placeholder="Dog ID (0 if none)"
                  min="0"
                  required
                />
              </div>
            </div>
            <div className="card-actions justify-end mt-6 gap-2">
              <button type="reset" className="btn btn-ghost btn-sm">
                Clear
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary gap-2">
                <PawPrint className="h-4 w-4" />
                Register
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
