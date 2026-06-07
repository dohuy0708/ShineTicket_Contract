// 🔄 LUỒNG HOẠT ĐỘNG CHI TIẾT - CRYPTO vs RELAYER

// ════════════════════════════════════════════════════════════════
// 🔵 LUỒNG 1: MUA VÉ BẰNG CRYPTO - ĐƠNGẢI LẺ
// ════════════════════════════════════════════════════════════════

/\*
📋 Scenario: Khách muốn mua 3 vé loại EventId=5 bằng Crypto

┌─────────────────────────────────────────────────────────┐
│ 1. USER APPROVES (Off-chain) │
│ const usdtContract = new ethers.Contract( │
│ USDT_ADDRESS, │
│ ERC20_ABI, │
│ userSigner │
│ ); │
│ │
│ const totalPrice = eventPrice _ 3; │
│ await usdtContract.approve( │
│ SHINE_TICKET_ADDRESS, │
│ totalPrice // ≥ totalPrice │
│ ); │
│ ✅ Cho phép hợp đồng rút USDT │
└─────────────────────────────────────────────────────────┘
⬇️
┌─────────────────────────────────────────────────────────┐
│ 2. CALL buyTicket() │
│ │
│ const tx = await shineTicketContract.buyTicket( │
│ eventId: 5, │
│ quantity: 3, │
│ recipient: "0xuser123...abc" ← Ví Privy của khách
│ ); │
│ │
│ ✅ Hợp đồng được gọi │
└─────────────────────────────────────────────────────────┘
⬇️
┌─────────────────────────────────────────────────────────┐
│ 3. SMART CONTRACT XỬ LÝ (On-chain) │
│ │
│ a) Kiểm tra: │
│ - Event 5 có active? ✅ │
│ - Price set? ✅ │
│ - quantity > 0? ✅ │
│ │
│ b) Tính toán: │
│ totalPrice = events[5].price _ 3 │
│ = 100 USDT _ 3 = 300 USDT │
│ │
│ c) Transfer USDT: │
│ usdtToken.transferFrom( │
│ msg.sender (user), │
│ address(this) (contract), │
│ 300 USDT │
│ ); │
│ ✅ USDT được khóa vào contract (Escrow) │
│ │
│ d) Ghi nhận revenue: │
│ eventRevenue[5] += 300 │
│ ✅ Organizer sẽ claim tiền này sau │
│ │
│ e) Mint vé: │
│ uint256 startTokenId = \_nextTokenId(); // 1000 │
│ \_safeMint("0xuser123...abc", 3); │
│ ✅ 3 vé: tokenId 1000, 1001, 1002 │
│ │
│ f) Ghi mapping: │
│ ticketToEvent[1000] = 5 │
│ ticketToEvent[1001] = 5 │
│ ticketToEvent[1002] = 5 │
│ ✅ Để sau này check expiry │
│ │
│ g) Emit Transfer events (từ ERC721A): │
│ Transfer(0x00..00, 0xuser123, 1000) │
│ Transfer(0x00..00, 0xuser123, 1001) │
│ Transfer(0x00..00, 0xuser123, 1002) │
│ ✅ Lịch sử công khai trên blockchain │
└─────────────────────────────────────────────────────────┘
⬇️
┌─────────────────────────────────────────────────────────┐
│ 4. FRONTEND LẤY TOKEN IDS │
│ │
│ const receipt = await tx.wait(); │
│ │
│ const tokenIds = []; │
│ receipt.logs.forEach(log => { │
│ const parsed = iface.parseLog(log); │
│ if (parsed.name === 'Transfer' │
│ && parsed.args.from === '0x00...00') { │
│ tokenIds.push(parsed.args.tokenId); │
│ } │
│ }); │
│ │
│ ✅ tokenIds = [1000, 1001, 1002] │
└─────────────────────────────────────────────────────────┘
⬇️
┌─────────────────────────────────────────────────────────┐
│ 5. RESULT │
│ │
│ ✅ Khách mua 3 vé EventId=5 thành công │
│ ✅ Thanh toán 300 USDT │
│ ✅ Nhận được 3 NFT vé: 1000, 1001, 1002 │
│ ✅ USDT được khóa vào Escrow │
│ ✅ Organizer có thể claim sau │
└─────────────────────────────────────────────────────────┘
_/

