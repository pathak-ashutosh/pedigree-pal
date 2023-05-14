import React, { useState } from "react";

// We'll use ethers to interact with the Ethereum network and our contract
import { ethers } from "ethers";

// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import TokenArtifact from "../contracts/PedigreePal.json";
import contractAddress from "../contracts/contract-address.json";

// All the logic of this dapp is contained in the Dapp component.
// These other components are just presentational ones: they don't have any
// logic. They just render HTML.
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { RegisterDog } from "./RegisterDog";
import { CheckDog } from "./CheckDog";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";
import { NoTokensMessage } from "./NoTokensMessage";

// This is the default id used by the Hardhat Network
const HARDHAT_NETWORK_ID = '31337';

// This is an error code that indicates that the user canceled a transaction
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

// This component is in charge of doing these things:
//   1. It connects to the user's wallet
//   2. Initializes ethers and the Token contract
//   3. Shows options to Register a dog or Check a dog's pedigree
//   4. Renders the whole application
export class Dapp extends React.Component {
  constructor(props) {
    super(props);

    // We store multiple things in Dapp's state.
    // You don't need to follow this pattern, but it's an useful example.
    this.initialState = {
      // The user's address
      selectedAddress: undefined,
      transactionError: undefined,
      networkError: undefined,
      txBeingSent: undefined,

      register: null,
      seePedigree: null,

      // The Dog's details
      dogId: undefined,
      name: undefined,
      breed: undefined,
      age: undefined,
      sex: undefined,
      mother: undefined,
      father: undefined,
    };

    this.state = this.initialState;
  }

  render() {
    // Ethereum wallets inject the window.ethereum object. If it hasn't been
    // injected, we instruct the user to install a wallet.
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    // The next thing we need to do, is to ask the user to connect their wallet.
    // When the wallet gets connected, we are going to save the users's address
    // in the component's state. So, if it hasn't been saved yet, we have
    // to show the ConnectWallet component.
    //
    // Note that we pass it a callback that is going to be called when the user
    // clicks a button. This callback just calls the _connectWallet method.
    if (!this.state.selectedAddress) {
      return (
        <ConnectWallet 
          connectWallet={() => this._connectWallet()} 
          networkError={this.state.networkError}
          dismiss={() => this._dismissNetworkError()}
        />
      );
    }
    
    // If the token address hasn't loaded yet, we show a loading component.
    if (!this.state.selectedAddress) {
      return <Loading />;
    }

    // If everything is loaded, we render the application with two buttons,
    // one for registering a dog and one for seeing a dog's details. On clicking
    // these buttons, we load the corresponding components.
    return (
      <div className="container-fluid mt-5 text-center">
        <div className="row">
          <div className="col">
            <button
              className="btn btn-primary"
              onClick={() => this._registerDogClicked()}
            >
              Register Dog
            </button>
          </div>
          <div className="col">
            <button
              className="btn btn-primary"
              onClick={() => this._checkDogClicked()}
            >
              Check Dog
            </button>
          </div>
        </div>

        <hr />

        <div className="row">
          <div className="col-12">
            {/* 
              Sending a transaction isn't an immediate action. You have to wait
              for it to be mined.
              If we are waiting for one, we show a message here.
            */}
            {this.state.txBeingSent && (
              <WaitingForTransactionMessage txHash={this.state.txBeingSent} />
            )}

            {/* 
              Sending a transaction can fail in multiple ways. 
              If that happened, we show a message here.
            */}
            {this.state.transactionError && (
              <TransactionErrorMessage
                message={this._getRpcErrorMessage(this.state.transactionError)}
                dismiss={() => this._dismissTransactionError()}
              />
            )}
          </div>
        </div>
        <div className="row mt-5">
          <div className="col">
            {this._renderMain()}
          </div>
        </div>
      </div>
      );
    }

  _renderMain() {
    // This method renders the main content of the application, depending on its
    // state. If no button has been clicked yet, it asks the user to register
    // or check a dog. If the user has clicked one of the buttons, it loads
    // the corresponding component.
    if (this.state.register) {
      return (
        <RegisterDog
          registerDog={() => this._registerDog(
            this.state.name,
            this.state.breed,
            this.state.sex,
            this.state.age,
            this.state.mother,
            this.state.father,
          )}
        />
      );
    }

    // If the user has clicked the "Check Dog" button, we load the CheckDog
    // component into the page.
    if (this.state.seePedigree) {
      return (
        <CheckDog
          getDogId={() => this._checkDog()}
        />
      );
    }
  }
  
