import hre from "hardhat";
import { writeFileSync } from "fs";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying StreamYield contracts with:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", hre.ethers.formatEther(balance), "HSK");

    // 1. Deploy MockUSDC
    console.log("\n📦 Deploying MockUSDC...");
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    console.log("✅ MockUSDC deployed to:", await mockUSDC.getAddress());

    // 2. Deploy RWAYieldRouter
    console.log("\n📦 Deploying RWAYieldRouter...");
    const RWAYieldRouter = await hre.ethers.getContractFactory("RWAYieldRouter");
    const rwaRouter = await RWAYieldRouter.deploy();
    await rwaRouter.waitForDeployment();
    console.log("✅ RWAYieldRouter deployed to:", await rwaRouter.getAddress());

    // 3. Deploy StreamVault (needs RWAYieldRouter address)
    console.log("\n📦 Deploying StreamVault...");
    const StreamVault = await hre.ethers.getContractFactory("StreamVault");
    const streamVault = await StreamVault.deploy(await rwaRouter.getAddress());
    await streamVault.waitForDeployment();
    console.log("✅ StreamVault deployed to:", await streamVault.getAddress());

    // 4. Deploy HSPSettlementEmitter (needs StreamVault address)
    console.log("\n📦 Deploying HSPSettlementEmitter...");
    const HSPSettlementEmitter = await hre.ethers.getContractFactory("HSPSettlementEmitter");
    const hspEmitter = await HSPSettlementEmitter.deploy(await streamVault.getAddress());
    await hspEmitter.waitForDeployment();
    console.log("✅ HSPSettlementEmitter deployed to:", await hspEmitter.getAddress());

    // 5. Link contracts
    console.log("\n🔗 Linking contracts...");
    const tx = await rwaRouter.setStreamVault(await streamVault.getAddress());
    await tx.wait();
    console.log("✅ RWAYieldRouter linked to StreamVault");

    // 6. Print deployment summary
    console.log("\n🎉 ══════════ DEPLOYMENT COMPLETE ══════════");
    console.log("Network:              HashKey Chain Testnet (Chain ID 133)");
    console.log("MockUSDC:            ", await mockUSDC.getAddress());
    console.log("RWAYieldRouter:      ", await rwaRouter.getAddress());
    console.log("StreamVault:         ", await streamVault.getAddress());
    console.log("HSPSettlementEmitter:", await hspEmitter.getAddress());
    console.log("\n🔍 Verify at: https://testnet-explorer.hsk.xyz");
    console.log("════════════════════════════════════════════\n");

    const addresses = {
        network: "hashkeyTestnet",
        chainId: 133,
        MockUSDC: await mockUSDC.getAddress(),
        RWAYieldRouter: await rwaRouter.getAddress(),
        StreamVault: await streamVault.getAddress(),
        HSPSettlementEmitter: await hspEmitter.getAddress(),
        deployedAt: new Date().toISOString(),
    };
    writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));
    console.log("📄 Addresses saved to deployed-addresses.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
