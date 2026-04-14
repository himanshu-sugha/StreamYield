// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./RWAYieldRouter.sol";
import "./HSPSettlementEmitter.sol";

/**
 * @title StreamVault
 * @dev Core StreamYield contract — streams payroll per-second to employees
 *      while routing unvested capital to RWA yield vaults.
 *
 * HSP Integration:
 *   Every payroll lifecycle action creates and immediately express-settles
 *   an HSP settlement record via HSPSettlementEmitter, providing a full
 *   on-chain audit trail for regulators and downstream settlement processors.
 *
 * Flow:
 *   1. Employer calls createStream()  → deposits capital, routes to ERC-4626 vault, creates HSP settlement
 *   2. Employee calls claimVested()   → withdraws vested salary, creates HSP settlement
 *   3. Employer calls closeStream()   → harvests yield from vault, creates HSP settlement
 */
contract StreamVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Structs ────────────────────────────────────────────────────────────

    struct Stream {
        address employer;
        address employee;
        address token;          // ERC-20 token (mUSDC)
        uint256 totalAmount;    // Total payroll to stream
        uint256 startTime;
        uint256 endTime;
        uint256 claimedAmount;  // How much employee has claimed so far
        uint8   vaultTier;      // 0=Stable(4%), 1=Balanced(8%), 2=Growth(12%)
        bool    active;
        string  aiReasoning;    // AI explanation for vault selection (stored on-chain)
    }

    // ─── State ───────────────────────────────────────────────────────────────

    RWAYieldRouter         public immutable yieldRouter;
    HSPSettlementEmitter   public hspEmitter;   // Set after deployment

    uint256 public nextStreamId;
    mapping(uint256 => Stream) public streams;
    mapping(address => uint256[]) public employerStreams;
    mapping(address => uint256[]) public employeeStreams;

    // ─── Events ──────────────────────────────────────────────────────────────

    event StreamCreated(
        uint256 indexed streamId,
        address indexed employer,
        address indexed employee,
        uint256 totalAmount,
        uint256 startTime,
        uint256 endTime,
        uint8 vaultTier,
        string aiReasoning
    );
    event Claimed(uint256 indexed streamId, address indexed employee, uint256 amount);
    event StreamClosed(uint256 indexed streamId, uint256 yieldEarned);
    event HSPEmitterSet(address indexed emitter);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _yieldRouter) {
        yieldRouter = RWAYieldRouter(_yieldRouter);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /**
     * @notice Link the HSP settlement emitter (called by deployer after deploy)
     * @dev Optional — payroll functions work without it; HSP events are skipped if not set
     */
    function setHSPEmitter(address _hspEmitter) external {
        require(address(hspEmitter) == address(0), "HSP emitter already set");
        hspEmitter = HSPSettlementEmitter(_hspEmitter);
        emit HSPEmitterSet(_hspEmitter);
    }

    // ─── External Functions ───────────────────────────────────────────────────

    /**
     * @notice Create a new payroll stream
     * @param employee      Recipient wallet address
     * @param token         ERC-20 token address (mUSDC)
     * @param totalAmount   Total amount to stream
     * @param duration      Stream duration in seconds
     * @param vaultTier     RWA vault tier (0=Stable, 1=Balanced, 2=Growth)
     * @param aiReasoning   Human-readable AI explanation for vault selection
     */
    function createStream(
        address employee,
        address token,
        uint256 totalAmount,
        uint256 duration,
        uint8 vaultTier,
        string calldata aiReasoning
    ) external nonReentrant returns (uint256 streamId) {
        require(employee != address(0), "Invalid employee address");
        require(employee != msg.sender, "Cannot stream to yourself");
        require(totalAmount > 0, "Amount must be > 0");
        require(duration >= 60, "Duration must be at least 60 seconds");
        require(vaultTier <= 2, "Invalid vault tier");

        // Transfer payroll capital from employer to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Route entire capital to the ERC-4626 yield router
        IERC20(token).approve(address(yieldRouter), totalAmount);
        streamId = nextStreamId++;
        yieldRouter.deposit(token, totalAmount, vaultTier, streamId);

        streams[streamId] = Stream({
            employer:      msg.sender,
            employee:      employee,
            token:         token,
            totalAmount:   totalAmount,
            startTime:     block.timestamp,
            endTime:       block.timestamp + duration,
            claimedAmount: 0,
            vaultTier:     vaultTier,
            active:        true,
            aiReasoning:   aiReasoning
        });

        employerStreams[msg.sender].push(streamId);
        employeeStreams[employee].push(streamId);

        emit StreamCreated(
            streamId,
            msg.sender,
            employee,
            totalAmount,
            block.timestamp,
            block.timestamp + duration,
            vaultTier,
            aiReasoning
        );

        // HSP: Register and immediately express-settle the stream creation
        _hspSettle(
            msg.sender,
            employee,
            token,
            totalAmount,
            streamId,
            HSPSettlementEmitter.SettlementType.STREAM_CREATED
        );
    }

    /**
     * @notice Employee claims their vested salary
     * @param streamId  ID of the stream to claim from
     */
    function claimVested(uint256 streamId) external nonReentrant {
        Stream storage s = streams[streamId];
        require(s.employee == msg.sender, "Not the stream recipient");
        require(s.active, "Stream is not active");

        uint256 claimable = _vestedAmount(s) - s.claimedAmount;
        require(claimable > 0, "Nothing to claim yet");

        s.claimedAmount += claimable;

        // Redeem ERC-4626 shares from yield router to fund the payout
        yieldRouter.withdraw(s.token, claimable, s.vaultTier, streamId);

        IERC20(s.token).safeTransfer(msg.sender, claimable);
        emit Claimed(streamId, msg.sender, claimable);

        // HSP: Register and express-settle the claim
        _hspSettle(
            s.employer,
            msg.sender,
            s.token,
            claimable,
            streamId,
            HSPSettlementEmitter.SettlementType.STREAM_CLAIMED
        );
    }

    /**
     * @notice Employer closes stream after it ends and collects yield
     * @param streamId  ID of the stream to close
     */
    function closeStream(uint256 streamId) external nonReentrant {
        Stream storage s = streams[streamId];
        require(s.employer == msg.sender, "Not the stream employer");
        require(s.active, "Already closed");
        require(block.timestamp >= s.endTime, "Stream still active");

        s.active = false;

        // Harvest all remaining yield from ERC-4626 vault — sent directly to employer
        uint256 yieldEarned = yieldRouter.harvestYield(streamId, s.employer);

        emit StreamClosed(streamId, yieldEarned);

        // HSP: Register and express-settle yield harvest
        if (yieldEarned > 0) {
            _hspSettle(
                msg.sender,
                msg.sender, // employer receives yield
                s.token,
                yieldEarned,
                streamId,
                HSPSettlementEmitter.SettlementType.YIELD_HARVESTED
            );
        }
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /// @notice Returns how much has vested for a given stream (real-time)
    function getVestedAmount(uint256 streamId) external view returns (uint256) {
        return _vestedAmount(streams[streamId]);
    }

    /// @notice Returns how much is claimable right now
    function getClaimable(uint256 streamId) external view returns (uint256) {
        Stream storage s = streams[streamId];
        return _vestedAmount(s) - s.claimedAmount;
    }

    /// @notice Returns a full stream summary
    function getStream(uint256 streamId) external view returns (Stream memory) {
        return streams[streamId];
    }

    /// @notice Returns all stream IDs for an employer
    function getEmployerStreams(address employer) external view returns (uint256[] memory) {
        return employerStreams[employer];
    }

    /// @notice Returns all stream IDs for an employee
    function getEmployeeStreams(address employee) external view returns (uint256[] memory) {
        return employeeStreams[employee];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _vestedAmount(Stream storage s) internal view returns (uint256) {
        if (block.timestamp <= s.startTime) return 0;
        if (block.timestamp >= s.endTime)   return s.totalAmount;

        uint256 elapsed  = block.timestamp - s.startTime;
        uint256 duration = s.endTime - s.startTime;
        return (s.totalAmount * elapsed) / duration;
    }

    /**
     * @dev Internal helper — creates and immediately express-settles an HSP record.
     *      Silently skips if the emitter is not linked (e.g. in tests without emitter).
     */
    function _hspSettle(
        address employer,
        address employee,
        address token,
        uint256 amount,
        uint256 streamId,
        HSPSettlementEmitter.SettlementType settlementType
    ) internal {
        if (address(hspEmitter) == address(0)) return;
        try hspEmitter.createSettlement(
            employer, employee, token, amount, streamId, settlementType
        ) returns (uint256 settlementId) {
            hspEmitter.expressSettle(settlementId);
        } catch {}
    }
}
