// 🎯 QUICK REFERENCE - MUA VÉ BATCH

// ════════════════════════════════════════════════════════════════
// 📊 BẢNG TÓMMẮT CÁC HÀM
// ════════════════════════════════════════════════════════════════

/*
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│   buyTicket()    │ batchBuyTickets()│relayerBuyTicket()│batchRelayerBuy() │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Tham số:         │ Tham số:         │ Tham số:         │ Tham số:         │
│ - eventId        │ - eventIds[]     │ - eventId        │ - eventIds[]     │
│ - quantity       │ - quantities[]   │ - quantity       │ - quantities[]   │
│ - recipient      │ - recipient      │ - buyerAddress   │ - buyerAddress   │
│                  │                  │                  │                  │
│ Return: void     │ Return: void     │ Return: void     │ Return: void     │
│                  │                  │                  │                  │
│ Caller: Any      │ Caller: Any      │ Caller: Admin    │ Caller: Admin    │
│ (Public)         │ (Public)         │ ONLY (Relayer)   │ ONLY (Relayer)   │
│                  │                  │                  │                  │
│ Payer:           │ Payer:           │ Payer:           │ Payer:           │
│ msg.sender       │ msg.sender       │ msg.sender       │ msg.sender       │
│ (User)           │ (User)           │ (Relayer)        │ (Relayer)        │
│                  │                  │                  │                  │
│ Receiver:        │ Receiver:        │ Receiver:        │ Receiver:        │
│ recipient param  │ recipient param  │ buyerAddress     │ buyerAddress     │
│                  │                  │ param (Khách)    │ param (Khách)    │
│                  │                  │                  │                  │
│ Số eventId: 1    │ Số eventId: N    │ Số eventId: 1    │ Số eventId: N    │
│ (Đơn vị)         │ (Batch)          │ (Đơn vị)         │ (Batch)          │
│                  │                  │                  │                  │
│ tokenId pattern: │ tokenId pattern: │ tokenId pattern: │ tokenId pattern: │
│ Sequential       │ Sequential       │ Sequential       │ Sequential       │
│ (liên tiếp)      │ (liên tiếp)      │ (liên tiếp)      │ (liên tiếp)      │
│                  │                  │                  │                  │
│ Transfer USDT:   │ Transfer USDT:   │ Transfer USDT:   │ Transfer USDT:   │
│ 1 lần, qty*price │ 1 lần, tổng price│ 1 lần, qty*price │ 1 lần, tổng price│
│                  │                  │                  │                  │
│ State changes:   │ State changes:   │ State changes:   │ State changes:   │
│ - eventRevenue   │ - eventRevenue   │ - eventRevenue   │ - eventRevenue   │
│   (1 record)     │   (N records)    │   (1 record)     │   (N records)    │
│                  │                  │                  │                  │
│                  │                  │ - eventRelayer   │ - eventRelayer   │
│                  │                  │   SoldCount      │   SoldCount      │
│                  │                  │   (1 record)     │   (N records)    │
│                  │                  │                  │                  │
│ Use case:        │ Use case:        │ Use case:        │ Use case:        │
│ User mua 1 loại  │ User mua 3 loại  │ Relayer mua hộ   │ Relayer mua hộ   │
│ vé qua crypto    │ vé khác nhau     │ khách 1 loại     │ khách 3 loại vé  │
│                  │ qua crypto       │ via chuyển khoản │ via chuyển khoản │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
*/

// ════════════════════════════════════════════════════════════════
// 🎬 CODE SAMPLE HOÀN CHỈNH
// ════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ✅ SAMPLE 1: Buy đơn lẻ (Khách + Crypto)
// ═══════════════════════════════════════════════════════════════

