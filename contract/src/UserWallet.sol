// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ICheeseVault.sol";

/**
 * @title UserWallet
 * @notice Individual custodial wallet for each Cheese user.
 *
 * ── Access model ─────────────────────────────────────────────────────────────
 *
 *   backend  — the platform EOA (NestJS signer). Controls all money movement.
 *   factory  — the UserWalletFactory that deployed this wallet. Authorised to
 *              call transferToUser() on behalf of a transferByUsername() call.
 *   vault    — CheeseVault. Authorised to pull funds via transferToVault().
 *   owner    — optional user recovery address (initially address(0)).
 *              Can only be set by backend. Allows emergency withdrawal.
 *
 * ── Money flows ───────────────────────────────────────────────────────────────
 *
 *   Deposit:           off-chain fiat/crypto → backend credits token into this contract
 *   Bill payment:      backend calls vault.processPayment() → vault calls transferToVault()
 *   P2P send:          factory.transferByUsername() → this.transferToUser(recipientWallet)
 *   Withdrawal:        backend calls withdraw(token, amount, recipient)
 *   Emergency:         owner calls emergencyWithdraw(token)
 */
contract UserWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ========== STATE VARIABLES ==========

    address public backend;
    address public factory;   // UserWalletFactory
    address public owner;     // User recovery address (initially address(0))
    ICheeseVault public vault;

    mapping(address => bool) public supportedTokens;
    address[] private _tokenList;

    // ========== EVENTS ==========

    event TransferredToVault(
        address indexed token,
        uint256 paymentAmount,
        uint256 feeAmount,
        uint256 totalAmount,
        uint256 timestamp
    );

    event TransferredToUser(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    event Withdrawal(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);

    event EmergencyWithdrawal(address indexed token, uint256 amount, uint256 timestamp);

    event TokenAdded(address indexed token);

    // ========== MODIFIERS ==========

    modifier onlyBackend() {
        require(msg.sender == backend, "Only backend");
        _;
    }

    modifier onlyOwnerAddr() {
        require(owner != address(0), "Owner not set");
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyBackendOrOwner() {
        require(msg.sender == backend || msg.sender == owner, "Not authorised");
        _;
    }

    modifier onlyBackendOrVault() {
        require(
            msg.sender == backend || msg.sender == address(vault),
            "Not authorised"
        );
        _;
    }

    modifier onlyBackendOrFactory() {
        require(
            msg.sender == backend || msg.sender == factory,
            "Not authorised"
        );
        _;
    }

    modifier onlySupported(address token) {
        require(supportedTokens[token], "Unsupported token");
        _;
    }

    // ========== CONSTRUCTOR ==========

    /**
     * @param _backend        Platform EOA address
     * @param _factory        UserWalletFactory address
     * @param _vault          CheeseVault address
     * @param _initialTokens  Array of supported token addresses (e.g. [USDC, USDT])
     * @param _owner          User recovery address (pass address(0) initially)
     */
    constructor(
        address _backend,
        address _factory,
        address _vault,
        address[] memory _initialTokens,
        address _owner
    ) {
        require(_backend != address(0), "Invalid backend");
        require(_factory != address(0), "Invalid factory");
        require(_vault   != address(0), "Invalid vault");

        backend = _backend;
        factory = _factory;
        vault   = ICheeseVault(_vault);
        owner   = _owner;

        for (uint256 i = 0; i < _initialTokens.length; i++) {
            address t = _initialTokens[i];
            require(t != address(0), "Invalid token address");
            if (!supportedTokens[t]) {
                supportedTokens[t] = true;
                _tokenList.push(t);
                emit TokenAdded(t);
            }
        }
    }

    // ========== VIEW FUNCTIONS ==========

    /// @notice Balance of a supported token held in this wallet
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice List of all supported token addresses
    function getTokenList() external view returns (address[] memory) {
        return _tokenList;
    }

    // ========== PAYMENT FUNCTIONS ==========

    /**
     * @notice Pull (payment + fee) to CheeseVault for a bill payment.
     *         Called by the vault inside processPayment().
     * @param  token          ERC-20 token address (USDC or USDT)
     * @param  paymentAmount  Bill amount excluding fee
     * @return totalAmount    Actual amount transferred (payment + fee)
     */
    function transferToVault(address token, uint256 paymentAmount)
        external
        onlyBackendOrVault
        onlySupported(token)
        nonReentrant
        returns (uint256 totalAmount)
    {
        require(paymentAmount > 0, "Payment amount must be > 0");

        uint256 feeAmt = vault.feeAmount();
        totalAmount = paymentAmount + feeAmt;

        require(IERC20(token).balanceOf(address(this)) >= totalAmount, "Insufficient balance");
        IERC20(token).safeTransfer(address(vault), totalAmount);

        emit TransferredToVault(token, paymentAmount, feeAmt, totalAmount, block.timestamp);
    }

    /**
     * @notice Send tokens directly to another user's wallet (P2P transfer).
     *         Called by UserWalletFactory.transferByUsername().
     * @param  token           ERC-20 token address
     * @param  recipientWallet Address of the recipient's UserWallet contract
     * @param  amount          Token amount in token units (6 decimals for USDC/USDT)
     */
    function transferToUser(address token, address recipientWallet, uint256 amount)
        external
        onlyBackendOrFactory
        onlySupported(token)
        nonReentrant
    {
        require(amount > 0, "Amount must be > 0");
        require(recipientWallet != address(0), "Invalid recipient");
        require(recipientWallet != address(this), "Cannot send to self");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");

        IERC20(token).safeTransfer(recipientWallet, amount);

        emit TransferredToUser(token, recipientWallet, amount, block.timestamp);
    }

    // ========== WITHDRAWAL FUNCTIONS ==========

    /**
     * @notice Withdraw tokens from wallet (backend-initiated or owner recovery).
     * @param  token      ERC-20 token address
     * @param  amount     Amount to withdraw
     * @param  recipient  Address to receive tokens
     */
    function withdraw(address token, uint256 amount, address recipient)
        external
        onlyBackendOrOwner
        onlySupported(token)
        nonReentrant
    {
        require(amount > 0, "Amount must be > 0");
        require(recipient != address(0), "Invalid recipient");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");

        IERC20(token).safeTransfer(recipient, amount);

        emit Withdrawal(token, recipient, amount, block.timestamp);
    }

    /**
     * @notice Emergency drain of a specific token — sends entire balance to owner.
     *         Safety valve if backend is compromised.
     * @param  token  ERC-20 token address to drain
     */
    function emergencyWithdraw(address token) external onlyOwnerAddr onlySupported(token) nonReentrant {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "Nothing to withdraw");

        IERC20(token).safeTransfer(owner, balance);

        emit EmergencyWithdrawal(token, balance, block.timestamp);
    }

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @notice Add a new supported token to this wallet.
     *         Only backend can call this.
     * @param  token  ERC-20 token address to add
     */
    function addSupportedToken(address token) external onlyBackend {
        require(token != address(0), "Invalid token address");
        if (!supportedTokens[token]) {
            supportedTokens[token] = true;
            _tokenList.push(token);
            emit TokenAdded(token);
        }
    }

    /**
     * @notice Register or update the user's recovery address.
     *         Only backend can set this — prevents user from self-assigning
     *         before KYC or other off-chain checks pass.
     * @param  newOwner  New recovery address
     */
    function setOwner(address newOwner) external onlyBackend {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnerUpdated(oldOwner, newOwner);
    }
}
