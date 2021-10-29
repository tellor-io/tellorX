
// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../Oracle.sol";

contract TestOracle is Oracle {
    constructor(address t)  {
        // For this to work need to manually remove the `constant` keyword from the TellorVars contract.
        TELLOR_ADDRESS = t;
    }
}



