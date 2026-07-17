# Smart Contract Reference

## Overview

**File:** `contracts/PedigreePal.sol`
**Compiler:** Solidity ^0.8.0 (configured for 0.8.28)
**License:** GPL-3.0-only

The `PedigreePal` contract is the sole on-chain component. It maintains a registry of dogs keyed by auto-incrementing integer IDs.

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `owner` | `address` | Contract deployer address |
| `dogId` | `uint` | Next dog ID; also equals the number registered |
| `dogs` | `mapping(uint => Dog)` | Registry mapping dog ID to Dog struct |

---

## Structs

### Dog

```solidity
struct Dog {
    uint id;        // Unique identifier, auto-assigned
    string name;    // Dog's name
    uint age;       // Age in years
    string breed;   // Breed (e.g. "Labrador Retriever")
    string sex;     // "M" or "F"
    uint mother;    // Mother's dog ID; 0 = unknown/unregistered
    uint father;    // Father's dog ID; 0 = unknown/unregistered
    address owner;  // msg.sender at time of registration
}
```

---

## Functions

### `registerDog`

```solidity
function registerDog(
    string memory _name,
    string calldata _breed,
    string calldata _sex,
    uint _age,
    uint _mother,
    uint _father
) public
```

Registers a new dog and stores it in the `dogs` mapping.

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `_name` | `string` | Dog's name |
| `_age` | `uint` | Age in years |
| `_breed` | `string` | Breed name |
| `_sex` | `string` | `"M"` or `"F"` |
| `_mother` | `uint` | ID of registered mother; `0` if unknown |
| `_father` | `uint` | ID of registered father; `0` if unknown |

**Returns:** nothing

**Emits:** `Register(name, breed, sex, age, mother, father)`

**Access:** Public — any address can register a dog

---

### `retrieveDog`

```solidity
function retrieveDog(uint _id) public view returns (Dog memory)
```

Returns the full `Dog` struct for a given ID.

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `_id` | `uint` | The dog's ID |

**Returns:** `Dog` struct

**Access:** Public view — no gas cost, no transaction required

---

## Events

### `Register`

```solidity
event Register(string name, string breed, string sex, uint age, uint mother, uint father);
```

Emitted when a new dog is successfully registered.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Dog's name |
| `breed` | `string` | Breed |
| `sex` | `string` | Sex value supplied by caller |
| `age` | `uint` | Age supplied by caller |
| `mother` | `uint` | Mother ID supplied by caller |
| `father` | `uint` | Father ID supplied by caller |

---

## Deployment

The deploy script at `scripts/deploy.js` compiles and deploys the contract, then writes the deployed address to `frontend/src/contracts/contract-address.json`.

```bash
# Local Hardhat network
npx hardhat run scripts/deploy.js --network localhost

# Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network amoy
```

**Known local address:** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
(First contract deployed on fresh Hardhat node — deterministic)

---

## Limitations & Known Issues

- **No parent validation** — parent IDs are not checked to exist before assignment
- **No update/deletion** — dog records are immutable once written
- **No access control on registration** — any wallet can register any dog
- **All data public** — owner contact details are exposed as an Ethereum address; full PII encryption is on the roadmap
- **Ambiguous ID zero** — the first valid dog is ID `0`, while the UI also instructs users to use `0` for an unknown parent
- **Unknown lookup ambiguity** — unregistered IDs return a zero-value struct instead of reverting or reporting absence
