// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IUserWallet.sol";

/**
 * @title CheeseVault
 * @notice Multi-token stablecoin vault for bill payments with role-based access control.
 * @dev Accepts USDC and USDT (both 6 decimals). Per-token accounting ensures funds
 *      are never commingled across tokens.
 */
contract CheeseVault is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // ========== STATE VARIABLES ==========

    // Roles
    bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    // Token support
    mapping(address => bool) public supportedTokens;
    address[] private _tokenList;

    // Per-token accounting
    mapping(address => uint256) public availableProcessedPayments;
    mapping(address => uint256) public totalPaymentsProcessed;
    mapping(address => uint256) public availableFees;
    mapping(address => uint256) public totalFeesCollected;

    // Settings
    uint256 public feeAmount;              // Flat fee per transaction (applies to all tokens)
    uint256 public constant MAX_FEE = 5e6; // $5 (6 decimals)
    uint256 public minDeposit;             // Minimum deposit amount

    // ========== EVENTS ==========

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

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event MinDepositUpdated(uint256 oldMinDeposit, uint256 newMinDeposit);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    // ========== CONSTRUCTOR ==========

    /**
     * @notice Initialise the vault with supported tokens and initial settings.
     * @param _initialTokens  Array of accepted ERC-20 token addresses (e.g. [USDC, USDT])
     * @param _feeAmount      Initial flat fee amount per transaction (must be <= MAX_FEE)
     * @param _minDeposit     Minimum deposit amount
     */
    constructor(address[] memory _initialTokens, uint256 _feeAmount, uint256 _minDeposit) {
        require(_feeAmount <= MAX_FEE, "Fee exceeds maximum");

        feeAmount  = _feeAmount;
        minDeposit = _minDeposit;

        for (uint256 i = 0; i < _initialTokens.length; i++) {
            address t = _initialTokens[i];
            require(t != address(0), "Invalid token address");
            if (!supportedTokens[t]) {
                supportedTokens[t] = true;
                _tokenList.push(t);
                emit TokenAdded(t);
            }
        }

        // Grant deployer the default admin role (can assign other roles)
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ========== OPERATOR FUNCTIONS ==========

    /**
     * @notice Process a payment — pulls (paymentAmount + fee) from the UserWallet.
     * @param userWallet     Address of the UserWallet contract
     * @param paymentAmount  Bill amount excluding fee
     * @param paymentId      Unique identifier for this payment
     * @param token          ERC-20 token address (USDC or USDT)
     */
    function processPayment(
        address userWallet,
        uint256 paymentAmount,
        bytes32 paymentId,
        address token
    )
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        require(paymentAmount > 0, "Payment amount must be greater than 0");
        require(userWallet != address(0), "Invalid wallet address");
        require(supportedTokens[token], "Unsupported token");

        // Update per-token accounting
        availableProcessedPayments[token] += paymentAmount;
        totalPaymentsProcessed[token]     += paymentAmount;
        availableFees[token]              += feeAmount;
        totalFeesCollected[token]         += feeAmount;

        // Pull funds from UserWallet
        uint256 totalAmount = IUserWallet(userWallet).transferToVault(token, paymentAmount);

        require(totalAmount == paymentAmount + feeAmount, "Incorrect amount transferred");

        emit PaymentProcessed(userWallet, paymentId, token, paymentAmount, feeAmount, 0);
    }

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @notice Refund a failed payment back to the user's wallet.
     * @param userWallet     Address of the UserWallet contract
     * @param paymentAmount  Original payment amount (excluding fee)
     * @param refundFee      Whether to also refund the fee
     * @param paymentId      Payment identifier for tracking
     * @param token          ERC-20 token address
     */
    function refundPayment(
        address userWallet,
        uint256 paymentAmount,
        bool    refundFee,
        bytes32 paymentId,
        address token
    )
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
        whenNotPaused
    {
        require(paymentAmount > 0, "Refund amount must be greater than 0");
        require(userWallet != address(0), "Invalid wallet address");
        require(supportedTokens[token], "Unsupported token");

        uint256 refundAmount = paymentAmount;

        require(
            availableProcessedPayments[token] >= paymentAmount,
            "Insufficient processed payments to refund"
        );
        availableProcessedPayments[token] -= paymentAmount;

        if (refundFee) {
            require(availableFees[token] >= feeAmount, "Insufficient fees to refund");
            availableFees[token] -= feeAmount;
            refundAmount += feeAmount;
        }

        IERC20(token).safeTransfer(userWallet, refundAmount);

        emit PaymentRefunded(userWallet, paymentId, token, refundAmount, 0);
    }

    /**
     * @notice Add a new supported token.
     */
    function addSupportedToken(address token) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        if (!supportedTokens[token]) {
            supportedTokens[token] = true;
            _tokenList.push(token);
            emit TokenAdded(token);
        }
    }

    /**
     * @notice Remove a supported token. Existing per-token balances are unaffected
     *         and can still be withdrawn by the treasurer.
     */
    function removeSupportedToken(address token) external onlyRole(ADMIN_ROLE) {
        require(supportedTokens[token], "Token not supported");
        supportedTokens[token] = false;

        uint256 len = _tokenList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_tokenList[i] == token) {
                _tokenList[i] = _tokenList[len - 1];
                _tokenList.pop();
                break;
            }
        }
        emit TokenRemoved(token);
    }

    /**
     * @notice Update the flat fee amount (applies to all tokens going forward).
     * @param newFee New fee amount (must be <= MAX_FEE)
     */
    function setFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        require(newFee <= MAX_FEE, "Fee exceeds maximum");
        uint256 oldFee = feeAmount;
        feeAmount = newFee;
        emit FeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update the minimum deposit amount.
     */
    function setMinDeposit(uint256 newMinDeposit) external onlyRole(ADMIN_ROLE) {
        uint256 oldMinDeposit = minDeposit;
        minDeposit = newMinDeposit;
        emit MinDepositUpdated(oldMinDeposit, newMinDeposit);
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ========== TREASURER FUNCTIONS ==========

    /**
     * @notice Withdraw processed payments and fees for a specific token.
     * @param to     Recipient address
     * @param token  ERC-20 token address to withdraw
     */
    function withdrawVaultFunds(address to, address token)
        external
        onlyRole(TREASURER_ROLE)
        nonReentrant
    {
        require(to != address(0), "Invalid recipient address");
        require(supportedTokens[token], "Unsupported token");

        uint256 paymentsToWithdraw = availableProcessedPayments[token];
        uint256 feesToWithdraw     = availableFees[token];
        uint256 totalToWithdraw    = paymentsToWithdraw + feesToWithdraw;

        require(totalToWithdraw > 0, "No funds available to withdraw");

        availableProcessedPayments[token] = 0;
        availableFees[token]              = 0;

        IERC20(token).safeTransfer(to, totalToWithdraw);

        emit VaultFundsWithdrawn(msg.sender, to, token, paymentsToWithdraw, feesToWithdraw, totalToWithdraw);
    }

    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Get available funds that can be withdrawn by treasurer for a specific token.
     * @param token  ERC-20 token address
     * @return payments  Available processed payments
     * @return fees      Available fees
     * @return total     Total available for withdrawal
     */
    function getAvailableWithdrawal(address token)
        external
        view
        returns (uint256 payments, uint256 fees, uint256 total)
    {
        payments = availableProcessedPayments[token];
        fees     = availableFees[token];
        total    = payments + fees;
    }

    /**
     * @notice Verify vault accounting is correct for a specific token.
     * @param token  ERC-20 token address
     * @return isValid  True if vault balance >= available withdrawals for that token
     */
    function verifyVaultAccounting(address token) external view returns (bool isValid) {
        uint256 vaultBalance     = IERC20(token).balanceOf(address(this));
        uint256 requiredBalance  = availableProcessedPayments[token] + availableFees[token];
        return vaultBalance >= requiredBalance;
    }

    /// @notice Return the full list of supported token addresses.
    function getTokenList() external view returns (address[] memory) {
        return _tokenList;
    }
}
