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
    address internal revoker = makeAddr("revoker");
    address internal outsider = makeAddr("outsider");

    bytes32 internal constant ROOT = keccak256("merkle-root-1");

    event Attested(bytes32 indexed root, address indexed issuer, uint40 timestamp);
    event Revoked(bytes32 indexed root, address indexed issuer, uint40 timestamp);

    function setUp() public {
        registry = new AttestationRegistry(admin);
        bytes32 issuerRole = registry.ISSUER_ROLE();
        bytes32 revokerRole = registry.REVOKER_ROLE();
        vm.startPrank(admin);
        registry.grantRole(issuerRole, issuer);
        registry.grantRole(revokerRole, revoker);
        vm.stopPrank();
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
        vm.prank(issuer);
        registry.attest(ROOT);

        vm.expectEmit(true, true, false, true);
        emit Revoked(ROOT, revoker, uint40(block.timestamp));
        vm.prank(revoker);
        registry.revoke(ROOT);

        (, bool revoked) = registry.attestations(ROOT);
        assertTrue(revoked);
        assertFalse(registry.isAttested(ROOT));
    }

    function test_RevokeRejectsUnknownAndDoubleRevocation() public {
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.NotAttested.selector, ROOT));
        vm.prank(revoker);
        registry.revoke(ROOT);

        vm.prank(issuer);
        registry.attest(ROOT);

        vm.startPrank(revoker);
        registry.revoke(ROOT);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.AlreadyRevoked.selector, ROOT));
        registry.revoke(ROOT);
        vm.stopPrank();
    }

    function test_RevokeRejectsNonRevoker() public {
        vm.prank(issuer);
        registry.attest(ROOT);

        vm.expectRevert(unauthorized(outsider, registry.REVOKER_ROLE()));
        vm.prank(outsider);
        registry.revoke(ROOT);
    }

    /// A leaked issuer key must not be able to revoke: revocation is permanent,
    /// so otherwise the compromised key could destroy every legitimate root.
    function test_IssuerCannotRevoke() public {
        vm.startPrank(issuer);
        registry.attest(ROOT);
        vm.expectRevert(unauthorized(issuer, registry.REVOKER_ROLE()));
        registry.revoke(ROOT);
        vm.stopPrank();

        assertTrue(registry.isAttested(ROOT));
    }

    function test_RevokedRootCannotBeReattested() public {
        vm.prank(issuer);
        registry.attest(ROOT);
        vm.prank(revoker);
        registry.revoke(ROOT);

        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.AlreadyAttested.selector, ROOT));
        vm.prank(issuer);
        registry.attest(ROOT);
    }

    function test_PauseBlocksAttestButNotRevoke() public {
        vm.prank(issuer);
        registry.attest(ROOT);

        vm.prank(admin);
        registry.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(issuer);
        registry.attest(keccak256("merkle-root-2"));

        // A compromised issuer key is contained by pause alone: it can neither
        // attest nor revoke while the operator cleans up.
        vm.expectRevert(unauthorized(issuer, registry.REVOKER_ROLE()));
        vm.prank(issuer);
        registry.revoke(ROOT);

        // The operator can still clear forged roots during containment.
        vm.prank(revoker);
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

    function test_ConstructorRejectsZeroAdmin() public {
        vm.expectRevert(AttestationRegistry.ZeroAdmin.selector);
        new AttestationRegistry(address(0));
    }

    function test_DeployedRegistryGrantsNoRolesByDefault() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertFalse(registry.hasRole(registry.ISSUER_ROLE(), admin));
        assertFalse(registry.hasRole(registry.REVOKER_ROLE(), admin));
        assertFalse(registry.hasRole(registry.REVOKER_ROLE(), issuer));
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
