// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

/// @notice Deploys the registry with ADMIN_ADDRESS as DEFAULT_ADMIN_ROLE.
///         Issuer keys are granted afterwards through the admin — deployment
///         and issuance stay separate so the deploy key never signs
///         attestations.
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
