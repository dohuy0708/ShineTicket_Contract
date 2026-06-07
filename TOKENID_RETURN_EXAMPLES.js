// 📄 EXAMPLE: Lấy TokenIds từ hàm Batch Buy

// ============================================
// 🟢 CÁCH 1: Parse Transfer Events từ Receipt
// ============================================

async function batchBuyAndGetTokenIds(
  contract,
  eventIds,
  quantities,
  recipientAddress,
) {
  console.log("📌 Gọi batchBuyTickets...");
  const tx = await contract.batchBuyTickets(
    eventIds,
    quantities,
    recipientAddress,
  );

  console.log("⏳ Chờ transaction xác nhận...");
  const receipt = await tx.wait();

  const tokenIds = [];
  const iface = contract.interface;

  // Parse tất cả logs để tìm Transfer events
  receipt.logs.forEach((log) => {
    try {
      const parsed = iface.parseLog(log);

      // Transfer event có:
      // - from = ZeroAddress (0x00...00) khi mint
      // - to = người nhận
      // - tokenId = id vé
      if (parsed.name === "Transfer") {
        const from = parsed.args.from;
        const to = parsed.args.to;
        const tokenId = parsed.args.tokenId;

        // ✅ Lọc chỉ các Transfer mới được mint (from = 0x00...)
        if (from === "0x0000000000000000000000000000000000000000") {
          tokenIds.push({
            id: tokenId.toString(),
            to: to,
            timestamp: receipt.blockNumber,
          });
        }
      }
    } catch (e) {
      // Log không phải từ ShineTicket contract
    }
  });

  console.log(`✅ Mint thành công ${tokenIds.length} vé`);
  console.log(
    "TokenIds:",
    tokenIds.map((t) => t.id),
  );

  return tokenIds;
}

// 📌 CÁCH DÙNG:
/*
const eventIds = [5, 7, 9];           // 3 loại vé
const quantities = [3, 2, 2];         // Mua 3+2+2=7 vé
const recipient = "0x1234...abcd";    // Địa chỉ nhận vé

const minted = await batchBuyAndGetTokenIds(
    shineTicketContract,
    eventIds,
    quantities,
    recipient
);

// Output:
// ✅ Mint thành công 7 vé
// TokenIds: ['100', '101', '102', '103', '104', '105', '106']
*/

// ============================================
// 🟠 CÁCH 2: Query _nextTokenId() Trước & Sau
// ============================================

async function batchBuyWithIdTracking(
  contract,
  eventIds,
  quantities,
  recipientAddress,
) {
  console.log("📌 Query startTokenId...");
  const startTokenId = await contract._nextTokenId();
  console.log(`   startTokenId = ${startTokenId}`);

  // Tính tổng số lượng vé
  const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
  console.log(`   Sẽ mint ${totalQuantity} vé`);

  console.log("📌 Gọi batchBuyTickets...");
  const tx = await contract.batchBuyTickets(
    eventIds,
    quantities,
    recipientAddress,
  );

  console.log("⏳ Chờ transaction xác nhận...");
  await tx.wait();

  // Tất cả tokenIds sẽ là liên tiếp
  const tokenIds = [];
  for (let i = 0; i < totalQuantity; i++) {
    tokenIds.push(startTokenId + i);
  }

  console.log(`✅ Mint thành công`);
  console.log(
    "TokenIds:",
    tokenIds.map((id) => id.toString()),
  );

  return tokenIds;
}

// ⚠️ LƯU Ý: Cách này cho biết tokenIds liên tiếp,
// nhưng KHÔNG biết tokenId nào cho eventId nào

// ============================================
// 🔵 CÁCH 3: Hybrid - Track từng EventId
// ============================================

async function batchBuyWithEventTracking(
  contract,
  eventIds,
  quantities,
  recipientAddress,
) {
  const result = {
    totalMinted: 0,
    byEvent: {}, // { eventId: [tokenIds] }
  };

  const startTokenId = await contract._nextTokenId();
  let currentId = BigInt(startTokenId);

  console.log("📌 Gọi batchBuyTickets...");
  const tx = await contract.batchBuyTickets(
    eventIds,
    quantities,
    recipientAddress,
  );

  console.log("⏳ Chờ transaction xác nhận...");
  await tx.wait();

  // Map lại từng eventId → tokenIds
  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i].toString();
    const qty = quantities[i];

    const tokenIds = [];
    for (let j = 0; j < qty; j++) {
      tokenIds.push(currentId.toString());
      currentId++;
    }

    result.byEvent[eventId] = tokenIds;
    result.totalMinted += qty;

    console.log(`   EventId ${eventId}: ${tokenIds.join(", ")}`);
  }

  console.log(`✅ Mint thành công ${result.totalMinted} vé`);
  return result;
}