async function sampleBuyTicket() {
  // Input
  const eventId = 5;
  const quantity = 3;
  const recipientAddress = "0x1234567890abcdef1234567890abcdef12345678";
  const eventPrice = ethers.parseUnits("100", 6); // 100 USDT (6 decimals)

  const shineTicketAddress = "0xShineTicketContractAddress";
  const usdtAddress = "0xUSDTContractAddress";

  // Setup signer
  const signer = new ethers.Wallet(privateKey, provider);

  // 1. APPROVE USDT
  console.log("1️⃣  Approving USDT...");
  const totalPrice = eventPrice * BigInt(quantity);
  const usdt = new ethers.Contract(usdtAddress, ERC20_ABI, signer);
  const approveTx = await usdt.approve(shineTicketAddress, totalPrice);
  await approveTx.wait();
  console.log("✅ USDT approved");

  // 2. CALL buyTicket
  console.log("2️⃣  Calling buyTicket()...");
  const shineTicket = new ethers.Contract(
    shineTicketAddress,
    SHINE_TICKET_ABI,
    signer,
  );

  const tx = await shineTicket.buyTicket(eventId, quantity, recipientAddress);

  console.log("⏳ Waiting for transaction...");
  const receipt = await tx.wait();

  // 3. EXTRACT TOKEN IDS from Transfer events
  console.log("3️⃣  Parsing Transfer events...");
  const tokenIds = [];
  const iface = shineTicket.interface;

  receipt.logs.forEach((log) => {
    try {
      const parsed = iface.parseLog(log);
      if (
        parsed.name === "Transfer" &&
        parsed.args.from === "0x0000000000000000000000000000000000000000"
      ) {
        tokenIds.push(parsed.args.tokenId.toString());
      }
    } catch (e) {}
  });

  console.log("✅ Buy thành công!");
  console.log("📋 Result:");
  console.log(`   - EventId: ${eventId}`);
  console.log(`   - Quantity: ${quantity}`);
  console.log(`   - Total Price: ${ethers.formatUnits(totalPrice, 6)} USDT`);
  console.log(`   - Recipient: ${recipientAddress}`);
  console.log(`   - TokenIds: [${tokenIds.join(", ")}]`);
  console.log(`   - TxHash: ${receipt.transactionHash}`);

  return {
    status: "SUCCESS",
    tokenIds,
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  };
}

// ✅ CALL:
// await sampleBuyTicket();

// ═══════════════════════════════════════════════════════════════
// ✅ SAMPLE 2: Batch Buy (Khách + Crypto, 3 loại vé)
// ═══════════════════════════════════════════════════════════════

async function sampleBatchBuyTickets() {
  const eventIds = [5, 7, 9];
  const quantities = [3, 2, 2];
  const recipientAddress = "0x1234567890abcdef1234567890abcdef12345678";

  // Event prices
  const prices = {
    5: ethers.parseUnits("100", 6), // 100 USDT
    7: ethers.parseUnits("150", 6), // 150 USDT
    9: ethers.parseUnits("200", 6), // 200 USDT
  };

  // 1. Calculate total price
  console.log("1️⃣  Calculating total price...");
  let totalPriceSum = BigInt(0);
  for (let i = 0; i < eventIds.length; i++) {
    const itemPrice = prices[eventIds[i]] * BigInt(quantities[i]);
    totalPriceSum += itemPrice;
    console.log(
      `   EventId ${eventIds[i]}: ${quantities[i]} × ${ethers.formatUnits(
        prices[eventIds[i]],
        6,
      )} = ${ethers.formatUnits(itemPrice, 6)} USDT`,
    );
  }
  console.log(`   Total: ${ethers.formatUnits(totalPriceSum, 6)} USDT`);

  // 2. Approve USDT
  console.log("\n2️⃣  Approving USDT...");
  const signer = new ethers.Wallet(privateKey, provider);
  const usdt = new ethers.Contract(usdtAddress, ERC20_ABI, signer);
  const approveTx = await usdt.approve(shineTicketAddress, totalPriceSum);
  await approveTx.wait();
  console.log("✅ USDT approved");

  // 3. Get startTokenId BEFORE
  console.log("\n3️⃣  Getting startTokenId...");
  const shineTicket = new ethers.Contract(
    shineTicketAddress,
    SHINE_TICKET_ABI,
    signer,
  );

  const startTokenId = await shineTicket._nextTokenId();
  console.log(`   startTokenId = ${startTokenId}`);

  // 4. Call batchBuyTickets
  console.log("\n4️⃣  Calling batchBuyTickets()...");
  const tx = await shineTicket.batchBuyTickets(
    eventIds,
    quantities,
    recipientAddress,
  );

  console.log("⏳ Waiting for transaction...");
  const receipt = await tx.wait();

  // 5. Track tokenIds per eventId
  console.log("\n5️⃣  Mapping tokenIds to eventIds...");
  const result = {
    totalMinted: 0,
    byEvent: {},
    tokenIdList: [],
  };

  let currentId = BigInt(startTokenId);

  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i];
    const qty = quantities[i];
    const tokenIds = [];

    for (let j = 0; j < qty; j++) {
      tokenIds.push(currentId.toString());
      result.tokenIdList.push(currentId.toString());
      currentId++;
    }

    result.byEvent[eventId] = tokenIds;
    result.totalMinted += qty;

    console.log(`   EventId ${eventId}: [${tokenIds.join(", ")}]`);
  }

  console.log("\n✅ Batch Buy thành công!");
  console.log(`   - Tổng vé mua: ${result.totalMinted}`);
  console.log(`   - All TokenIds: [${result.tokenIdList.join(", ")}]`);
  console.log(`   - TxHash: ${receipt.transactionHash}`);

  return {
    status: "SUCCESS",
    ...result,
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  };
}

