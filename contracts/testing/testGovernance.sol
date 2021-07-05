// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Governance.sol";

contract TestGovernance is Governance{
    receive() external payable;//allows the contract to recieve funds for gas via harhdat-impersonate account
}