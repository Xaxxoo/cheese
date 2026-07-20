// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UserWalletFactory.sol";
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

contract UserWalletFactoryTest is Test {
    UserWalletFactory public factory;
    MockUSDC public usdc;
    MockUSDT public usdt;
    CheeseVault public vault;

    address public owner;
    address public backend;

    uint256 constant INITIAL_FEE = 0.5e6;
    uint256 constant MIN_DEPOSIT = 1e6;

    event BackendUpdated(address indexed oldBackend, address indexed newBackend);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    function setUp() public {
        owner   = address(this);
        backend = makeAddr("backend");

        usdc = new MockUSDC();
        usdt = new MockUSDT();

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(usdt);

        vault = new CheeseVault(tokens, INITIAL_FEE, MIN_DEPOSIT);
        vault.grantRole(vault.OPERATOR_ROLE(), backend);

        factory = new UserWalletFactory(backend, address(vault), tokens);
    }

    // ========== DEPLOYMENT TESTS ==========

    function test_Deployment() public view {
        assertEq(factory.backend(), backend);
        assertEq(factory.vault(), address(vault));
        assertEq(factory.totalWallets(), 0);
        assertTrue(factory.isTokenSupported(address(usdc)));
        assertTrue(factory.isTokenSupported(address(usdt)));

        address[] memory supported = factory.getSupportedTokens();
        assertEq(supported.length, 2);
    }

    function test_RevertWhen_DeployWithInvalidBackend() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        vm.expectRevert("Invalid backend");
        new UserWalletFactory(address(0), address(vault), tokens);
    }

    function test_RevertWhen_DeployWithInvalidVault() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        vm.expectRevert("Invalid vault");
        new UserWalletFactory(backend, address(0), tokens);
    }

    // ========== CREATE WALLET TESTS ==========

    function test_CreateWallet() public {
        string memory userId   = "user@example.com";
        string memory username = "alice";
        address predicted = factory.predictWalletAddress(userId);

        vm.prank(backend);
        address wallet = factory.createWallet(userId, username);

        assertTrue(wallet != address(0));
        assertEq(wallet, predicted);
        assertEq(factory.getWallet(userId), wallet);
        assertEq(factory.getWalletByUsername(username), wallet);
        assertTrue(factory.hasWallet(userId));
        assertFalse(factory.isUsernameTaken("notexist"));
        assertTrue(factory.isUsernameTaken(username));
        assertTrue(factory.isWallet(wallet));
        assertEq(factory.totalWallets(), 1);
        assertEq(factory.getWalletAtIndex(0), wallet);
    }

    function test_CreateMultipleWallets() public {
        vm.startPrank(backend);
        address wallet1 = factory.createWallet("user1@example.com", "alice");
        address wallet2 = factory.createWallet("user2@example.com", "bob");
        address wallet3 = factory.createWallet("user3@example.com", "carol");
        vm.stopPrank();

        assertEq(factory.totalWallets(), 3);
        assertTrue(wallet1 != wallet2);
        assertTrue(wallet2 != wallet3);
        assertTrue(wallet1 != wallet3);

        assertEq(factory.getWallet("user1@example.com"), wallet1);
        assertEq(factory.getWallet("user2@example.com"), wallet2);
        assertEq(factory.getWallet("user3@example.com"), wallet3);
    }

    function test_PredictWalletAddressMatchesCreateWallet() public {
        string memory userId = "user@example.com";
        address predicted = factory.predictWalletAddress(userId);

        vm.prank(backend);
        address wallet = factory.createWallet(userId, "alice");

        assertEq(wallet, predicted);
        assertTrue(predicted.code.length > 0);
    }

    function test_PredictWalletAddressIsStable() public view {
        string memory userId = "user@example.com";

        assertEq(
            factory.predictWalletAddress(userId),
            factory.predictWalletAddress(userId)
        );
    }

    function test_PredictWalletAddressUnaffectedByTokenListChanges() public {
        string memory userId = "user@example.com";
        address predictedBefore = factory.predictWalletAddress(userId);

        MockUSDC newToken = new MockUSDC();
        factory.addSupportedToken(address(newToken));

        address predictedAfter = factory.predictWalletAddress(userId);
        assertEq(predictedAfter, predictedBefore);

        vm.prank(backend);
        address walletAddr = factory.createWallet(userId, "alice");
        UserWallet wallet = UserWallet(walletAddr);

        assertEq(walletAddr, predictedBefore);
        assertTrue(wallet.supportedTokens(address(usdc)));
        assertTrue(wallet.supportedTokens(address(usdt)));
        assertTrue(wallet.supportedTokens(address(newToken)));
    }

    function test_PredictWalletAddressUnaffectedByUsername() public {
        string memory userId = "user@example.com";
        address predicted = factory.predictWalletAddress(userId);

        vm.prank(backend);
        address wallet = factory.createWallet(userId, "Alice");

        assertEq(wallet, predicted);
    }

    function test_RevertWhen_PredictWalletAddressEmptyUserId() public {
        vm.expectRevert("Invalid userId");
        factory.predictWalletAddress("");
    }

    function test_RevertWhen_CreateWalletNotBackend() public {
        vm.prank(makeAddr("unauthorized"));
        vm.expectRevert("Only backend");
        factory.createWallet("user@example.com", "alice");
    }

    function test_RevertWhen_CreateWalletAlreadyExists() public {
        vm.startPrank(backend);
        factory.createWallet("user@example.com", "alice");
        vm.expectRevert("Wallet already exists");
        factory.createWallet("user@example.com", "alice2");
        vm.stopPrank();
    }

    function test_RevertWhen_CreateWalletUsernameTaken() public {
        vm.startPrank(backend);
        factory.createWallet("user1@example.com", "alice");
        vm.expectRevert("Username already taken");
        factory.createWallet("user2@example.com", "alice"); // same username
        vm.stopPrank();
    }

    function test_RevertWhen_CreateWalletEmptyUserId() public {
        vm.prank(backend);
        vm.expectRevert("Invalid userId");
        factory.createWallet("", "alice");
    }

    function test_RevertWhen_CreateWalletWhenPaused() public {
        factory.pause();
        vm.prank(backend);
        vm.expectRevert();
        factory.createWallet("user@example.com", "alice");
    }

    // ========== GET WALLET TESTS ==========

    function test_GetWallet() public {
        vm.prank(backend);
        address wallet = factory.createWallet("user@example.com", "alice");
        assertEq(factory.getWallet("user@example.com"), wallet);
    }

    function test_GetWalletNonExistent() public view {
        assertEq(factory.getWallet("nonexistent@example.com"), address(0));
    }

    function test_GetWalletByUsername_CaseInsensitive() public {
        vm.prank(backend);
        address wallet = factory.createWallet("user@example.com", "Alice");

        assertEq(factory.getWalletByUsername("Alice"), wallet);
        assertEq(factory.getWalletByUsername("alice"), wallet);
        assertEq(factory.getWalletByUsername("ALICE"), wallet);
    }

    // ========== HAS WALLET TESTS ==========

    function test_HasWallet() public {
        assertFalse(factory.hasWallet("user@example.com"));
        vm.prank(backend);
        factory.createWallet("user@example.com", "alice");
        assertTrue(factory.hasWallet("user@example.com"));
    }

    // ========== GET WALLET AT INDEX TESTS ==========

    function test_GetWalletAtIndex() public {
        vm.startPrank(backend);
        address wallet1 = factory.createWallet("user1@example.com", "alice");
        address wallet2 = factory.createWallet("user2@example.com", "bob");
        vm.stopPrank();

        assertEq(factory.getWalletAtIndex(0), wallet1);
        assertEq(factory.getWalletAtIndex(1), wallet2);
    }

    function test_RevertWhen_GetWalletAtIndexOutOfBounds() public {
        vm.expectRevert("Index out of bounds");
        factory.getWalletAtIndex(0);
    }

    // ========== TRANSFER BY USERNAME TESTS ==========

    function test_TransferByUsernameUSDC() public {
        vm.startPrank(backend);
        address wallet1 = factory.createWallet("user1@example.com", "alice");
        address wallet2 = factory.createWallet("user2@example.com", "bob");
        vm.stopPrank();

        usdc.mint(wallet1, 200e6);

        vm.prank(backend);
        factory.transferByUsername("alice", "bob", 100e6, address(usdc));

        assertEq(usdc.balanceOf(wallet2), 100e6);
    }

    function test_TransferByUsernameUSDT() public {
        vm.startPrank(backend);
        address wallet1 = factory.createWallet("user1@example.com", "alice");
        address wallet2 = factory.createWallet("user2@example.com", "bob");
        vm.stopPrank();

        usdt.mint(wallet1, 200e6);

        vm.prank(backend);
        factory.transferByUsername("alice", "bob", 80e6, address(usdt));

        assertEq(usdt.balanceOf(wallet2), 80e6);
    }

    function test_TransferByUsername_CaseInsensitive() public {
        vm.startPrank(backend);
        address wallet1 = factory.createWallet("user1@example.com", "Alice");
        address wallet2 = factory.createWallet("user2@example.com", "Bob");
        vm.stopPrank();

        usdc.mint(wallet1, 200e6);

        vm.prank(backend);
        factory.transferByUsername("ALICE", "BOB", 50e6, address(usdc));

        assertEq(usdc.balanceOf(wallet2), 50e6);
    }

    function test_RevertWhen_TransferByUsernameNotBackend() public {
        vm.prank(makeAddr("unauthorized"));
        vm.expectRevert("Only backend");
        factory.transferByUsername("alice", "bob", 100e6, address(usdc));
    }

    function test_RevertWhen_TransferByUsernameUnsupportedToken() public {
        vm.startPrank(backend);
        factory.createWallet("user1@example.com", "alice");
        factory.createWallet("user2@example.com", "bob");
        vm.stopPrank();

        MockUSDC randomToken = new MockUSDC();
        vm.prank(backend);
        vm.expectRevert("Unsupported token");
        factory.transferByUsername("alice", "bob", 100e6, address(randomToken));
    }

    function test_RevertWhen_TransferByUsernameSenderNotFound() public {
        vm.prank(backend);
        factory.createWallet("user2@example.com", "bob");

        vm.prank(backend);
        vm.expectRevert("Sender username not found");
        factory.transferByUsername("nonexistent", "bob", 100e6, address(usdc));
    }

    function test_RevertWhen_TransferByUsernameRecipientNotFound() public {
        vm.prank(backend);
        factory.createWallet("user1@example.com", "alice");

        vm.prank(backend);
        vm.expectRevert("Recipient username not found");
        factory.transferByUsername("alice", "nonexistent", 100e6, address(usdc));
    }

    // ========== TOKEN MANAGEMENT TESTS ==========

    function test_AddSupportedToken() public {
        MockUSDC newToken = new MockUSDC();

        vm.expectEmit(true, true, true, true);
        emit TokenAdded(address(newToken));
        factory.addSupportedToken(address(newToken));

        assertTrue(factory.isTokenSupported(address(newToken)));

        address[] memory supported = factory.getSupportedTokens();
        assertEq(supported.length, 3);
    }

    function test_AddSupportedToken_Idempotent() public {
        factory.addSupportedToken(address(usdc)); // already supported

        address[] memory supported = factory.getSupportedTokens();
        assertEq(supported.length, 2); // no duplicate
    }

    function test_RemoveSupportedToken() public {
        vm.expectEmit(true, true, true, true);
        emit TokenRemoved(address(usdt));
        factory.removeSupportedToken(address(usdt));

        assertFalse(factory.isTokenSupported(address(usdt)));

        address[] memory supported = factory.getSupportedTokens();
        assertEq(supported.length, 1);
        assertEq(supported[0], address(usdc));
    }

    function test_RevertWhen_AddSupportedTokenNotOwner() public {
        vm.prank(makeAddr("unauthorized"));
        vm.expectRevert();
        factory.addSupportedToken(address(usdc));
    }

    function test_RevertWhen_RemoveSupportedTokenNotOwner() public {
        vm.prank(makeAddr("unauthorized"));
        vm.expectRevert();
        factory.removeSupportedToken(address(usdt));
    }

    function test_RevertWhen_RemoveSupportedTokenNotSupported() public {
        MockUSDC randomToken = new MockUSDC();
        vm.expectRevert("Token not supported");
        factory.removeSupportedToken(address(randomToken));
    }

    // ========== UPDATE BACKEND TESTS ==========

    function test_UpdateBackend() public {
        address newBackend = makeAddr("newBackend");

        vm.expectEmit(true, true, true, true);
        emit BackendUpdated(backend, newBackend);

        factory.updateBackend(newBackend);

        assertEq(factory.backend(), newBackend);
    }

    function test_RevertWhen_UpdateBackendNotOwner() public {
        vm.prank(makeAddr("unauthorized"));
        vm.expectRevert();
        factory.updateBackend(makeAddr("newBackend"));
    }

    function test_RevertWhen_UpdateBackendToZeroAddress() public {
        vm.expectRevert("Invalid backend");
        factory.updateBackend(address(0));
    }

    // ========== UPDATE VAULT TESTS ==========

    function test_UpdateVault() public {
        address newVault = makeAddr("newVault");

        vm.expectEmit(true, true, true, true);
        emit VaultUpdated(address(vault), newVault);

        factory.updateVault(newVault);

        assertEq(factory.vault(), newVault);
    }

    function test_RevertWhen_UpdateVaultNotOwner() public {
        vm.prank(makeAddr("unauthorized"));
        vm.expectRevert();
        factory.updateVault(makeAddr("newVault"));
    }

    function test_RevertWhen_UpdateVaultToZeroAddress() public {
        vm.expectRevert("Invalid vault");
        factory.updateVault(address(0));
    }

    // ========== PAUSE/UNPAUSE TESTS ==========

    function test_Pause() public {
        factory.pause();
        assertTrue(factory.paused());
    }

    function test_Unpause() public {
        factory.pause();
        factory.unpause();
        assertFalse(factory.paused());
    }

    function test_RevertWhen_PauseNotOwner() public {
        vm.prank(makeAddr("unauthorized"));
        vm.expectRevert();
        factory.pause();
    }

    function test_RevertWhen_UnpauseNotOwner() public {
        factory.pause();
        vm.prank(makeAddr("unauthorized"));
        vm.expectRevert();
        factory.unpause();
    }

    // ========== INTEGRATION TESTS ==========

    function test_CreateWalletAndVerifyProperties() public {
        vm.prank(backend);
        address walletAddress = factory.createWallet("user@example.com", "alice");

        UserWallet wallet = UserWallet(payable(walletAddress));

        assertEq(wallet.backend(), backend);
        assertEq(wallet.factory(), address(factory));
        assertEq(address(wallet.vault()), address(vault));
        assertEq(wallet.owner(), address(0));
        assertEq(wallet.getBalance(address(usdc)), 0);
        assertEq(wallet.getBalance(address(usdt)), 0);
        assertTrue(wallet.supportedTokens(address(usdc)));
        assertTrue(wallet.supportedTokens(address(usdt)));
    }

    function test_MultipleUsersCompleteFlow() public {
        vm.startPrank(backend);
        address wallet1 = factory.createWallet("user1@example.com", "alice");
        address wallet2 = factory.createWallet("user2@example.com", "bob");
        address wallet3 = factory.createWallet("user3@example.com", "carol");
        vm.stopPrank();

        assertTrue(wallet1 != wallet2);
        assertTrue(wallet2 != wallet3);

        assertEq(factory.totalWallets(), 3);
        assertTrue(factory.isWallet(wallet1));
        assertTrue(factory.isWallet(wallet2));
        assertTrue(factory.isWallet(wallet3));

        assertEq(factory.getWallet("user1@example.com"), wallet1);
        assertEq(factory.getWallet("user2@example.com"), wallet2);
        assertEq(factory.getWallet("user3@example.com"), wallet3);
    }

    function test_NewWalletsInheritSupportedTokens() public {
        // Add a new token before creating wallets
        MockUSDC newToken = new MockUSDC();
        factory.addSupportedToken(address(newToken));

        vm.prank(backend);
        address walletAddr = factory.createWallet("user@example.com", "alice");
        UserWallet wallet = UserWallet(walletAddr);

        assertTrue(wallet.supportedTokens(address(usdc)));
        assertTrue(wallet.supportedTokens(address(usdt)));
        assertTrue(wallet.supportedTokens(address(newToken)));
    }
}
