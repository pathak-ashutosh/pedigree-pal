// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

/// @notice Deploys the registry with ADMIN_ADDRESS as DEFAULT_ADMIN_ROLE and no
///         other roles granted. The admin then grants ISSUER_ROLE to the
///         submitter's Turnkey key and REVOKER_ROLE to an operator key — never
///         both to the same key, or a leak would let the attacker permanently
///         revoke legitimate roots. Deployment stays separate from issuance so
///         the deploy key never signs attestations.
///
///         forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast
contract Deploy is Script {
    function run() external returns (AttestationRegistry registry) {
        address admin = vm.envAddress("ADMIN_ADDRESS");
        vm.startBroadcast();
        registry = new AttestationRegistry(admin);
        vm.stopBroadcast();
    }
}