// ════════════════════════════════════════════════════════════════
// 🟠 LUỒNG 2: MUA VÉ BẰNG CRYPTO - BATCH (NHIỀU LOẠI VÉ)
// ════════════════════════════════════════════════════════════════

/\*
📋 Scenario: Khách muốn mua batch

- 3 vé loại EventId=5 (mỗi vé 100 USDT)
- 2 vé loại EventId=7 (mỗi vé 150 USDT)
- 2 vé loại EventId=9 (mỗi vé 200 USDT)
  Tổng: 3*100 + 2*150 + 2\*200 = 1000 USDT

┌──────────────────────────────────────────────────────────┐
│ 1. APPROVE USDT (Như Luồng 1) │
│ await usdtContract.approve( │
│ SHINE_TICKET_ADDRESS, │
│ 1000 USDT │
│ ); │
└──────────────────────────────────────────────────────────┘
⬇️
┌──────────────────────────────────────────────────────────┐
│ 2. CALL batchBuyTickets() │
│ │
│ const tx = await shineTicketContract.batchBuyTickets(│
│ eventIds: [5, 7, 9], │
│ quantities: [3, 2, 2], │
│ recipient: "0xuser123...abc" │
│ ); │
│ │
│ ✅ Gọi hàm batch │
└──────────────────────────────────────────────────────────┘
⬇️
┌──────────────────────────────────────────────────────────┐
│ 3. SMART CONTRACT XỬ LÝ (Chi tiết) │
│ │
│ ┌─ VÒng 1 (Setup - Tính tổng) │
│ │ for (i = 0 to 2): │
│ │ EventId 5: 100 _ 3 = 300 USDT ✓ │
│ │ EventId 7: 150 _ 2 = 300 USDT ✓ │
│ │ EventId 9: 200 _ 2 = 400 USDT ✓ │
│ │ totalPriceSum = 300 + 300 + 400 = 1000 USDT │
│ │ │
│ ├─ TRANSFER USDT 1 lần │
│ │ usdtToken.transferFrom(user, contract, 1000) │
│ │ ✅ Một lần rút 1000 USDT │
│ │ │
│ └─ VÒng 2 (Mint - Xử lý từng eventId) │
│ ├─ EventId 5 (qty 3): │
│ │ startTokenId = \_nextTokenId(); // 2000 │
│ │ \_safeMint(recipient, 3); │
│ │ eventRevenue[5] += 300; │
│ │ tokenId: 2000, 2001, 2002 → EventId 5 │
│ │ │
│ ├─ EventId 7 (qty 2): │
│ │ startTokenId = \_nextTokenId(); // 2003 │
│ │ \_safeMint(recipient, 2); │
│ │ eventRevenue[7] += 300; │
│ │ tokenId: 2003, 2004 → EventId 7 │
│ │ │
│ └─ EventId 9 (qty 2): │
│ startTokenId = \_nextTokenId(); // 2005 │
│ \_safeMint(recipient, 2); │
│ eventRevenue[9] += 400; │
│ tokenId: 2005, 2006 → EventId 9 │
│ │
│ Emit 7 Transfer events: │
│ Transfer(0, 0xuser, 2000) from EventId 5 │
│ Transfer(0, 0xuser, 2001) from EventId 5 │
│ Transfer(0, 0xuser, 2002) from EventId 5 │
│ Transfer(0, 0xuser, 2003) from EventId 7 │
│ Transfer(0, 0xuser, 2004) from EventId 7 │
│ Transfer(0, 0xuser, 2005) from EventId 9 │
│ Transfer(0, 0xuser, 2006) from EventId 9 │
└──────────────────────────────────────────────────────────┘
⬇️
┌──────────────────────────────────────────────────────────┐
│ 4. MAPPING RESULT (QUAN TRỌNG!) │
│ │
│ ⚠️ TokenIds KHÔNG liên tiếp per EventId: │
│ │
│ EventId 5: [2000, 2001, 2002] │
│ EventId 7: [2003, 2004] │
│ EventId 9: [2005, 2006] │
│ │
│ ✅ Nếu track trước: │
│ startId = 2000, tổng qty = 7 │
│ => tokenIds = [2000...2006] │
│ ✅ Sau đó map: │
│ [2000,2001,2002] → EventId 5 │
│ [2003,2004] → EventId 7 │
│ [2005,2006] → EventId 9 │
└──────────────────────────────────────────────────────────┘
⬇️
┌──────────────────────────────────────────────────────────┐
│ 5. RESULT │
│ │
│ ✅ Mua 7 vé thành công (3 loại EventId) │
│ ✅ Thanh toán 1000 USDT 1 lần │
│ ✅ TokenIds: 2000-2006 (liên tiếp) │
│ ✅ Mapping: tokenId → EventId │
│ ✅ 3 organizer sẽ nhận tiền │
└──────────────────────────────────────────────────────────┘
_/

