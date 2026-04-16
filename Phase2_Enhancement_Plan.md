# Kế Hoạch Nâng Cấp Hệ Sinh Thái ShineTicket (Phase 2)

Tiến trình nâng cấp dự án từ một hợp đồng NFT (ERC721A) Ticketing cơ bản thành một **Hệ sinh thái Quản lý Sự kiện chuyên nghiệp** tích hợp tài chính phi tập trung (DeFi Escrow) và phân quyền chặt chẽ.

---

## Danh Mục Các Module & Giải Pháp Kỹ Thuật

### 1. Nâng Cấp Quản Lý Quyền Hạn (Access Control & Emergency Pause)

- **Công nghệ:** `AccessControl`, `Pausable` (OpenZeppelin).
- **Mục tiêu:** Chuyển đổi từ `Ownable` sang kiến trúc đa rễ (Role Hierarchy).
- **Chi tiết thực hiện:**
  - Khởi tạo các Role:
    - `DEFAULT_ADMIN_ROLE`: Quản trị viên tối cao (có thể cấp/thu hồi các role khác).
    - `ORGANIZER_ROLE`: Ban tổ chức sự kiện (tạo sự kiện, claim funds).
    - `OPERATOR_ROLE`: Nhân viên soát vé tại cổng (chỉ có quyền gọi hàm check-in).
  - Áp dụng `Pausable` (hàm `pause()` / `unpause()`) cho các hàm quan trọng (mint, checkIn, transfer, claim) để đóng băng logic trong trường hợp phát hiện lỗi bảo mật khẩn cấp.

### 2. Tối Ưu Hóa Minting Flow (EIP-712: Typed Data Signing)

- **Công nghệ:** `EIP712` (OpenZeppelin).
- **Mục tiêu:** Chống Replay Attacks và bảo mật chữ ký giao dịch (Blind Signing).
- **Chi tiết thực hiện:**
  - Định nghĩa dữ liệu `Voucher` (`MintVoucher`) như sau:
    ```solidity
    struct MintVoucher {
        uint256 eventId;
        uint256 quantity;
        uint256 commissionRate;
        uint256 gasOffset;
        uint64 expiryTime;      // Thời gian hết hạn check-in
        uint256 nonce;          // Chống Replay Attack
        bytes signature;        // Chữ ký của Admin
    }
    ```
  - Smart Contract xác thực chữ ký của Admin/Organizer trên On-chain. Sử dụng `_hashTypedDataV4` để tạo cơ chế Domain Separator độc nhất (chống dùng lại chữ ký xuyên mạng lưới giữa Testnet và Mainnet).
  - Tách riêng tham số chữ ký (`bytes signature`) khỏi struct khi gọi hàm nhận calldata để tiết kiệm gas trong quá trình giải mã (split) `r, s, v`.
  - Theo dõi `nonce` đã sử dụng thông qua mapping để đảm bảo mỗi voucher chỉ mint được 1 lần.

### 3. Kiểm Soát Chuyển Nhượng & Thị Trường (Hybrid Walled Garden)

- **Công nghệ:** Override hook `_beforeTokenTransfers` (trong ERC721A).
- **Mục tiêu:** Ngăn chặn chợ đen ngoài luồng, bảo vệ quyền lợi ban tổ chức nhưng vẫn cho phép giao dịch hợp pháp qua Marketplace chính quyền.
- **Chi tiết thực hiện:**
  - Định nghĩa State Machine cho vé: `transferable` (mặc định = false).
  - Trạng thái đăng bán: `IsListing = true`.
  - Override hàm chuyển token:
    - Bị chặn nếu: Người gửi / Người nhận là tài khoản cá nhân thông thường.
    - Cho phép nếu: `from` hoặc `to` là ví hợp đồng Marketplace (được cấp quyền) HOẶC ví Admin.
    - Hoặc giao dịch được thực hiện thông qua hàm Buy chính thống của hợp đồng.
    - Không thể chuyển các vé đã đánh dấu là "Đã Check-in".

### 4. Cơ Chế Escrow & Quyết Toán Bằng Stablecoin (USDT Settlement)

- **Công nghệ:** `IERC20`, `ReentrancyGuard` (Pull over Push).
- **Mục tiêu:** Khóa tiền khi mua vé, và chỉ quyết toán sau sự kiện để đảm bảo minh bạch, chống lừa đảo sự kiện ảo.
- **Chi tiết thực hiện:**
  - Tích hợp hàm thanh toán USDT cho mỗi sự kiện thay vì native token (ETH/POL) để tránh biến động tỷ giá. Địa chỉ hợp đồng USDT nên được khởi tạo là `immutable` để tăng độ tin cậy.
  - Admin/Smart Contract neo chi phí hệ thống (gas fee, platform fee) theo USDT (`gasOffset`). Cơ chế Escrow sẽ tự động trích lại phần `commissionRate` và `gasOffset` trước khi cho phép Organizer rút phần doanh thu ròng (Net Revenue).
  - Áp dụng mô hình **Pull Payment**: Hợp đồng tính toán doanh thu sự kiện, sau đó Organizer phải chủ động gọi hàm `claimFunds()` để rút tiền.
  - Sử dụng `nonReentrant` để chống tấn công vào pool quỹ dự án.

