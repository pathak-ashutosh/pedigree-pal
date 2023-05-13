import React from "react";

export function RegisterDog() {
  return (
    <div className="container">
      <div className="row justify-content-md-center">
        <div className="col-12 text-center">
          <h1>Register Dog</h1>
        </div>
        <div className="col-6 p-4">
          <form onSubmit={registerDog}>
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
            <button className="btn btn-primary mr-2" type="submit">
              Register Dog
            </button>
            <button className="btn btn-secondary mr-2" type="reset">
              Clear Form
            </button>
            <button className="btn btn-secondary mr-2" type="cancel">
              Cancel
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