  async _registerDogClicked() {
    // This method is called when the user clicks the "Register Dog" button.
    // We load the RegisterDog component into the page.
    this.setState({ register: true, seePedigree: false });
  }

  async _checkDogClicked() {
    // This method is called when the user clicks the "Check Dog" button.
    // We load the CheckDog component into the page.
    this.setState({ register: false, seePedigree: true });
  }

  async _registerDog(name, breed, sex, age, mother, father) { 
    // This method is called when the user clicks the "Register Dog" button.
    // Send a transaction to the contract to register a dog.

    try {
      // If a transaction fails, we save that error in the component's state.
      // We only save one such error, so before sending a second transaction, we
      // clear it.
      this._dismissTransactionError();

      // We send the transaction, and save its hash in the Dapp's state. This
      // way we can indicate that we are waiting for it to be mined.
      const tx = await this._token.registerDog(name, breed, sex, age, mother, father);
      this.setState({ txBeingSent: tx.hash });

      // We use .wait() to wait for the transaction to be mined. This method
      // returns the transaction's receipt.
      const receipt = await tx.wait();

      // The receipt, contains a status flag, which is 0 to indicate an error.
      if (receipt.status === 0) {
        // We can't know the exact error that made the transaction fail when it
        // was mined, so we throw this generic one.
        throw new Error("Transaction failed");
      }

      // If we got here, the transaction was successful.

    } catch (error) {
      // We check the error code to see if this error was produced because the
      // user rejected a tx. If that's the case, we do nothing.
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }

      // Other errors are logged and stored in the Dapp's state. This is used to
      // show them to the user, and for debugging.
      console.error(error);
      this.setState({ transactionError: error });
    } finally {
      // If we leave the try/catch, we aren't sending a tx anymore, so we clear
      // this part of the state.
      this.setState({ txBeingSent: undefined });
    }
  }

  async _checkDog() {
    // This method is called when the user clicks the "Check Dog" button.
    // Send a transaction to the contract to check a dog's details by its ID.

    try {
      const dogDetails = await this._token.retrieveDog(this.state.dogId);
      this.setState({ name: dogDetails.name });
      this.setState({ breed: dogDetails.breed });
      this.setState({ sex: dogDetails.sex });
      this.setState({ age: dogDetails.age });
      this.setState({ mother: dogDetails.mother });
      this.setState({ father: dogDetails.father });
      console.log(dogDetails);
    }
    catch (err) {
      console.error(err);
      this.setState({ transactionError: err });
    }
  }

  async _connectWallet() {
    // This method is run when the user clicks the Connect. It connects the
    // dapp to the user's wallet, and initializes it.

    // To connect to the user's wallet, we have to run this method.
    // It returns a promise that will resolve to the user's address.
    const [selectedAddress] = await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Once we have the address, we can initialize the application.

    // First we check the network
    this._checkNetwork();

    this._initialize(selectedAddress);

    // We reinitialize it whenever the user changes their account.
    window.ethereum.on("accountsChanged", ([newAddress]) => {
      // `accountsChanged` event can be triggered with an undefined newAddress.
      // This happens when the user removes the Dapp from the "Connected
      // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
      // To avoid errors, we reset the dapp state 
      if (newAddress === undefined) {
        return this._resetState();
      }
      
      this._initialize(newAddress);
    });
  }

  _initialize(userAddress) {
    // This method initializes the dapp

    // We first store the user's address in the component's state
    this.setState({
      selectedAddress: userAddress,
    });

    this._initializeEthers();
  }

  async _initializeEthers() {
    // We first initialize ethers by creating a provider using window.ethereum
    this._provider = new ethers.providers.Web3Provider(window.ethereum);

    // Then, we initialize the contract using that provider and the token's
    // artifact. You can do this same thing with your contracts.
    this._token = new ethers.Contract(
      contractAddress.Token,
      TokenArtifact.abi,
      this._provider.getSigner(0)
    );
  }

  // This method just clears part of the state.
  _dismissTransactionError() {
    this.setState({ transactionError: undefined });
  }

  // This method just clears part of the state.
  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  // This is an utility method that turns an RPC error into a human readable
  // message.
  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }

    return error.message;
  }

  // This method resets the state
  _resetState() {
    this.setState(this.initialState);
  }

  async _switchChain() {
    const chainIdHex = `0x${HARDHAT_NETWORK_ID.toString(16)}`
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    await this._initialize(this.state.selectedAddress);
  }

  // This method checks if the selected network is Localhost:8545
  _checkNetwork() {
    if (window.ethereum.networkVersion !== HARDHAT_NETWORK_ID) {
      this._switchChain();
    }
  }
}
