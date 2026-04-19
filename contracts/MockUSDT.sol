// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock Tether", "USDT") {
        _mint(msg.sender, 1000000 * 10 ** decimals()); // Mint 1M USDT cho người deploy
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}