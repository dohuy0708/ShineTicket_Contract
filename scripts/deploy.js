import { network } from "hardhat";
const { ethers, networkName } = await network.connect();

async function main() {
  console.log(`\nStarting deployment to network: ${networkName}...`);

  // 2. Lấy thông tin người deploy
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 3. Kiểm tra số dư (quan trọng để tránh lỗi thiếu gas mà không biết)
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "POL/MATIC");

  if (
    balance === 0n &&
    networkName !== "hardhat" &&
    networkName !== "hardhatMainnet"
  ) {
    console.error("Error: deployer has no native token for gas.");
    return;
  }

  // 3. Resolve USDT address
  let usdtAddress = process.env.USDT_TOKEN_ADDRESS;
  if (!usdtAddress) {
    console.log("No USDT_TOKEN_ADDRESS provided. Deploying MockUSDT...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    usdtAddress = await mockUSDT.getAddress();
    console.log("MockUSDT deployed to:", usdtAddress);
  }

  // 4. Deploy ShineTicket
  const ShineTicket = await ethers.getContractFactory("ShineTicket");
  const shineTicket = await ShineTicket.deploy(deployer.address, usdtAddress);

  console.log("⏳ Waiting for deployment confirmation...");

  // Chờ transaction được confirm
  await shineTicket.waitForDeployment();

  const address = await shineTicket.getAddress();

  console.log("----------------------------------------");
  console.log("ShineTicket deployed to:", address);
  console.log("USDT token address:", usdtAddress);
  console.log("----------------------------------------");

  // 5. Grant default roles
  const OPERATOR_ROLE = ethers.id("OPERATOR_ROLE");
  const ORGANIZER_ROLE = ethers.id("ORGANIZER_ROLE");
  const MARKETPLACE_ROLE = ethers.id("MARKETPLACE_ROLE");

  const operatorAddress = process.env.OPERATOR_ADDRESS || deployer.address;
  const organizerAddress = process.env.ORGANIZER_ADDRESS || deployer.address;
  const marketplaceAddress =
    process.env.MARKETPLACE_ADDRESS || deployer.address;

  await (await shineTicket.grantRole(OPERATOR_ROLE, operatorAddress)).wait();
  await (await shineTicket.grantRole(ORGANIZER_ROLE, organizerAddress)).wait();
  await (
    await shineTicket.grantRole(MARKETPLACE_ROLE, marketplaceAddress)
  ).wait();

  console.log("Default roles granted:");
  console.log("OPERATOR_ROLE:", operatorAddress);
  console.log("ORGANIZER_ROLE:", organizerAddress);
  console.log("MARKETPLACE_ROLE:", marketplaceAddress);

  // 6. Verify code (Chỉ chạy khi không phải mạng local)
  if (
    networkName !== "hardhat" &&
    networkName !== "localhost" &&
    networkName !== "hardhatMainnet"
  ) {
    console.log(
      "Verification step skipped in script. Run verify manually with constructor args:",
    );
    console.log(`[\"${deployer.address}\", \"${usdtAddress}\"]`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