// ════════════════════════════════════════════════════════════════
// 🔴 LUỒNG 3: MUA VÉ BẰNG RELAYER - ĐƠNI LẺ
// ════════════════════════════════════════════════════════════════

/\*
📋 Scenario: Khách chuyển khoản VNĐ 3.000.000 đ
Nền tảng convert → 300 USDT
Worker (Relayer) gọi hệ thống mua hộ khách

┌───────────────────────────────────────────────────────────┐
│ 1. KHÁCH CHUYỂN KHOẢN (Off-chain) │
│ │
│ Khách: Chuyển 3.000.000 VNĐ │
│ → Tài khoản thanh toán ShineTicket │
│ → Ghi chú: OrderId=12345 │
│ │
│ ✅ Backend track: 3M VNĐ → 300 USDT │
│ ✅ Backend track: Buyer = 0xuser123...abc │
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 2. BACKEND ENQUEUE RELAYER JOB (Off-chain) │
│ │
│ // src/relayer.js hoặc queue system │
│ await buyJob.enqueue({ │
│ jobType: 'RELAYER_BUY', │
│ orderId: 12345, │
│ buyerAddress: '0xuser123...abc', │
│ eventId: 5, │
│ quantity: 3, │
│ totalPrice: 300, // ⚠️ QUAN TRỌNG! │
│ totalPriceUsdt: 300, │
│ timestamp: Date.now() │
│ }); │
│ │
│ ✅ Job enqueued → DLQ nếu thiếu totalPrice │
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 3. RELAYER WORKER PROCESS JOB │
│ │
│ // Worker service │
│ const relayerAddress = "0xadmin...xyz"; // Relayer │
│ const contract = shineTicket.connect( │
│ signer(relayerAddress) │
│ ); │
│ │
│ ✅ Relayer signed as DEFAULT_ADMIN_ROLE │
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 4. CALL relayerBuyTicket() (Chỉ Relayer) │
│ │
│ const tx = await contract.relayerBuyTicket( │
│ eventId: 5, │
│ quantity: 3, │
│ buyerAddress: '0xuser123...abc' ← Khách mua │
│ ); │
│ │
│ ⚠️ msg.sender = Relayer (0xadmin...xyz) │
│ ✅ Gọi từ Relayer account │
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 5. SMART CONTRACT XỬ LÝ │
│ │
│ a) Kiểm tra permission: │
│ require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) │
│ ✅ Chỉ Relayer được gọi │
│ │
│ b) Transfer USDT: │
│ usdtToken.transferFrom( │
│ msg.sender (Relayer 0xadmin), │
│ address(this) (contract), │
│ 300 USDT │
│ ); │
│ ⚠️ Relayer phải có USDT đủ! │
│ ✅ USDT khóa vào contract │
│ │
│ c) Ghi nhận revenue: │
│ eventRevenue[5] += 300 │
│ │
│ d) Mint vé cho BUYER (không phải Relayer): │
│ uint256 startTokenId = \_nextTokenId(); // 3000 │
│ \_safeMint('0xuser123...abc', 3); ← Buyer ví │
│ ✅ Vé vào ví buyer, không ví relayer │
│ │
│ e) Ghi mapping: │
│ ticketToEvent[3000] = 5 │
│ ticketToEvent[3001] = 5 │
│ ticketToEvent[3002] = 5 │
│ │
│ f) Tăng counter: │
│ eventRelayerSoldCount[5] += 3 │
│ ✅ Để report sales từ Relayer │
│ │
│ g) Emit Transfer (to = Buyer, không Relayer): │
│ Transfer(0, 0xuser123, 3000) │
│ Transfer(0, 0xuser123, 3001) │
│ Transfer(0, 0xuser123, 3002) │
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 6. BACKEND UPDATE JOB STATUS │
│ │
│ // Job thành công │
│ job.status = 'SUCCESS'; │
│ job.transactionHash = tx.hash; │
│ job.tokenIds = [3000, 3001, 3002]; │
│ job.completedAt = Date.now(); │
│ │
│ // Update order │
│ order.status = 'COMPLETED'; │
│ order.tokenIds = [3000, 3001, 3002]; │
│ order.vndPaid = 3000000; │
│ order.usdtPaid = 300; │
│ │
│ // Notify user │
│ userService.notifyTicketReady(buyerAddress, [3000...])│
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 7. RESULT │
│ │
│ ✅ Khách mua 3 vé qua chuyển khoản VNĐ │
│ ✅ Relayer đã rút USDT từ admin wallet │
│ ✅ Vé được mint trực tiếp vào ví buyer │
│ ✅ Token IDs: 3000, 3001, 3002 │
│ ✅ Order marked as completed │
│ ✅ Organizer sẽ claim tiền từ revenue │
└───────────────────────────────────────────────────────────┘
\*/

