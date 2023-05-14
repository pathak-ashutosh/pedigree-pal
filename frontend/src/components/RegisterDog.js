import React from "react";

export function RegisterDog({ registerDog }) {
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
        <div className="form-group">
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
        <div className="form-group">
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
        <div className="form-group">
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
        <div className="form-group">
          <label htmlFor="sex">Sex</label>
            <input
              className="form-control"
              id="sex"
              type="dropdown"
              name="sex"
              placeholder="M or F"
              required
            />
        </div>
        <div className="form-group">
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
        <div className="form-group">
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
        <div className="form-group">
          <input className="btn btn-primary" type="submit" value="Register" />
        </div>
        <button className="btn btn-secondary btn-danger mr-2" type="reset">
          Clear Form
        </button>
        <button className="btn btn-secondary btn-warning mr-2" type="cancel">
          Cancel
        </button>
      </form>
      </div>
    </div>
  );
}
