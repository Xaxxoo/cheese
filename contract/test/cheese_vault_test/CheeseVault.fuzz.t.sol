// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/CheeseVault.sol";
import "../../src/UserWallet.sol";
import "../../src/UserWalletFactory.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/**
 * @title CheeseVault Fuzz Tests
 * @notice Property-based testing using fuzzing
 * @dev Run with: forge test --match-path test/CheeseVault.fuzz.t.sol -vv
 */
contract CheeseVaultFuzzTest is Test {
    CheeseVault public vault;
    UserWalletFactory public factory;
    MockUSDC public usdc;
    MockUSDT public usdt;

    address public owner;
    address public admin;
    address public operator;
    address public treasurer;

    uint256 constant INITIAL_FEE = 0.5e6;
    uint256 constant MIN_DEPOSIT = 1e6;
    uint256 constant MAX_FEE     = 5e6;

    function setUp() public {
        owner     = address(this);
        admin     = makeAddr("admin");
        operator  = makeAddr("operator");
        treasurer = makeAddr("treasurer");

        usdc = new MockUSDC();
        usdt = new MockUSDT();

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(usdt);

        vault = new CheeseVault(tokens, INITIAL_FEE, MIN_DEPOSIT, owner);
        factory = new UserWalletFactory(owner, operator, address(vault), tokens);

        vault.grantRole(vault.ADMIN_ROLE(), admin);
        vault.grantRole(vault.OPERATOR_ROLE(), operator);
        vault.grantRole(vault.TREASURER_ROLE(), treasurer);
    }

    // ========== PROCESS PAYMENT FUZZ TESTS ==========

    /// @notice Processing payment always deducts correct amount
    function testFuzz_ProcessPayment(address user, uint256 paymentAmount) public {
        vm.assume(user != address(0));
        vm.assume(user != address(vault));
        vm.assume(user != address(factory));

        paymentAmount = bound(paymentAmount, 1e6, 1_000_000e6);

        string memory userId = vm.toString(user);
        string memory username = string(abi.encodePacked("u", vm.toString(uint160(user))));
        vm.prank(operator);
        address userWallet = factory.createWallet(userId, username);

        usdc.mint(userWallet, paymentAmount + INITIAL_FEE);

        vm.prank(operator);
        vault.processPayment(userWallet, paymentAmount, keccak256("payment"), address(usdc));

        assertEq(vault.availableProcessedPayments(address(usdc)), paymentAmount);
        assertEq(vault.availableFees(address(usdc)), INITIAL_FEE);
        assertEq(vault.totalPaymentsProcessed(address(usdc)), paymentAmount);
        assertEq(vault.totalFeesCollected(address(usdc)), INITIAL_FEE);
    }

    /// @notice USDT payment tracks independently of USDC
    function testFuzz_ProcessPaymentUSDT(uint256 usdcAmount, uint256 usdtAmount) public {
        usdcAmount = bound(usdcAmount, 1e6, 500_000e6);
        usdtAmount = bound(usdtAmount, 1e6, 500_000e6);

        vm.prank(operator);
        address wallet = factory.createWallet("user@example.com", "testuser");

        usdc.mint(wallet, usdcAmount + INITIAL_FEE);
        usdt.mint(wallet, usdtAmount + INITIAL_FEE);

        vm.prank(operator);
        vault.processPayment(wallet, usdcAmount, keccak256("usdc-payment"), address(usdc));

        vm.prank(operator);
        vault.processPayment(wallet, usdtAmount, keccak256("usdt-payment"), address(usdt));

        assertEq(vault.totalPaymentsProcessed(address(usdc)), usdcAmount);
        assertEq(vault.totalPaymentsProcessed(address(usdt)), usdtAmount);
        assertEq(vault.availableProcessedPayments(address(usdc)), usdcAmount);
        assertEq(vault.availableProcessedPayments(address(usdt)), usdtAmount);
    }

    /// @notice Multiple payments accumulate correctly
    function testFuzz_MultiplePayments(uint256 payment1, uint256 payment2, uint8 numUsers) public {
        payment1 = bound(payment1, 1e6, 100_000e6);
        payment2 = bound(payment2, 1e6, 100_000e6);
        numUsers = uint8(bound(numUsers, 1, 5));

        uint256 totalPayments = 0;
        uint256 totalFees     = 0;

        for (uint256 i = 0; i < numUsers; i++) {
            string memory userId   = string(abi.encodePacked("user", vm.toString(i)));
            string memory username = string(abi.encodePacked("u", vm.toString(i)));
            vm.prank(operator);
            address userWallet = factory.createWallet(userId, username);

            usdc.mint(userWallet, payment1 + INITIAL_FEE);
            vm.prank(operator);
            vault.processPayment(userWallet, payment1, keccak256(abi.encode("payment1", i)), address(usdc));
            totalPayments += payment1;
            totalFees     += INITIAL_FEE;

            usdc.mint(userWallet, payment2 + INITIAL_FEE);
            vm.prank(operator);
            vault.processPayment(userWallet, payment2, keccak256(abi.encode("payment2", i)), address(usdc));
            totalPayments += payment2;
            totalFees     += INITIAL_FEE;
        }

        assertEq(vault.totalPaymentsProcessed(address(usdc)), totalPayments);
        assertEq(vault.totalFeesCollected(address(usdc)), totalFees);
        assertEq(vault.availableProcessedPayments(address(usdc)), totalPayments);
        assertEq(vault.availableFees(address(usdc)), totalFees);
    }

    // ========== REFUND FUZZ TESTS ==========

    /// @notice Refund always restores correct balance
    function testFuzz_RefundPayment(uint256 paymentAmount) public {
        paymentAmount = bound(paymentAmount, 1e6, 1_000_000e6);

        vm.prank(operator);
        address userWallet = factory.createWallet("user@example.com", "testuser");

        usdc.mint(userWallet, paymentAmount + INITIAL_FEE);

        vm.prank(operator);
        vault.processPayment(userWallet, paymentAmount, keccak256("payment"), address(usdc));

        uint256 walletBalanceBefore = usdc.balanceOf(userWallet);

        vm.prank(admin);
        vault.refundPayment(userWallet, paymentAmount, false, keccak256("payment"), address(usdc));

        assertEq(usdc.balanceOf(userWallet), walletBalanceBefore + paymentAmount);
        assertEq(vault.availableProcessedPayments(address(usdc)), 0);
        assertEq(vault.totalPaymentsProcessed(address(usdc)), paymentAmount);
    }

    /// @notice Refund with fee restores full amount
    function testFuzz_RefundPaymentWithFee(uint256 paymentAmount) public {
        paymentAmount = bound(paymentAmount, 1e6, 1_000_000e6);

        vm.prank(operator);
        address userWallet = factory.createWallet("user@example.com", "testuser");

        usdc.mint(userWallet, paymentAmount + INITIAL_FEE);

        vm.prank(operator);
        vault.processPayment(userWallet, paymentAmount, keccak256("payment"), address(usdc));

        uint256 walletBalanceBefore = usdc.balanceOf(userWallet);

        vm.prank(admin);
        vault.refundPayment(userWallet, paymentAmount, true, keccak256("payment"), address(usdc));

        assertEq(usdc.balanceOf(userWallet), walletBalanceBefore + paymentAmount + INITIAL_FEE);
        assertEq(vault.availableProcessedPayments(address(usdc)), 0);
        assertEq(vault.availableFees(address(usdc)), 0);
        assertEq(vault.totalPaymentsProcessed(address(usdc)), paymentAmount);
        assertEq(vault.totalFeesCollected(address(usdc)), INITIAL_FEE);
    }

    // ========== VAULT WITHDRAWAL FUZZ TESTS ==========

    /// @notice Treasurer can withdraw all available funds
    function testFuzz_WithdrawVaultFunds(uint256 paymentAmount, address recipient) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient != address(vault));
        paymentAmount = bound(paymentAmount, 1e6, 1_000_000e6);

        vm.prank(operator);
        address userWallet = factory.createWallet("user@example.com", "testuser");

        usdc.mint(userWallet, paymentAmount + INITIAL_FEE);

        vm.prank(operator);
        vault.processPayment(userWallet, paymentAmount, keccak256("payment"), address(usdc));

        vm.prank(treasurer);
        vault.withdrawVaultFunds(recipient, address(usdc));

        assertEq(usdc.balanceOf(recipient), paymentAmount + INITIAL_FEE);
        assertEq(vault.availableProcessedPayments(address(usdc)), 0);
        assertEq(vault.availableFees(address(usdc)), 0);
    }

    // ========== INVARIANT TESTS ==========

    /// @notice Total payments processed should never decrease
    function testFuzz_TotalPaymentsNeverDecrease(uint256 payment1, uint256 payment2) public {
        payment1 = bound(payment1, 1e6, 500_000e6);
        payment2 = bound(payment2, 1e6, 500_000e6);

        vm.prank(operator);
        address userWallet = factory.createWallet("user@example.com", "testuser");

        usdc.mint(userWallet, payment1 + INITIAL_FEE);
        vm.prank(operator);
        vault.processPayment(userWallet, payment1, keccak256("payment1"), address(usdc));

        uint256 totalAfterFirst = vault.totalPaymentsProcessed(address(usdc));

        usdc.mint(userWallet, payment2 + INITIAL_FEE);
        vm.prank(operator);
        vault.processPayment(userWallet, payment2, keccak256("payment2"), address(usdc));

        uint256 totalAfterSecond = vault.totalPaymentsProcessed(address(usdc));

        assertGe(totalAfterSecond, totalAfterFirst);
        assertEq(totalAfterSecond, payment1 + payment2);
    }

    /// @notice Vault accounting always valid
    function testFuzz_VaultAccountingAlwaysValid(uint256 payment1, uint256 payment2, uint256 payment3) public {
        payment1 = bound(payment1, 1e6, 300_000e6);
        payment2 = bound(payment2, 1e6, 300_000e6);
        payment3 = bound(payment3, 1e6, 300_000e6);

        vm.prank(operator);
        address wallet1 = factory.createWallet("user1@example.com", "u1");
        vm.prank(operator);
        address wallet2 = factory.createWallet("user2@example.com", "u2");
        vm.prank(operator);
        address wallet3 = factory.createWallet("user3@example.com", "u3");

        usdc.mint(wallet1, payment1 + INITIAL_FEE);
        vm.prank(operator);
        vault.processPayment(wallet1, payment1, keccak256("payment1"), address(usdc));
        assertTrue(vault.verifyVaultAccounting(address(usdc)));

        usdc.mint(wallet2, payment2 + INITIAL_FEE);
        vm.prank(operator);
        vault.processPayment(wallet2, payment2, keccak256("payment2"), address(usdc));
        assertTrue(vault.verifyVaultAccounting(address(usdc)));

        usdc.mint(wallet3, payment3 + INITIAL_FEE);
        vm.prank(operator);
        vault.processPayment(wallet3, payment3, keccak256("payment3"), address(usdc));
        assertTrue(vault.verifyVaultAccounting(address(usdc)));

        vm.prank(treasurer);
        vault.withdrawVaultFunds(makeAddr("recipient"), address(usdc));
        assertTrue(vault.verifyVaultAccounting(address(usdc)));
    }

    /// @notice USDT and USDC accounting are always independent
    function testFuzz_TokenAccountingAlwaysIndependent(uint256 usdcPmt, uint256 usdtPmt) public {
        usdcPmt = bound(usdcPmt, 1e6, 500_000e6);
        usdtPmt = bound(usdtPmt, 1e6, 500_000e6);

        vm.prank(operator);
        address wallet = factory.createWallet("user@example.com", "testuser");

        usdc.mint(wallet, usdcPmt + INITIAL_FEE);
        vm.prank(operator);
        vault.processPayment(wallet, usdcPmt, keccak256("usdc"), address(usdc));

        usdt.mint(wallet, usdtPmt + INITIAL_FEE);
        vm.prank(operator);
        vault.processPayment(wallet, usdtPmt, keccak256("usdt"), address(usdt));

        // Each token tracks independently
        assertEq(vault.availableProcessedPayments(address(usdc)), usdcPmt);
        assertEq(vault.availableProcessedPayments(address(usdt)), usdtPmt);

        // Withdrawing USDC doesn't touch USDT
        vm.prank(treasurer);
        vault.withdrawVaultFunds(makeAddr("r"), address(usdc));

        assertEq(vault.availableProcessedPayments(address(usdc)), 0);
        assertEq(vault.availableProcessedPayments(address(usdt)), usdtPmt); // unchanged
    }

    // ========== FEE UPDATE FUZZ TESTS ==========

    /// @notice Admin can set any fee <= MAX_FEE
    function testFuzz_SetFee(uint256 newFee) public {
        newFee = bound(newFee, 0, MAX_FEE);
        vm.prank(admin);
        vault.setFee(newFee);
        assertEq(vault.feeAmount(), newFee);
    }

    /// @notice Setting fee above MAX_FEE always reverts
    function testFuzz_RevertWhen_SetFeeAboveMax(uint256 newFee) public {
        newFee = bound(newFee, MAX_FEE + 1, type(uint128).max);
        vm.prank(admin);
        vm.expectRevert("Fee exceeds maximum");
        vault.setFee(newFee);
    }

    // ========== MIN DEPOSIT FUZZ TESTS ==========

    /// @notice Admin can set any minimum deposit
    function testFuzz_SetMinDeposit(uint256 newMinDeposit) public {
        newMinDeposit = bound(newMinDeposit, 0, 1000e6);
        vm.prank(admin);
        vault.setMinDeposit(newMinDeposit);
        assertEq(vault.minDeposit(), newMinDeposit);
    }

    /// @notice Fee updates apply to new payments (both tokens use same fee)
    function testFuzz_FeeUpdateApplies(uint256 newFee, uint256 paymentAmount) public {
        newFee        = bound(newFee, 0.1e6, MAX_FEE);
        paymentAmount = bound(paymentAmount, 1e6, 100_000e6);

        vm.prank(admin);
        vault.setFee(newFee);

        vm.prank(operator);
        address userWallet = factory.createWallet("user@example.com", "testuser");

        usdc.mint(userWallet, paymentAmount + newFee);
        vm.prank(operator);
        vault.processPayment(userWallet, paymentAmount, keccak256("payment"), address(usdc));

        assertEq(vault.availableFees(address(usdc)), newFee);
        assertEq(vault.totalFeesCollected(address(usdc)), newFee);
    }
}
