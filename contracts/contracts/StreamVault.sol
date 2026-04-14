// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./RWAYieldRouter.sol";

/**
 * @title StreamVault
 * @dev Core StreamYield contract — streams payroll per-second to employees
 *      while routing unvested capital to RWA yield vaults.
 *
 * Flow:
 *   1. Employer calls createStream() — deposits total payroll amount
 *   2. Contract instantly routes unvested capital to RWAYieldRouter
 *   3. Employee calls claimVested() at any time to pull their accrued salary
 *   4. As capital vests, yield router withdraws to fund the claim
 *   5. Employer earns yield on the unvested portion throughout the period
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
        string  aiReasoning;    // AI explanation for vault selection
    }

    // ─── State ───────────────────────────────────────────────────────────────

    RWAYieldRouter public immutable yieldRouter;
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

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _yieldRouter) {
        yieldRouter = RWAYieldRouter(_yieldRouter);
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

        // Route entire unvested capital to the yield router (ERC-4626 deposit)
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

        // Withdraw from yield router (redeems ERC-4626 shares) to fund the payout
        yieldRouter.withdraw(s.token, claimable, s.vaultTier, streamId);

        IERC20(s.token).safeTransfer(msg.sender, claimable);
        emit Claimed(streamId, msg.sender, claimable);
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
}
