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

        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        const RWAYieldRouter = await ethers.getContractFactory("RWAYieldRouter");
        rwaRouter = await RWAYieldRouter.deploy();

        const StreamVault = await ethers.getContractFactory("StreamVault");
        streamVault = await StreamVault.deploy(await rwaRouter.getAddress());

        const HSPSettlementEmitter = await ethers.getContractFactory("HSPSettlementEmitter");
        hspEmitter = await HSPSettlementEmitter.deploy(await streamVault.getAddress());

        await rwaRouter.setStreamVault(await streamVault.getAddress());
        await mockUSDC.faucet(employer.address, ethers.parseUnits("10000", DECIMALS));
        await mockUSDC.connect(employer).approve(await streamVault.getAddress(), STREAM_AMOUNT);
    });

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

    describe("StreamVault", function () {
        async function createStream(tier = 0, reasoning = "Stable vault") {
            return streamVault.connect(employer).createStream(
                employee.address,
                await mockUSDC.getAddress(),
                STREAM_AMOUNT,
                ONE_MONTH,
                tier,
                reasoning
            );
        }

        it("emits StreamCreated", async function () {
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

        it("100% vested at end", async function () {
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
            await mockUSDC.connect(employer).approve(await streamVault.getAddress(), STREAM_AMOUNT);
            await expect(
                streamVault.connect(employer).createStream(
                    employer.address, await mockUSDC.getAddress(), STREAM_AMOUNT, ONE_MONTH, 0, ""
                )
            ).to.be.revertedWith("Cannot stream to yourself");
        });
    });

    describe("RWAYieldRouter", function () {
        it("correct APY per tier", async function () {
            expect(await rwaRouter.getTierAPY(0)).to.equal(400n);
            expect(await rwaRouter.getTierAPY(1)).to.equal(800n);
            expect(await rwaRouter.getTierAPY(2)).to.equal(1200n);
        });
        it("correct tier names", async function () {
            expect(await rwaRouter.getTierName(0)).to.equal("Stable (4% APY)");
            expect(await rwaRouter.getTierName(1)).to.equal("Balanced (8% APY)");
            expect(await rwaRouter.getTierName(2)).to.equal("Growth (12% APY)");
        });
        it("unauthorized cannot deposit", async function () {
            await expect(
                rwaRouter.connect(other).deposit(await mockUSDC.getAddress(), 100n, 0)
            ).to.be.revertedWith("Only StreamVault");
        });
    });

    describe("HSPSettlementEmitter", function () {
        it("emits HSPSettlementEmitted event", async function () {
            await expect(
                hspEmitter.emitSettlement(employer.address, employee.address, STREAM_AMOUNT, "mUSDC", 0, 0)
            ).to.emit(hspEmitter, "HSPSettlementEmitted");
        });
        it("stores and retrieves settlement data", async function () {
            await hspEmitter.emitSettlement(employer.address, employee.address, STREAM_AMOUNT, "mUSDC", 0, 1);
            const s = await hspEmitter.getSettlement(0);
            expect(s.sender).to.equal(employer.address);
            expect(s.recipient).to.equal(employee.address);
            expect(s.amount).to.equal(STREAM_AMOUNT);
            expect(s.currency).to.equal("mUSDC");
        });
    });
});
