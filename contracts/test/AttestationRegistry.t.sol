// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

contract AttestationRegistryTest is Test {
    AttestationRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal outsider = makeAddr("outsider");

    bytes32 internal constant ROOT = keccak256("merkle-root-1");

    event Attested(bytes32 indexed root, address indexed issuer, uint40 timestamp);
    event Revoked(bytes32 indexed root, address indexed issuer, uint40 timestamp);

    function setUp() public {
        registry = new AttestationRegistry(admin);
        bytes32 issuerRole = registry.ISSUER_ROLE();
        vm.prank(admin);
        registry.grantRole(issuerRole, issuer);
    }

    function unauthorized(address account, bytes32 role) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, account, role);
    }

    function test_AttestRecordsTimestampAndEmits() public {
        vm.warp(1_800_000_000);
        vm.expectEmit(true, true, false, true);
        emit Attested(ROOT, issuer, uint40(1_800_000_000));
        vm.prank(issuer);
        registry.attest(ROOT);

        (uint40 attestedAt, bool revoked) = registry.attestations(ROOT);
        assertEq(attestedAt, uint40(1_800_000_000));
        assertFalse(revoked);
        assertTrue(registry.isAttested(ROOT));
    }

    function test_AttestRejectsNonIssuer() public {
        vm.expectRevert(unauthorized(outsider, registry.ISSUER_ROLE()));
        vm.prank(outsider);
        registry.attest(ROOT);

        vm.expectRevert(unauthorized(admin, registry.ISSUER_ROLE()));
        vm.prank(admin);
        registry.attest(ROOT);
    }

    function test_AttestRejectsZeroRoot() public {
        vm.expectRevert(AttestationRegistry.ZeroRoot.selector);
        vm.prank(issuer);
        registry.attest(bytes32(0));
    }

    function test_AttestRejectsDuplicate() public {
        vm.startPrank(issuer);
        registry.attest(ROOT);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.AlreadyAttested.selector, ROOT));
        registry.attest(ROOT);
        vm.stopPrank();
    }

    function test_RevokeMarksRootAndEmits() public {
        vm.startPrank(issuer);
        registry.attest(ROOT);
        vm.expectEmit(true, true, false, true);
        emit Revoked(ROOT, issuer, uint40(block.timestamp));
        registry.revoke(ROOT);
        vm.stopPrank();

        (, bool revoked) = registry.attestations(ROOT);
        assertTrue(revoked);
        assertFalse(registry.isAttested(ROOT));
    }

    function test_RevokeRejectsUnknownAndDoubleRevocation() public {
        vm.startPrank(issuer);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.NotAttested.selector, ROOT));
        registry.revoke(ROOT);

        registry.attest(ROOT);
        registry.revoke(ROOT);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.AlreadyRevoked.selector, ROOT));
        registry.revoke(ROOT);
        vm.stopPrank();
    }

    function test_RevokeRejectsNonIssuer() public {
        vm.prank(issuer);
        registry.attest(ROOT);
        vm.expectRevert(unauthorized(outsider, registry.ISSUER_ROLE()));
        vm.prank(outsider);
        registry.revoke(ROOT);
    }

    function test_RevokedRootCannotBeReattested() public {
        vm.startPrank(issuer);
        registry.attest(ROOT);
        registry.revoke(ROOT);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.AlreadyAttested.selector, ROOT));
        registry.attest(ROOT);
        vm.stopPrank();
    }

    function test_PauseBlocksAttestButNotRevoke() public {
        vm.prank(issuer);
        registry.attest(ROOT);

        vm.prank(admin);
        registry.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(issuer);
        registry.attest(keccak256("merkle-root-2"));

        // Break-glass: revocation must stay available during an incident.
        vm.prank(issuer);
        registry.revoke(ROOT);
        assertFalse(registry.isAttested(ROOT));

        vm.prank(admin);
        registry.unpause();
        vm.prank(issuer);
        registry.attest(keccak256("merkle-root-2"));
    }

    function test_PauseRejectsNonAdmin() public {
        vm.expectRevert(unauthorized(issuer, registry.DEFAULT_ADMIN_ROLE()));
        vm.prank(issuer);
        registry.pause();
    }

    function test_IssuerRotation() public {
        address nextIssuer = makeAddr("next-issuer");
        vm.startPrank(admin);
        registry.grantRole(registry.ISSUER_ROLE(), nextIssuer);
        registry.revokeRole(registry.ISSUER_ROLE(), issuer);
        vm.stopPrank();

        vm.expectRevert(unauthorized(issuer, registry.ISSUER_ROLE()));
        vm.prank(issuer);
        registry.attest(ROOT);

        vm.prank(nextIssuer);
        registry.attest(ROOT);
        assertTrue(registry.isAttested(ROOT));
    }

    function testFuzz_AttestThenVerify(bytes32 root, uint40 timestamp) public {
        vm.assume(root != bytes32(0));
        timestamp = uint40(bound(timestamp, 1, type(uint40).max));
        vm.warp(timestamp);

        vm.prank(issuer);
        registry.attest(root);

        (uint40 attestedAt, bool revoked) = registry.attestations(root);
        assertEq(attestedAt, timestamp);
        assertFalse(revoked);
        assertTrue(registry.isAttested(root));
    }

    function testFuzz_UnattestedRootsVerifyFalse(bytes32 root) public view {
        assertFalse(registry.isAttested(root));
    }
}
