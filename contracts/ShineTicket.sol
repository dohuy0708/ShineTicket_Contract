// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ShineTicket is ERC721A, AccessControl, Pausable, EIP712, ReentrancyGuard {
    // --- KHAI BÁO ROLE ---
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE"); // Quyền Marketplace

    // --- STRUCTS (Tối ưu thiết kế Bit-packing) ---
    struct MintVoucher {
        uint256 eventId;
        uint256 quantity;
        uint256 commissionRate;
        uint256 gasOffset;
        uint64 expiryTime;
        uint256 nonce;
    }

    struct Event {
        address organizer;    // 160 bits
        uint64 expiryTime;    // 64 bits
        uint32 maxCapacity;   // 32 bits => Tổng 256 bits (Tiết kiệm 1 slot lưu trữ)
        uint256 price;        // 256 bits (Giá vé lưu bằng định dạng USDT decimals)
        bool isActive;        // 8 bits (Trạng thái sự kiện)
    }

    // --- KHAI BÁO BIẾN TRẠNG THÁI ---
    bytes32 public constant VOUCHER_TYPEHASH = keccak256(
        "MintVoucher(uint256 eventId,uint256 quantity,uint256 commissionRate,uint256 gasOffset,uint64 expiryTime,uint256 nonce)"
    );

    IERC20 public immutable usdtToken; // Hardcode token thanh toán chống thao túng
    mapping(uint256 => Event) public events;
    mapping(uint256 => bool) public ticketUsed;
    mapping(uint256 => bool) public usedNonces; // Chống Replay Attack

    // --- ESCROW & REVENUE TRACKING ---
    mapping(uint256 => uint256) public eventRevenue;          // Tổng doanh thu USDT của sự kiện
    mapping(uint256 => uint256) public eventCommissionRate;   // Tỷ lệ % hoa hồng nền tảng (VD: 500 = 5%)
    mapping(uint256 => uint256) public eventGasOffset;        // Phí bù gas mạng (USDT decimals)
    mapping(uint256 => bool) public fundsClaimed;             // Đánh dấu để chống claim lần 2

    string private _baseTokenURI;

    // --- SỰ KIỆN ---
    event TicketsCheckedIn(uint256[] tokenIds, uint256 timestamp);
    
    // --- KHỞI TẠO ---
    constructor(address defaultAdmin, address _usdtToken) 
        ERC721A("ShineTicket", "SHINE") 
        EIP712("ShineTicket", "1")
    {
        require(_usdtToken != address(0), "Invalid USDT address");
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        usdtToken = IERC20(_usdtToken);
    }

    // --- TÍNH NĂNG 1: MINT BATCH (WORKER GỌI) ---
    function mintBatchUsers(address[] calldata recipients, uint256[] calldata quantities) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        require(recipients.length == quantities.length, "Data mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _safeMint(recipients[i], quantities[i]);
        }
    }

    // --- TÍNH NĂNG 2: MINT SỰ KIỆN TỪ VOUCHER CỦA ADMIN (EIP-712) ---
    function mintEventTickets(MintVoucher calldata voucher, bytes calldata signature) external whenNotPaused {
        // 1. Chống MINT LẠI (Replay Attack)
        require(!usedNonces[voucher.nonce], "Voucher has already been used");
        usedNonces[voucher.nonce] = true;

        // 2. Khôi phục chữ ký và Xác thực Admin
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    VOUCHER_TYPEHASH,
                    voucher.eventId,
                    voucher.quantity,
                    voucher.commissionRate,
                    voucher.gasOffset,
                    voucher.expiryTime,
                    voucher.nonce
                )
            )
        );
        address signer = ECDSA.recover(digest, signature);
        require(hasRole(DEFAULT_ADMIN_ROLE, signer), "Invalid signature from Admin");

        // 3. Khởi tạo dữ liệu sự kiện (nếu chưa có)
        if (events[voucher.eventId].organizer == address(0)) {
            events[voucher.eventId].organizer = msg.sender;
            events[voucher.eventId].expiryTime = voucher.expiryTime;
            events[voucher.eventId].isActive = true;
            
            // Thiết lập thông số Escrow
            eventCommissionRate[voucher.eventId] = voucher.commissionRate;
            eventGasOffset[voucher.eventId] = voucher.gasOffset;
        } else {
            require(events[voucher.eventId].organizer == msg.sender, "Caller is not the event organizer");
        }

        // 4. Mint vé cho Organizer theo định lượng voucher chỉ định
        _safeMint(msg.sender, voucher.quantity);
    }

    // --- TÍNH NĂNG 3: MINT THỦ CÔNG (ADMIN GỌI) ---
    function mintTicket(address to, uint256 quantity) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        _safeMint(to, quantity);
    }

    // --- TÍNH NĂNG 3: BATCH CHECK-IN (QUAN TRỌNG) ---
    
    /**
     * @dev NÂNG CẤP: Cho phép Worker đồng bộ trạng thái nhiều vé cùng lúc.
     * Ví dụ: Worker gom 50 vé đã soát ở cổng, gọi hàm này 1 lần duy nhất.
     */
    function batchCheckIn(uint256[] calldata tokenIds) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            
            // Chỉ xử lý nếu vé tồn tại và chưa dùng 
            if (_exists(tokenId) && !ticketUsed[tokenId]) {
                ticketUsed[tokenId] = true;
            }
        }
        // Emit 1 event cho cả mảng để tiết kiệm gas
        emit TicketsCheckedIn(tokenIds, block.timestamp);
    }

    /**
     * @dev Hàm cũ (giữ lại nếu muốn test lẻ, nhưng thực tế sẽ ít dùng)
     */
    function checkIn(uint256 tokenId) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(_exists(tokenId), "Ticket does not exist");
        require(!ticketUsed[tokenId], "Ticket already used");
        ticketUsed[tokenId] = true;
        
        // Tạo mảng tạm để emit event cho thống nhất
        uint256[] memory ids = new uint256[](1);
        ids[0] = tokenId;
        emit TicketsCheckedIn(ids, block.timestamp);
    }

    // --- TÍNH NĂNG 4: CHẶN CHUYỂN VÉ ĐÃ DÙNG (BẢO MẬT) ---

    /**
     * @dev Hook của ERC721A chạy trước khi chuyển token.
     * Chặn không cho chuyển vé (Transfer) nếu vé đó đã Check-in.
     */
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override whenNotPaused {
        // Cho phép mint (from == 0) và burn (to == 0)
        if (from != address(0) && to != address(0)) {
            // --- HYBRID WALLED GARDEN ---
            // Chặn chuyển P2P tự do. Chỉ cho phép nếu có dính tới Marketplace hoặc Admin.
            bool isMarketplace = hasRole(DEFAULT_ADMIN_ROLE, from) || 
                                 hasRole(DEFAULT_ADMIN_ROLE, to) || 
                                 hasRole(MARKETPLACE_ROLE, from) || 
                                 hasRole(MARKETPLACE_ROLE, to) || 
                                 hasRole(MARKETPLACE_ROLE, msg.sender);
            require(isMarketplace, "Transfer locked: Only Official Marketplace allowed");

            // Kiểm tra từng token trong batch chuyển đi (chặn cho tặng vé đã soát ở cổng)
            for (uint256 i = 0; i < quantity; i++) {
                require(!ticketUsed[startTokenId + i], "Used ticket cannot be transferred");
            }
        }
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }
    // --- TÍNH NĂNG 5: QUẢN LÝ VÒNG ĐỜI (ADMIN ONLY) ---

    /**
     * @dev Chỉ Admin mới có quyền hủy vé (Ví dụ: Vé bị hack, hoặc hoàn tiền hủy show).
     * User không tự burn được.
     */
    function revokeTicket(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        _burn(tokenId); 
    }

    // --- TÍNH NĂNG 6: MUA VÉ TRỰC TIẾP (KẾT NỐI ESCROW) ---
    function setEventPrice(uint256 eventId, uint256 price) external whenNotPaused {
        require(events[eventId].organizer == msg.sender, "Not organizer");
        events[eventId].price = price;
    }

    /**
     * @dev Customer tự mua vé bằng Crypto (USDT). 
     * Khóa trực tiếp USDT từ ví user vào Contract. Mint vé cho user.
     */
    function buyTicket(uint256 eventId, uint256 quantity) external whenNotPaused nonReentrant {
        Event memory evt = events[eventId];
        require(evt.isActive, "Event is not active");
        
        uint256 totalPrice = evt.price * quantity;
        require(totalPrice > 0, "Price not set or quantity zero");

        // Khóa USDT vào contract (Escrow)
        require(usdtToken.transferFrom(msg.sender, address(this), totalPrice), "USDT transfer failed");

        // Ghi nhận doanh thu sự kiện
        eventRevenue[eventId] += totalPrice;

        // Cấp phát số lượng vé trực tiếp cho Customer (msg.sender)
        _safeMint(msg.sender, quantity);
    }

    /**
     * @dev Nền tảng (Relayer) mua vé hộ cho khách chuyển khoản VNĐ.
     * Nền tảng trừ trước USDT của ví chủ/Worker, gọi hàm này để Mint vé từ xa vào cục bộ ví khách (buyerAddress)
     */
    function relayerBuyTicket(uint256 eventId, uint256 quantity, address buyerAddress) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused nonReentrant {
        Event memory evt = events[eventId];
        require(evt.isActive, "Event is not active");
        
        uint256 totalPrice = evt.price * quantity;
        require(totalPrice > 0, "Price not set or quantity zero");

        // Khóa USDT vào contract từ ví của Admin Relayer (msg.sender)
        require(usdtToken.transferFrom(msg.sender, address(this), totalPrice), "USDT transfer failed");

        // Ghi nhận doanh thu sự kiện (để tính gộp cho Organizer về sau)
        eventRevenue[eventId] += totalPrice;

        // Mint vé phân bổ thẳng về tay khách (buyerAddress)
        _safeMint(buyerAddress, quantity);
    }

    // --- TÍNH NĂNG 7: RÚT TIỀN (PULL OVER PUSH) ---
    function claimFunds(uint256 eventId) external nonReentrant whenNotPaused {
        Event memory evt = events[eventId];
        
        require(evt.organizer == msg.sender, "Only organizer can claim");
        require(block.timestamp > evt.expiryTime, "Event not ended yet");
        require(!fundsClaimed[eventId], "Funds already claimed");

        fundsClaimed[eventId] = true;

        uint256 totalGross = eventRevenue[eventId];
        require(totalGross > 0, "No revenue to claim");

        // Công thức tính toán
        uint256 offset = eventGasOffset[eventId];
        uint256 commRate = eventCommissionRate[eventId];
        
        // Tính phí nền tảng chia 10000 (Ví dụ 500 = 5%)
        uint256 platformFee = (totalGross * commRate) / 10000;
        uint256 totalDeduction = platformFee + offset;

        // Tránh tình trạng sự kiện ế vé, không đủ trả phí nền tảng
        require(totalGross > totalDeduction, "Revenue is less than system fees");
        
        // Lợi nhuận ròng của Organizer
        uint256 netRevenue = totalGross - totalDeduction;

        // Thực hiện lệnh pull transfer
        require(usdtToken.transfer(msg.sender, netRevenue), "USDT transfer failed");
        
        // Admin sẽ gọi hàm rút gộp quỹ Platform Fee sau từ ví Admin (mở rộng về sau)
    }

    // --- HELPER & CONFIG ---

    // Hàm View cho Frontend check 1 lúc nhiều vé
    function getBatchTicketStatus(uint256[] calldata tokenIds) external view returns (bool[] memory) {
        bool[] memory statuses = new bool[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!_exists(tokenIds[i])) {
                statuses[i] = false; // Coi như chưa dùng (hoặc không tồn tại)
            } else {
                statuses[i] = ticketUsed[tokenIds[i]];
            }
        }
        return statuses;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string calldata baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseURI;
    }
    
    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    // --- PAUSE & UNPAUSE CONTROLS ---
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- BẮT BUỘC OVERRIDE CHO ACCESSCONTROL VÀ ERC721A ---
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721A, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}