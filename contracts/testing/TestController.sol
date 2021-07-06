// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Controller.sol";
contract TestController is Controller{
    event Received(address, uint);
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function changeAddressVar(bytes32 _id, address _addy) external {
        addresses[_id] = _addy;
    }
}
