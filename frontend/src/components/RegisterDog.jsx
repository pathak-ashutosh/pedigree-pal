import React from "react";

export function RegisterDog({ registerDog, onCancel }) {
  return (
    <div className="container">
      <div className="row justify-content-md-center">
        <div className="col-12 text-center">
          <h1>Register Dog</h1>
        </div>
        <form
          onSubmit={(event) => {
            // This function just calls the registerDog callback with the form's data.
            event.preventDefault();

            const formData = new FormData(event.target);
            const name = formData.get("name");
            const breed = formData.get("breed");
            const sex = formData.get("sex");
            const age = formData.get("age");
            const mother = formData.get("mother");
            const father = formData.get("father");

            if (name && breed && sex && age && mother && father) {
              registerDog(name, breed, sex, age, mother, father);
            }
          }}
        >
        <div className="mb-3">
          <label htmlFor="name">Name</label>
          <input
            className="form-control"
            id="name"
            type="text"
            name="name"
            placeholder="Enter name"
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="breed">Breed</label>
          <input
            className="form-control"
            id="breed"
            type="text"
            name="breed"
            placeholder="Enter breed"
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="age">Age</label>
          <input
            className="form-control"
            id="age"
            type="number"
            name="age"
            placeholder="Enter age"
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="sex">Sex</label>
          <select className="form-control" id="sex" name="sex" required>
            <option value="">Select sex</option>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="mother">Mother</label>
          <input
            className="form-control"
            id="mother"
            type="number"
            name="mother"
            placeholder="Enter mother"  
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="father">Father</label>
          <input
            className="form-control"
            id="father"
            type="number"
            name="father"
            placeholder="Enter father"
            required
          />
        </div>
        <div className="mb-3">
          <input className="btn btn-primary" type="submit" value="Register" />
        </div>
        <button className="btn btn-danger me-2" type="reset">
          Clear Form
        </button>
        <button className="btn btn-warning me-2" type="button" onClick={onCancel}>
          Cancel
        </button>
      </form>
      </div>
    </div>
  );
}
