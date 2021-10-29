// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Governance.sol";

contract TestGovernance is Governance {
    event Received(address, uint256);

    constructor(address t)  {
        // For this to work need to manually remove the `constant` keyword from the TellorVars contract.
        TELLOR_ADDRESS = t;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    //allows the contract to recieve funds for gas via harhdat-impersonate account
    fallback() external payable {
        emit Received(msg.sender, msg.value);
    }
}