// 📌 CÁCH DÙNG:
/*
const eventIds = [5, 7, 9];
const quantities = [3, 2, 2];

const result = await batchBuyWithEventTracking(
    contract,
    eventIds,
    quantities,
    recipient
);

// Output:
// EventId 5: 100, 101, 102
// EventId 7: 103, 104
// EventId 9: 105, 106
// ✅ Mint thành công 7 vé

result.byEvent['5']  // ['100', '101', '102']
result.byEvent['7']  // ['103', '104']
*/

// ============================================
// 🟣 CÁCH 4: Batch Relayer Buy (Dành cho Admin)
// ============================================

async function batchRelayerBuyAndGetTokenIds(
  contract,
  eventIds,
  quantities,
  buyerAddress, // Khách mua (chuyển khoản VNĐ)
  relayerSigner, // Relayer ký (có role DEFAULT_ADMIN_ROLE)
) {
  console.log("📌 Query startTokenId...");
  const startTokenId = await contract._nextTokenId();

  const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);

  console.log(`📌 Relayer gọi batchRelayerBuyTicket...`);
  console.log(`   Buyer: ${buyerAddress}`);
  console.log(`   Mint ${totalQuantity} vé`);

  // ⚠️ Relayer phải signed với admin account
  const contractAsRelayer = contract.connect(relayerSigner);

  const tx = await contractAsRelayer.batchRelayerBuyTicket(
    eventIds,
    quantities,
    buyerAddress,
  );

  console.log("⏳ Chờ transaction xác nhận...");
  const receipt = await tx.wait();

  // Track từng eventId
  const result = {
    totalMinted: 0,
    byEvent: {},
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  };

  let currentId = BigInt(startTokenId);

  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i].toString();
    const qty = quantities[i];

    const tokenIds = [];
    for (let j = 0; j < qty; j++) {
      tokenIds.push(currentId.toString());
      currentId++;
    }

    result.byEvent[eventId] = tokenIds;
    result.totalMinted += qty;
  }

  console.log(
    `✅ Mint thành công ${result.totalMinted} vé cho ${buyerAddress}`,
  );
  return result;
}

// ============================================
// 📊 SO SÁNH 3 CÁCH
// ============================================

/*
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Tiêu chí    │   Cách 1     │   Cách 2     │   Cách 3     │   Cách 4     │
│             │ Parse Event  │ Query Before │   Hybrid     │   Relayer    │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Độ phức tạp │      🔴 Cao  │      🟢 Thấp │      🟡 TB   │      🟡 TB   │
│ Gas cost    │     🟢 Rẻ    │     🔴 Đắt   │     🟢 Rẻ    │     🟢 Rẻ    │
│ Độ chính xác│    🟢 100%   │    🟢 100%   │    🟢 100%   │    🟢 100%   │
│ Biết event  │      ❌      │      ❌      │      ✅      │      ✅      │
│ Thích hợp   │   Production │   Quick test │   Tracking   │   Relayer    │
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘

🟢 Cách 1 (Parse Event): Tốt nhất cho production
   ✅ Chính xác 100% (từ on-chain)
   ✅ Biết eventId nào cho tokenId nào
   ✅ Gas rẻ (không query thêm)
   ❌ Parse log phức tạp

🟢 Cách 2 (Query Before): Nhanh & đơn giản
   ✅ Code đơn giản
   ✅ Nhanh (không parse log)
   ❌ Query thêm 2 lần (_nextTokenId)
   ❌ KHÔNG biết eventId nào cho tokenId nào

🟡 Cách 3 (Hybrid): Balance tốt
   ✅ Biết eventId nào cho tokenId nào
   ✅ Query 1 lần trước
   ✅ Code rõ ràng
   ✅ RECOMMEND cho tracking

🟡 Cách 4: Dành riêng cho Relayer
   ✅ Tương tự Cách 3
   ✅ Thêm transaction hash & block number
   ✅ Dùng relayerSigner để sign
*/

// ============================================
// 💡 KHUYẾN NGHỊ CUỐI CÙNG
// ============================================

/*
1. 🏆 BEST PRACTICE:
   → Dùng CÁCH 3 (Hybrid) cho cả Regular Buy & Relayer Buy
   → Tính toán eventId → tokenIds trước gọi hàm
   → Không phụ thuộc vào parsing event (nhanh hơn)

2. 🔄 ĐỀ XUẤT THÊM VÀO SC:
   → Thêm return value cho hàm batch
   → Emit event khi mint xong (với startTokenId + quantity)
   → Giúp frontend dễ dàng hơn

3. 🔒 BẢO MẬT:
   → Luôn kiểm tra receipt.status === 1 (success)
   → Luôn verify recipient address trước mint
   → Log transaction hash để audit

4. 📱 FE BEST PRACTICE:
   → Store tokenIds vào database sau mint
   → Link với orderId để tracking order
   → Show user danh sách vé đã mua ngay
*/
