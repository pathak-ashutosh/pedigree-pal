// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title AttestationRegistry
/// @notice Append-only registry of Merkle roots covering off-chain record
///         hashes. An attestation proves the issuer asserted a batch of
///         records at a point in time; it carries no record data. Immutable
///         and versioned: breaking changes ship as a new registry, and roots
///         attested here stay valid forever.
contract AttestationRegistry is AccessControl, Pausable {
    /// @notice Held by the automated submitter's signing key. Attestation is
    ///         all it can do — see REVOKER_ROLE.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @notice Deliberately separate from ISSUER_ROLE. Revocation is permanent
    ///         (a revoked root can never be re-attested), so a leaked issuer key
    ///         must not be able to destroy the registry during the very incident
    ///         `pause` exists to contain. Held by an operator key, never by the
    ///         automated submitter.
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    struct Attestation {
        uint40 attestedAt;
        bool revoked;
    }

    /// @notice Anyone can verify a root directly from this mapping without an
    ///         indexer: nonzero `attestedAt` and `revoked == false`.
    mapping(bytes32 root => Attestation) public attestations;

    event Attested(bytes32 indexed root, address indexed issuer, uint40 timestamp);
    event Revoked(bytes32 indexed root, address indexed issuer, uint40 timestamp);

    error ZeroRoot();
    error ZeroAdmin();
    error AlreadyAttested(bytes32 root);
    error NotAttested(bytes32 root);
    error AlreadyRevoked(bytes32 root);

    /// @param admin Receives DEFAULT_ADMIN_ROLE and grants the issuer and
    ///        revoker roles afterwards. Rejected if zero: the registry is
    ///        immutable, so a misconfigured deployment could never grant a
    ///        single role and would have to be redeployed.
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function attest(bytes32 root) external onlyRole(ISSUER_ROLE) whenNotPaused {
        if (root == bytes32(0)) revert ZeroRoot();
        if (attestations[root].attestedAt != 0) revert AlreadyAttested(root);
        uint40 timestamp = uint40(block.timestamp);
        attestations[root] = Attestation({attestedAt: timestamp, revoked: false});
        emit Attested(root, msg.sender, timestamp);
    }

    /// @notice Permanent: a revoked root can never be attested again.
    ///         Stays callable while paused so an operator can clear forged
    ///         roots during containment — safe only because the compromised
    ///         issuer key does not hold REVOKER_ROLE.
    function revoke(bytes32 root) external onlyRole(REVOKER_ROLE) {
        Attestation storage attestation = attestations[root];
        if (attestation.attestedAt == 0) revert NotAttested(root);
        if (attestation.revoked) revert AlreadyRevoked(root);
        attestation.revoked = true;
        emit Revoked(root, msg.sender, uint40(block.timestamp));
    }

    function isAttested(bytes32 root) external view returns (bool) {
        Attestation storage attestation = attestations[root];
        return attestation.attestedAt != 0 && !attestation.revoked;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
