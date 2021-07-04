// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./tellor3/TellorStorage.sol";
import "./TellorVars.sol";
import "./interfaces/IOracle.sol";

contract Transition is TellorStorage,TellorVars{

     //links to the Oracle contract.  Allows parties (like Liquity) to continue to use the master address to acess values.
        //all parties should be reading values through this address
    
    function init(address _governance, address _oracle, address _treasury) external{
        //run this once migrated over.  This changes the underlying storage
        require(msg.sender == addresses[_OWNER]);
        require(addresses[_GOVERNANCE_CONTRACT] == address(0), "Only good once");
        uints[_STAKE_AMOUNT] = 100;
        addresses[_GOVERNANCE_CONTRACT] = _governance;
        addresses[_ORACLE_CONTRACT] = _oracle;
        addresses[_TREASURY_CONTRACT] = _treasury;
    }


    function getLastNewValueById(uint256 _requestId)
        external
        view
        returns (uint256, bool)
    {
        uint256 _timeCount =IOracle(addresses[_ORACLE_CONTRACT]).getTimestampCountByID(_requestId);
        if (_timeCount != 0) {
            return (
                retrieveData(
                    _requestId,
                    IOracle(addresses[_ORACLE_CONTRACT]).getReportTimestampByIndex(_requestId,_timeCount- 1)
                ),
                true
            );
        } else {
            return (0, false);
        }
    }

    /**
     * @dev Counts the number of values that have been submitted for the request
     * if called for the currentRequest being mined it can tell you how many miners have submitted a value for that
     * request so far
     * @param _requestId the requestId to look up
     * @return uint count of the number of values received for the requestId
     */
    function getNewValueCountbyRequestId(uint256 _requestId)
        external
        view
        returns (uint256)
    {
        return IOracle(addresses[_ORACLE_CONTRACT]).getTimestampCountByID(_requestId);
    }

    /**
     * @dev Retrieve value from oracle based on timestamp
     * @param _requestId being requested
     * @param _timestamp to retrieve data/value from
     * @return value for timestamp submitted
     */
    function retrieveData(uint256 _requestId, uint256 _timestamp)
        public
        view
        returns (uint256)
    {
        return _sliceUint(IOracle(addresses[_ORACLE_CONTRACT]).getValueByTimestamp(_requestId, _timestamp),0);
    }

    //Getters
    /**
     * @dev Allows users to access the number of decimals
     */
    function decimals() external pure returns (uint8) {
        return 18;
    }
    
    /**
     * @dev allows Tellor to read data from the addressVars mapping
     * @param _data is the keccak256("variable_name") of the variable that is being accessed.
     * These are examples of how the variables are saved within other functions:
     * addressVars[keccak256("_owner")]
     * addressVars[keccak256("tellorContract")]
     * @return address of the requested variable
     */
    function getAddressVars(bytes32 _data) external view returns (address) {
        return addresses[_data];
    }

    /**
     * @dev Getter for the variables saved under the TellorStorageStruct uints variable
     * @param _data the variable to pull from the mapping. _data = keccak256("variable_name")
     * where variable_name is the variables/strings used to save the data in the mapping.
     * The variables names in the TellorVariables contract
     * @return uint of specified variable
     */
    function getUintVar(bytes32 _data) external view returns (uint256) {
        return uints[_data];
    }

    /**
     * @dev Allows users to access the token's name
     */
    function name() external pure returns (string memory) {
        return "Tellor Tributes";
    }

    /**
     * @dev Allows users to access the token's symbol
     */
    function symbol() external pure returns (string memory) {
        return "TRB";
    }
    
    /**
     * @dev Getter for the total_supply of oracle tokens
     * @return uint total supply
     */
    function totalSupply() external view returns (uint256) {
        return uints[_TOTAL_SUPPLY];
    }
    
    /**
     * @dev This allows Tellor X to fallback to the old Tellor if there are current open disputes (or disputes on old Tellor values)
     */
    fallback() external {
        address addr = 0xdDB59729045d2292eeb8Ff96c46B8db53B88Daa2;//hardcode this in?
        bytes4 _function = bytes4(msg.data[0]);
        require(_function == bytes4(keccak256("beginDispute(uint256)"))||
        _function == bytes4(keccak256("vote(uint256)")) ||
        _function == bytes4(keccak256("tallyVotes(uint256)")) ||
        _function == bytes4(keccak256("unlockDisputeFee(uint256)"))); //should autolock out after a week (no disputes can begin past a week)
            (bool result, ) =  addr.delegatecall(msg.data);
            assembly {
                returndatacopy(0, 0, returndatasize())
                switch result
                    // delegatecall returns 0 on error.
                    case 0 {
                        revert(0, returndatasize())
                    }
                    default {
                        return(0, returndatasize())
                    }
           }
    }

    //Internal    
    function _sliceUint(bytes memory bs, uint start) internal pure returns (uint256 _x){
        require(bs.length >= start + 32, "slicing out of range");
        assembly {
            _x := mload(add(bs, add(0x20, start)))
        }
    }
}