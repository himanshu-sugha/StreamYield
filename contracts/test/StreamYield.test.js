const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StreamYield Protocol", function () {
    let mockUSDC, rwaRouter, streamVault, hspEmitter;
    let employer, employee, other;
    const DECIMALS = 6;
    const ONE_MONTH = 30 * 24 * 60 * 60;
    const STREAM_AMOUNT = ethers.parseUnits("1000", DECIMALS);

    beforeEach(async function () {
        [employer, employee, other] = await ethers.getSigners();

        // 1. Deploy MockUSDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        // 2. Deploy RWAYieldRouter (needs MockUSDC token address)
        const RWAYieldRouter = await ethers.getContractFactory("RWAYieldRouter");
        rwaRouter = await RWAYieldRouter.deploy(await mockUSDC.getAddress());

        // 3. Deploy StreamVault
        const StreamVault = await ethers.getContractFactory("StreamVault");
        streamVault = await StreamVault.deploy(await rwaRouter.getAddress());

        // 4. Deploy HSPSettlementEmitter (no-arg constructor)
        const HSPSettlementEmitter = await ethers.getContractFactory("HSPSettlementEmitter");
        hspEmitter = await HSPSettlementEmitter.deploy();

        // 5. Link all contracts
        await rwaRouter.setStreamVault(await streamVault.getAddress());
        await hspEmitter.setStreamVault(await streamVault.getAddress());
        await streamVault.setHSPEmitter(await hspEmitter.getAddress());

        // 6. Fund employer
        await mockUSDC.faucet(employer.address, ethers.parseUnits("10000", DECIMALS));
        await mockUSDC.connect(employer).approve(await streamVault.getAddress(), ethers.parseUnits("10000", DECIMALS));
    });

    // ─── MockUSDC ─────────────────────────────────────────────────────────────

    describe("MockUSDC", function () {
        it("has 6 decimals", async function () {
            expect(await mockUSDC.decimals()).to.equal(6);
        });

        it("faucet mints tokens to any address", async function () {
            const mintAmt = ethers.parseUnits("100", 6);
            const before = await mockUSDC.balanceOf(other.address);
            await mockUSDC.faucet(other.address, mintAmt);
            expect(await mockUSDC.balanceOf(other.address)).to.equal(before + mintAmt);
        });
    });

    // ─── StreamVault ──────────────────────────────────────────────────────────

    describe("StreamVault", function () {
        async function createStream(tier = 0, reasoning = "Stable vault — conservative pick") {
            return streamVault.connect(employer).createStream(
                employee.address,
                await mockUSDC.getAddress(),
                STREAM_AMOUNT,
                ONE_MONTH,
                tier,
                reasoning
            );
        }

        it("emits StreamCreated on creation", async function () {
            await expect(createStream()).to.emit(streamVault, "StreamCreated");
        });

        it("vested amount is 0 at stream start", async function () {
            await createStream();
            expect(await streamVault.getVestedAmount(0)).to.equal(0n);
        });

        it("50% vested at midpoint", async function () {
            await createStream();
            await time.increase(ONE_MONTH / 2);
            const vested = await streamVault.getVestedAmount(0);
            const tolerance = ethers.parseUnits("1", DECIMALS);
            expect(vested).to.be.closeTo(STREAM_AMOUNT / 2n, tolerance);
        });

        it("100% vested at end of stream", async function () {
            await createStream();
            await time.increase(ONE_MONTH + 1);
            expect(await streamVault.getVestedAmount(0)).to.equal(STREAM_AMOUNT);
        });

        it("employee claims vested salary", async function () {
            await createStream();
            await time.increase(ONE_MONTH / 2);
            const claimable = await streamVault.getClaimable(0);
            const balBefore = await mockUSDC.balanceOf(employee.address);
            await streamVault.connect(employee).claimVested(0);
            const balAfter = await mockUSDC.balanceOf(employee.address);
            expect(balAfter - balBefore).to.be.closeTo(claimable, ethers.parseUnits("0.01", DECIMALS));
        });

        it("non-employee cannot claim", async function () {
            await createStream();
            await time.increase(ONE_MONTH / 2);
            await expect(streamVault.connect(other).claimVested(0))
                .to.be.revertedWith("Not the stream recipient");
        });

        it("cannot stream to self", async function () {
            await expect(
                streamVault.connect(employer).createStream(
                    employer.address, await mockUSDC.getAddress(), STREAM_AMOUNT, ONE_MONTH, 0, ""
                )
            ).to.be.revertedWith("Cannot stream to yourself");
        });

        it("tracks streams for employer and employee", async function () {
            await createStream();
            const empStreams = await streamVault.getEmployerStreams(employer.address);
            const eeStreams  = await streamVault.getEmployeeStreams(employee.address);
            expect(empStreams.length).to.equal(1);
            expect(eeStreams.length).to.equal(1);
            expect(empStreams[0]).to.equal(0n);
        });
    });

    // ─── RWAYieldRouter (ERC-4626) ────────────────────────────────────────────

    describe("RWAYieldRouter", function () {
        it("correct APY per tier in bps", async function () {
            expect(await rwaRouter.getTierAPY(0)).to.equal(400n);
            expect(await rwaRouter.getTierAPY(1)).to.equal(800n);
            expect(await rwaRouter.getTierAPY(2)).to.equal(1200n);
        });

        it("exposes ERC-4626 vault address for each tier", async function () {
            const stable   = await rwaRouter.getVaultAddress(0);
            const balanced = await rwaRouter.getVaultAddress(1);
            const growth   = await rwaRouter.getVaultAddress(2);
            expect(stable).to.not.equal(ethers.ZeroAddress);
            expect(balanced).to.not.equal(ethers.ZeroAddress);
            expect(growth).to.not.equal(ethers.ZeroAddress);
            // All different vault contracts
            expect(stable).to.not.equal(balanced);
            expect(balanced).to.not.equal(growth);
        });

        it("unauthorized cannot call deposit directly", async function () {
            await expect(
                rwaRouter.connect(other).deposit(
                    await mockUSDC.getAddress(), 100n, 0, 0
                )
            ).to.be.revertedWith("Only StreamVault");
        });

        it("stream creation deposits into ERC-4626 vault", async function () {
            await streamVault.connect(employer).createStream(
                employee.address,
                await mockUSDC.getAddress(),
                STREAM_AMOUNT,
                ONE_MONTH,
                1, // Balanced vault
                "Balanced vault — AI selected"
            );
            const vaultAddr = await rwaRouter.getVaultAddress(1);
            const bal = await mockUSDC.balanceOf(vaultAddr);
            expect(bal).to.equal(STREAM_AMOUNT);
        });
    });

    // ─── HSPSettlementEmitter (Lifecycle State Machine) ───────────────────────

    describe("HSPSettlementEmitter", function () {
        it("stream creation creates and express-settles an HSP record", async function () {
            await streamVault.connect(employer).createStream(
                employee.address,
                await mockUSDC.getAddress(),
                STREAM_AMOUNT,
                ONE_MONTH,
                0,
                "Stable vault"
            );
            // settlementCount starts at 1 after first creation
            expect(await hspEmitter.settlementCount()).to.equal(1n);
            const s = await hspEmitter.getSettlement(1);
            expect(s.status).to.equal(2); // 2 = SETTLED (express-settled)
            expect(s.employer).to.equal(employer.address);
            expect(s.amount).to.equal(STREAM_AMOUNT);
        });

        it("claim creates a second STREAM_CLAIMED settlement", async function () {
            await streamVault.connect(employer).createStream(
                employee.address,
                await mockUSDC.getAddress(),
                STREAM_AMOUNT,
                ONE_MONTH,
                0,
                "Stable vault"
            );
            await time.increase(ONE_MONTH / 2);
            await streamVault.connect(employee).claimVested(0);
            expect(await hspEmitter.settlementCount()).to.equal(2n);
            const s = await hspEmitter.getSettlement(2);
            expect(s.status).to.equal(2); // SETTLED
            expect(s.employee).to.equal(employee.address);
        });

        it("verifyProof returns true for a valid settlement", async function () {
            await streamVault.connect(employer).createStream(
                employee.address,
                await mockUSDC.getAddress(),
                STREAM_AMOUNT,
                ONE_MONTH,
                0,
                "Stable vault"
            );
            const [valid] = await hspEmitter.verifyProof(1);
            expect(valid).to.be.true;
        });

        it("unauthorized cannot call createSettlement directly", async function () {
            await expect(
                hspEmitter.connect(other).createSettlement(
                    employer.address,
                    employee.address,
                    await mockUSDC.getAddress(),
                    STREAM_AMOUNT,
                    0,
                    0
                )
            ).to.be.revertedWith("HSP: Not authorized");
        });
    });
});
