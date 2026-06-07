// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Interface phụ trợ để lấy thêm status vé nếu cần
interface IShineTicket is IERC721 {
    function ticketUsed(uint256 tokenId) external view returns (bool);
}

contract ShineMarketplace is ReentrancyGuard, Ownable {
    IShineTicket public immutable shineTicket;
    IERC20 public immutable usdtToken;
    
    address public adminTreasury;
    uint256 public platformFeeBps; // VD: 500 = 5%

    // Struct lưu thông tin Listing
    struct Listing {
        address seller;       // Địa chỉ ví Privy của người bán
        uint256 price;        // Giá (wei USDT)
        address fundReceiver; // Địa chỉ (MetaMask/Binance) nhận tiền
    }

    // Mapping tokenId => dữ liệu Listing
    mapping(uint256 => Listing) public listings;

    // Các sự kiện Tracking
    event TicketListed(uint256 indexed tokenId, address indexed seller, uint256 price, address fundReceiver);
    event TicketCanceled(uint256 indexed tokenId, address indexed seller);
    event TicketSold(uint256 indexed tokenId, address indexed buyerPrivy, uint256 price, address fundReceiver);

    constructor(
        address _shineTicket, 
        address _usdtToken, 
        address _adminTreasury, 
        uint256 _platformFeeBps
    ) Ownable(msg.sender) {
        require(_shineTicket != address(0), "Invalid NFT address");
        require(_usdtToken != address(0), "Invalid USDT address");
        require(_adminTreasury != address(0), "Invalid admin address");
        require(_platformFeeBps <= 2000, "Fee too high max 20%");

        shineTicket = IShineTicket(_shineTicket);
        usdtToken = IERC20(_usdtToken);
        adminTreasury = _adminTreasury;
        platformFeeBps = _platformFeeBps;
    }

    // Settings
    function setPlatformFee(uint256 _platformFeeBps) external onlyOwner {
        require(_platformFeeBps <= 2000, "Fee too high");
        platformFeeBps = _platformFeeBps;
    }

    function setAdminTreasury(address _adminTreasury) external onlyOwner {
        require(_adminTreasury != address(0), "Invalid admin address");
        adminTreasury = _adminTreasury;
    }

    // 1. Rao bán vé
    function listTicket(uint256 tokenId, uint256 price, address fundReceiver) external {
        require(shineTicket.ownerOf(tokenId) == msg.sender, "Not the ticket owner");
        require(!shineTicket.ticketUsed(tokenId), "Ticket already checked-in");
        require(price > 0, "Price must be > 0");
        require(fundReceiver != address(0), "Invalid fund receiver");

        // Yêu cầu user đã gọi 'approve' hoặc 'setApprovalForAll' trên SC ShineTicket
        require(
            shineTicket.getApproved(tokenId) == address(this) || 
            shineTicket.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to transfer this ticket"
        );

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            fundReceiver: fundReceiver
        });

        emit TicketListed(tokenId, msg.sender, price, fundReceiver);
    }

    // 1.1 Rao bán nhiều vé (Batch List)
    function batchListTickets(
        uint256[] calldata tokenIds,
        uint256[] calldata prices,
        address fundReceiver
    ) external {
        require(tokenIds.length == prices.length, "Array lengths mismatch");
        require(tokenIds.length > 0, "Empty arrays");
        require(fundReceiver != address(0), "Invalid fund receiver");

        bool isApprovedAll = shineTicket.isApprovedForAll(msg.sender, address(this));

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 price = prices[i];

            require(shineTicket.ownerOf(tokenId) == msg.sender, "Not the ticket owner");
            require(!shineTicket.ticketUsed(tokenId), "Ticket already checked-in");
            require(price > 0, "Price must be > 0");

            require(
                isApprovedAll || shineTicket.getApproved(tokenId) == address(this),
                "Marketplace not approved to transfer this ticket"
            );

            listings[tokenId] = Listing({
                seller: msg.sender,
                price: price,
                fundReceiver: fundReceiver
            });

            emit TicketListed(tokenId, msg.sender, price, fundReceiver);
        }
    }

    // 2. Hủy rao bán
    function cancelListing(uint256 tokenId) external {
        Listing memory listing = listings[tokenId];
        require(listing.seller == msg.sender, "Not the seller");
        
        delete listings[tokenId];
        
        emit TicketCanceled(tokenId, msg.sender);
    }

    // 2.1 Hủy rao bán nhiều vé (Batch Cancel)
    function batchCancelListings(uint256[] calldata tokenIds) external {
        require(tokenIds.length > 0, "Empty array");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            Listing memory listing = listings[tokenId];
            require(listing.seller == msg.sender, "Not the seller");
            
            delete listings[tokenId];
            
            emit TicketCanceled(tokenId, msg.sender);
        }
    }

    // 3. Mua vé
    function buyTicketFor(uint256 tokenId, address destinationPrivyAddress) external nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "Ticket is not listed");
        require(destinationPrivyAddress != address(0), "Invalid destination address");
        
        // Seller vẫn phải đang giữ vé (ngăn tình trạng list xong đem đi chuyển ví khác)
        require(shineTicket.ownerOf(tokenId) == listing.seller, "Seller no longer owns this ticket");

        // Tính toán phí
        uint256 platformFee = (listing.price * platformFeeBps) / 10000;
        uint256 sellerAmount = listing.price - platformFee;

        // Xóa listing trước để chống Reentrancy Attack
        delete listings[tokenId];

        // Rút USDT từ msg.sender. Cần đảm bảo msg.sender (ví mua) đã 'approve' USDT cho ShineMarketplace
        require(usdtToken.transferFrom(msg.sender, adminTreasury, platformFee), "USDT fee transfer failed");
        require(usdtToken.transferFrom(msg.sender, listing.fundReceiver, sellerAmount), "USDT seller transfer failed");

        // Chuyển NFT từ Seller -> Buyer
        // Lưu ý: ShineTicket phải được grantMARKETPLACE_ROLE(địa_chỉ_contract_này) để qua được check walled-garden
        shineTicket.transferFrom(listing.seller, destinationPrivyAddress, tokenId);

        emit TicketSold(tokenId, destinationPrivyAddress, listing.price, listing.fundReceiver);
    }

    // 3.1 Mua nhiều vé (Batch Buy)
    function batchBuyTicketsFor(
        uint256[] calldata tokenIds, 
        address destinationPrivyAddress
    ) external nonReentrant {
        require(tokenIds.length > 0, "Empty array");
        require(destinationPrivyAddress != address(0), "Invalid destination address");
        
        uint256 totalPrice = 0;
        
        // Pass 1: Tính tổng tiền và kiểm tra tính hợp lệ
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            Listing memory listing = listings[tokenId];
            require(listing.price > 0, "Ticket is not listed");
            require(shineTicket.ownerOf(tokenId) == listing.seller, "Seller no longer owns this ticket");
            totalPrice += listing.price;
        }

        // Rút tổng tiền USDT từ người mua về SC (Tiết kiệm gas thay vì transferFrom liên tục)
        require(usdtToken.transferFrom(msg.sender, address(this), totalPrice), "USDT total transfer failed");

        uint256 totalPlatformFee = 0;

        // Pass 2: Chia tiền và gửi NFT
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            Listing memory listing = listings[tokenId];
            
            uint256 platformFee = (listing.price * platformFeeBps) / 10000;
            uint256 sellerAmount = listing.price - platformFee;
            totalPlatformFee += platformFee;
            
            delete listings[tokenId];
            
            require(usdtToken.transfer(listing.fundReceiver, sellerAmount), "USDT seller transfer failed");
            
            shineTicket.transferFrom(listing.seller, destinationPrivyAddress, tokenId);
            
            emit TicketSold(tokenId, destinationPrivyAddress, listing.price, listing.fundReceiver);
        }
        
        if (totalPlatformFee > 0) {
            require(usdtToken.transfer(adminTreasury, totalPlatformFee), "USDT admin fee transfer failed");
        }
    }
}
