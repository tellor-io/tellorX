// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Token.sol";

contract TestToken is Token {
    event Received(address, uint256);

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function mint(address _to, uint256 _amount) external {
        _doMint(_to, _amount);
    }
}