// ════════════════════════════════════════════════════════════════
// 🟣 LUỒNG 4: MUA VÉ BẰNG RELAYER - BATCH
// ════════════════════════════════════════════════════════════════

/\*
📋 Scenario: Khách chuyển 5.000.000 VNĐ
Nền tảng convert → 500 USDT
Muốn mua batch: - 2 vé EventId=5 (200 USDT) - 2 vé EventId=7 (300 USDT)

┌───────────────────────────────────────────────────────────┐
│ 1-2. KHÁCH CHUYỂN KHOẢN + BACKEND ENQUEUE (Như Luồng 3) │
│ │
│ await buyJob.enqueue({ │
│ jobType: 'RELAYER_BUY_BATCH', │
│ orderId: 12346, │
│ buyerAddress: '0xuser456...def', │
│ eventIds: [5, 7], │
│ quantities: [2, 2], │
│ totalPrice: 500, ⚠️ CRITICAL │
│ totalPriceUsdt: 500, │
│ timestamp: Date.now() │
│ }); │
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 3. CALL batchRelayerBuyTicket() │
│ │
│ const tx = await relayerContract.batchRelayerBuyTicket(│
│ eventIds: [5, 7], │
│ quantities: [2, 2], │
│ buyerAddress: '0xuser456...def' │
│ ); │
│ │
│ ⚠️ msg.sender = Relayer │
│ ⚠️ buyerAddress = Khách (không Relayer) │
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 4. SMART CONTRACT BATCH PROCESS │
│ │
│ Similar to batchBuyTickets() but: │
│ ✅ msg.sender = Relayer (need DEFAULT_ADMIN role) │
│ ✅ Transfer USDT từ Relayer │
│ ✅ Mint vé cho Buyer (không Relayer) │
│ ✅ Tăng eventRelayerSoldCount cho từng eventId │
│ │
│ DetailedFlow: │
│ ├─ EventId 5 (qty 2): │
│ │ startTokenId = 4000 │
│ │ Mint 2 vé: 4000, 4001 → EventId 5 │
│ │ eventRevenue[5] += 200 │
│ │ eventRelayerSoldCount[5] += 2 │
│ │ │
│ └─ EventId 7 (qty 2): │
│ startTokenId = 4002 │
│ Mint 2 vé: 4002, 4003 → EventId 7 │
│ eventRevenue[7] += 300 │
│ eventRelayerSoldCount[7] += 2 │
│ │
│ Total USDT transferred: 500 (1 lần) │
│ Total vé minted: 4 (2 block \_safeMint) │
│ Transfer events emitted: 4 (cho buyer) │
└───────────────────────────────────────────────────────────┘
⬇️
┌───────────────────────────────────────────────────────────┐
│ 5. RESULT │
│ │
│ ✅ Batch relayer buy thành công │
│ ✅ 4 vé: tokenIds = [4000, 4001, 4002, 4003] │
│ ✅ Mapping: │
│ EventId 5: [4000, 4001] │
│ EventId 7: [4002, 4003] │
│ ✅ Tất cả vé vào ví buyer │
│ ✅ eventRelayerSoldCount updated │
└───────────────────────────────────────────────────────────┘
\*/

