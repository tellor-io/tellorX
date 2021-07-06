// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Token.sol";
contract TestToken is Token{
    event Received(address, uint);
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
    //allows the contract to recieve funds for gas via harhdat-impersonate account
    fallback() external payable{
        emit Received(msg.sender, msg.value);
    }

    function mint(address _to, uint _amount) external {
        _doMint(_to, _amount);
    }
}
