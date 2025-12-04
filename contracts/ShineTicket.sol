// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ShineTicket is ERC721A, Ownable {
    // --- KHAI BÁO BIẾN TRẠNG THÁI ---
    mapping(uint256 => bool) public ticketUsed;
    string private _baseTokenURI;

    // --- SỰ KIỆN ---
    // Sửa lại event để hỗ trợ batch (tiết kiệm gas log)
    event TicketsCheckedIn(uint256[] tokenIds, uint256 timestamp);
    
    // --- KHỞI TẠO ---
    constructor(address initialOwner) 
        ERC721A("ShineTicket", "SHINE") 
        Ownable(initialOwner) 
    {}

    // --- TÍNH NĂNG 1: MINT BATCH (WORKER GỌI) ---
    function mintBatchUsers(address[] calldata recipients, uint256[] calldata quantities) external onlyOwner {
        require(recipients.length == quantities.length, "Data mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _safeMint(recipients[i], quantities[i]);
        }
    }

    // --- TÍNH NĂNG 2: MINT THỦ CÔNG (ADMIN GỌI) ---
    function mintTicket(address to, uint256 quantity) external onlyOwner {
        _safeMint(to, quantity);
    }

    // --- TÍNH NĂNG 3: BATCH CHECK-IN (QUAN TRỌNG) ---
    
    /**
     * @dev NÂNG CẤP: Cho phép Worker đồng bộ trạng thái nhiều vé cùng lúc.
     * Ví dụ: Worker gom 50 vé đã soát ở cổng, gọi hàm này 1 lần duy nhất.
     */
    function batchCheckIn(uint256[] calldata tokenIds) external onlyOwner {
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
    function checkIn(uint256 tokenId) external onlyOwner {
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
    ) internal virtual override {
        // Cho phép mint (from == 0) và burn (to == 0)
        if (from != address(0) && to != address(0)) {
            // Kiểm tra từng token trong batch chuyển đi
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
    function revokeTicket(uint256 tokenId) external onlyOwner {
        _burn(tokenId); 
        // Hàm _burn có sẵn trong ERC721A nhưng là internal
        // Ta bọc nó lại để chỉ Admin gọi được.
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

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }
}