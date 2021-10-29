
// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Treasury.sol";

contract TestTreasury is Treasury {
    constructor(address t)  {
        // For this to work need to manually remove the `constant` keyword from the TellorVars contract.
        TELLOR_ADDRESS = t;
    }
}



