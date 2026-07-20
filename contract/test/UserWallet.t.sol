// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UserWallet.sol";
import "../src/CheeseVault.sol";
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

contract UserWalletTest is Test {
    UserWallet public userWallet;
    MockUSDC public usdc;
    MockUSDT public usdt;
    CheeseVault public vault;

    address public backend;
    address public factoryAddr;
    address public owner;
    address public user;
    address public treasurer;

    uint256 constant INITIAL_FEE = 0.5e6;
    uint256 constant MIN_DEPOSIT = 1e6;

    // Mirror contract events for expectEmit
    event TransferredToVault(address indexed token, uint256 paymentAmount, uint256 feeAmount, uint256 totalAmount, uint256 timestamp);
    event Withdrawal(address indexed token, address indexed recipient, uint256 amount, uint256 timestamp);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event EmergencyWithdrawal(address indexed token, uint256 amount, uint256 timestamp);
    event TokenAdded(address indexed token);

    function setUp() public {
        backend     = makeAddr("backend");
        factoryAddr = address(this);
        owner       = makeAddr("owner");
        user        = makeAddr("user");
        treasurer   = makeAddr("treasurer");

        usdc = new MockUSDC();
        usdt = new MockUSDT();

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(usdt);

        vault = new CheeseVault(tokens, INITIAL_FEE, MIN_DEPOSIT, address(this));

        userWallet = new UserWallet();
        userWallet.initialize(
            backend,
            address(vault),
            address(0) // No owner initially
        );
        userWallet.addSupportedToken(address(usdc));
        userWallet.addSupportedToken(address(usdt));

        vault.grantRole(vault.OPERATOR_ROLE(), backend);
        vault.grantRole(vault.TREASURER_ROLE(), treasurer);

        usdc.mint(user, 1000e6);
        usdt.mint(user, 1000e6);
    }

    // ========== DEPLOYMENT TESTS ==========

    function test_Deployment() public view {
        assertEq(userWallet.backend(), backend);
        assertEq(userWallet.factory(), factoryAddr);
        assertEq(address(userWallet.vault()), address(vault));
        assertEq(userWallet.owner(), address(0));
        assertTrue(userWallet.supportedTokens(address(usdc)));
        assertTrue(userWallet.supportedTokens(address(usdt)));
    }

    function test_RevertWhen_DeployWithInvalidBackend() public {
        UserWallet wallet = new UserWallet();
        vm.expectRevert("Invalid backend");
        wallet.initialize(address(0), address(vault), owner);
    }

    function test_RevertWhen_InitializeNotFactory() public {
        UserWallet wallet = new UserWallet();
        vm.prank(user);
        vm.expectRevert("Only factory");
        wallet.initialize(backend, address(vault), owner);
    }

    function test_RevertWhen_DeployWithInvalidVault() public {
        UserWallet wallet = new UserWallet();
        vm.expectRevert("Invalid vault");
        wallet.initialize(backend, address(0), owner);
    }

    function test_RevertWhen_InitializeTwice() public {
        vm.expectRevert("Already initialized");
        userWallet.initialize(backend, address(vault), owner);
    }

    // ========== GET BALANCE TESTS ==========

    function test_GetBalance() public {
        assertEq(userWallet.getBalance(address(usdc)), 0);

        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        assertEq(userWallet.getBalance(address(usdc)), 100e6);
    }

    function test_GetBalanceUSDT() public {
        vm.prank(user);
        usdt.transfer(address(userWallet), 50e6);

        assertEq(userWallet.getBalance(address(usdt)), 50e6);
        assertEq(userWallet.getBalance(address(usdc)), 0);
    }

    // ========== TRANSFER TO VAULT TESTS ==========

    function test_TransferToVaultUSDC() public {
        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        uint256 paymentAmount = 50e6;
        uint256 expectedFee   = INITIAL_FEE;
        uint256 expectedTotal = paymentAmount + expectedFee;

        vm.prank(backend);
        vm.expectEmit(true, true, true, true);
        emit TransferredToVault(address(usdc), paymentAmount, expectedFee, expectedTotal, block.timestamp);

        uint256 totalTransferred = userWallet.transferToVault(address(usdc), paymentAmount);

        assertEq(totalTransferred, expectedTotal);
        assertEq(userWallet.getBalance(address(usdc)), 100e6 - expectedTotal);
        assertEq(usdc.balanceOf(address(vault)), expectedTotal);
    }

    function test_TransferToVaultUSDT() public {
        vm.prank(user);
        usdt.transfer(address(userWallet), 100e6);

        uint256 paymentAmount = 50e6;
        uint256 expectedTotal = paymentAmount + INITIAL_FEE;

        vm.prank(backend);
        uint256 totalTransferred = userWallet.transferToVault(address(usdt), paymentAmount);

        assertEq(totalTransferred, expectedTotal);
        assertEq(userWallet.getBalance(address(usdt)), 100e6 - expectedTotal);
        assertEq(usdt.balanceOf(address(vault)), expectedTotal);
    }

    function test_TransferToVaultWithUpdatedFee() public {
        vault.grantRole(vault.ADMIN_ROLE(), address(this));
        vault.setFee(1e6); // Update to $1

        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        vm.prank(backend);
        uint256 totalTransferred = userWallet.transferToVault(address(usdc), 50e6);

        assertEq(totalTransferred, 51e6); // 50 + 1 (new fee)
    }

    function test_RevertWhen_TransferToVaultNotBackend() public {
        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        vm.prank(user);
        vm.expectRevert("Not authorised");
        userWallet.transferToVault(address(usdc), 50e6);
    }

    function test_RevertWhen_TransferToVaultZeroAmount() public {
        vm.prank(backend);
        vm.expectRevert("Payment amount must be > 0");
        userWallet.transferToVault(address(usdc), 0);
    }

    function test_RevertWhen_TransferToVaultInsufficientBalance() public {
        vm.prank(user);
        usdc.transfer(address(userWallet), 10e6);

        vm.prank(backend);
        vm.expectRevert("Insufficient balance");
        userWallet.transferToVault(address(usdc), 50e6);
    }

    function test_RevertWhen_TransferToVaultUnsupportedToken() public {
        MockUSDC randomToken = new MockUSDC();
        vm.prank(backend);
        vm.expectRevert("Unsupported token");
        userWallet.transferToVault(address(randomToken), 50e6);
    }

    // ========== WITHDRAW TESTS ==========

    function test_WithdrawByBackend() public {
        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        address recipient    = makeAddr("recipient");
        uint256 withdrawAmount = 50e6;

        vm.prank(backend);
        vm.expectEmit(true, true, true, true);
        emit Withdrawal(address(usdc), recipient, withdrawAmount, block.timestamp);

        userWallet.withdraw(address(usdc), withdrawAmount, recipient);

        assertEq(usdc.balanceOf(recipient), withdrawAmount);
        assertEq(userWallet.getBalance(address(usdc)), 50e6);
    }

    function test_WithdrawByOwner() public {
        vm.prank(backend);
        userWallet.setOwner(owner);

        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        address recipient = makeAddr("recipient");

        vm.prank(owner);
        userWallet.withdraw(address(usdc), 50e6, recipient);

        assertEq(usdc.balanceOf(recipient), 50e6);
    }

    function test_WithdrawUSDT() public {
        vm.prank(user);
        usdt.transfer(address(userWallet), 100e6);

        address recipient = makeAddr("recipient");

        vm.prank(backend);
        userWallet.withdraw(address(usdt), 60e6, recipient);

        assertEq(usdt.balanceOf(recipient), 60e6);
        assertEq(userWallet.getBalance(address(usdt)), 40e6);
    }

    function test_RevertWhen_WithdrawNotAuthorized() public {
        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        vm.prank(user);
        vm.expectRevert("Not authorised");
        userWallet.withdraw(address(usdc), 50e6, user);
    }

    function test_RevertWhen_WithdrawZeroAmount() public {
        vm.prank(backend);
        vm.expectRevert("Amount must be > 0");
        userWallet.withdraw(address(usdc), 0, user);
    }

    function test_RevertWhen_WithdrawToZeroAddress() public {
        vm.prank(backend);
        vm.expectRevert("Invalid recipient");
        userWallet.withdraw(address(usdc), 50e6, address(0));
    }

    function test_RevertWhen_WithdrawInsufficientBalance() public {
        vm.prank(user);
        usdc.transfer(address(userWallet), 10e6);

        vm.prank(backend);
        vm.expectRevert("Insufficient balance");
        userWallet.withdraw(address(usdc), 50e6, user);
    }

    function test_RevertWhen_WithdrawUnsupportedToken() public {
        MockUSDC randomToken = new MockUSDC();
        vm.prank(backend);
        vm.expectRevert("Unsupported token");
        userWallet.withdraw(address(randomToken), 50e6, user);
    }

    // ========== EMERGENCY WITHDRAW TESTS ==========

    function test_EmergencyWithdraw() public {
        vm.prank(backend);
        userWallet.setOwner(owner);

        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit EmergencyWithdrawal(address(usdc), 100e6, block.timestamp);

        userWallet.emergencyWithdraw(address(usdc));

        assertEq(usdc.balanceOf(owner), 100e6);
        assertEq(userWallet.getBalance(address(usdc)), 0);
    }

    function test_EmergencyWithdrawUSDT() public {
        vm.prank(backend);
        userWallet.setOwner(owner);

        vm.prank(user);
        usdt.transfer(address(userWallet), 75e6);

        vm.prank(owner);
        userWallet.emergencyWithdraw(address(usdt));

        assertEq(usdt.balanceOf(owner), 75e6);
    }

    function test_RevertWhen_EmergencyWithdrawNotOwner() public {
        vm.prank(backend);
        userWallet.setOwner(owner);

        vm.prank(user);
        vm.expectRevert("Only owner");
        userWallet.emergencyWithdraw(address(usdc));
    }

    function test_RevertWhen_EmergencyWithdrawOwnerNotSet() public {
        vm.prank(user);
        vm.expectRevert("Owner not set");
        userWallet.emergencyWithdraw(address(usdc));
    }

    function test_RevertWhen_EmergencyWithdrawZeroBalance() public {
        vm.prank(backend);
        userWallet.setOwner(owner);

        vm.prank(owner);
        vm.expectRevert("Nothing to withdraw");
        userWallet.emergencyWithdraw(address(usdc));
    }

    // ========== TOKEN MANAGEMENT TESTS ==========

    function test_AddSupportedToken() public {
        MockUSDC newToken = new MockUSDC();

        vm.prank(backend);
        vm.expectEmit(true, true, true, true);
        emit TokenAdded(address(newToken));
        userWallet.addSupportedToken(address(newToken));

        assertTrue(userWallet.supportedTokens(address(newToken)));
    }

    function test_AddSupportedToken_Idempotent() public {
        // Adding an already-supported token should not duplicate
        vm.prank(backend);
        userWallet.addSupportedToken(address(usdc));

        address[] memory list = userWallet.getTokenList();
        uint256 count = 0;
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == address(usdc)) count++;
        }
        assertEq(count, 1);
    }

    function test_RevertWhen_AddSupportedTokenNotBackendOrFactory() public {
        MockUSDC newToken = new MockUSDC();
        vm.prank(user);
        vm.expectRevert("Not authorised");
        userWallet.addSupportedToken(address(newToken));
    }

    // ========== SET OWNER TESTS ==========

    function test_SetOwner() public {
        vm.prank(backend);
        vm.expectEmit(true, true, true, true);
        emit OwnerUpdated(address(0), owner);

        userWallet.setOwner(owner);

        assertEq(userWallet.owner(), owner);
    }

    function test_UpdateOwner() public {
        vm.prank(backend);
        userWallet.setOwner(owner);

        address newOwner = makeAddr("newOwner");

        vm.prank(backend);
        vm.expectEmit(true, true, true, true);
        emit OwnerUpdated(owner, newOwner);

        userWallet.setOwner(newOwner);

        assertEq(userWallet.owner(), newOwner);
    }

    function test_RevertWhen_SetOwnerNotBackend() public {
        vm.prank(user);
        vm.expectRevert("Only backend");
        userWallet.setOwner(owner);
    }

    // ========== INTEGRATION TESTS ==========

    function test_CompletePaymentFlow() public {
        // 1. User deposits USDC to their wallet
        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        assertEq(userWallet.getBalance(address(usdc)), 100e6);

        // 2. Backend processes payment (transferToVault directly)
        uint256 paymentAmount = 50e6;

        vm.prank(backend);
        userWallet.transferToVault(address(usdc), paymentAmount);

        // 3. Verify balances
        assertEq(userWallet.getBalance(address(usdc)), 100e6 - paymentAmount - INITIAL_FEE);
        assertEq(usdc.balanceOf(address(vault)), paymentAmount + INITIAL_FEE);

        // 4. User withdraws remaining
        address recipient = makeAddr("recipient");
        uint256 remaining = userWallet.getBalance(address(usdc));

        vm.prank(backend);
        userWallet.withdraw(address(usdc), remaining, recipient);

        assertEq(usdc.balanceOf(recipient), remaining);
        assertEq(userWallet.getBalance(address(usdc)), 0);
    }

    function test_CompletePaymentFlowUSDT() public {
        vm.prank(user);
        usdt.transfer(address(userWallet), 100e6);

        vm.prank(backend);
        userWallet.transferToVault(address(usdt), 50e6);

        assertEq(userWallet.getBalance(address(usdt)), 100e6 - 50e6 - INITIAL_FEE);
        assertEq(usdt.balanceOf(address(vault)), 50e6 + INITIAL_FEE);
    }

    function test_BothTokensIndependent() public {
        vm.prank(user);
        usdc.transfer(address(userWallet), 100e6);

        vm.prank(user);
        usdt.transfer(address(userWallet), 100e6);

        assertEq(userWallet.getBalance(address(usdc)), 100e6);
        assertEq(userWallet.getBalance(address(usdt)), 100e6);

        vm.prank(backend);
        userWallet.withdraw(address(usdc), 30e6, makeAddr("r1"));

        vm.prank(backend);
        userWallet.withdraw(address(usdt), 40e6, makeAddr("r2"));

        assertEq(userWallet.getBalance(address(usdc)), 70e6);
        assertEq(userWallet.getBalance(address(usdt)), 60e6);
    }
}
