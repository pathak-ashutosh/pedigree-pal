import React, { useReducer, useRef } from "react";
import { ethers } from "ethers";

import TokenArtifact from "../contracts/PedigreePal.json";
import contractAddress from "../contracts/contract-address.json";

import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { RegisterDog } from "./RegisterDog";
import { CheckDog } from "./CheckDog";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";
import { NoTokensMessage } from "./NoTokensMessage";
import { Navbar } from "./Navbar";
import { DogCertificateCard } from "./DogCertificateCard";
import { Footer } from "./Footer";
import { SuccessToast } from "./SuccessToast";

const HARDHAT_NETWORK_ID = "31337";
const ERROR_CODE_TX_REJECTED_BY_USER = "ACTION_REJECTED";

const initialState = {
  selectedAddress: undefined,
  transactionError: undefined,
  networkError: undefined,
  txBeingSent: undefined,
  register: null,
  seePedigree: null,
  contractReady: false,
  dogId: undefined,
  name: undefined,
  breed: undefined,
  age: undefined,
  sex: undefined,
  mother: undefined,
  father: undefined,
  owner: undefined,
  lastRegistered: null,
};

function reducer(state, patch) {
  return { ...state, ...patch };
}

export function Dapp() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const providerRef = useRef(null);
  const contractRef = useRef(null);

  function _cancelClicked() {
    dispatch({
      register: null,
      seePedigree: null,
      dogId: undefined,
      name: undefined,
      breed: undefined,
      age: undefined,
      sex: undefined,
      mother: undefined,
      father: undefined,
      owner: undefined,
    });
  }

  function _registerDogClicked() {
    dispatch({ register: true, seePedigree: false });
  }

  function _checkDogClicked() {
    dispatch({ register: false, seePedigree: true });
  }

  async function _registerDog(name, breed, sex, age, mother, father) {
    try {
      _dismissTransactionError();
      const tx = await contractRef.current.registerDog(name, breed, sex, age, mother, father);
      dispatch({ txBeingSent: tx.hash });
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }
      dispatch({ lastRegistered: { name } });
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }
      console.error(error);
      dispatch({ transactionError: error });
    } finally {
      dispatch({ txBeingSent: undefined });
    }
  }

  async function _checkDog(id) {
    try {
      _dismissTransactionError();
      const dog = await contractRef.current.retrieveDog(id);
      dispatch({
        dogId: dog.id.toString(),
        name: dog.name,
        breed: dog.breed,
        sex: dog.sex,
        age: dog.age.toString(),
        mother: dog.mother.toString(),
        father: dog.father.toString(),
        owner: dog.owner,
      });
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }
      console.error(error);
      dispatch({ transactionError: error });
    }
  }

  async function _connectWallet() {
    const [selectedAddress] = await window.ethereum.request({ method: "eth_requestAccounts" });
    _checkNetwork();
    _initialize(selectedAddress);
    window.ethereum.on("accountsChanged", ([newAddress]) => {
      if (newAddress === undefined) {
        return _resetState();
      }
      _initialize(newAddress);
    });
  }

  function _initialize(userAddress) {
    dispatch({ selectedAddress: userAddress });
    _initializeEthers();
  }

  async function _initializeEthers() {
    providerRef.current = new ethers.BrowserProvider(window.ethereum);
    const signer = await providerRef.current.getSigner();
    contractRef.current = new ethers.Contract(
      contractAddress.Token,
      TokenArtifact.abi,
      signer
    );
    dispatch({ contractReady: true });
  }

  function _dismissTransactionError() {
    dispatch({ transactionError: undefined });
  }

  function _dismissNetworkError() {
    dispatch({ networkError: undefined });
  }

  function _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }
    return error.message;
  }

  function _resetState() {
    dispatch(initialState);
  }

  async function _switchChain() {
    const chainIdHex = `0x${parseInt(HARDHAT_NETWORK_ID).toString(16)}`;
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    await _initialize(state.selectedAddress);
  }

  function _checkNetwork() {
    if (window.ethereum.networkVersion !== HARDHAT_NETWORK_ID) {
      _switchChain();
    }
  }

  if (window.ethereum === undefined) {
    return <NoWalletDetected />;
  }

  if (!state.selectedAddress) {
    return (
      <ConnectWallet
        connectWallet={_connectWallet}
        networkError={state.networkError}
        dismiss={_dismissNetworkError}
      />
    );
  }

  if (!state.contractReady) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <Navbar selectedAddress={state.selectedAddress} onDisconnect={_resetState} />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        {state.txBeingSent && (
          <WaitingForTransactionMessage txHash={state.txBeingSent} />
        )}
        {state.transactionError && (
          <TransactionErrorMessage
            message={_getRpcErrorMessage(state.transactionError)}
            dismiss={_dismissTransactionError}
          />
        )}

        {!state.register && !state.seePedigree && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div
                className="card bg-base-100 shadow hover:shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                onClick={_registerDogClicked}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && _registerDogClicked()}
              >
                <div className="card-body items-center text-center py-8">
                  <div className="text-4xl mb-2">🐕</div>
                  <h2 className="card-title text-primary">Register Dog</h2>
                  <p className="text-sm text-base-content/60">Add a new dog to the blockchain registry</p>
                </div>
              </div>
              <div
                className="card bg-base-100 shadow hover:shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                onClick={_checkDogClicked}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && _checkDogClicked()}
              >
                <div className="card-body items-center text-center py-8">
                  <div className="text-4xl mb-2">🔍</div>
                  <h2 className="card-title text-secondary">Check Pedigree</h2>
                  <p className="text-sm text-base-content/60">Look up a dog's lineage by ID</p>
                </div>
              </div>
            </div>
            <NoTokensMessage />
          </>
        )}

        {state.register && (
          <RegisterDog
            registerDog={(name, breed, sex, age, mother, father) =>
              _registerDog(name, breed, sex, age, mother, father)
            }
            onCancel={_cancelClicked}
          />
        )}

        {state.seePedigree && (
          <CheckDog
            retrieveDog={(dogId) => _checkDog(dogId)}
            onCancel={_cancelClicked}
          />
        )}

        {state.seePedigree && state.dogId !== undefined && (
          <DogCertificateCard
            dogId={state.dogId}
            name={state.name}
            breed={state.breed}
            sex={state.sex}
            age={state.age}
            mother={state.mother}
            father={state.father}
            owner={state.owner}
          />
        )}
      </main>

      <Footer contractAddr={contractAddress.Token} />

      {state.lastRegistered && (
        <SuccessToast
          dog={state.lastRegistered}
          onDone={() => dispatch({ lastRegistered: null })}
        />
      )}
    </div>
  );
}
