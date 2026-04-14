// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RWAYieldRouter
 * @dev Routes unvested payroll capital into tiered RWA yield vaults.
 *
 * Each vault tier is an ERC-4626 tokenized vault — the industry-standard interface
 * for on-chain yield strategies (used by Aave, Morpho, Ondo, Angle, etc).
 *
 * ERC-4626 provides:
 *   - shares/assets accounting (vault shares appreciate vs the underlying asset)
 *   - Standard deposit/withdraw/redeem interface
 *   - totalAssets() reflecting accrued yield
 *   - convertToAssets() / convertToShares() for real-time pricing
 *
 * Vault Tiers (simulated yield on testnet; mainnet would route to real vaults):
 *   Tier 0 — Stable:   4%  APY  (T-bills / USDC money market equivalent)
 *   Tier 1 — Balanced: 8%  APY  (diversified RWA — real estate + IG bonds)
 *   Tier 2 — Growth:  12%  APY  (high-yield private credit + real estate)
 */

// ─── Single-tier ERC-4626 Vault ───────────────────────────────────────────────

contract RWATierVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR  = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    uint256 public immutable apyBps;     // e.g. 400 = 4%
    string  public  tierName;

    // Tracks when each depositor deposited (for yield accrual)
    mapping(address => uint256) public depositTimestamp;

    event YieldAccrued(address indexed account, uint256 yield);

    constructor(
        IERC20  _asset,
        string memory _name,
        string memory _symbol,
        uint256 _apyBps,
        string memory _tierName
    )
        ERC4626(_asset)
        ERC20(_name, _symbol)
        Ownable(msg.sender)
    {
        apyBps   = _apyBps;
        tierName = _tierName;
    }

    // ─── ERC-4626 overrides ───────────────────────────────────────────────────

    /**
     * @notice Total assets = deposited principal + simulated accrued yield.
     * This makes shares appreciate continuously — the standard ERC-4626 pattern.
     */
    function totalAssets() public view override returns (uint256) {
        uint256 base = IERC20(asset()).balanceOf(address(this));
        // Simulated yield accrual on total TVL — approximation for testnet
        uint256 elapsed = block.timestamp - _genesisTimestamp();
        uint256 yieldOnBase = (base * apyBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        return base + yieldOnBase;
    }

    // Genesis timestamp approximated by contract deployment (stored at first deposit)
    uint256 private _genesis;
    function _genesisTimestamp() internal view returns (uint256) {
        return _genesis == 0 ? block.timestamp : _genesis;
    }

    function deposit(uint256 assets, address receiver)
        public override nonReentrant returns (uint256)
    {
        if (_genesis == 0) _genesis = block.timestamp;
        if (depositTimestamp[receiver] == 0) depositTimestamp[receiver] = block.timestamp;
        return super.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public override nonReentrant returns (uint256)
    {
        return super.withdraw(assets, receiver, owner_);
    }

    function redeem(uint256 shares, address receiver, address owner_)
        public override nonReentrant returns (uint256)
    {
        return super.redeem(shares, receiver, owner_);
    }

    // ─── View helpers ────────────────────────────────────────────────────────

    function getAPYBps() external view returns (uint256) { return apyBps; }

    function previewYieldForAmount(uint256 principal, uint256 durationSeconds)
        external view returns (uint256)
    {
        return (principal * apyBps * durationSeconds) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }
}

// ─── Router — orchestrates all 3 tier vaults ──────────────────────────────────

contract RWAYieldRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    RWATierVault public stableVault;    // Tier 0 — 4% APY
    RWATierVault public balancedVault;  // Tier 1 — 8% APY
    RWATierVault public growthVault;    // Tier 2 — 12% APY

    // Legacy constants kept for backward-compatibility with tests
    uint256 public constant STABLE_APY_BPS   = 400;
    uint256 public constant BALANCED_APY_BPS = 800;
    uint256 public constant GROWTH_APY_BPS   = 1200;
    uint256 public constant BPS_DENOMINATOR  = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // Per-stream positions (vault shares are held by this router)
    struct VaultPosition {
        address token;
        uint256 shares;       // ERC-4626 shares issued on deposit
        uint256 principal;    // Original deposit amount
        uint256 depositedAt;
        uint8   tier;
        bool    active;
    }

    mapping(uint256 => VaultPosition) public positions;
    address public streamVault;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Deposited(uint256 indexed streamId, address token, uint256 assets, uint256 shares, uint8 tier);
    event Withdrawn(uint256 indexed streamId, address token, uint256 assets, uint256 shares, uint8 tier);
    event YieldHarvested(uint256 indexed streamId, uint256 yieldAmount);

    constructor(IERC20 _token) Ownable(msg.sender) {
        // Deploy one ERC-4626 vault per tier
        stableVault   = new RWATierVault(_token, "SY Stable Vault",   "sySTV", 400,  "Stable");
        balancedVault = new RWATierVault(_token, "SY Balanced Vault",  "syBAV", 800,  "Balanced");
        growthVault   = new RWATierVault(_token, "SY Growth Vault",    "syGTV", 1200, "Growth");
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    modifier onlyStreamVault() {
        require(msg.sender == streamVault, "Only StreamVault");
        _;
    }

    function setStreamVault(address _sv) external onlyOwner {
        streamVault = _sv;
    }

    function _vaultForTier(uint8 tier) internal view returns (RWATierVault) {
        if (tier == 0) return stableVault;
        if (tier == 1) return balancedVault;
        if (tier == 2) return growthVault;
        revert("Invalid tier");
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /**
     * @notice Deposit on behalf of a stream. Returns shares minted by the vault.
     * @dev The ERC-4626 vault converts assets → shares at current exchange rate.
     */
    function deposit(address token, uint256 amount, uint8 tier, uint256 streamId)
        external onlyStreamVault nonReentrant returns (uint256 sharesReceived)
    {
        require(tier <= 2, "Invalid tier");
        RWATierVault vault = _vaultForTier(tier);
        require(address(vault.asset()) == token, "Token mismatch");

        // Pull tokens from StreamVault, approve vault, then deposit
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).approve(address(vault), amount);
        sharesReceived = vault.deposit(amount, address(this));

        positions[streamId] = VaultPosition({
            token: token,
            shares: sharesReceived,
            principal: amount,
            depositedAt: block.timestamp,
            tier: tier,
            active: true
        });

        emit Deposited(streamId, token, amount, sharesReceived, tier);
    }

    /**
     * @notice Withdraw principal for streaming (employee claim).
     * Redeems proportional shares from the ERC-4626 vault.
     */
    function withdraw(address token, uint256 amount, uint8 tier, uint256 streamId)
        external onlyStreamVault nonReentrant
    {
        RWATierVault vault = _vaultForTier(tier);
        VaultPosition storage pos = positions[streamId];
        require(pos.active, "Position not active");

        // Calculate shares to redeem proportionally
        uint256 sharesToRedeem = vault.convertToShares(amount);
        if (sharesToRedeem > pos.shares) sharesToRedeem = pos.shares;

        uint256 assetsReceived = vault.redeem(sharesToRedeem, msg.sender, address(this));
        pos.shares -= sharesToRedeem;
        if (amount <= pos.principal) pos.principal -= amount;

        emit Withdrawn(streamId, token, assetsReceived, sharesToRedeem, tier);
    }

    /**
     * @notice Harvest all remaining yield at stream end.
     * Any appreciation of shares above principal is the employer's yield.
     */
    function harvestYield(uint256 streamId, address recipient)
        external onlyStreamVault nonReentrant returns (uint256 yieldAmount)
    {
        VaultPosition storage pos = positions[streamId];
        if (!pos.active || pos.shares == 0) return 0;

        RWATierVault vault = _vaultForTier(pos.tier);
        // Total assets corresponding to remaining shares
        uint256 currentAssets = vault.convertToAssets(pos.shares);
        yieldAmount = currentAssets > pos.principal ? currentAssets - pos.principal : 0;

        // Redeem all remaining shares
        vault.redeem(pos.shares, recipient, address(this));
        pos.shares = 0;
        pos.active = false;

        emit YieldHarvested(streamId, yieldAmount);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /// @notice Real-time yield for a stream based on ERC-4626 share appreciation
    function getAccumulatedYield(uint256 streamId) external view returns (uint256) {
        VaultPosition storage pos = positions[streamId];
        if (!pos.active || pos.shares == 0) return 0;
        RWATierVault vault = _vaultForTier(pos.tier);
        uint256 currentAssets = vault.convertToAssets(pos.shares);
        return currentAssets > pos.principal ? currentAssets - pos.principal : 0;
    }

    /// @notice Returns total assets in a vault tier (TVL)
    function getTierTVL(uint8 tier) external view returns (uint256) {
        return _vaultForTier(tier).totalAssets();
    }

    /// @notice Returns the ERC-4626 vault address for a tier
    function getVaultAddress(uint8 tier) external view returns (address) {
        return address(_vaultForTier(tier));
    }

    function getTierAPY(uint8 tier) external pure returns (uint256) {
        if (tier == 0) return STABLE_APY_BPS;
        if (tier == 1) return BALANCED_APY_BPS;
        if (tier == 2) return GROWTH_APY_BPS;
        revert("Invalid tier");
    }

    function getTierBalance(address token, uint8 tier) external view returns (uint256) {
        return IERC20(token).balanceOf(address(_vaultForTier(tier)));
    }
}
