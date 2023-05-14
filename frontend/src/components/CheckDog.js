import { React } from "react";

// Shows an input field where the user enters a dog id, and a button that
// triggers the checkDog callback. The checkDog callback is passed in as a
// prop. It is going to be called when the user clicks the button. The
// checkDog callback is going to call the _checkDog method in the Dapp
// component. The _checkDog method is going to send a transaction to the
// contract to check a dog's pedigree. The transaction is going to be
// processed by the contract, and the contract is going to emit an event
// with the dog's details. The Dapp component is going to listen for this
// event, and when it receives it, it is going to update the state with the
// dog's details.

export function CheckDog({ checkDog }) {
    return (
        <div className="container">
            <div className="row justify-content-md-center">
                <div className="col-12 text-center">
                    <p>Enter </p>
                    <input type="number" id="dogId" />
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={checkDog}
                    >
                        Show Pedigree
                    </button>
                </div>
            </div>
        </div>
    );
}