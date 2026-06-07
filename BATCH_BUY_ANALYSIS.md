# 📋 PHÂN TÍCH HÀM MUA VÉ THEO BATCH - CRYPTO vs RELAYER

## 🎯 TÓM TẮT

Có 4 hàm mua vé chính trong `ShineTicket.sol`:

1. **buyTicket** - Mua đơn lẻ 1 loại vé bằng Crypto
2. **batchBuyTickets** - Mua gộp nhiều loại vé khác nhau bằng Crypto
3. **relayerBuyTicket** - Relayer mua đơn lẻ cho khách chuyển khoản VNĐ
4. **batchRelayerBuyTicket** - Relayer mua gộp nhiều loại vé cho khách

---

## 1️⃣ HÀM MUA BẰNG CRYPTO

### 📌 `buyTicket()` - Mua vé đơn lẻ

```solidity
function buyTicket(
    uint256 eventId,
    uint256 quantity,
    address recipient
) external whenNotPaused nonReentrant
```

**Quy trình:**

1. Kiểm tra event có active không
2. Tính `totalPrice = price * quantity`
3. **Transfer USDT từ buyer → contract** (Escrow)
4. Ghi nhận revenue: `eventRevenue[eventId] += totalPrice`
5. **Mint vé trực tiếp cho recipient**
6. **Ghi mapping vé → sự kiện**: `ticketToEvent[tokenId] = eventId`

**TokenId trả về:**

- Không có return value rõ ràng ❌
- Phải lấy từ **Transfer event** của ERC721A
- `_nextTokenId()` được gọi trước, vì vậy tokenId bắt đầu từ `startTokenId`
- **Công thức:** Nếu `startTokenId = _nextTokenId()`, các vé là `[startTokenId, startTokenId+1, ..., startTokenId+quantity-1]`

### 📌 `batchBuyTickets()` - Mua gộp nhiều loại vé

```solidity
function batchBuyTickets(
    uint256[] calldata eventIds,
    uint256[] calldata quantities,
    address recipient
) external whenNotPaused nonReentrant
```

**Quy trình:**

1. Kiểm tra các eventIds có active không
2. **Tính tổng giá của tất cả các loại vé** → `totalPriceSum`
3. **Transfer USDT 1 lần duy nhất** từ buyer → contract
4. **Vòng lặp xử lý từng eventId:**
   - Ghi nhận revenue cho từng sự kiện
   - **Mint vé cho mỗi eventId riêng biệt**
   - Ghi mapping `ticketToEvent`

**⚠️ LƯU Ý QUAN TRỌNG:**

```
Trong batch, mỗi eventId được xử lý RIÊNG BỘ trong vòng for
→ Mỗi lần gọi _safeMint(), tokenId tăng theo số lượng
→ TokenId KHÔNG LIÊN TIẾP cho cùng 1 sự kiện nếu có nhiều eventId
```

**Ví dụ minh họa:**

```
startTokenId trước = 100
eventId[0] = 5, quantity[0] = 3  → mint 3 vé: 100, 101, 102
eventId[1] = 7, quantity[1] = 2  → mint 2 vé: 103, 104
eventId[2] = 9, quantity[2] = 2  → mint 2 vé: 105, 106
```

**TokenId trả về:**

- ❌ Hàm không có return value
- ✅ Phải lấy từ **Transfer event**
- ✅ Hoặc track `startTokenId` trước mỗi `_safeMint()`

---

## 2️⃣ HÀM MUA BẰNG RELAYER (CHUYỂN KHOẢN VNĐ)

### 📌 `relayerBuyTicket()` - Relayer mua đơn lẻ

```solidity
function relayerBuyTicket(
    uint256 eventId,
    uint256 quantity,
    address buyerAddress
) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused nonReentrant
```

**🔐 Yêu cầu:** Chỉ Relayer (DEFAULT_ADMIN_ROLE) mới gọi được

**Quy trình:**

1. Kiểm tra event active
2. Tính `totalPrice = price * quantity`
3. **Transfer USDT từ Relayer (msg.sender) → contract**
4. Ghi nhận revenue
5. **Mint vé cho buyerAddress** (khách chuyển khoản VNĐ)
6. Ghi mapping `ticketToEvent`
7. **Tăng counter**: `eventRelayerSoldCount[eventId] += quantity`

**TokenId trả về:** Như `buyTicket()` - lấy từ event

### 📌 `batchRelayerBuyTicket()` - Relayer mua gộp

```solidity
function batchRelayerBuyTicket(
    uint256[] calldata eventIds,
    uint256[] calldata quantities,
    address buyerAddress
) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused nonReentrant
```

**🔐 Yêu cầu:** Chỉ Relayer mới gọi

**Quy trình:** ⚠️ **GIỐNG HOÀN TOÀN với `batchBuyTickets()`**

1. Tính tổng giá `totalPriceSum`
2. Transfer USDT 1 lần từ Relayer
3. Vòng lặp xử lý từng eventId:
   - Mint vé cho buyerAddress
   - Tăng `eventRelayerSoldCount` cho từng eventId

**TokenId:** Cũng là mint riêng biệt, không liên tiếp

---

## 📊 BẢNG SO SÁNH