// ════════════════════════════════════════════════════════════════
// 📊 BẢNG SO SÁNH 4 LUỒNG
// ════════════════════════════════════════════════════════════════

/_
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Tiêu chí │ Luồng 1 │ Luồng 2 │ Luồng 3 │ Luồng 4 │
│ │ Buy Đơn lẻ │ Buy Batch │ Relayer Đơn │ Relayer Batch│
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ EventIds │ 1 │ N │ 1 │ N │
│ Qty per │ 1 param │ N params │ 1 param │ N params │
│ TokenIds │ Liên tiếp │ Không (mỗi │ Liên tiếp │ Không (mỗi │
│ │ │ event riêng)│ │ event riêng)│
│ Transfer │ 1 lần │ 1 lần │ 1 lần │ 1 lần │
│ USDT │ │ │ │ │
│ Mint calls │ 1 block │ N blocks │ 1 block │ N blocks │
│ Transfer │ qty │ total │ qty │ total │
│ events │ │ │ │ │
│ Permission │ Public │ Public │ Admin only │ Admin only │
│ Relayer │ ❌ │ ❌ │ ✅ │ ✅ │
│ │ │ │ │ │
│ Revenue │ Ghi record │ N records │ Ghi record │ N records │
│ records │ │ │ │ │
│ │ │ │ │ │
│ Counter │ Không │ Không │ eventRelayer │ eventRelayer │
│ update │ │ │ SoldCount │ SoldCount │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
_/

// ════════════════════════════════════════════════════════════════
// 🔒 LƯU Ý BẢO MẬT - RELAYER PATH
// ════════════════════════════════════════════════════════════════

/\*
⚠️ RỦI RO RELAYER:

1. ❌ USDT không đủ:

   - Nếu Relayer wallet không có USDT
   - transferFrom() sẽ FAIL
   - Job vào DLQ

2. ❌ Chậm xử lý:

   - Khách chuyển VNĐ lúc 9am
   - Worker xử lý lúc 9pm (12h sau)
   - Vé deliver muộn

3. ❌ Mapping sai eventId:

   - Backend nhập sai eventId/qty
   - Khách mua vé sai loại

4. ✅ GIẢI PHÁP:

   - Monitor USDT balance Relayer
   - Auto-topup USDT nếu cần
   - Double-check eventId trước mint
   - Log transaction hash
   - Có cơ chế refund/reverse nếu cần

5. 🔐 SECURITY:
   - Relayer wallet = Protected Admin wallet
   - Có rate limit trên job queue
   - Có audit log cho tất cả job
   - Monitor unusual patterns
     \*/
