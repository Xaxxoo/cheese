// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CheeseVault.sol";
import "../src/UserWalletFactory.sol";

/**
 * @notice Deterministic multi-chain deployment script.
 *
 * Uses CREATE2 with a fixed salt so CheeseVault and UserWalletFactory deploy
 * to the SAME address on every supported chain. Contracts are deployed with an
 * empty token list, then the chain-specific tokens are added post-deployment
 * (empty constructor args = identical init code everywhere).
 *
 * Supported chains (mainnet):
 *   Arbitrum (42161)  — USDC + USDT
 *   Base     (8453)   — USDC + USDT (bridged)
 *   Celo     (42220)  — USDC + USDT
 *   Polygon  (137)    — USDC + USDT
 *   Lisk     (1135)   — USDC.e + USDT
 *
 * Supported chains (testnet):
 *   Arbitrum Sepolia (421614) — USDC
 *   Base Sepolia     (84532)  — USDC
 *   Alfajores        (44787)  — USDC
 *   Polygon Amoy     (80002)  — USDC
 *   Lisk Sepolia     (4202)   — USDC.e
 *
 * Usage:
 *   forge script script/Deploy.s.sol --rpc-url <network> --broadcast --verify
 */
contract DeployAll is Script {

    // ── CREATE2 salt ────────────────────────────────────────────────────────
    // Changing this salt changes the deployed addresses on all chains.
    bytes32 constant SALT = keccak256("CheesePay_v1_0_0");

    // ── Fee / deposit config (same on all chains — 6 decimal tokens) ────────
    uint256 constant INITIAL_FEE = 0.5e6; // $0.50
    uint256 constant MIN_DEPOSIT = 1e6;   // $1.00

    // ── Chain IDs ────────────────────────────────────────────────────────────
    uint256 constant ETHEREUM_MAINNET  = 1;
    uint256 constant ETHEREUM_SEPOLIA  = 11155111;
    uint256 constant ARBITRUM_MAINNET  = 42161;
    uint256 constant ARBITRUM_SEPOLIA  = 421614;
    uint256 constant BASE_MAINNET      = 8453;
    uint256 constant BASE_SEPOLIA      = 84532;
    uint256 constant CELO_MAINNET      = 42220;
    uint256 constant CELO_ALFAJORES    = 44787;
    uint256 constant POLYGON_MAINNET   = 137;
    uint256 constant POLYGON_AMOY      = 80002;
    uint256 constant LISK_MAINNET      = 1135;
    uint256 constant LISK_SEPOLIA      = 4202;

    // ── Ethereum ──────────────────────────────────────────────────────────────
    address constant USDC_ETHEREUM         = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDT_ETHEREUM         = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant USDC_ETHEREUM_SEPOLIA = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    // ── Arbitrum ──────────────────────────────────────────────────────────────
    address constant USDC_ARBITRUM         = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant USDT_ARBITRUM         = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address constant USDC_ARBITRUM_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    // ── Base ──────────────────────────────────────────────────────────────────
    address constant USDC_BASE         = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDT_BASE         = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2; // bridged USDT
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // ── Celo ──────────────────────────────────────────────────────────────────
    address constant USDC_CELO         = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;
    address constant USDT_CELO         = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
    address constant USDC_CELO_ALFAJORES = 0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B;

    // ── Polygon ───────────────────────────────────────────────────────────────
    address constant USDC_POLYGON      = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
    address constant USDT_POLYGON      = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
    address constant USDC_POLYGON_AMOY = 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582;

    // ── Lisk ──────────────────────────────────────────────────────────────────
    address constant USDC_LISK         = 0xF242275d3a6527d877f2c927a82D9b057609cc71; // USDC.e (bridged)
    address constant USDT_LISK         = 0x05D032ac25d322df992303dCa074EE7392C117b9;
    address constant USDC_LISK_SEPOLIA = 0x8a0e9D3E5931E93bF9bb43bb9f0ea03b5d54E7Fa; // verify before use

    // ─────────────────────────────────────────────────────────────────────────

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        uint256 chainId = block.chainid;

        // Resolve chain config
        (string memory networkName, bool isTestnet, address[] memory tokens) =
            _getChainConfig(chainId);

        console.log("==========================================");
        console.log("CheesePay Deterministic Deployment");
        console.log("==========================================");
        console.log("Network:    ", networkName);
        console.log("Chain ID:   ", chainId);
        console.log("Deployer:   ", deployer);
        console.log("Salt:        CheesePay_v1_0_0");
        console.log("Tokens to add after deploy:", tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            console.log("  Token", i, ":", tokens[i]);
        }
        console.log("==========================================");
        console.log("");

        // Empty token array — identical init code on every chain → same CREATE2 address
        address[] memory emptyTokens = new address[](0);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy CheeseVault via CREATE2
        console.log("Deploying CheeseVault...");
        CheeseVault vault = new CheeseVault{salt: SALT}(emptyTokens, INITIAL_FEE, MIN_DEPOSIT, deployer);
        console.log("CheeseVault:", address(vault));

        // 2. Deploy UserWalletFactory via CREATE2
        console.log("Deploying UserWalletFactory...");
        UserWalletFactory factory = new UserWalletFactory{salt: SALT}(
            deployer,       // owner — explicit because CREATE2 deployer is msg.sender in constructor
            deployer,       // backend — update via updateBackend() on mainnet
            address(vault),
            emptyTokens
        );
        console.log("UserWalletFactory:", address(factory));
        console.log("");

        // 3. Grant deployer ADMIN_ROLE so this script can add chain-specific tokens.
        //    DEFAULT_ADMIN_ROLE was granted explicitly in the constructor.
        vault.grantRole(vault.ADMIN_ROLE(), deployer);

        // 4. Add chain-specific tokens to both contracts
        console.log("Adding supported tokens...");
        for (uint256 i = 0; i < tokens.length; i++) {
            vault.addSupportedToken(tokens[i]);
            factory.addSupportedToken(tokens[i]);
            console.log("  Added token:", tokens[i]);
        }
        console.log("");

        // 5. On testnets, grant all roles to deployer for easy testing
        if (isTestnet) {
            console.log("TESTNET: Granting all roles to deployer...");
            vault.grantRole(vault.ADMIN_ROLE(), deployer);
            vault.grantRole(vault.OPERATOR_ROLE(), deployer);
            vault.grantRole(vault.TREASURER_ROLE(), deployer);
            console.log("Roles granted.");
            console.log("");
        }

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("==========================================");
        console.log("Deployment Summary");
        console.log("==========================================");
        console.log("Network:          ", networkName);
        console.log("CheeseVault:      ", address(vault));
        console.log("UserWalletFactory:", address(factory));
        console.log("Fee:               $0.50 (0.5e6)");
        console.log("Min deposit:       $1.00 (1e6)");
        console.log("");

        if (!isTestnet) {
            console.log("MAINNET - post-deployment steps:");
            console.log("1. vault.grantRole(ADMIN_ROLE, <admin>)");
            console.log("2. vault.grantRole(OPERATOR_ROLE, <operator>)");
            console.log("3. vault.grantRole(TREASURER_ROLE, <treasurer>)");
            console.log("4. factory.updateBackend(<backend_eoa>)");
        }
        console.log("==========================================");
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    function _getChainConfig(uint256 chainId)
        internal
        pure
        returns (string memory networkName, bool isTestnet, address[] memory tokens)
    {
        if (chainId == ETHEREUM_MAINNET) {
            networkName = "Ethereum Mainnet";
            isTestnet   = false;
            tokens      = _tokens2(USDC_ETHEREUM, USDT_ETHEREUM);

        } else if (chainId == ETHEREUM_SEPOLIA) {
            networkName = "Ethereum Sepolia";
            isTestnet   = true;
            tokens      = _tokens1(USDC_ETHEREUM_SEPOLIA);

        } else if (chainId == ARBITRUM_MAINNET) {
            networkName = "Arbitrum Mainnet";
            isTestnet   = false;
            tokens      = _tokens2(USDC_ARBITRUM, USDT_ARBITRUM);

        } else if (chainId == ARBITRUM_SEPOLIA) {
            networkName = "Arbitrum Sepolia";
            isTestnet   = true;
            tokens      = _tokens1(USDC_ARBITRUM_SEPOLIA);

        } else if (chainId == BASE_MAINNET) {
            networkName = "Base Mainnet";
            isTestnet   = false;
            tokens      = _tokens2(USDC_BASE, USDT_BASE);

        } else if (chainId == BASE_SEPOLIA) {
            networkName = "Base Sepolia";
            isTestnet   = true;
            tokens      = _tokens1(USDC_BASE_SEPOLIA);

        } else if (chainId == CELO_MAINNET) {
            networkName = "Celo Mainnet";
            isTestnet   = false;
            tokens      = _tokens2(USDC_CELO, USDT_CELO);

        } else if (chainId == CELO_ALFAJORES) {
            networkName = "Celo Alfajores";
            isTestnet   = true;
            tokens      = _tokens1(USDC_CELO_ALFAJORES);

        } else if (chainId == POLYGON_MAINNET) {
            networkName = "Polygon Mainnet";
            isTestnet   = false;
            tokens      = _tokens2(USDC_POLYGON, USDT_POLYGON);

        } else if (chainId == POLYGON_AMOY) {
            networkName = "Polygon Amoy";
            isTestnet   = true;
            tokens      = _tokens1(USDC_POLYGON_AMOY);

        } else if (chainId == LISK_MAINNET) {
            networkName = "Lisk Mainnet";
            isTestnet   = false;
            tokens      = _tokens2(USDC_LISK, USDT_LISK);

        } else if (chainId == LISK_SEPOLIA) {
            networkName = "Lisk Sepolia";
            isTestnet   = true;
            tokens      = _tokens1(USDC_LISK_SEPOLIA);

        } else {
            revert(string(abi.encodePacked("Unsupported chain ID: ", vm.toString(chainId))));
        }
    }

    function _tokens1(address a) internal pure returns (address[] memory t) {
        t = new address[](1);
        t[0] = a;
    }

    function _tokens2(address a, address b) internal pure returns (address[] memory t) {
        t = new address[](2);
        t[0] = a;
        t[1] = b;
    }
}
