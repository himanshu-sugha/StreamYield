// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title HSPSettlementEmitter
 * @dev Implements HashKey Settlement Protocol (HSP) with full settlement lifecycle.
 *
 * Settlement States:
 *   PENDING    → Settlement created, awaiting processing
 *   PROCESSING → Settlement accepted, funds locked in transit
 *   SETTLED    → Settlement finalized, funds delivered
 *   DISPUTED   → Settlement flagged for review
 *   CANCELLED  → Settlement reversed
 *
 * This goes beyond event emission — it maintains on-chain settlement state,
 * enforces lifecycle transitions, and provides HSP-compatible query interfaces
 * for downstream settlement processors and compliance systems.
 */
contract HSPSettlementEmitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Enums ────────────────────────────────────────────────────────────────

    enum SettlementStatus { PENDING, PROCESSING, SETTLED, DISPUTED, CANCELLED }
    enum SettlementType   { STREAM_CREATED, STREAM_CLAIMED, STREAM_CLOSED, YIELD_HARVESTED }

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Settlement {
        uint256 settlementId;
        address employer;
        address employee;
        address token;
        uint256 amount;
        uint256 streamId;
        uint256 createdAt;
        uint256 processedAt;
        uint256 settledAt;
        SettlementStatus status;
        SettlementType   settlementType;
        bytes32          proofHash;      // keccak256 of critical fields for audit
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public streamVault;
    uint256 public settlementCount;

    mapping(uint256 => Settlement)        public settlements;
    mapping(uint256 => uint256[])         public streamSettlements;     // streamId → settlementIds
    mapping(address => uint256[])         public employerSettlements;   // employer → settlementIds
    mapping(address => uint256[])         public employeeSettlements;   // employee → settlementIds
    mapping(SettlementStatus => uint256)  public statusCount;           // count per status

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted on every new settlement — HSP-compatible primary event
    event SettlementCreated(
        uint256 indexed settlementId,
        uint256 indexed streamId,
        address indexed employer,
        address employee,
        address token,
        uint256 amount,
        SettlementType settlementType,
        bytes32 proofHash,
        uint256 timestamp
    );

    /// @notice Emitted when a settlement transitions state
    event SettlementStatusChanged(
        uint256 indexed settlementId,
        SettlementStatus fromStatus,
        SettlementStatus toStatus,
        uint256 timestamp
    );

    /// @notice Emitted when a settlement is finalized (SETTLED)
    event SettlementFinalized(
        uint256 indexed settlementId,
        uint256 indexed streamId,
        address indexed employee,
        uint256 amount,
        uint256 settledAt
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Admin ────────────────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        require(
            msg.sender == streamVault || msg.sender == owner(),
            "HSP: Not authorized"
        );
        _;
    }

    function setStreamVault(address _streamVault) external onlyOwner {
        streamVault = _streamVault;
    }

    // ─── Settlement Lifecycle ─────────────────────────────────────────────────

    /**
     * @notice Create a new settlement in PENDING state.
     * @dev Called by StreamVault on every significant payroll action.
     * @return settlementId The unique ID of this settlement.
     */
    function createSettlement(
        address employer,
        address employee,
        address token,
        uint256 amount,
        uint256 streamId,
        SettlementType settlementType
    ) external onlyAuthorized returns (uint256 settlementId) {
        settlementId = ++settlementCount;

        bytes32 proofHash = keccak256(abi.encodePacked(
            settlementId, employer, employee, token, amount, streamId,
            uint8(settlementType), block.timestamp
        ));

        Settlement memory s = Settlement({
            settlementId:   settlementId,
            employer:       employer,
            employee:       employee,
            token:          token,
            amount:         amount,
            streamId:       streamId,
            createdAt:      block.timestamp,
            processedAt:    0,
            settledAt:      0,
            status:         SettlementStatus.PENDING,
            settlementType: settlementType,
            proofHash:      proofHash
        });

        settlements[settlementId] = s;
        streamSettlements[streamId].push(settlementId);
        employerSettlements[employer].push(settlementId);
        if (employee != address(0)) employeeSettlements[employee].push(settlementId);
        statusCount[SettlementStatus.PENDING]++;

        emit SettlementCreated(
            settlementId, streamId, employer, employee, token,
            amount, settlementType, proofHash, block.timestamp
        );
    }

    /**
     * @notice Advance a settlement from PENDING → PROCESSING.
     * @dev Represents the HSP network accepting the settlement for processing.
     */
    function processSettlement(uint256 settlementId) external onlyAuthorized {
        Settlement storage s = settlements[settlementId];
        require(s.status == SettlementStatus.PENDING, "HSP: Not PENDING");
        _transition(s, SettlementStatus.PROCESSING);
        s.processedAt = block.timestamp;
    }

    /**
     * @notice Finalize a settlement: PROCESSING → SETTLED.
     * @dev Represents on-chain confirmation that funds were delivered.
     *      In production, called by the HSP relay after L1 confirmation.
     */
    function finalizeSettlement(uint256 settlementId) external onlyAuthorized {
        Settlement storage s = settlements[settlementId];
        require(s.status == SettlementStatus.PROCESSING, "HSP: Not PROCESSING");
        _transition(s, SettlementStatus.SETTLED);
        s.settledAt = block.timestamp;
        emit SettlementFinalized(
            settlementId, s.streamId, s.employee, s.amount, block.timestamp
        );
    }

    /**
     * @notice Express-settle: PENDING → SETTLED in one call.
     * @dev Used for low-risk small amounts where two-phase is unnecessary.
     */
    function expressSettle(uint256 settlementId) external onlyAuthorized {
        Settlement storage s = settlements[settlementId];
        require(s.status == SettlementStatus.PENDING, "HSP: Not PENDING");
        s.processedAt = block.timestamp;
        s.settledAt   = block.timestamp;
        _transition(s, SettlementStatus.SETTLED);
        emit SettlementFinalized(
            settlementId, s.streamId, s.employee, s.amount, block.timestamp
        );
    }

    /**
     * @notice Flag a settlement as DISPUTED.
     */
    function disputeSettlement(uint256 settlementId) external onlyOwner {
        Settlement storage s = settlements[settlementId];
        require(
            s.status == SettlementStatus.PENDING || s.status == SettlementStatus.PROCESSING,
            "HSP: Cannot dispute"
        );
        _transition(s, SettlementStatus.DISPUTED);
    }

    /**
     * @notice Cancel a settlement (PENDING or DISPUTED only).
     */
    function cancelSettlement(uint256 settlementId) external onlyOwner {
        Settlement storage s = settlements[settlementId];
        require(
            s.status == SettlementStatus.PENDING || s.status == SettlementStatus.DISPUTED,
            "HSP: Cannot cancel"
        );
        _transition(s, SettlementStatus.CANCELLED);
    }

    // ─── HSP-compatible convenience (wraps createSettlement + expressSettle) ──

    /**
     * @notice Legacy entry point for simple one-shot event emission.
     * Internally creates a settlement and immediately express-settles it.
     */
    function emitSettlement(
        address employer,
        address employee,
        address token,
        uint256 amount,
        uint256 streamId,
        string calldata settlementTypeStr
    ) external onlyAuthorized {
        SettlementType t = _parseType(settlementTypeStr);
        uint256 id = this.createSettlement(employer, employee, token, amount, streamId, t);
        // Express-settle by calling internal directly (avoids auth re-check)
        Settlement storage s = settlements[id];
        s.processedAt = block.timestamp;
        s.settledAt   = block.timestamp;
        statusCount[SettlementStatus.PENDING]--;
        statusCount[SettlementStatus.SETTLED]++;
        emit SettlementStatusChanged(id, SettlementStatus.PENDING, SettlementStatus.SETTLED, block.timestamp);
        s.status = SettlementStatus.SETTLED;
        emit SettlementFinalized(id, streamId, employee, amount, block.timestamp);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getSettlement(uint256 settlementId)
        external view returns (Settlement memory)
    {
        return settlements[settlementId];
    }

    function getStreamSettlements(uint256 streamId)
        external view returns (uint256[] memory)
    {
        return streamSettlements[streamId];
    }

    function getEmployerSettlements(address employer)
        external view returns (uint256[] memory)
    {
        return employerSettlements[employer];
    }

    function getEmployeeSettlements(address employee)
        external view returns (uint256[] memory)
    {
        return employeeSettlements[employee];
    }

    function verifyProof(uint256 settlementId) external view returns (bool valid, bytes32 expectedHash) {
        Settlement storage s = settlements[settlementId];
        expectedHash = keccak256(abi.encodePacked(
            s.settlementId, s.employer, s.employee, s.token, s.amount, s.streamId,
            uint8(s.settlementType), s.createdAt
        ));
        valid = (expectedHash == s.proofHash);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _transition(Settlement storage s, SettlementStatus to) internal {
        SettlementStatus from = s.status;
        statusCount[from]--;
        statusCount[to]++;
        s.status = to;
        emit SettlementStatusChanged(s.settlementId, from, to, block.timestamp);
    }

    function _parseType(string calldata t) internal pure returns (SettlementType) {
        bytes32 h = keccak256(bytes(t));
        if (h == keccak256("STREAM_CREATED"))    return SettlementType.STREAM_CREATED;
        if (h == keccak256("STREAM_CLAIMED"))    return SettlementType.STREAM_CLAIMED;
        if (h == keccak256("STREAM_CLOSED"))     return SettlementType.STREAM_CLOSED;
        if (h == keccak256("YIELD_HARVESTED"))   return SettlementType.YIELD_HARVESTED;
        return SettlementType.STREAM_CREATED;
    }
}
