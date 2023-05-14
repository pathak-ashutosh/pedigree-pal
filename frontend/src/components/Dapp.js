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

    const [registerDog, setRegisterDog] = useState(null);
  
    const onClick = () => {
      setRegisterDog(<RegisterDog registerDog={() => this._registerDog()} />);
    };

    // If everything is loaded, we render the application with two buttons,
    // one for registering a dog and one for seeing a dog's details.
    return (
      
      // render two buttons here, one for registering a dog and one for seeing a dog's details

      <div className="container">
        <div className="row justify-content-md-center">
          <div className="col-12 text-center">
          <div className="col-6 p-4 text-center">
            <p>Register a dog</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={registerDog}
            >
              Register Dog
            </button>
          </div>
          <div className="col-6 p-4 text-center">
            <p>Check a dog's pedigree</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={checkDog}
            >
              Check Dog
            </button>
          </div>
        </div>
      </div>
      </div>
    );
  }

  async _registerDog() { 
    // This method is called when the user clicks the "Register Dog" button.
    // Send a transaction to the contract to register a dog.
    
    const dogDetails = {
      name: this.state.name,
      breed: this.state.breed,
      age: this.state.age,
    };

    try {
      const tx = await this._token.registerDog(dogDetails);
      this.setState({ txBeingSent: tx.hash });
      await tx.wait();
      this.setState({ txBeingSent: undefined });
    } catch (err) {
      // If the error was a user rejection, don't show it.
      if (err.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }

      console.error(err);
      this.setState({ transactionError: err });
    }
  }

  async _checkDog() {
    // This method is called when the user clicks the "Check Dog" button.
    // It calls the contract to get the dog's details.
    // We set the txBeingSent object with the information of the transaction,
    // so we can show a "waiting for confirmation" message to the user.
    try {
      const tx = await this._token.checkDog();
      this.setState({ txBeingSent: tx.hash });
      await tx.wait();
      this.setState({ txBeingSent: undefined });
    } catch (err) {
      // If the error was a user rejection, don't show it.
      if (err.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }

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
      TokenArtifact,
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
