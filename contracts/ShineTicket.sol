// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Import thư viện ERC721A để tối ưu gas khi mint số lượng lớn
// Đảm bảo bạn đã chạy: npm install erc721a @openzeppelin/contracts
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ShineTicket is ERC721A, Ownable {
    // --- KHAI BÁO BIẾN TRẠNG THÁI ---

    // Mapping lưu trạng thái Check-in của từng vé (TokenID => Đã dùng chưa?)
    mapping(uint256 => bool) public ticketUsed;

    // Base URI cho Metadata (Link folder chứa file JSON trên IPFS hoặc API Backend)
    string private _baseTokenURI;

    // --- SỰ KIỆN (EVENTS) ---
    // Event bắn ra khi vé được check-in thành công
    event TicketUsed(uint256 indexed tokenId, address checkInBy, uint256 timestamp);
    // Event bắn ra khi mint lẻ hoặc mint số lượng lớn cho 1 người (Admin mint thủ công)
    event BatchMinted(address indexed to, uint256 quantity, uint256 startTokenId);

    // --- KHỞI TẠO ---
    constructor(address initialOwner) 
        ERC721A("ShineTicket", "SHINE") 
        Ownable(initialOwner) 
    {}

    // --- TÍNH NĂNG 1: MINT BATCH (GOM ĐƠN NHIỀU NGƯỜI) ---
    
    /**
     * @dev CORE FEATURE: Hàm này dùng cho Worker gom đơn hàng từ Queue.
     * Ví dụ: 
     * - User A mua 1 vé
     * - User B mua 2 vé
     * => recipients = [AddrA, AddrB], quantities = [1, 2]
     * => Kết quả: A nhận ID 1, B nhận ID 2 và 3.
     */
    function mintBatchUsers(address[] calldata recipients, uint256[] calldata quantities) external onlyOwner {
        // Kiểm tra dữ liệu đầu vào có khớp nhau không
        require(recipients.length == quantities.length, "Data mismatch");

        // Vòng lặp mint cho từng người
        // ERC721A tối ưu gas nên việc gọi _safeMint trong vòng lặp vẫn rẻ hơn ERC721 thường
        for (uint256 i = 0; i < recipients.length; i++) {
            _safeMint(recipients[i], quantities[i]);
        }
    }

    // --- TÍNH NĂNG 2: MINT THỦ CÔNG / SPONSOR (BACKUP) ---
    
    /**
     * @dev BACKUP FEATURE: Dùng khi Admin muốn tặng vé mời hoặc xử lý sự cố.
     * Mint số lượng lớn vào TRỰC TIẾP 1 ví duy nhất.
     */
    function mintTicket(address to, uint256 quantity) external onlyOwner {
        uint256 startId = _nextTokenId();
        _safeMint(to, quantity);
        
        emit BatchMinted(to, quantity, startId);
    }

    // --- TÍNH NĂNG 3: CHECK-IN (SOÁT VÉ) ---

    /**
     * @dev Hàm check-in vé. Chỉ Admin/Worker mới gọi được.
     * Logic: Quét QR -> Worker gọi hàm này -> Đổi trạng thái vé trên Blockchain.
     */
    function checkIn(uint256 tokenId) external onlyOwner {
        // 1. Kiểm tra vé có tồn tại không
        require(_exists(tokenId), "Ticket does not exist");
        
        // 2. Kiểm tra vé đã dùng chưa
        require(!ticketUsed[tokenId], "Ticket already used");

        // 3. Đánh dấu đã dùng
        ticketUsed[tokenId] = true;

        emit TicketUsed(tokenId, msg.sender, block.timestamp);
    }

    /**
     * @dev Hàm kiểm tra trạng thái vé (cho App/Frontend gọi view để hiển thị màu vé)
     */
    function isTicketUsed(uint256 tokenId) external view returns (bool) {
        require(_exists(tokenId), "Ticket does not exist");
        return ticketUsed[tokenId];
    }

    // --- CẤU HÌNH HỆ THỐNG ---

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    // Worker sẽ gọi hàm này để cập nhật link API Metadata
    // Ví dụ: setBaseURI("https://api.shineticket.com/metadata/")
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    // Config: Vé bắt đầu từ số 1 (thay vì số 0) để đẹp đội hình
    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }
}