// ✅ CALL:
// await sampleBatchBuyTickets();

// ═══════════════════════════════════════════════════════════════
// ✅ SAMPLE 3: Relayer Buy (Khách chuyển khoản VNĐ)
// ═══════════════════════════════════════════════════════════════

async function sampleRelayerBuyTicket(
  eventId,
  quantity,
  buyerAddress,
  relayerPrivateKey, // Relayer account (phải có role DEFAULT_ADMIN_ROLE)
) {
  console.log("📌 Relayer Buy Ticket");
  console.log(`   EventId: ${eventId}`);
  console.log(`   Quantity: ${quantity}`);
  console.log(`   Buyer: ${buyerAddress}`);

  // Setup relayer signer (Admin account)
  const relayerSigner = new ethers.Wallet(relayerPrivateKey, provider);
  console.log(`   Relayer: ${relayerSigner.address}`);

  // 1. Get startTokenId
  console.log("\n1️⃣  Getting startTokenId...");
  const shineTicket = new ethers.Contract(
    shineTicketAddress,
    SHINE_TICKET_ABI,
    relayerSigner, // ← Relayer signed
  );

  const startTokenId = await shineTicket._nextTokenId();
  console.log(`   startTokenId = ${startTokenId}`);

  // 2. Calculate totalPrice
  const event = await shineTicket.events(eventId);
  const price = event.price;
  const totalPrice = price * BigInt(quantity);
  console.log(
    `\n2️⃣  Calculated price: ${ethers.formatUnits(totalPrice, 6)} USDT`,
  );

  // 3. Call relayerBuyTicket
  console.log("\n3️⃣  Calling relayerBuyTicket()...");
  console.log("   ⚠️  msg.sender = Relayer (Admin)");
  console.log("   ⚠️  Relayer will pay USDT");

  const tx = await shineTicket.relayerBuyTicket(
    eventId,
    quantity,
    buyerAddress, // ← Vé nhận bởi buyer (không phải relayer!)
  );

  console.log("⏳ Waiting for transaction...");
  const receipt = await tx.wait();

  // 4. Get tokenIds
  const tokenIds = [];
  for (let i = 0; i < quantity; i++) {
    tokenIds.push((BigInt(startTokenId) + BigInt(i)).toString());
  }

  console.log("\n✅ Relayer Buy thành công!");
  console.log(`   - Relayer paid: ${ethers.formatUnits(totalPrice, 6)} USDT`);
  console.log(`   - Vé nhận bởi: ${buyerAddress}`);
  console.log(`   - TokenIds: [${tokenIds.join(", ")}]`);
  console.log(`   - TxHash: ${receipt.transactionHash}`);

  return {
    status: "SUCCESS",
    tokenIds,
    totalPrice: ethers.formatUnits(totalPrice, 6),
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  };
}

// ✅ CALL:
// await sampleRelayerBuyTicket(
//     5,                         // eventId
//     3,                         // quantity
//     "0xbuyer...",              // buyerAddress (khách)
//     relayerPrivateKey          // relayer (admin)
// );

// ═══════════════════════════════════════════════════════════════
// ✅ SAMPLE 4: Relayer Batch Buy (Relayer + 3 loại vé)
// ═══════════════════════════════════════════════════════════════