| Tiêu chí              | buyTicket          | batchBuyTickets           | relayerBuyTicket         | batchRelayerBuyTicket     |
| --------------------- | ------------------ | ------------------------- | ------------------------ | ------------------------- |
| **Loại vé**           | 1 eventId          | Nhiều eventId             | 1 eventId                | Nhiều eventId             |
| **Người thanh toán**  | Buyer (msg.sender) | Buyer (msg.sender)        | Relayer (msg.sender)     | Relayer (msg.sender)      |
| **Người nhận vé**     | recipient param    | recipient param           | buyerAddress param       | buyerAddress param        |
| **Require Role**      | ❌ Không           | ❌ Không                  | ✅ DEFAULT_ADMIN         | ✅ DEFAULT_ADMIN          |
| **Transfer USDT**     | 1 lần              | 1 lần                     | 1 lần                    | 1 lần                     |
| **Mint vé**           | 1 block            | nhiều block (per eventId) | 1 block                  | nhiều block (per eventId) |
| **TokenId liên tiếp** | ✅ Có              | ❌ Không (per eventId)    | ✅ Có                    | ❌ Không (per eventId)    |
| **Counter tăng**      | ❌ Không           | ❌ Không                  | ✅ eventRelayerSoldCount | ✅ eventRelayerSoldCount  |
| **Return value**      | void               | void                      | void                     | void                      |

---

## 🔴 TOKENID TRẢ VỀ - CÁCH LẤY

### ❌ Vấn đề: Hàm không return tokenId

```solidity
// ❌ Không có return value
function batchBuyTickets(...) external {
    // ... code ...
    uint256 startTokenId = _nextTokenId();
    _safeMint(recipient, quantity);
    // ❌ startTokenId không được return
}
```

### ✅ Giải pháp 1: Lấy từ Transfer Event

```javascript
// Frontend
const tx = await contract.batchBuyTickets(
  eventIds,
  quantities,
  recipientAddress,
);
const receipt = await tx.wait();

// Parse Transfer events
const tokenIds = [];
receipt.logs.forEach((log) => {
  try {
    const parsed = contract.interface.parseLog(log);
    if (parsed.name === "Transfer" && parsed.args.from === ethers.ZeroAddress) {
      tokenIds.push(parsed.args.tokenId);
    }
  } catch (e) {}
});

console.log("Minted TokenIds:", tokenIds);
```

### ✅ Giải pháp 2: Query `_nextTokenId()` trước & sau

```javascript
const startId = await contract._nextTokenId(); // Query trước
await contract.batchBuyTickets(eventIds, quantities, recipientAddress);
const endId = await contract._nextTokenId(); // Query sau

const allTokenIds = Array.from(
  { length: endId - startId },
  (_, i) => startId + i,
);
```

### ✅ Giải pháp 3: Gọi hàm riêng track TokenId (Nên thêm vào SC)

```solidity
// ❌ SC hiện tại KHÔNG có hàm này
// ✅ Có thể thêm vào để tiện lợi:
function batchBuyTicketsReturnIds(
    uint256[] calldata eventIds,
    uint256[] calldata quantities,
    address recipient
) external returns (uint256[] memory tokenIds) {
    uint256 startTokenId = _nextTokenId();

    // ... (logic từ batchBuyTickets) ...

    uint256 totalQuantity = 0;
    for(uint i = 0; i < quantities.length; i++) {
        totalQuantity += quantities[i];
    }

    tokenIds = new uint256[](totalQuantity);
    for(uint i = 0; i < totalQuantity; i++) {
        tokenIds[i] = startTokenId + i;
    }
}
```

---

## 🎗️ LƯU Ý BẢO MẬT

### 1. **Vé đã Check-in không thể chuyển**

```solidity
function _beforeTokenTransfers(...) {
    // ⚠️ Vé checked-in bị khóa chuyển
    require(!ticketUsed[startTokenId + i], "Used ticket cannot be transferred");
}
```

### 2. **Chỉ Marketplace/Admin được chuyển vé**

```solidity
// ⚠️ Chặn P2P chuyển tự do
bool isMarketplace = hasRole(DEFAULT_ADMIN_ROLE, ...) || hasRole(MARKETPLACE_ROLE, ...);
require(isMarketplace, "Transfer locked: Only Official Marketplace allowed");
```

### 3. **Relayer bị giới hạn bằng USDT của Admin**

- Relayer phải có USDT đủ + Approve cho contract
- Nếu không đủ → `transferFrom` fail

---

## 📝 GHI CHÚ CUỐI

1. ✅ **batchBuyTickets** & **batchRelayerBuyTicket** là hàm V3 mới
2. ✅ Cả 2 đều support mua nhiều eventId trong 1 tx
3. ❌ TokenId KHÔNG trả về → cần parse Transfer event hoặc track `_nextTokenId()`
4. ⚠️ Nếu batch có 3 eventId với qty [3,2,2] → 7 Transfer event riêng biệt
5. 🔐 Relayer hàm có `onlyRole(DEFAULT_ADMIN_ROLE)` để bảo mật

---

## 💡 KHUYẾN NGHỊ

Nên thêm return value vào SC để tiện lợi:

```solidity
event TicketsMinted(uint256 indexed eventId, uint256 startTokenId, uint256 quantity);

function batchBuyTickets(...) external returns (uint256[] memory) {
    // ... existing code ...
    uint256[] memory allTokenIds = new uint256[](totalQuantity);
    uint256 idx = 0;

    for (uint256 i = 0; i < eventIds.length; i++) {
        uint256 startTokenId = _nextTokenId();
        _safeMint(recipient, quantities[i]);

        for(uint j = 0; j < quantities[i]; j++) {
            allTokenIds[idx++] = startTokenId + j;
        }

        emit TicketsMinted(eventIds[i], startTokenId, quantities[i]);
    }

    return allTokenIds;
}
```
