// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Controller.sol";
import "hardhat/console.sol";

contract TestController is Controller {
    event Received(address, uint);

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function changeAddressVar(bytes32 _id, address _addy) external {
        addresses[_id] = _addy;
    }

    function sliceUintTest(bytes memory bs) external pure returns (uint256) {
        return _sliceUint(bs);
    }
}
