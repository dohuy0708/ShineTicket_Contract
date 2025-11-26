import { network } from "hardhat";
const { ethers, networkName } = await network.connect();

async function main() {
  console.log(`\n🚀 Starting deployment to network: ${networkName}...`);

  // 2. Lấy thông tin người deploy
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 3. Kiểm tra số dư (quan trọng để tránh lỗi thiếu gas mà không biết)
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "POL/MATIC");

  if (balance === 0n && network.name !== "hardhat") {
    console.error("❌ Error: Ví không có tiền. Vui lòng nạp faucet!");
    return;
  }

  // 4. Deploy Contract
  const ShineTicket = await ethers.getContractFactory("ShineTicket");
  // Nếu constructor có tham số, truyền vào đây. Ví dụ: .deploy(deployer.address)
  const shineTicket = await ShineTicket.deploy(deployer.address);

  console.log("⏳ Waiting for deployment confirmation...");

  // Chờ transaction được confirm
  await shineTicket.waitForDeployment();

  const address = await shineTicket.getAddress();

  console.log("\n----------------------------------------------------");
  console.log("✅ SUCCESS! ShineTicket deployed to:", address);
  console.log("----------------------------------------------------");

  // 5. Verify code (Chỉ chạy khi không phải mạng local)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("⏳ Waiting 15s for block propagation...");
    await new Promise((resolve) => setTimeout(resolve, 15000));

    try {
      console.log("Verifying contract...");
      await run("verify:verify", {
        address: address,
        constructorArguments: [deployer.address],
      });
      console.log("✅ Contract verified successfully!");
    } catch (error) {
      console.log("⚠️ Verification failed:", error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
