# Smart Contract Reference

## Overview

**File:** `contracts/PedigreePal.sol`
**Compiler:** Solidity ^0.8.0 (configured for 0.8.28)
**License:** MIT

The `PedigreePal` contract is the sole on-chain component. It maintains a registry of dogs keyed by auto-incrementing integer IDs.

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `owner` | `address` | Contract deployer address |
| `dogCount` | `uint` | Total number of registered dogs (also used as next ID) |
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
    uint _age,
    string memory _breed,
    string memory _sex,
    uint _mother,
    uint _father
) public returns (uint)
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

**Returns:** `uint` — the newly assigned dog ID

**Emits:** `Register(id, name, owner)`

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
event Register(uint id, string name, address owner);
```

Emitted when a new dog is successfully registered.

| Field | Type | Description |
|---|---|---|
| `id` | `uint` | Assigned dog ID |
| `name` | `string` | Dog's name |
| `owner` | `address` | Address that called `registerDog` |

---

## Modifiers

### `onlyOwner`

```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not the contract owner");
    _;
}
```

Restricts a function to the contract deployer. Not currently applied to public-facing functions — intended for future administrative operations.

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
- **Sequential IDs** — ID `0` is the zero value and is used to mean "unknown parent"; valid dogs start at ID `1`
