// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./interfaces/IController.sol";
import "./TellorVars.sol";
import "hardhat/console.sol";

/**
 @author Tellor Inc.
 @title Oracle
 @dev This is the Oracle contract which defines the functionality for the Tellor
 * oracle, where reporters submit values on chain and users can retrieve values.
*/
contract Oracle is TellorVars{
    // Storage
    uint256[] public timestamps; // array of timestamps from reported values
    mapping(bytes32 => uint256) public tips; // mapping of data IDs to the amount of TRB they are tipped
    uint256 public tipsInContract; // number of tips within the contract
    uint256 public timeOfLastNewValue = block.timestamp; // time of the last new value, originally set to the block timestamp
    uint256 public miningLock = 12 hours; // amount of time before a reporter is able to submit a value again
    uint256 public timeBasedReward = 5e17; // time based reward for a repoter for successfully submitting a value
    mapping(bytes32 => Report) reports; // mapping of data IDs to a report
    mapping(address => uint256) reporterLastTimestamp; // mapping of reporter addresses to the timestamp of their last reported value
    mapping(address => uint256) reportsSubmittedByAddress; // mapping of reporter addresses to the number of reports they've submitted
    mapping(address => uint256) tipsByUser; // mapping of a user to the amount of tips they've paid

    // Structs
    struct Report {
        uint256[] timestamps; // array of all newValueTimestamps requested
        mapping(uint256 => uint256) timestampIndex; // mapping of indices to respective timestamps
        mapping(uint256 => uint256) timestampToBlockNum; // mapping described by [apiId][minedTimestamp]=>block.number
        mapping(uint256 => bytes) valueByTimestamp; // mapping of timestamps to values
        mapping(uint256 => address) reporterByTimestamp; // mapping of timestamps to reporters
    }

    // Events
    event TipAdded(address _user, bytes32 _id,uint256 _tip, uint256 _totalTip);
    event NewReport(bytes32 _id, uint256 _time, bytes _value, uint256 _reward);
    event MiningLockChanged(uint _newMiningLock);
    event TimeBasedRewardsChanged(uint _newTimeBasedReward);

    /**
     * @dev Adds tips to incentivize reporters to submit values for specific data IDs.
     * @param _id is ID of the specific data feed
     * @param _tip is the amount to tip the given data ID
    */
    function addTip(bytes32 _id, uint256 _tip) external{
        // Require tip to be greater than 1 and be paid
        require(_tip > 1, "Tip should be greater than 1");
        require(IController(TELLOR_ADDRESS).approveAndTransferFrom(msg.sender,address(this),_tip), "tip must be paid");
        // Burn half the tip
        _tip = _tip/2;
        IController(TELLOR_ADDRESS).burn(_tip);
        // Update total tip amount for user, data ID, and in total contract
        tips[_id] += _tip;
        tipsByUser[msg.sender] += _tip;
        tipsInContract += _tip;
        emit TipAdded(msg.sender, _id, _tip, tips[_id]);
    }

    /**
     * @dev Changes mining lock for reporters.
     * Note: this function is only callable by the Governance contract.
     * @param _newMiningLock is the new mining lock.
    */
    function changeMiningLock(uint256 _newMiningLock) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT), "Only governance contract can change mining lock.");
        miningLock = _newMiningLock;
        emit MiningLockChanged(_newMiningLock);
    }

    /**
     * @dev Changes time based reward for reporters.
     * Note: this function is only callable by the Governance contract.
     * @param _newTimeBasedReward is the new time based reward.
    */
    function changeTimeBasedReward(uint256 _newTimeBasedReward) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT), "Only governance contract can change time based reward.");
        timeBasedReward = _newTimeBasedReward;
        emit TimeBasedRewardsChanged(_newTimeBasedReward);
    }

    /**
     * @dev Removes a value from the oracle.
     * Note: this function is only callable by the Governance contract.
     * @param _id is ID of the specific data feed
     * @param _timestamp is the timestamp of the data value to remove
    */
    function removeValue(bytes32 _id, uint256 _timestamp) external {
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT), "caller must be the governance contract");
        Report storage rep = reports[_id];
        uint256 _index = rep.timestampIndex[_timestamp];
        // Shift all timestamps back to reflect deletion of value
        for (uint256 i = _index; i < rep.timestamps.length-1; i++){
            rep.timestamps[i] = rep.timestamps[i+1];
        }
        // Delete and reset timestamp and value
        delete rep.timestamps[rep.timestamps.length-1];
        rep.timestamps.pop();
        rep.valueByTimestamp[_timestamp] = "";
    }

    /**
     * @dev Allows a reporter to submit a value to the oracle
     * @param _id is ID of the specific data feed
     * @param _value is the value the user submits to the oracle
    */
    function submitValue(bytes32 _id, bytes calldata _value) external{
        // Require reporter to abide by given mining lock
        require(
            block.timestamp - reporterLastTimestamp[msg.sender]  > miningLock,
            "still in reporter time lock, please wait!"
        );
        reporterLastTimestamp[msg.sender] = block.timestamp;
        IController _tellor = IController(TELLOR_ADDRESS);
        // Checks that reporter is not already staking TRB
        (uint256 _status,) = _tellor.getStakerInfo(msg.sender);
        require(_status == 1, "Reporter status is not staker");
        // Check is in case the stake amount increases
        require(_tellor.balanceOf(msg.sender) >= _tellor.uints(_STAKE_AMOUNT), "balance must be greater than stake amount");
        // Checks for no double reporting of timestamps
        Report storage rep = reports[_id];
        require(rep.reporterByTimestamp[block.timestamp] == address(0), "timestamp already reported for");
        // Update number of timestamps, value for given timestamp, and reporter for timestamp
        rep.timestampIndex[block.timestamp] = rep.timestamps.length;
        rep.timestamps.push(block.timestamp);
        rep.timestampToBlockNum[block.timestamp] = block.number;
        rep.valueByTimestamp[block.timestamp] = _value;
        rep.reporterByTimestamp[block.timestamp] = msg.sender;
        // Calculate total reward for reporter
        uint256 _timeDiff = block.timestamp - timeOfLastNewValue;
        uint256 _tip = tips[_id];
        uint256 _reward = (_timeDiff * timeBasedReward) / 300; //.5 TRB per 5 minutes (should we make this upgradeable)
        if(_tellor.balanceOf(address(this)) < _reward + tipsInContract){
            _reward = _tellor.balanceOf(address(this)) - tipsInContract;
        }
         // Send tips + timeBasedReward to reporter of value, and reset tips for ID
        tipsInContract -= _tip;
        if(_reward + _tip > 0){
            _tellor.transfer(msg.sender,_reward + _tip);
        }
        tips[_id] = 0;
        // Update last oracle value and number of values submitted by a reporter
        timeOfLastNewValue = block.timestamp;
        reportsSubmittedByAddress[msg.sender]++;
        emit NewReport(_id, block.timestamp, _value,_tip + _reward);
    }

    //Getters
    /**
     * @dev Returns the block number at a given timestamp
     * @param _id is ID of the specific data feed
     * @param _timestamp is the timestamp to find the corresponding block number for
     * @return uint256 of the block number of the timestamp for the given data ID
     */
    function getBlockNumberByTimestamp(bytes32 _id, uint256 _timestamp) external view returns(uint256){
        return reports[_id].timestampToBlockNum[_timestamp];
    }

    function getMiningLock() external view returns(uint256){
        return miningLock;
    }
    
    /**
     * @dev Returns the address of the reporter who submitted a value for a data ID at a specific time
     * @param _id is ID of the specific data feed
     * @param _timestamp is the timestamp to find a corresponding reporter for
     * @return address of the reporter who reported the value for the data ID at the given timestamp
     */
    function getReporterByTimestamp(bytes32 _id, uint256 _timestamp) external view returns(address){
        return reports[_id].reporterByTimestamp[_timestamp];
    }

    /**
     * @dev Returns the number of values submitted by a specific reporter address
     * @param _reporter is the address of a reporter
     * @return uint256 of the number of values submitted by the given reporter
     */
    function getReportsSubmittedByAddress(address _reporter) external view returns(uint256){
        return reportsSubmittedByAddress[_reporter];
    }

    /**
     * @dev Returns the number of timestamps/reports for a specific data ID
     * @param _id is ID of the specific data feed
     * @return uint256 of the number of the timestamps/reports for the inputted data ID
     */
    function getTimestampCountById(bytes32 _id) external view returns(uint256){
        return reports[_id].timestamps.length;
    }   

    /**
     * @dev Returns the timestamp of a reported value given a data ID and timestamp index
     * @param _id is ID of the specific data feed
     * @param _index is the index of the timestamp
     * @return uint256 of timestamp of the last oracle value
     */
    function getReportTimestampByIndex(bytes32 _id, uint256 _index) external view returns(uint256){
        return reports[_id].timestamps[_index];
    }

    /**
     * @dev Returns the timestamp for the last value of any ID from the oracle
     * @return uint256 of timestamp of the last oracle value
     */
    function getTimeOfLastNewValue() external view returns(uint256){
        return timeOfLastNewValue;
    }

    /**
     * @dev Returns the index of a reporter timestamp in the timestamp array for a specific data ID
     * @param _id is ID of the specific data feed
     * @param _timestamp is the timestamp to find in the timestamps array
     * @return uint256 of the index of the reporter timestamp in the array for specific ID
     */
    function getTimestampIndexByTimestamp(bytes32 _id, uint256 _timestamp) external view returns(uint256){
        return reports[_id].timestampIndex[_timestamp];
    }

    /**
     * @dev Returns the number of tips made for a specific data feed ID
     * @param _id is ID of the specific data feed
     * @return uint256 of the number of tips made for the specific ID
     */
    function getTipsById(bytes32 _id) external view returns(uint256){
        return tips[_id];
    }

    /**
     * @dev Returns the number of tips made by a user
     * @param _user is the address of the user
     * @return uint256 of the number of tips made by the user
     */
    function getTipsByUser(address _user) external view returns(uint256){
        return tipsByUser[_user];
    }

    /**
     * @dev Returns the value of a data feed given a specific ID and timestamp
     * @param _id is the ID of the specific data feed
     * @param _timestamp is the timestamp to look for data
     * @return bytes memory of the value of data at the associated timestamp
     */
    function getValueByTimestamp(bytes32 _id, uint256 _timestamp) external view returns(bytes memory){
        return reports[_id].valueByTimestamp[_timestamp];
    }

    /**
     * @dev Returns the current value of a data feed given a specific ID
     * @param _id is the ID of the specific data feed
     * @return bytes memory of the current value of data
     */
    function getCurrentValue(bytes32 _id) external view returns(bytes memory){
         return reports[_id].valueByTimestamp[reports[_id].timestamps[reports[_id].timestamps.length-1]];
    }

    /**
     * @dev Used during the upgrade process to verify valid Tellor Contracts
    */
    function verify() external pure returns(uint){
        return 9999;
    }
}