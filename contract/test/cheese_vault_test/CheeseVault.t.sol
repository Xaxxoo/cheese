// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/CheeseVault.sol";
import "../../src/UserWallet.sol";
import "../../src/UserWalletFactory.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") { _mint(msg.sender, 1_000_000 * 10 ** 6); }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract CheeseVaultTest is Test {
    CheeseVault public vault;
    UserWalletFactory public factory;
    MockUSDC public usdc;
    MockUSDT public usdt;

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
    uint256 constant MAX_FEE     = 5e6;

    // Mirror events for expectEmit
    event PaymentProcessed(
        address indexed userWallet,
        bytes32 indexed paymentId,
        address indexed token,
        uint256 paymentAmount,
        uint256 feeAmount,
        uint256 remainingBalance
    );

    event PaymentRefunded(
        address indexed userWallet,
        bytes32 indexed paymentId,
        address indexed token,
        uint256 refundAmount,
        uint256 newBalance
    );

    event VaultFundsWithdrawn(
        address indexed treasurer,
        address indexed to,
        address indexed token,
        uint256 paymentsAmount,
        uint256 feesAmount,
        uint256 totalAmount
    );

    function setUp() public {
        owner     = address(this);
        admin     = makeAddr("admin");
        operator  = makeAddr("operator");
        treasurer = makeAddr("treasurer");
        user1     = makeAddr("user1");
        user2     = makeAddr("user2");

        usdc = new MockUSDC();
        usdt = new MockUSDT();

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(usdt);

        vault = new CheeseVault(tokens, INITIAL_FEE, MIN_DEPOSIT, owner);

        factory = new UserWalletFactory(
            owner,
            operator, // backend
            address(vault),
            tokens
        );

        vault.grantRole(vault.ADMIN_ROLE(), admin);
        vault.grantRole(vault.OPERATOR_ROLE(), operator);
        vault.grantRole(vault.TREASURER_ROLE(), treasurer);

        vm.startPrank(operator);
        user1Wallet = factory.createWallet("user1@example.com", "user1");
        user2Wallet = factory.createWallet("user2@example.com", "user2");
        vm.stopPrank();

        // Fund wallets with both tokens
        usdc.mint(user1Wallet, 500e6);
        usdc.mint(user2Wallet, 500e6);
        usdt.mint(user1Wallet, 500e6);
        usdt.mint(user2Wallet, 500e6);
    }

    // ========== DEPLOYMENT TESTS ==========

    function test_Deployment() public view {
        assertEq(vault.feeAmount(), INITIAL_FEE);
        assertEq(vault.minDeposit(), MIN_DEPOSIT);
        assertEq(vault.MAX_FEE(), MAX_FEE);

        assertTrue(vault.supportedTokens(address(usdc)));
        assertTrue(vault.supportedTokens(address(usdt)));

        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(vault.hasRole(vault.ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(vault.OPERATOR_ROLE(), operator));
        assertTrue(vault.hasRole(vault.TREASURER_ROLE(), treasurer));
    }

    function test_RevertWhen_DeploymentWithFeeExceedingMax() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        vm.expectRevert("Fee exceeds maximum");
        new CheeseVault(tokens, MAX_FEE + 1, MIN_DEPOSIT, owner);
    }

    function test_RevertWhen_DeploymentWithInvalidAdmin() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        vm.expectRevert("Invalid admin");
        new CheeseVault(tokens, INITIAL_FEE, MIN_DEPOSIT, address(0));
    }

    // ========== PROCESS PAYMENT TESTS ==========

    function test_ProcessPaymentUSDC() public {
        uint256 paymentAmount = 50e6;
        bytes32 paymentId     = keccak256("payment-001");

        vm.prank(operator);
        vault.processPayment(user1Wallet, paymentAmount, paymentId, address(usdc));

        assertEq(vault.availableProcessedPayments(address(usdc)), paymentAmount);
        assertEq(vault.totalPaymentsProcessed(address(usdc)), paymentAmount);
        assertEq(vault.availableFees(address(usdc)), INITIAL_FEE);
        assertEq(vault.totalFeesCollected(address(usdc)), INITIAL_FEE);

        // USDT accounting untouched
        assertEq(vault.availableProcessedPayments(address(usdt)), 0);
    }

    function test_ProcessPaymentUSDT() public {
        uint256 paymentAmount = 75e6;
        bytes32 paymentId     = keccak256("payment-usdt-001");

        vm.prank(operator);
        vault.processPayment(user1Wallet, paymentAmount, paymentId, address(usdt));

        assertEq(vault.availableProcessedPayments(address(usdt)), paymentAmount);
        assertEq(vault.totalPaymentsProcessed(address(usdt)), paymentAmount);
        assertEq(vault.availableFees(address(usdt)), INITIAL_FEE);

        // USDC accounting untouched
        assertEq(vault.availableProcessedPayments(address(usdc)), 0);
    }

    function test_ProcessPaymentEmitsEvent() public {
        uint256 paymentAmount = 50e6;
        bytes32 paymentId     = keccak256("payment-001");

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit PaymentProcessed(user1Wallet, paymentId, address(usdc), paymentAmount, INITIAL_FEE, 0);

        vault.processPayment(user1Wallet, paymentAmount, paymentId, address(usdc));
    }

    function test_MultiplePayments() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("payment-001"), address(usdc));

        vm.prank(operator);
        vault.processPayment(user1Wallet, 30e6, keccak256("payment-002"), address(usdc));

        assertEq(vault.availableProcessedPayments(address(usdc)), 80e6);
        assertEq(vault.totalPaymentsProcessed(address(usdc)), 80e6);
        assertEq(vault.availableFees(address(usdc)), INITIAL_FEE * 2);
        assertEq(vault.totalFeesCollected(address(usdc)), INITIAL_FEE * 2);
    }

    function test_RevertWhen_ProcessPaymentNotOperator() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.processPayment(user1Wallet, 50e6, keccak256("payment-001"), address(usdc));
    }

    function test_RevertWhen_ProcessPaymentZeroAmount() public {
        vm.prank(operator);
        vm.expectRevert("Payment amount must be greater than 0");
        vault.processPayment(user1Wallet, 0, keccak256("payment-001"), address(usdc));
    }

    function test_RevertWhen_ProcessPaymentInvalidWallet() public {
        vm.prank(operator);
        vm.expectRevert("Invalid wallet address");
        vault.processPayment(address(0), 50e6, keccak256("payment-001"), address(usdc));
    }

    function test_RevertWhen_ProcessPaymentUnsupportedToken() public {
        MockUSDC randomToken = new MockUSDC();
        vm.prank(operator);
        vm.expectRevert("Unsupported token");
        vault.processPayment(user1Wallet, 50e6, keccak256("payment-001"), address(randomToken));
    }

    // ========== REFUND PAYMENT TESTS ==========

    function test_RefundPaymentWithoutFee() public {
        bytes32 paymentId = keccak256("payment-001");

        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, paymentId, address(usdc));

        uint256 walletBalanceBefore = usdc.balanceOf(user1Wallet);

        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit PaymentRefunded(user1Wallet, paymentId, address(usdc), 50e6, 0);
        vault.refundPayment(user1Wallet, 50e6, false, paymentId, address(usdc));

        assertEq(usdc.balanceOf(user1Wallet), walletBalanceBefore + 50e6);
        assertEq(vault.availableProcessedPayments(address(usdc)), 0);
        assertEq(vault.totalPaymentsProcessed(address(usdc)), 50e6); // cumulative unchanged
    }

    function test_RefundPaymentWithFee() public {
        bytes32 paymentId = keccak256("payment-001");

        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, paymentId, address(usdc));

        uint256 walletBalanceBefore = usdc.balanceOf(user1Wallet);

        vm.prank(admin);
        vault.refundPayment(user1Wallet, 50e6, true, paymentId, address(usdc));

        assertEq(usdc.balanceOf(user1Wallet), walletBalanceBefore + 50e6 + INITIAL_FEE);
        assertEq(vault.availableProcessedPayments(address(usdc)), 0);
        assertEq(vault.availableFees(address(usdc)), 0);
        assertEq(vault.totalPaymentsProcessed(address(usdc)), 50e6);
        assertEq(vault.totalFeesCollected(address(usdc)), INITIAL_FEE);
    }

    function test_RefundPaymentUSDT() public {
        bytes32 paymentId = keccak256("payment-usdt-001");

        vm.prank(operator);
        vault.processPayment(user1Wallet, 40e6, paymentId, address(usdt));

        vm.prank(admin);
        vault.refundPayment(user1Wallet, 40e6, false, paymentId, address(usdt));

        assertEq(vault.availableProcessedPayments(address(usdt)), 0);
    }

    function test_RevertWhen_RefundPaymentNotAdmin() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.refundPayment(user1Wallet, 50e6, false, keccak256("payment-001"), address(usdc));
    }

    function test_RevertWhen_RefundPaymentInsufficientProcessedPayments() public {
        vm.prank(admin);
        vm.expectRevert("Insufficient processed payments to refund");
        vault.refundPayment(user1Wallet, 50e6, false, keccak256("payment-001"), address(usdc));
    }

    // ========== WITHDRAW VAULT FUNDS TESTS ==========

    function test_WithdrawVaultFundsUSDC() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("payment-001"), address(usdc));

        address recipient = makeAddr("recipient");

        vm.prank(treasurer);
        vm.expectEmit(true, true, true, true);
        emit VaultFundsWithdrawn(treasurer, recipient, address(usdc), 50e6, INITIAL_FEE, 50e6 + INITIAL_FEE);
        vault.withdrawVaultFunds(recipient, address(usdc));

        assertEq(vault.availableProcessedPayments(address(usdc)), 0);
        assertEq(vault.availableFees(address(usdc)), 0);
        assertEq(usdc.balanceOf(recipient), 50e6 + INITIAL_FEE);
    }

    function test_WithdrawVaultFundsUSDT() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 80e6, keccak256("payment-usdt-001"), address(usdt));

        address recipient = makeAddr("recipient");
        vm.prank(treasurer);
        vault.withdrawVaultFunds(recipient, address(usdt));

        assertEq(usdt.balanceOf(recipient), 80e6 + INITIAL_FEE);
        assertEq(vault.availableProcessedPayments(address(usdt)), 0);
    }

    function test_WithdrawVaultFundsBothTokensIndependent() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("usdc-payment"), address(usdc));

        vm.prank(operator);
        vault.processPayment(user2Wallet, 60e6, keccak256("usdt-payment"), address(usdt));

        address recipient = makeAddr("recipient");

        // Withdraw USDC only
        vm.prank(treasurer);
        vault.withdrawVaultFunds(recipient, address(usdc));

        assertEq(usdc.balanceOf(recipient), 50e6 + INITIAL_FEE);
        assertEq(usdt.balanceOf(recipient), 0); // USDT untouched

        // USDT still available
        assertEq(vault.availableProcessedPayments(address(usdt)), 60e6);

        // Withdraw USDT separately
        vm.prank(treasurer);
        vault.withdrawVaultFunds(recipient, address(usdt));

        assertEq(usdt.balanceOf(recipient), 60e6 + INITIAL_FEE);
    }

    function test_WithdrawVaultFundsMultiplePayments() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("payment-001"), address(usdc));

        vm.prank(operator);
        vault.processPayment(user1Wallet, 30e6, keccak256("payment-002"), address(usdc));

        address recipient = makeAddr("recipient");
        vm.prank(treasurer);
        vault.withdrawVaultFunds(recipient, address(usdc));

        assertEq(usdc.balanceOf(recipient), 80e6 + (INITIAL_FEE * 2));
    }

    function test_RevertWhen_WithdrawVaultFundsNotTreasurer() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.withdrawVaultFunds(user1, address(usdc));
    }

    function test_RevertWhen_WithdrawVaultFundsToZeroAddress() public {
        vm.prank(treasurer);
        vm.expectRevert("Invalid recipient address");
        vault.withdrawVaultFunds(address(0), address(usdc));
    }

    function test_RevertWhen_WithdrawVaultFundsWhenEmpty() public {
        vm.prank(treasurer);
        vm.expectRevert("No funds available to withdraw");
        vault.withdrawVaultFunds(makeAddr("recipient"), address(usdc));
    }

    // ========== TOKEN MANAGEMENT TESTS ==========

    function test_AddSupportedToken() public {
        MockUSDC newToken = new MockUSDC();
        vm.prank(admin);
        vault.addSupportedToken(address(newToken));
        assertTrue(vault.supportedTokens(address(newToken)));
    }

    function test_RemoveSupportedToken() public {
        vm.prank(admin);
        vault.removeSupportedToken(address(usdt));
        assertFalse(vault.supportedTokens(address(usdt)));
    }

    function test_RevertWhen_AddSupportedTokenNotAdmin() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.addSupportedToken(makeAddr("token"));
    }

    function test_RevertWhen_RemoveSupportedTokenNotAdmin() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.removeSupportedToken(address(usdt));
    }

    // ========== ADMIN FUNCTIONS TESTS ==========

    function test_SetFee() public {
        vm.prank(admin);
        vault.setFee(1e6);
        assertEq(vault.feeAmount(), 1e6);
    }

    function test_RevertWhen_SetFeeExceedingMax() public {
        vm.prank(admin);
        vm.expectRevert("Fee exceeds maximum");
        vault.setFee(MAX_FEE + 1);
    }

    function test_RevertWhen_SetFeeNotAdmin() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setFee(1e6);
    }

    function test_SetMinDeposit() public {
        vm.prank(admin);
        vault.setMinDeposit(10e6);
        assertEq(vault.minDeposit(), 10e6);
    }

    function test_RevertWhen_SetMinDepositNotAdmin() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setMinDeposit(10e6);
    }

    function test_Pause() public {
        vault.pause();
        assertTrue(vault.paused());
    }

    function test_Unpause() public {
        vault.pause();
        vault.unpause();
        assertFalse(vault.paused());
    }

    function test_RevertWhen_PauseNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.pause();
    }

    // ========== VIEW FUNCTIONS TESTS ==========

    function test_GetAvailableWithdrawal() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("payment-001"), address(usdc));

        (uint256 payments, uint256 fees, uint256 total) = vault.getAvailableWithdrawal(address(usdc));

        assertEq(payments, 50e6);
        assertEq(fees, INITIAL_FEE);
        assertEq(total, 50e6 + INITIAL_FEE);
    }

    function test_VerifyVaultAccounting() public {
        assertTrue(vault.verifyVaultAccounting(address(usdc)));

        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("payment-001"), address(usdc));
        assertTrue(vault.verifyVaultAccounting(address(usdc)));

        vm.prank(treasurer);
        vault.withdrawVaultFunds(makeAddr("recipient"), address(usdc));
        assertTrue(vault.verifyVaultAccounting(address(usdc)));
    }

    // ========== INTEGRATION TESTS ==========

    function test_CompleteUserJourney() public {
        // 1. User pays a bill
        vm.prank(operator);
        vault.processPayment(user1Wallet, 100e6, keccak256("bill-electricity"), address(usdc));

        // 2. Payment fails, admin refunds with fee
        vm.prank(admin);
        vault.refundPayment(user1Wallet, 100e6, true, keccak256("bill-electricity"), address(usdc));

        // 3. User pays another bill successfully
        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("bill-water"), address(usdc));

        // 4. Treasurer withdraws processed funds
        address companyWallet = makeAddr("company");
        vm.prank(treasurer);
        vault.withdrawVaultFunds(companyWallet, address(usdc));

        assertEq(usdc.balanceOf(companyWallet), 50e6 + INITIAL_FEE);
    }

    function test_MultipleUsersScenario() public {
        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("user1-payment"), address(usdc));

        vm.prank(operator);
        vault.processPayment(user2Wallet, 100e6, keccak256("user2-payment"), address(usdc));

        assertEq(vault.totalPaymentsProcessed(address(usdc)), 150e6);
        assertEq(vault.totalFeesCollected(address(usdc)), INITIAL_FEE * 2);

        assertTrue(vault.verifyVaultAccounting(address(usdc)));
    }

    function test_MixedTokenJourney() public {
        // User1 pays with USDC, User2 pays with USDT
        vm.prank(operator);
        vault.processPayment(user1Wallet, 50e6, keccak256("usdc-bill"), address(usdc));

        vm.prank(operator);
        vault.processPayment(user2Wallet, 80e6, keccak256("usdt-bill"), address(usdt));

        assertEq(vault.totalPaymentsProcessed(address(usdc)), 50e6);
        assertEq(vault.totalPaymentsProcessed(address(usdt)), 80e6);

        // Withdraw both independently
        address company = makeAddr("company");
        vm.prank(treasurer);
        vault.withdrawVaultFunds(company, address(usdc));
        vm.prank(treasurer);
        vault.withdrawVaultFunds(company, address(usdt));

        assertEq(usdc.balanceOf(company), 50e6 + INITIAL_FEE);
        assertEq(usdt.balanceOf(company), 80e6 + INITIAL_FEE);
    }
}
