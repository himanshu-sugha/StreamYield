const hre = require("hardhat");
const { writeFileSync } = require("fs");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying StreamYield contracts with:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", hre.ethers.formatEther(balance), "HSK");

    // ── 1. Deploy MockUSDC ────────────────────────────────────────────────────
    console.log("\n📦 Deploying MockUSDC...");
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    const mockUSDCAddr = await mockUSDC.getAddress();
    console.log("✅ MockUSDC deployed to:", mockUSDCAddr);

    // ── 2. Deploy RWAYieldRouter (ERC-4626) ───────────────────────────────────
    // Constructor takes the underlying token address — creates 3 ERC-4626 sub-vaults
    console.log("\n📦 Deploying RWAYieldRouter (ERC-4626)...");
    const RWAYieldRouter = await hre.ethers.getContractFactory("RWAYieldRouter");
    const rwaRouter = await RWAYieldRouter.deploy(mockUSDCAddr);
    await rwaRouter.waitForDeployment();
    const rwaRouterAddr = await rwaRouter.getAddress();
    console.log("✅ RWAYieldRouter deployed to:", rwaRouterAddr);

    // Print sub-vault addresses for reference
    const stableVault   = await rwaRouter.getVaultAddress(0);
    const balancedVault = await rwaRouter.getVaultAddress(1);
    const growthVault   = await rwaRouter.getVaultAddress(2);
    console.log("   └─ Stable Vault (4%):   ", stableVault);
    console.log("   └─ Balanced Vault (8%): ", balancedVault);
    console.log("   └─ Growth Vault (12%):  ", growthVault);

    // ── 3. Deploy StreamVault ─────────────────────────────────────────────────
    console.log("\n📦 Deploying StreamVault...");
    const StreamVault = await hre.ethers.getContractFactory("StreamVault");
    const streamVault = await StreamVault.deploy(rwaRouterAddr);
    await streamVault.waitForDeployment();
    const streamVaultAddr = await streamVault.getAddress();
    console.log("✅ StreamVault deployed to:", streamVaultAddr);

    // ── 4. Deploy HSPSettlementEmitter ────────────────────────────────────────
    console.log("\n📦 Deploying HSPSettlementEmitter (HSP State Machine)...");
    const HSPSettlementEmitter = await hre.ethers.getContractFactory("HSPSettlementEmitter");
    const hspEmitter = await HSPSettlementEmitter.deploy();
    await hspEmitter.waitForDeployment();
    const hspEmitterAddr = await hspEmitter.getAddress();
    console.log("✅ HSPSettlementEmitter deployed to:", hspEmitterAddr);

    // ── 5. Link all contracts ─────────────────────────────────────────────────
    console.log("\n🔗 Linking contracts...");

    let tx = await rwaRouter.setStreamVault(streamVaultAddr);
    await tx.wait();
    console.log("✅ RWAYieldRouter → StreamVault linked");

    tx = await hspEmitter.setStreamVault(streamVaultAddr);
    await tx.wait();
    console.log("✅ HSPSettlementEmitter → StreamVault linked");

    tx = await streamVault.setHSPEmitter(hspEmitterAddr);
    await tx.wait();
    console.log("✅ StreamVault → HSPSettlementEmitter linked");

    // ── 6. Deployment summary ─────────────────────────────────────────────────
    console.log("\n🎉 ══════════ DEPLOYMENT COMPLETE ══════════");
    console.log("Network:              HashKey Chain Testnet (Chain ID 133)");
    console.log("MockUSDC:            ", mockUSDCAddr);
    console.log("RWAYieldRouter:      ", rwaRouterAddr);
    console.log("StreamVault:         ", streamVaultAddr);
    console.log("HSPSettlementEmitter:", hspEmitterAddr);
    console.log(" ");
    console.log("ERC-4626 Sub-Vaults:");
    console.log("  Stable   (4%):     ", stableVault);
    console.log("  Balanced (8%):     ", balancedVault);
    console.log("  Growth   (12%):    ", growthVault);
    console.log("\n🔍 Verify at: https://testnet-explorer.hsk.xyz");
    console.log("════════════════════════════════════════════\n");

    const addresses = {
        network:              "hashkeyTestnet",
        chainId:              133,
        deployedAt:           new Date().toISOString(),
        MockUSDC:             mockUSDCAddr,
        RWAYieldRouter:       rwaRouterAddr,
        StreamVault:          streamVaultAddr,
        HSPSettlementEmitter: hspEmitterAddr,
        erc4626Vaults: {
            stable:   stableVault,
            balanced: balancedVault,
            growth:   growthVault,
        },
    };
    writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));
    console.log("📄 Addresses saved to deployed-addresses.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
