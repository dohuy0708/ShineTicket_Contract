import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("🚀 Bắt đầu deploy ShineTicket V2 (Lazy Minting)...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Tài khoản deploy:", deployer.address);
  console.log("Số dư (ETH):", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || deployer.address;
  const USDT_ADDRESS = process.env.USDT_ADDRESS;

  if (!USDT_ADDRESS) {
    throw new Error("❌ Không tìm thấy USDT_ADDRESS trong file .env!");
  }

  console.log("Config: ");
  console.log("- Admin/Treasury:", ADMIN_ADDRESS);
  console.log("- USDT Token:", USDT_ADDRESS);

  // Deploy Contract
  const ShineTicket = await hre.ethers.getContractFactory("ShineTicket");
  const shineTicket = await ShineTicket.deploy(ADMIN_ADDRESS, USDT_ADDRESS);
  await shineTicket.waitForDeployment();

  const contractAddress = await shineTicket.getAddress();
  console.log("\n✅ Đã deploy ShineTicket V2 thành công tại địa chỉ:", contractAddress);
  
  // Save address for verification or usage
  const info = {
    address: contractAddress,
    admin: ADMIN_ADDRESS,
    usdt: USDT_ADDRESS,
    network: hre.network.name
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployed_v2.json"),
    JSON.stringify(info, null, 2)
  );

  console.log("\n⚠️ QUAN TRỌNG: Hãy copy địa chỉ này và cập nhật vào file .env của các thư mục sau:");
  console.log("1. DA2_KL_BE (.env -> CONTRACT_ADDRESS)");
  console.log("2. ShineTicket_Worker (.env -> CONTRACT_ADDRESS)");
  console.log("3. DA2_KL_FE (src/constants/web3.js -> CONTRACT_ADDRESS)");
  
  console.log("\nLưu ý: Bạn cũng cần chạy script cấp quyền OPERATOR_ROLE cho ví của Worker nữa nhé!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