### 5. Tối Ưu Hóa Lưu Trữ (Multi-Event Struct & Bit-Packing)

- **Công nghệ:** Solidity Storage Bit-packing.
- **Mục tiêu:** Giảm thiểu chi phí gas khi lưu trữ (SSTORE).
- **Chi tiết thực hiện:**
  - Gói gọn dữ liệu sự kiện trong slot 256-bit nếu có thể. Tận dụng quy tắc Solidity lấp đầy các slot từ phải sang trái: Hãy đặt các biến có kích thước nhỏ (`uint64`, `uint32`, `address`, `bool`) nằm kế tiếp nhau để chúng "rơi" vào cùng một storage slot. Tuyệt đối không đặt một biến `uint256` xen giữa các biến nhỏ vì sẽ ép trình biên dịch tách ra các slot khác nhau, làm mất hoàn toàn tác dụng của Bit-packing.
  - Ví dụ cấu trúc dữ liệu (`struct Event`):
    ```solidity
    struct Event {
        address organizer;    // 160 bits
        uint64 startTime;     // 64 bits
        uint32 maxCapacity;   // 32 bits  => Tổng 256 bits (Tiết kiệm 1 slot lưu trữ)
        uint256 price;        // 256 bits
        bool isActive;        // 8 bits
        // ...
    }
    ```

### 6. Tối Ưu Quá Trình Check-In (Operator Efficiency & Expiry Time)

- **Mục tiêu:** Chủ động dọn dẹp và bảo mật sau khi sự kiện kết thúc.
- **Chi tiết thực hiện:**
  - **Phía Backend (Thẩm định & Ký duyệt):** Tính toán `expiryTime` (Unix Timestamp), đưa tham số này vào cấu trúc `MintVoucher` cùng với các thông số khác, sau đó dùng Private Key của Admin để ký xác thực.
  - **Phía Smart Contract (Lúc Mint vé):** Xác thực chữ ký từ BE gửi lên để đảm bảo `expiryTime` là do Admin chỉ định. Sau đó lưu `expiryTime` (sử dụng kiểu `uint64`) vào struct `Event` để tối ưu gas (nằm chung storage slot với `address`).
  - **Phía Smart Contract (Lúc Check-in):** Khi Operator gọi `batchCheckIn`, hợp đồng sẽ kiểm tra `block.timestamp > expiryTime`, nếu vượt quá thời gian sẽ tự động revert. Điều này ngăn chặn triệt để rủi ro Operator bị lộ private key sau sự kiện.
  - **Cơ chế gia hạn (Extend):** Cung cấp hàm `setEventExpiry(uint256 eventId, uint64 newExpiry)` (yêu cầu quyền `DEFAULT_ADMIN_ROLE`) để linh hoạt cập nhật mốc thời gian mới nếu sự kiện offline kéo dài hơn dự kiến.

---

## Lộ Trình Triển Khai (Step-by-Step Execution Plan)

- [ ] **Bước 1: Cấu trúc lại Smart Contract Lõi**
  - Giữ lại ERC721A.
  - Loại bỏ `Ownable`, thêm `AccessControl` và `Pausable`.
  - Setup cấu trúc quyền hạn (Roles).
- [ ] **Bước 2: Xây dựng Struct Data Event & Tích hợp USDT**
  - Implement struct `Event` chuẩn Bit-packing.
  - Thêm interface cho token thanh toán (USDT).
- [ ] **Bước 3: Tối ưu Workflow Minting & Verification**
  - Import plugin `EIP712`.
  - Viết logic `buyTicket` kết hợp verify chữ ký + chuyển USDT vào Escrow.
- [ ] **Bước 4: Hook Chuyển Nhượng & Phân phối Quỹ**
  - Cập nhật logic `_beforeTokenTransfers` (Hybrid Walled Garden).
  - Viết module thanh toán `claimFunds` (Pull over push + ReentrancyGuard).
- [ ] **Bước 5: Module Check-in V2**
  - Cập nhật `batchCheckIn` kèm điều kiện `expiryTime` giới hạn.
- [ ] **Bước 6: Cập nhật Testing & Deployment**
  - Viết lại toàn bộ Unit Tests bằng Ethers v6 theo chuẩn file `.test.js`.
  - Cập nhật script `deploy.js` để cấp các Role mặc định lúc khởi tạo hợp đồng.
