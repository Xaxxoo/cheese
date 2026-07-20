// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./UserWallet.sol";

/**
 * @title UserWalletFactory
 * @notice Deploys and manages all Cheese user wallet contracts.
 *
 * ── Username registry ────────────────────────────────────────────────────────
 *
 *   Each wallet is keyed by two identifiers:
 *
 *     userId   — internal platform ID (e.g. email address). Hashed to bytes32
 *                before storage so no PII lives on-chain.
 *     username — the display handle users see. Lowercased and hashed for lookup.
 *                Used for P2P transfers and displayed in the app.
 *
 *   Mappings:
 *     userIdHash   → wallet address   (internal lookup)
 *     usernameHash → wallet address   (public P2P lookup)
 *     wallet       → display username (reverse lookup for receipts)
 *
 * ── P2P transfers ────────────────────────────────────────────────────────────
 *
 *   transferByUsername(fromUsername, toUsername, amount, token)
 *     Resolves both usernames to wallet addresses, calls
 *     sender.transferToUser(token, recipientWallet, amount).
 *     Tokens move directly wallet-to-wallet (no vault involvement).
 *
 * ── Access ───────────────────────────────────────────────────────────────────
 *
 *   onlyBackend  — platform EOA. All money-movement functions.
 *   onlyOwner    — contract deployer (Ownable). Admin config only.
 */