async function sampleBatchRelayerBuyTicket(
  eventIds,
  quantities,
  buyerAddress,
  relayerPrivateKey,
) {
  console.log("📌 Relayer Batch Buy Tickets");
  console.log(`   EventIds: [${eventIds.join(", ")}]`);
  console.log(`   Quantities: [${quantities.join(", ")}]`);
  console.log(`   Buyer: ${buyerAddress}`);

  const relayerSigner = new ethers.Wallet(relayerPrivateKey, provider);
  console.log(`   Relayer: ${relayerSigner.address}`);

  // 1. Get startTokenId
  console.log("\n1️⃣  Getting startTokenId...");
  const shineTicket = new ethers.Contract(
    shineTicketAddress,
    SHINE_TICKET_ABI,
    relayerSigner,
  );

  const startTokenId = await shineTicket._nextTokenId();

  // 2. Calculate total price
  console.log("\n2️⃣  Calculating total price...");
  let totalPriceSum = BigInt(0);
  const priceMap = {};

  for (let i = 0; i < eventIds.length; i++) {
    const event = await shineTicket.events(eventIds[i]);
    const itemPrice = event.price * BigInt(quantities[i]);
    totalPriceSum += itemPrice;
    priceMap[eventIds[i]] = itemPrice;

    console.log(
      `   EventId ${eventIds[i]}: ${quantities[i]} vé = ${ethers.formatUnits(
        itemPrice,
        6,
      )} USDT`,
    );
  }
  console.log(`   Total: ${ethers.formatUnits(totalPriceSum, 6)} USDT`);

  // 3. Call batchRelayerBuyTicket
  console.log("\n3️⃣  Calling batchRelayerBuyTicket()...");
  const tx = await shineTicket.batchRelayerBuyTicket(
    eventIds,
    quantities,
    buyerAddress,
  );

  console.log("⏳ Waiting for transaction...");
  const receipt = await tx.wait();

  // 4. Map tokenIds to eventIds
  console.log("\n4️⃣  Mapping tokenIds...");
  const result = {
    totalMinted: 0,
    byEvent: {},
    tokenIdList: [],
  };

  let currentId = BigInt(startTokenId);

  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i];
    const qty = quantities[i];
    const tokenIds = [];

    for (let j = 0; j < qty; j++) {
      tokenIds.push(currentId.toString());
      result.tokenIdList.push(currentId.toString());
      currentId++;
    }

    result.byEvent[eventId] = tokenIds;
    result.totalMinted += qty;

    console.log(`   EventId ${eventId}: [${tokenIds.join(", ")}]`);
  }

  console.log("\n✅ Relayer Batch Buy thành công!");
  console.log(
    `   - Relayer paid: ${ethers.formatUnits(totalPriceSum, 6)} USDT`,
  );
  console.log(`   - Total vé mua: ${result.totalMinted}`);
  console.log(`   - Vé nhận bởi: ${buyerAddress}`);
  console.log(`   - TxHash: ${receipt.transactionHash}`);

  return {
    status: "SUCCESS",
    ...result,
    totalPrice: ethers.formatUnits(totalPriceSum, 6),
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  };
}

// ✅ CALL:
// await sampleBatchRelayerBuyTicket(
//     [5, 7, 9],                 // eventIds
//     [2, 2, 2],                 // quantities
//     "0xbuyer...",              // buyerAddress (khách)
//     relayerPrivateKey          // relayer (admin)
// );

// ════════════════════════════════════════════════════════════════
// 🎯 INTEGRATION WITH BACKEND (Node.js)
// ════════════════════════════════════════════════════════════════

/*
// In backend payment/relayer service:

// 1. When user transfers VNĐ:
app.post('/pay-vnd', async (req, res) => {
    const { orderId, vnd_amount, buyerAddress, eventIds, quantities } = req.body;
    
    // Convert VNĐ to USDT (e.g., 3M VNĐ = 300 USDT)
    const usdtAmount = convertVNDtoUSDT(vnd_amount);
    
    // Enqueue relayer job
    const job = {
        jobType: 'RELAYER_BUY_BATCH',
        orderId,
        buyerAddress,
        eventIds,
        quantities,
        totalPrice: usdtAmount,
        totalPriceUsdt: usdtAmount,
        timestamp: Date.now()
    };
    
    await relayerQueue.enqueue(job);
    res.json({ status: 'PAYMENT_RECEIVED', orderId });
});

// 2. Worker processes job:
relayerQueue.process(async (job) => {
    const { orderId, buyerAddress, eventIds, quantities, totalPrice } = job.data;
    
    try {
        const result = await sampleBatchRelayerBuyTicket(
            eventIds,
            quantities,
            buyerAddress,
            process.env.RELAYER_PRIVATE_KEY
        );
        
        // Update order
        await Order.updateOne(
            { _id: orderId },
            {
                status: 'COMPLETED',
                tokenIds: result.tokenIdList,
                txHash: result.transactionHash,
                blockNumber: result.blockNumber,
                completedAt: new Date()
            }
        );
        
        // Notify user
        await notifyUser(buyerAddress, {
            type: 'TICKET_MINTED',
            tokenIds: result.tokenIdList,
            message: `Bạn đã nhận được ${result.totalMinted} vé`
        });
        
        return result;
    } catch (error) {
        console.error('Job failed:', error);
        throw error;  // Job will go to DLQ
    }
});
*/
