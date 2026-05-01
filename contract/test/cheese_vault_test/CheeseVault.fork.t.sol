// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/CheeseVault.sol";
import "../../src/UserWallet.sol";
import "../../src/UserWalletFactory.sol";

interface IERC20Extended is IERC20 {
    function decimals() external view returns (uint8);
}

/**
 * @title CheeseVault Fork Tests
 * @notice Tests using real USDC and USDT on Arbitrum mainnet fork
 * @dev Run with: forge test --match-path test/cheese_vault_test/CheeseVault.fork.t.sol --fork-url $ARBITRUM_RPC_URL -vv
 */
contract CheeseVaultForkTest is Test {
    CheeseVault public vault;
    UserWalletFactory public factory;
    IERC20Extended public usdc;
    IERC20Extended public usdt;

    // Real Arbitrum mainnet addresses
    address constant USDC_ADDRESS = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant USDT_ADDRESS = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;

    address public owner;
    address public admin;
    address public operator;
    address public treasurer;
    address public user1;
    address public user2;

    address public user1Wallet;
    address public user2Wallet;

    uint256 constant INITIAL_FEE = 0.5e6;
    uint256 constant MIN_DEPOSIT = 1e6;

    function setUp() public {
        string memory rpcUrl = vm.envString("ARBITRUM_RPC_URL");
        vm.createSelectFork(rpcUrl);

        owner     = address(this);
        admin     = makeAddr("admin");
        operator  = makeAddr("operator");
        treasurer = makeAddr("treasurer");
        user1     = makeAddr("user1");
        user2     = makeAddr("user2");

        usdc = IERC20Extended(USDC_ADDRESS);
        usdt = IERC20Extended(USDT_ADDRESS);

        address[] memory tokens = new address[](2);
        tokens[0] = USDC_ADDRESS;
        tokens[1] = USDT_ADDRESS;

        vault = new CheeseVault(tokens, INITIAL_FEE, MIN_DEPOSIT);
        factory = new UserWalletFactory(operator, address(vault), tokens);

        vault.grantRole(vault.ADMIN_ROLE(), admin);
        vault.grantRole(vault.OPERATOR_ROLE(), operator);
        vault.grantRole(vault.TREASURER_ROLE(), treasurer);

        vm.startPrank(operator);
        user1Wallet = factory.createWallet("user1@example.com", "user1");
        user2Wallet = factory.createWallet("user2@example.com", "user2");
        vm.stopPrank();

        deal(USDC_ADDRESS, user1Wallet, 1000e6);
        deal(USDC_ADDRESS, user2Wallet, 1000e6);
        deal(USDT_ADDRESS, user1Wallet, 1000e6);
        deal(USDT_ADDRESS, user2Wallet, 1000e6);
    }

    // ========== FORK TESTS ==========

    function test_Fork_TokenDecimalsCorrect() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(usdt.decimals(), 6);
    }

    function test_Fork_RealUSDCProcessPayment() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 100e6, keccak256("payment-001"), USDC_ADDRESS);

        assertEq(vault.availableProcessedPayments(USDC_ADDRESS), 100e6);
        assertEq(vault.availableFees(USDC_ADDRESS), INITIAL_FEE);
    }

    function test_Fork_RealUSDTProcessPayment() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 80e6, keccak256("usdt-payment-001"), USDT_ADDRESS);

        assertEq(vault.availableProcessedPayments(USDT_ADDRESS), 80e6);
        assertEq(vault.availableFees(USDT_ADDRESS), INITIAL_FEE);
    }

    function test_Fork_CompleteFlowUSDC() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 100e6, keccak256("bill-001"), USDC_ADDRESS);

        address recipient = makeAddr("recipient");
        vm.prank(treasurer);
        vault.withdrawVaultFunds(recipient, USDC_ADDRESS);

        assertEq(usdc.balanceOf(recipient), 100e6 + INITIAL_FEE);
    }

    function test_Fork_CompleteFlowUSDT() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 75e6, keccak256("bill-usdt-001"), USDT_ADDRESS);

        address recipient = makeAddr("recipient");
        vm.prank(treasurer);
        vault.withdrawVaultFunds(recipient, USDT_ADDRESS);

        assertEq(usdt.balanceOf(recipient), 75e6 + INITIAL_FEE);
    }

    function test_Fork_BothTokensIndependent() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 100e6, keccak256("usdc-bill"), USDC_ADDRESS);

        vm.prank(operator);
        vault.processPayment(user2Wallet, 200e6, keccak256("usdt-bill"), USDT_ADDRESS);

        assertEq(vault.totalPaymentsProcessed(USDC_ADDRESS), 100e6);
        assertEq(vault.totalPaymentsProcessed(USDT_ADDRESS), 200e6);
        assertEq(vault.totalFeesCollected(USDC_ADDRESS), INITIAL_FEE);
        assertEq(vault.totalFeesCollected(USDT_ADDRESS), INITIAL_FEE);

        assertTrue(vault.verifyVaultAccounting(USDC_ADDRESS));
        assertTrue(vault.verifyVaultAccounting(USDT_ADDRESS));
    }

    function test_Fork_MultipleUsersRealTokens() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 100e6, keccak256("user1-payment"), USDC_ADDRESS);

        vm.prank(operator);
        vault.processPayment(user2Wallet, 200e6, keccak256("user2-payment"), USDC_ADDRESS);

        assertEq(vault.totalPaymentsProcessed(USDC_ADDRESS), 300e6);
        assertEq(vault.totalFeesCollected(USDC_ADDRESS), INITIAL_FEE * 2);
    }
}
