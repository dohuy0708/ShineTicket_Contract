const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

// Load ABI (Hãy đảm bảo đã npx hardhat compile trước để có file này)
const ShineMarketplaceJSON = require("../artifacts/contracts/ShineMarketplace.sol/ShineMarketplace.json");
const ShineMarketplaceABI = ShineMarketplaceJSON.abi;

async function main() {
    // 1. Cấu hình Provider
    const rpcUrl = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 2. Lấy thông tin từ .env
    const marketplaceAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS;
    const BE_WEBHOOK_URL = process.env.BE_WEBHOOK_URL || "http://localhost:3000";

    if (!marketplaceAddress) {
        console.error("❌ Thiếu biến MARKETPLACE_CONTRACT_ADDRESS trong .env");
        return;
    }

    const marketplaceContract = new ethers.Contract(marketplaceAddress, ShineMarketplaceABI, provider);
    console.log(`📡 Bắt đầu lắng nghe sự kiện trên Marketplace: ${marketplaceAddress}`);

    // --- Lắng nghe sự kiện TicketListed ---
    marketplaceContract.on("TicketListed", async (tokenId, seller, price, fundReceiver, event) => {
        console.log(`🎫 [TicketListed] ID: ${tokenId} | Price: ${ethers.formatUnits(price, 6)} USDT | Seller: ${seller}`);
        try {
            await axios.post(`${BE_WEBHOOK_URL}/api/webhook/marketplace/listed`, {
                tokenId: tokenId.toString(),
                price: price.toString(),
                seller: seller,
                fundReceiver: fundReceiver,
                transactionHash: event.log.transactionHash
            });
            console.log("✅ Webhook Listed: Thành công");
        } catch (error) {
            console.error("❌ Webhook Listed: Thất bại", error.message);
        }
    });

    // --- Lắng nghe sự kiện TicketCanceled ---
    marketplaceContract.on("TicketCanceled", async (tokenId, seller, event) => {
        console.log(`🚫 [TicketCanceled] ID: ${tokenId} | Seller: ${seller}`);
        try {
            await axios.post(`${BE_WEBHOOK_URL}/api/webhook/marketplace/canceled`, {
                tokenId: tokenId.toString(),
                seller: seller,
                transactionHash: event.log.transactionHash
            });
            console.log("✅ Webhook Canceled: Thành công");
        } catch (error) {
            console.error("❌ Webhook Canceled: Thất bại", error.message);
        }
    });

    // --- Lắng nghe sự kiện TicketSold ---
    marketplaceContract.on("TicketSold", async (tokenId, buyerPrivy, price, fundReceiver, event) => {
        console.log(`💰 [TicketSold] ID: ${tokenId} | Buyer: ${buyerPrivy} | Price: ${ethers.formatUnits(price, 6)} USDT`);
        try {
            await axios.post(`${BE_WEBHOOK_URL}/api/webhook/marketplace/sold`, {
                tokenId: tokenId.toString(),
                buyerPrivy: buyerPrivy,
                price: price.toString(),
                fundReceiver: fundReceiver,
                transactionHash: event.log.transactionHash
            });
            console.log("✅ Webhook Sold: Thành công");
        } catch (error) {
            console.error("❌ Webhook Sold: Thất bại", error.message);
        }
    });
}

main().catch((error) => {
    console.error("Lỗi khi khởi chạy Listener:", error);
    process.exitCode = 1;
});