contract UserWalletFactory is Ownable, Pausable, ReentrancyGuard {

    // ========== STATE VARIABLES ==========

    address public backend;
    address public vault;

    // Supported tokens — all new wallets are initialised with this list after CREATE2 deployment
    address[] public supportedTokens;
    mapping(address => bool) public isTokenSupported;

    // userId (hashed) → wallet address
    mapping(bytes32 => address) public userWallets;

    // username (lowercased, hashed) → wallet address
    mapping(bytes32 => address) public usernameWallets;

    // wallet address → display username (original casing)
    mapping(address => string) public walletUsername;

    // quick membership check
    mapping(address => bool) public isWallet;

    // iteration
    address[] public allWallets;
    uint256   public totalWallets;

    // ========== EVENTS ==========

    event WalletCreated(
        bytes32 indexed userIdHash,
        bytes32 indexed usernameHash,
        address indexed wallet,
        string  username,
        uint256 timestamp
    );

    event Transfer(
        address indexed fromWallet,
        address indexed toWallet,
        address indexed token,
        string  fromUsername,
        string  toUsername,
        uint256 amount,
        uint256 timestamp
    );

    event BackendUpdated(address indexed oldBackend, address indexed newBackend);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    // ========== MODIFIERS ==========

    modifier onlyBackend() {
        require(msg.sender == backend, "Only backend");
        _;
    }

    // ========== CONSTRUCTOR ==========

    /**
     * @param _backend        Platform EOA address
     * @param _vault          CheeseVault address
     * @param _initialTokens  Supported ERC-20 tokens (e.g. [USDC, USDT])
     */
    constructor(address _backend, address _vault, address[] memory _initialTokens)
        Ownable(msg.sender)
    {
        require(_backend != address(0), "Invalid backend");
        require(_vault   != address(0), "Invalid vault");

        backend = _backend;
        vault   = _vault;

        for (uint256 i = 0; i < _initialTokens.length; i++) {
            address t = _initialTokens[i];
            require(t != address(0), "Invalid token address");
            if (!isTokenSupported[t]) {
                isTokenSupported[t] = true;
                supportedTokens.push(t);
                emit TokenAdded(t);
            }
        }
    }

    // ========== FACTORY FUNCTIONS ==========

    /**
     * @notice Deploy a new UserWallet for a user and register their username.
     *
     * @param  userId    Internal platform identifier (e.g. email).
     *                   Stored as keccak256 hash — no PII on-chain.
     * @param  username  Display handle (@alice). Must be unique (case-insensitive).
     *                   Stored in original casing; lookups are lowercased.
     *
     * @return wallet    Address of the newly deployed UserWallet contract.
     */
    function createWallet(string memory userId, string memory username)
        external
        onlyBackend
        whenNotPaused
        returns (address wallet)
    {
        require(bytes(userId).length   > 0, "Invalid userId");
        require(bytes(username).length > 0, "Invalid username");

        bytes32 userIdHash   = keccak256(abi.encodePacked(userId));
        bytes32 usernameHash = keccak256(abi.encodePacked(_toLower(username)));

        require(userWallets[userIdHash]       == address(0), "Wallet already exists");
        require(usernameWallets[usernameHash] == address(0), "Username already taken");

        UserWallet newWallet = new UserWallet{salt: userIdHash}();
        newWallet.initialize(
            backend,
            vault,
            address(0)      // owner — set later via setOwner() after KYC
        );

        wallet = address(newWallet);
        _addSupportedTokensToWallet(wallet);

        // Register by userId
        userWallets[userIdHash] = wallet;

        // Register by username
        usernameWallets[usernameHash] = wallet;
        walletUsername[wallet]        = username;

        // Index
        isWallet[wallet] = true;
        allWallets.push(wallet);
        totalWallets++;

        emit WalletCreated(userIdHash, usernameHash, wallet, username, block.timestamp);
    }

    // ========== TRANSFER ==========

    /**
     * @notice Transfer tokens between two users identified by username.
     *
     * The sender's UserWallet calls token.safeTransfer(recipientWallet, amount)
     * directly — no vault involvement. The factory is authorised by both
     * wallets via the onlyBackendOrFactory modifier.
     *
     * @param  fromUsername  Sender's @handle (case-insensitive)
     * @param  toUsername    Recipient's @handle (case-insensitive)
     * @param  amount        Token amount in token units (6 decimals)
     * @param  token         ERC-20 token address (USDC or USDT)
     */
    function transferByUsername(
        string memory fromUsername,
        string memory toUsername,
        uint256 amount,
        address token
    )
        external
        onlyBackend
        nonReentrant
        whenNotPaused
    {
        require(amount > 0, "Amount must be > 0");
        require(isTokenSupported[token], "Unsupported token");

        bytes32 fromHash = keccak256(abi.encodePacked(_toLower(fromUsername)));
        bytes32 toHash   = keccak256(abi.encodePacked(_toLower(toUsername)));

        address fromWallet = usernameWallets[fromHash];
        address toWallet   = usernameWallets[toHash];

        require(fromWallet != address(0), "Sender username not found");
        require(toWallet   != address(0), "Recipient username not found");
        require(fromWallet != toWallet,   "Cannot transfer to self");

        // Execute — UserWallet.transferToUser has onlyBackendOrFactory
        UserWallet(fromWallet).transferToUser(token, toWallet, amount);

        emit Transfer(
            fromWallet,
            toWallet,
            token,
            fromUsername,
            toUsername,
            amount,
            block.timestamp
        );
    }

    // ========== VIEW FUNCTIONS ==========

    /// @notice Resolve an internal userId to its wallet address.
    function getWallet(string memory userId) external view returns (address) {
        return userWallets[keccak256(abi.encodePacked(userId))];
    }

    /// @notice Resolve a @username to its wallet address (case-insensitive).
    ///         Returns address(0) if username is not registered.
    function getWalletByUsername(string memory username) external view returns (address) {
        return usernameWallets[keccak256(abi.encodePacked(_toLower(username)))];
    }

    /// @notice Check whether a userId has a wallet.
    function hasWallet(string memory userId) external view returns (bool) {
        return userWallets[keccak256(abi.encodePacked(userId))] != address(0);
    }

    /// @notice Predict the deterministic wallet address for a user before deployment.
    function predictWalletAddress(string memory userId) public view returns (address) {
        require(bytes(userId).length > 0, "Invalid userId");

        bytes32 salt = keccak256(abi.encodePacked(userId));
        bytes32 bytecodeHash = keccak256(type(UserWallet).creationCode);
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)
        );

        return address(uint160(uint256(hash)));
    }

    /// @notice Check whether a @username is already registered (case-insensitive).
    function isUsernameTaken(string memory username) external view returns (bool) {
        return usernameWallets[keccak256(abi.encodePacked(_toLower(username)))] != address(0);
    }

    /// @notice Return a wallet address by its array index (for off-chain iteration).
    function getWalletAtIndex(uint256 index) external view returns (address) {
        require(index < allWallets.length, "Index out of bounds");
        return allWallets[index];
    }

    /// @notice Return the full list of supported tokens.
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @notice Add a new supported token. New wallets created after this will
     *         include it. Existing wallets must be updated individually via
     *         UserWallet.addSupportedToken().
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        if (!isTokenSupported[token]) {
            isTokenSupported[token] = true;
            supportedTokens.push(token);
            emit TokenAdded(token);
        }
    }

    /**
     * @notice Remove a token from the supported list (stops new wallets from
     *         including it). Does not affect existing wallets.
     */
    function removeSupportedToken(address token) external onlyOwner {
        require(isTokenSupported[token], "Token not supported");
        isTokenSupported[token] = false;

        // Remove from array (order not preserved)
        uint256 len = supportedTokens.length;
        for (uint256 i = 0; i < len; i++) {
            if (supportedTokens[i] == token) {
                supportedTokens[i] = supportedTokens[len - 1];
                supportedTokens.pop();
                break;
            }
        }
        emit TokenRemoved(token);
    }

    function updateBackend(address newBackend) external onlyOwner {
        require(newBackend != address(0), "Invalid backend");
        emit BackendUpdated(backend, newBackend);
        backend = newBackend;
    }

    function updateVault(address newVault) external onlyOwner {
        require(newVault != address(0), "Invalid vault");
        emit VaultUpdated(vault, newVault);
        vault = newVault;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ========== INTERNAL HELPERS ==========

    function _addSupportedTokensToWallet(address wallet) internal {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            UserWallet(wallet).addSupportedToken(supportedTokens[i]);
        }
    }

    /// @dev ASCII-only lowercase conversion for username normalisation.
    ///      Usernames are expected to contain only a-z, 0-9, _ and . characters.
    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr   = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint256 i = 0; i < bStr.length; i++) {
            bLower[i] = (bStr[i] >= 0x41 && bStr[i] <= 0x5A)
                ? bytes1(uint8(bStr[i]) + 32)
                : bStr[i];
        }
        return string(bLower);
    }
}
